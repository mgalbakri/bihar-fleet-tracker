// AIS Gap Detector -- monitors signal freshness and detects "going dark"
// Thresholds: 30min in JWC zones (HIGH), 6h outside (HIGH)
const { v4: uuidv4 } = require('uuid');
const config = require('../../../config/default');

// In-memory tracking of last AIS timestamp per vessel
const vesselSignalState = new Map();

let db;
let wsService;

function init(database, ws) {
  db = database;
  wsService = ws;
}

/**
 * Update signal state for a vessel.
 * Call this on every position update to record when we last heard from the vessel.
 *
 * @param {string} imo
 * @param {string} vesselName
 * @param {number} lat
 * @param {number} lon
 * @param {boolean} inJWC - Whether vessel is currently in a JWC zone
 * @param {string} aisTimestamp - The AIS message timestamp
 */
function recordSignal(imo, vesselName, lat, lon, inJWC, aisTimestamp) {
  const now = Date.now();
  const prev = vesselSignalState.get(imo);

  // If there was an open gap, close it
  if (prev && prev.gapOpen) {
    closeGap(imo, vesselName, now);
  }

  vesselSignalState.set(imo, {
    vesselName,
    lastSignal: now,
    lastAisTimestamp: aisTimestamp || new Date().toISOString(),
    lat,
    lon,
    inJWC,
    gapOpen: false,
    gapId: null,
    gapStart: null
  });
}

/**
 * Check all vessels for AIS gaps.
 * Call this periodically (e.g., on each poll cycle) to detect vessels that have gone dark.
 *
 * @returns {Array} - List of gap alerts generated
 */
function checkAllGaps() {
  const now = Date.now();
  const alerts = [];

  for (const [imo, state] of vesselSignalState) {
    const silenceMs = now - state.lastSignal;
    const silenceMinutes = silenceMs / 60000;

    // Determine threshold based on JWC zone presence
    const thresholdMinutes = state.inJWC
      ? config.ais.darkThresholdMinutesJWC  // 30 min in JWC
      : config.ais.darkThresholdMinutes;     // 360 min (6h) outside

    if (silenceMinutes >= thresholdMinutes && !state.gapOpen) {
      // Open a new gap
      const gap = openGap(imo, state, now);
      if (gap) {
        alerts.push(gap);
      }
    }
  }

  // Broadcast gap alerts
  if (alerts.length > 0 && wsService) {
    wsService.broadcast('ais_gaps', alerts);
  }

  return alerts;
}

function openGap(imo, state, now) {
  const gapId = uuidv4();
  state.gapOpen = true;
  state.gapId = gapId;
  state.gapStart = now;

  if (!db) return null;

  try {
    db.prepare(`
      INSERT INTO ais_gaps (id, vessel_imo, vessel_name, gap_start, last_known_lat, last_known_lon, in_jwc_zone, zone_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gapId, imo, state.vesselName,
      new Date(state.lastSignal).toISOString(),
      state.lat, state.lon,
      state.inJWC ? 1 : 0,
      null // zone_id could be enriched later
    );

    console.log(`[AIS-GAP] ${state.vesselName} (${imo}) went dark -- last signal ${Math.round((now - state.lastSignal) / 60000)}min ago${state.inJWC ? ' [IN JWC ZONE]' : ''}`);

    return {
      id: gapId,
      vesselImo: imo,
      vesselName: state.vesselName,
      gapStart: new Date(state.lastSignal).toISOString(),
      lastKnownLat: state.lat,
      lastKnownLon: state.lon,
      inJWCZone: state.inJWC,
      silenceMinutes: Math.round((now - state.lastSignal) / 60000)
    };
  } catch (err) {
    console.error('[AIS-GAP] Failed to log gap:', err.message);
    return null;
  }
}

function closeGap(imo, vesselName, now) {
  const state = vesselSignalState.get(imo);
  if (!state || !state.gapOpen || !state.gapId) return;

  const durationMinutes = Math.round((now - state.gapStart) / 60000);

  if (db) {
    try {
      db.prepare(`
        UPDATE ais_gaps SET gap_end = ?, duration_minutes = ? WHERE id = ?
      `).run(new Date().toISOString(), durationMinutes, state.gapId);

      console.log(`[AIS-GAP] ${vesselName} (${imo}) signal restored after ${durationMinutes}min`);
    } catch (err) {
      console.error('[AIS-GAP] Failed to close gap:', err.message);
    }
  }

  state.gapOpen = false;
  state.gapId = null;
  state.gapStart = null;
}

/**
 * Get AIS health status for a vessel
 * @returns {'GREEN'|'AMBER'|'RED'} - Signal health indicator
 */
function getHealth(imo) {
  const state = vesselSignalState.get(imo);
  if (!state) return 'UNKNOWN';

  if (state.gapOpen) return 'RED';

  const silenceMs = Date.now() - state.lastSignal;
  const silenceMinutes = silenceMs / 60000;

  // AMBER if approaching threshold (50% of threshold)
  const threshold = state.inJWC
    ? config.ais.darkThresholdMinutesJWC
    : config.ais.darkThresholdMinutes;

  if (silenceMinutes >= threshold * 0.5) return 'AMBER';
  return 'GREEN';
}

/**
 * Get health state for all vessels
 */
function getAllHealth() {
  const result = {};
  for (const [imo] of vesselSignalState) {
    result[imo] = getHealth(imo);
  }
  return result;
}

/**
 * Get active (open) gaps
 */
function getActiveGaps() {
  if (!db) return [];
  return db.prepare(`
    SELECT * FROM ais_gaps WHERE gap_end IS NULL ORDER BY gap_start DESC
  `).all();
}

module.exports = { init, recordSignal, checkAllGaps, getHealth, getAllHealth, getActiveGaps };
