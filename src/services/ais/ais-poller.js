// AIS Poller -- manages real-time vessel position tracking
// Supports: AISStream (WebSocket, free), Datalastic (REST, paid), Simulation (fallback)
// BIHAR SENTINEL

const cron = require('node-cron');
const path = require('path');
const config = require('../../../config/default');
const AISStreamProvider = require('./aisstream');
const DatalasticProvider = require('./datalastic');
const aisCache = require('./ais-cache');
const zoneTracker = require('./zone-tracker');
const gapDetector = require('./gap-detector');
const { getDestinationCoords } = require('./port-coords');

let db;
let wsService;
let vessels = [];
let isPolling = false;
let lastPollTime = null;
let simulationMode = false;
let lastSimulationTime = null;
let activeProvider = null; // 'aisstream', 'datalastic', or 'simulation'

const aisstream = new AISStreamProvider();
const datalastic = new DatalasticProvider();

// Vessel name lookup
const vesselNameMap = {};

// Throttle broadcast: buffer position updates and broadcast periodically
let broadcastTimer = null;
let pendingBroadcast = false;

function scheduleBroadcast() {
  if (broadcastTimer) return;
  pendingBroadcast = true;
  broadcastTimer = setTimeout(function() {
    broadcastTimer = null;
    if (pendingBroadcast) {
      pendingBroadcast = false;
      broadcastPositions();
    }
  }, 2000); // Batch broadcasts every 2 seconds
}

/**
 * Store a position update (from any source) into cache, DB, and zone tracker.
 */
function processPosition(pos) {
  if (!pos || !pos.lat || !pos.lon || !pos.imo) return;

  // Merge with existing cached data to preserve destination/eta from static messages
  var existing = aisCache.get(pos.imo);
  if (existing) {
    if (!pos.destination && existing.destination) pos.destination = existing.destination;
    if (!pos.eta && existing.eta) pos.eta = existing.eta;
    if (!pos.draught && existing.draught) pos.draught = existing.draught;
  }

  aisCache.set(pos.imo, pos);

  // Store in database
  if (db) {
    try {
      storePosition(pos);
    } catch (err) {
      // Ignore DB errors for individual positions
    }
  }

  // Zone tracking
  var vesselName = vesselNameMap[pos.imo] || pos.imo;
  var zoneResult = zoneTracker.processPosition(pos.imo, vesselName, pos.lat, pos.lon);

  // AIS gap detection
  gapDetector.recordSignal(pos.imo, vesselName, pos.lat, pos.lon,
    zoneResult ? zoneResult.inJWC : false, pos.aisTimestamp);

  // Schedule throttled broadcast
  scheduleBroadcast();
}

