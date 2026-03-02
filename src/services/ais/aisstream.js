// AISStream.io WebSocket provider -- real-time AIS data streaming
// Free tier: WebSocket push, up to 50 MMSI filter
// BIHAR SENTINEL

const WebSocket = require('ws');
const EventEmitter = require('events');

class AISStreamProvider extends EventEmitter {
  constructor() {
    super();
    this.name = 'AISStream';
    this.apiKey = process.env.AISSTREAM_API_KEY;
    this.wsUrl = 'wss://stream.aisstream.io/v0/stream';
    this.ws = null;
    this.mmsiList = [];
    this.imoToMmsi = {};
    this.mmsiToImo = {};
    this.connected = false;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 60000;
    this.reconnectAttempts = 0;
    this.lastMessageTime = null;
    this.messageCount = 0;
    this._reconnectTimer = null;
    this._healthTimer = null;
  }

  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  /**
   * Set the vessel fleet to track.
   * @param {Array} vessels - Array of { imo, mmsi, name } objects
   */
  setFleet(vessels) {
    this.mmsiList = [];
    this.imoToMmsi = {};
    this.mmsiToImo = {};

    for (const v of vessels) {
      if (v.mmsi) {
        this.mmsiList.push(String(v.mmsi));
        this.imoToMmsi[v.imo] = String(v.mmsi);
        this.mmsiToImo[String(v.mmsi)] = v.imo;
      }
    }
    console.log('[AISStream] Fleet set: ' + this.mmsiList.length + ' vessels with MMSI');
  }

  /**
   * Connect to AISStream WebSocket and start receiving position data.
   */
  connect() {
    if (!this.isConfigured()) {
      console.error('[AISStream] No API key configured');
      return;
    }
    if (this.mmsiList.length === 0) {
      console.error('[AISStream] No vessels configured -- call setFleet() first');
      return;
    }

    this._connect();

    // Health check: reconnect if no messages for 5 minutes
    this._healthTimer = setInterval(() => {
      if (this.lastMessageTime && Date.now() - this.lastMessageTime > 5 * 60 * 1000) {
        console.warn('[AISStream] No messages for 5 min, reconnecting...');
        this._reconnect();
      }
    }, 60000);
  }

  _connect() {
    if (this.ws) {
      try { this.ws.terminate(); } catch (e) {}
    }

    console.log('[AISStream] Connecting to ' + this.wsUrl + '...');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
      console.log('[AISStream] Connected -- subscribing to ' + this.mmsiList.length + ' vessels');

      // Send subscription message
      // APIkey (capital API, lowercase key) per official JS example
      // BoundingBoxes: global coverage, MMSI filter narrows to our fleet
      const subscription = {
        APIkey: this.apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: this.mmsiList,
        FilterMessageTypes: ['PositionReport', 'ShipStaticData']
      };
      this.ws.send(JSON.stringify(subscription));
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleMessage(msg);
      } catch (err) {
        console.error('[AISStream] Parse error:', err.message);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[AISStream] WebSocket error:', err.message);
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      var reasonStr = reason ? reason.toString() : '';
      console.log('[AISStream] Disconnected (code: ' + code + ', reason: ' + reasonStr + ')');
      this._scheduleReconnect();
    });
  }

  _handleMessage(msg) {
    this.lastMessageTime = Date.now();
    this.messageCount++;

    var type = msg.MessageType;
    var meta = msg.MetaData || {};
    var mmsi = String(meta.MMSI || '');
    var imo = this.mmsiToImo[mmsi];

    if (!imo) {
      // Message for a vessel not in our fleet -- skip
      return;
    }

    if (type === 'PositionReport' || type === 'StandardClassBCSPositionReport') {
      var report = msg.Message && (msg.Message.PositionReport || msg.Message.StandardClassBCSPositionReport);
      if (!report) return;

      var position = {
        imo: imo,
        mmsi: mmsi,
        lat: meta.latitude != null ? meta.latitude : (report.Latitude || null),
        lon: meta.longitude != null ? meta.longitude : (report.Longitude || null),
        sog: report.Sog != null ? report.Sog : 0,
        cog: report.Cog != null ? report.Cog : 0,
        heading: report.TrueHeading != null && report.TrueHeading !== 511 ? report.TrueHeading : null,
        navStatus: this._navStatusText(report.NavigationalStatus),
        rateOfTurn: report.RateOfTurn != null ? report.RateOfTurn : null,
        aisTimestamp: meta.time_utc || new Date().toISOString(),
        source: 'aisstream',
        shipName: meta.ShipName || null
      };

      // Only emit if we have valid coordinates
      if (position.lat != null && position.lon != null &&
          Math.abs(position.lat) <= 90 && Math.abs(position.lon) <= 180) {
        this.emit('position', position);
      }
    } else if (type === 'ShipStaticData') {
      var staticData = msg.Message && msg.Message.ShipStaticData;
      if (!staticData) return;

      this.emit('static', {
        imo: imo,
        mmsi: mmsi,
        destination: staticData.Destination || null,
        eta: this._parseEta(staticData.Eta),
        draught: staticData.MaximumStaticDraught || null,
        shipName: staticData.Name || meta.ShipName || null,
        shipType: staticData.Type || null
      });
    }
  }

  _navStatusText(code) {
    var statuses = {
      0: 'Under way using engine',
      1: 'At anchor',
      2: 'Not under command',
      3: 'Restricted manoeuvrability',
      4: 'Constrained by her draught',
      5: 'Moored',
      6: 'Aground',
      7: 'Engaged in Fishing',
      8: 'Under way sailing',
      9: 'Reserved for HSC',
      10: 'Reserved for WIG',
      11: 'Power-driven vessel towing astern',
      12: 'Power-driven vessel pushing ahead',
      14: 'AIS-SART',
      15: 'Not defined'
    };
    return statuses[code] || null;
  }

  _parseEta(eta) {
    if (!eta) return null;
    // AIS ETA format: { Month, Day, Hour, Minute }
    if (typeof eta === 'object' && eta.Month != null) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var month = eta.Month > 0 && eta.Month <= 12 ? months[eta.Month - 1] : '???';
      var day = eta.Day || '??';
      var hour = String(eta.Hour || 0).padStart(2, '0');
      var minute = String(eta.Minute || 0).padStart(2, '0');
      return day + ' ' + month + ' ' + hour + ':' + minute;
    }
    return String(eta);
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this.reconnectAttempts++;
    var delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelay);
    console.log('[AISStream] Reconnecting in ' + Math.round(delay / 1000) + 's (attempt ' + this.reconnectAttempts + ')');
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, delay);
  }

  _reconnect() {
    if (this.ws) {
      try { this.ws.terminate(); } catch (e) {}
    }
    this._connect();
  }

  disconnect() {
    if (this._healthTimer) clearInterval(this._healthTimer);
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.connected = false;
  }

  getStatus() {
    return {
      connected: this.connected,
      lastMessage: this.lastMessageTime ? new Date(this.lastMessageTime).toISOString() : null,
      messageCount: this.messageCount,
      trackedVessels: this.mmsiList.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

module.exports = AISStreamProvider;
