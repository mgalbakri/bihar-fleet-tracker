// BIHAR SENTINEL WebSocket Client
// Auto-reconnecting WebSocket with typed message handlers

class SentinelWebSocket {
  constructor() {
    this.handlers = {};
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connected = false;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('[WS] Connection failed:', e.message);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      var wasDisconnected = this.reconnectDelay > 1000;
      console.log('[WS] Connected to BIHAR SENTINEL');
      this.connected = true;
      this.reconnectDelay = 1000;
      this._updateIndicator('connected');

      // After reconnection, refresh data to catch up on missed updates
      if (wasDisconnected && typeof refreshAllData === 'function') {
        console.log('[WS] Refreshing data after reconnection...');
        refreshAllData();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type && this.handlers[msg.type]) {
          this.handlers[msg.type](msg.payload, msg.timestamp);
        }
      } catch (e) {
        console.error('[WS] Parse error:', e.message);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._updateIndicator('disconnected');
      console.log('[WS] Disconnected. Reconnecting...');
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error');
      this._updateIndicator('error');
    };
  }

  on(type, handler) {
    this.handlers[type] = handler;
  }

  _scheduleReconnect() {
    setTimeout(() => {
      console.log(`[WS] Reconnecting (delay: ${this.reconnectDelay}ms)...`);
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  _updateIndicator(status) {
    const dot = document.querySelector('.live-dot');
    const label = document.querySelector('.live-indicator .live-mode');
    if (!dot) return;

    switch (status) {
      case 'connected':
        // Don't override the data-status-driven label (LIVE vs SIMULATION)
        // Just re-fetch data status which will set the correct label
        if (typeof fetchDataStatus === 'function') fetchDataStatus();
        break;
      case 'disconnected':
        dot.style.background = 'var(--red, #ef4444)';
        if (label) { label.textContent = 'OFFLINE'; label.style.color = 'var(--red, #ef4444)'; }
        break;
      case 'error':
        dot.style.background = 'var(--amber, #f59e0b)';
        if (label) { label.textContent = 'ERROR'; label.style.color = 'var(--amber, #f59e0b)'; }
        break;
    }
  }
}

// Global instance
window.sentinelWS = new SentinelWebSocket();