let _storeStmt = null;
function storePosition(pos) {
  if (!_storeStmt) {
    _storeStmt = db.prepare(
      'INSERT INTO vessel_positions (vessel_imo, lat, lon, sog, cog, heading, draught, nav_status, destination, eta, ais_timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
  }
  _storeStmt.run(
    pos.imo, pos.lat, pos.lon, pos.sog || 0, pos.cog || 0,
    pos.heading, pos.draught, pos.navStatus,
    pos.destination, pos.eta, pos.aisTimestamp, pos.source
  );
}

/**
 * Initialize AIS tracking. Chooses best available provider.
 */
function init(database, ws) {
  db = database;
  wsService = ws;

  // Initialize sub-services
  zoneTracker.init(database, ws);
  gapDetector.init(database, ws);

  // Load vessel fleet from registry
  var vesselsPath = path.join(__dirname, '..', '..', '..', 'config', 'vessels.json');
  vessels = require(vesselsPath);
  for (var v of vessels) {
    vesselNameMap[v.imo] = v.name;
  }

  // Choose provider: Datalastic (paid, satellite coverage) > AISStream (free, limited coverage) > Simulation
  // Datalastic is preferred because AISStream's terrestrial network has gaps in Arabian Gulf/Red Sea
  if (datalastic.isConfigured()) {
    initDatalastic();
  } else if (aisstream.isConfigured()) {
    initAISStream();
  } else {
    initSimulation();
  }
}

/**
 * AISStream mode: real-time WebSocket push (like FlightRadar24)
 */
function initAISStream() {
  activeProvider = 'aisstream';
  simulationMode = false;

  console.log('[AIS] AISStream API key found -- connecting for real-time tracking');

  // Load initial positions from vessels.json as starting point
  // These will be replaced as real AIS data arrives
  seedInitialPositions();

  // Set fleet and connect
  aisstream.setFleet(vessels);

  // Handle real-time position updates
  aisstream.on('position', function(pos) {
    processPosition(pos);
    lastPollTime = new Date().toISOString();
  });

  // Handle static data updates (destination, ETA, draught)
  aisstream.on('static', function(data) {
    var existing = aisCache.get(data.imo);
    if (existing) {
      if (data.destination) existing.destination = data.destination;
      if (data.eta) existing.eta = data.eta;
      if (data.draught) existing.draught = data.draught;
      aisCache.set(data.imo, existing);
      scheduleBroadcast();
    }
  });

  aisstream.connect();

  // Periodic gap checking (every 5 minutes)
  cron.schedule('*/5 * * * *', function() {
    gapDetector.checkAllGaps();
  });

  console.log('[AIS] Real-time AISStream tracking initialized (' + vessels.length + ' vessels)');
}

/**
 * Datalastic mode: REST API polling every 5 minutes
 */
function initDatalastic() {
  activeProvider = 'datalastic';
  simulationMode = false;

  console.log('[AIS] Datalastic API configured -- live AIS polling enabled');
  pollNow();

  var intervalMinutes = Math.round(config.ais.pollIntervalMs / 60000);
  cron.schedule('*/' + intervalMinutes + ' * * * *', function() {
    pollNow();
  });

  console.log('[AIS] Poller initialized (every ' + intervalMinutes + ' min, ' + vessels.length + ' vessels)');
}

/**
 * Simulation mode: drift vessels along their course
 */
function initSimulation() {
  activeProvider = 'simulation';
  simulationMode = true;

  console.log('[AIS] No AIS API key configured -- running in SIMULATION mode');
  console.log('[AIS] Vessel positions will drift along their course every poll cycle');

  adjustDatesToPresent(vessels);
  seedInitialPositions();
  lastSimulationTime = Date.now();
  broadcastPositions();

  var intervalMinutes = Math.round(config.ais.pollIntervalMs / 60000);
  cron.schedule('*/' + intervalMinutes + ' * * * *', function() {
    pollNow();
  });

  console.log('[AIS] Simulation initialized (' + vessels.length + ' vessels)');
}

/**
 * Seed the cache with initial positions from vessels.json
 */
function seedInitialPositions() {
  for (var v of vessels) {
    if (!v.lat || !v.lng) continue;
    var pos = {
      imo: v.imo,
      lat: v.lat,
      lon: v.lng,
      sog: v.speed || 0,
      cog: v.course || 0,
      heading: null,
      draught: null,
      navStatus: v.navStatus,
      destination: v.destination,
      eta: v.eta,
      aisTimestamp: new Date().toISOString(),
      source: activeProvider === 'simulation' ? 'simulation' : 'seed'
    };
    aisCache.set(v.imo, pos);
    zoneTracker.processPosition(v.imo, v.name, v.lat, v.lng);
    gapDetector.recordSignal(v.imo, v.name, v.lat, v.lng, false, pos.aisTimestamp);
  }
}

/**
 * Poll for positions (Datalastic REST or simulation advance)
 */
async function pollNow() {
  if (isPolling) return;
  isPolling = true;
  var start = Date.now();

  try {
    if (activeProvider === 'aisstream') {
      // AISStream is push-based -- pollNow just checks gaps and broadcasts
      gapDetector.checkAllGaps();
      broadcastPositions();
      lastPollTime = new Date().toISOString();
      return;
    }

    if (activeProvider === 'simulation') {
      simulateMovement();
      gapDetector.checkAllGaps();
      broadcastPositions();
      lastPollTime = new Date().toISOString();
      return;
    }

    // Datalastic REST polling
    var imos = vessels.map(function(v) { return v.imo; });
    console.log('[AIS] Polling ' + imos.length + ' vessels from Datalastic...');

    var positions = await datalastic.getFleetPositions(imos);
    for (var pos of positions) {
      processPosition(pos);
    }

    gapDetector.checkAllGaps();

    var elapsed = Date.now() - start;
    lastPollTime = new Date().toISOString();
    console.log('[AIS] Poll complete: ' + positions.length + '/' + imos.length + ' positions (' + elapsed + 'ms)');
    broadcastPositions();
  } catch (err) {
    console.error('[AIS] Poll error:', err.message);
  } finally {
    isPolling = false;
  }
}

function broadcastPositions() {
  if (!wsService) return;
  var positions = aisCache.getAll();

  var enriched = positions.map(function(pos) {
    var zoneState = zoneTracker.getVesselZoneState(pos.imo);
    var aisHealth = gapDetector.getHealth(pos.imo);
    return Object.assign({}, pos, {
      inJWC: zoneState ? zoneState.inJWC : false,
      jwcZones: zoneState ? zoneState.zones : [],
      highestRisk: zoneState ? zoneState.highestRisk : null,
      corridors: zoneState ? zoneState.corridors : [],
      aisHealth: aisHealth
    });
  });

  wsService.broadcast('positions', enriched);
}

function getStatus() {
  var status = {
    provider: activeProvider || 'none',
    configured: activeProvider !== 'simulation',
    simulationMode: simulationMode,
    lastPollTime: lastPollTime,
    cachedPositions: aisCache.size(),
    isPolling: isPolling
  };

  if (activeProvider === 'aisstream') {
    status.stream = aisstream.getStatus();
  }

  return status;
}

// --- Simulation helpers (kept for fallback mode) ---

function adjustDatesToPresent(vesselList) {
  var now = new Date();
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var currentMonth = months[now.getMonth()];
  var monthRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;

  for (var v of vesselList) {
    if (v.eta && typeof v.eta === 'string' && monthRegex.test(v.eta)) {
      monthRegex.lastIndex = 0;
      v.eta = v.eta.replace(monthRegex, currentMonth);
    }
    if (v.portCalls) {
      for (var pc of v.portCalls) {
        if (pc.arrived && typeof pc.arrived === 'string') {
          monthRegex.lastIndex = 0;
          pc.arrived = pc.arrived.replace(monthRegex, currentMonth);
        }
        if (pc.departed && typeof pc.departed === 'string') {
          monthRegex.lastIndex = 0;
          pc.departed = pc.departed.replace(monthRegex, currentMonth);
        }
      }
    }
  }
}

function distanceNm(lat1, lon1, lat2, lon2) {
  var toRad = Math.PI / 180;
  var R = 3440.065;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function simulateMovement() {
  var now = Date.now();
  if (!lastSimulationTime) {
    lastSimulationTime = now;
    return;
  }

  var elapsedMs = now - lastSimulationTime;
  lastSimulationTime = now;
  var elapsedHours = elapsedMs / (1000 * 60 * 60);

  for (var v of vessels) {
    var cached = aisCache.get(v.imo);
    if (!cached) continue;

    var speed = cached.sog || 0;
    if (!v.active || speed <= 0.5) continue;

    var distNm = speed * elapsedHours;
    var courseRad = ((cached.cog || 0) * Math.PI) / 180;
    var latRad = (cached.lat * Math.PI) / 180;

    var newLat = cached.lat + (distNm / 60) * Math.cos(courseRad);
    var newLon = cached.lon + (distNm / 60) * Math.sin(courseRad) / Math.cos(latRad);

    var destCoords = getDestinationCoords(cached.destination);
    var newEta = cached.eta;
    var newNavStatus = cached.navStatus;
    var newSpeed = speed;
    var newCog = cached.cog;

    if (destCoords) {
      var remainingNm = distanceNm(newLat, newLon, destCoords[0], destCoords[1]);
      if (remainingNm < 5) {
        newLat = destCoords[0]; newLon = destCoords[1];
        newSpeed = 0; newNavStatus = 'At anchor'; newEta = 'In Port';
      } else {
        var etaHours = remainingNm / speed;
        var etaDate = new Date(now + etaHours * 3600000);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        newEta = etaDate.getDate() + ' ' + months[etaDate.getMonth()] + ' ' +
          String(etaDate.getHours()).padStart(2, '0') + ':' + String(etaDate.getMinutes()).padStart(2, '0');
        var targetBearing = Math.atan2(destCoords[1] - newLon, destCoords[0] - newLat) * (180 / Math.PI);
        newCog = ((targetBearing % 360) + 360) % 360;
      }
    }

    if (newSpeed > 0.5) {
      newSpeed = Math.max(0.5, newSpeed + (Math.random() - 0.5) * 0.6);
      newSpeed = Math.round(newSpeed * 10) / 10;
    }

    aisCache.set(v.imo, Object.assign({}, cached, {
      lat: newLat, lon: newLon, sog: newSpeed,
      cog: Math.round(newCog * 10) / 10,
      navStatus: newNavStatus, eta: newEta,
      aisTimestamp: new Date().toISOString()
    }));

    zoneTracker.processPosition(v.imo, v.name, newLat, newLon);
    gapDetector.recordSignal(v.imo, v.name, newLat, newLon, false, new Date().toISOString());
  }
}

module.exports = { init, pollNow, getStatus };
