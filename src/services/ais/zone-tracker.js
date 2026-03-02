// JWC Zone Tracker -- monitors vessel entry/exit from JWC Listed Areas
// Integrated into AIS poll cycle to generate events for insurance notifications
const { v4: uuidv4 } = require('uuid');
const { getZoneStatus } = require('../geo/zone-checker');

// In-memory state: last known zone status per vessel
const vesselZoneState = new Map();

let db;
let wsService;
let eventCallbacks = [];

function init(database, ws) {
  db = database;
  wsService = ws;
}

/**
 * Register a callback for zone events (ENTRY/EXIT)
 * Callback receives (event, vessel) where vessel may be null
 */
function onEvent(callback) {
  eventCallbacks.push(callback);
}

/**
 * Process a vessel's position update against JWC zones.
 * Detects ENTRY and EXIT events, logs to DB, broadcasts via WS.
 *
 * @param {string} imo - Vessel IMO
 * @param {string} vesselName - Vessel name for display
 * @param {number} lat
 * @param {number} lon
 * @returns {{ inJWC: boolean, zones: Array, highestRisk: string|null, events: Array }}
 */
function processPosition(imo, vesselName, lat, lon) {
  const current = getZoneStatus(lat, lon);
  const prev = vesselZoneState.get(imo) || { zoneIds: new Set() };
  const currentZoneIds = new Set(current.jwcZones.map(z => z.id));
  const events = [];

  // Detect ENTRY: zones in current but not in previous
  for (const zone of current.jwcZones) {
    if (!prev.zoneIds.has(zone.id)) {
      const event = {
        id: uuidv4(),
        vesselImo: imo,
        vesselName,
        zoneId: zone.id,
        zoneName: zone.name,
        riskLevel: zone.riskLevel,
        eventType: 'ENTRY',
        lat,
        lon,
        timestamp: new Date().toISOString()
      };
      events.push(event);
      logEvent(event);
    }
  }

  // Detect EXIT: zones in previous but not in current
  for (const zoneId of prev.zoneIds) {
    if (!currentZoneIds.has(zoneId)) {
      const event = {
        id: uuidv4(),
        vesselImo: imo,
        vesselName,
        zoneId,
        zoneName: zoneId, // We don't have the name cached, zone ID is sufficient
        eventType: 'EXIT',
        lat,
        lon,
        timestamp: new Date().toISOString()
      };
      events.push(event);
      logEvent(event);
    }
  }

  // Update state
  vesselZoneState.set(imo, {
    zoneIds: currentZoneIds,
    zones: current.jwcZones,
    corridors: current.corridors,
    highestRisk: current.highestRisk,
    inJWC: current.inJWC,
    lastUpdate: new Date().toISOString()
  });

  // Broadcast events if any
  if (events.length > 0) {
    if (wsService) wsService.broadcast('zone_events', events);
    // Notify registered callbacks
    for (const event of events) {
      for (const cb of eventCallbacks) {
        try { cb(event); } catch (e) { console.error('[ZONE] Event callback error:', e.message); }
      }
    }
  }

  return {
    inJWC: current.inJWC,
    zones: current.jwcZones,
    corridors: current.corridors,
    highestRisk: current.highestRisk,
    events
  };
}

function logEvent(event) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO jwc_zone_events (id, vessel_imo, vessel_name, zone_id, event_type, timestamp, lat, lon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.vesselImo, event.vesselName, event.zoneId, event.eventType, event.timestamp, event.lat, event.lon);
  } catch (err) {
    console.error('[ZONE-TRACKER] Failed to log event:', err.message);
  }
}

/**
 * Get current zone state for a vessel
 */
function getVesselZoneState(imo) {
  return vesselZoneState.get(imo) || null;
}

/**
 * Get zone state for all tracked vessels
 */
function getAllZoneStates() {
  const result = {};
  for (const [imo, state] of vesselZoneState) {
    result[imo] = state;
  }
  return result;
}

/**
 * Get recent zone events from DB
 */
function getRecentEvents(limit) {
  if (!db) return [];
  return db.prepare(`
    SELECT * FROM jwc_zone_events ORDER BY timestamp DESC LIMIT ?
  `).all(limit || 50);
}

module.exports = { init, onEvent, processPosition, getVesselZoneState, getAllZoneStates, getRecentEvents };
