// Notice Triggers -- hooks into existing services to auto-generate insurer notices
// Triggers: JWC entry -> BTW, JWC exit -> Zone Exit, proximity alert -> Proximity, AIS gap -> AIS Dark

const noticeGenerator = require('./notice-generator');

let wsService;

// Track which notices have been generated to avoid duplicates
// Key: `${noticeType}:${vesselImo}:${contextId}`, Value: timestamp
const generatedNotices = new Map();
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour dedup window

function init(ws) {
  wsService = ws;
}

/**
 * Check dedup cache -- returns true if we should skip this notice
 */
function isDuplicate(noticeType, vesselImo, contextId) {
  const key = `${noticeType}:${vesselImo}:${contextId || 'default'}`;
  const lastGenerated = generatedNotices.get(key);
  if (lastGenerated && (Date.now() - lastGenerated) < DEDUP_WINDOW_MS) {
    return true;
  }
  generatedNotices.set(key, Date.now());
  return false;
}

/**
 * Called when a vessel enters a JWC zone
 * Generates a Breach of Trading Warranty notice
 *
 * @param {object} event - Zone entry event from zone-tracker
 *   { vesselImo, vesselName, zoneId, zoneName, riskLevel, lat, lon }
 * @param {object} vessel - Full vessel data from registry
 */
function onJWCEntry(event, vessel) {
  if (isDuplicate('BTW', event.vesselImo, event.zoneId)) return;

  const notice = noticeGenerator.generate('BTW', {
    name: event.vesselName,
    imo: event.vesselImo,
    flag: vessel ? vessel.flag : 'Marshall Islands',
    lat: event.lat,
    lng: event.lon,
    speed: vessel ? vessel.speed : 0,
    course: vessel ? vessel.course : 0,
    destination: vessel ? vessel.destination : 'Not reported'
  }, `Vessel entered JWC zone: ${event.zoneName}`, {
    JWC_ZONE_NAME: event.zoneName,
    JWC_ZONE_ID: event.zoneId,
    ETA_EXIT: 'To be determined'
  });

  if (notice && wsService) {
    wsService.broadcast('notice_generated', notice);
  }
}

/**
 * Called when a vessel exits a JWC zone
 * Generates a Zone Exit confirmation notice (auto-send)
 */
function onJWCExit(event, vessel) {
  if (isDuplicate('ZONE_EXIT', event.vesselImo, event.zoneId)) return;

  const notice = noticeGenerator.generate('ZONE_EXIT', {
    name: event.vesselName,
    imo: event.vesselImo,
    flag: vessel ? vessel.flag : 'Marshall Islands',
    lat: event.lat,
    lng: event.lon,
    speed: vessel ? vessel.speed : 0,
    destination: vessel ? vessel.destination : 'Not reported'
  }, `Vessel exited JWC zone: ${event.zoneName}`, {
    JWC_ZONE_NAME: event.zoneName,
    JWC_ZONE_ID: event.zoneId,
    EXIT_TIME: new Date().toISOString(),
    ENTRY_TIME: 'See zone event log',
    DURATION: 'See zone event log'
  });

  if (notice && wsService) {
    wsService.broadcast('notice_generated', notice);
  }
}

/**
 * Called when a proximity alert fires (WARNING level or above, within 50nm)
 * Generates a Proximity notice
 *
 * @param {object} alert - From alert-engine
 *   { vessel_imo, vessel_name, incident_id, distance_nm, alert_level, incident_lat, incident_lon }
 * @param {object} incident - The incident data
 */
function onProximityAlert(alert, incident) {
  // Only generate notice for WARNING or higher within 50nm
  if (alert.distance_nm > 50) return;
  if (isDuplicate('PROXIMITY', alert.vessel_imo, alert.incident_id)) return;

  const notice = noticeGenerator.generate('PROXIMITY', {
    name: alert.vessel_name,
    imo: alert.vessel_imo,
    lat: alert.vessel_lat || 0,
    lng: alert.vessel_lon || 0,
    speed: 0,
    course: 0
  }, `Vessel ${alert.distance_nm.toFixed(1)}nm from ${incident ? incident.type : 'incident'} at ${incident ? incident.title : 'location'}`, {
    INCIDENT_TYPE: incident ? incident.type : 'Security incident',
    INCIDENT_TIME: incident ? incident.timestamp : new Date().toISOString(),
    INCIDENT_LAT: incident ? (incident.lat || 0).toFixed(4) : '0',
    INCIDENT_LNG: incident ? (incident.lon || 0).toFixed(4) : '0',
    INCIDENT_SOURCE: incident ? incident.source : 'Unknown',
    INCIDENT_DESCRIPTION: incident ? (incident.description || incident.title) : 'Details pending',
    DISTANCE_NM: alert.distance_nm.toFixed(1),
    INCIDENT_ID: alert.incident_id
  });

  if (notice && wsService) {
    wsService.broadcast('notice_generated', notice);
  }
}

/**
 * Called when an AIS gap is detected (vessel goes dark)
 * Generates an AIS Dark notice
 *
 * @param {object} gap - From gap-detector
 *   { vesselImo, vesselName, lastKnownLat, lastKnownLon, inJWCZone, silenceMinutes }
 */
function onAISDark(gap) {
  // Only notify if gap exceeds 60 minutes in JWC or 6 hours outside
  const threshold = gap.inJWCZone ? 60 : 360;
  if (gap.silenceMinutes < threshold) return;
  if (isDuplicate('AIS_DARK', gap.vesselImo, 'dark')) return;

  const notice = noticeGenerator.generate('AIS_DARK', {
    name: gap.vesselName,
    imo: gap.vesselImo,
    lat: gap.lastKnownLat,
    lng: gap.lastKnownLon,
    speed: 0,
    course: 0,
    destination: 'Unknown'
  }, `AIS signal lost for ${gap.silenceMinutes} minutes${gap.inJWCZone ? ' in JWC zone' : ''}`, {
    LAST_LAT: (gap.lastKnownLat || 0).toFixed(4),
    LAST_LNG: (gap.lastKnownLon || 0).toFixed(4),
    LAST_SIGNAL_TIME: gap.gapStart || new Date().toISOString(),
    SILENCE_MINUTES: gap.silenceMinutes,
    IN_JWC_ZONE: gap.inJWCZone ? 'YES' : 'NO',
    JWC_ZONE_NAME: gap.inJWCZone ? 'JWC Listed Area' : 'N/A',
    JWC_NOTE: gap.inJWCZone ? ' (heightened threshold for JWC Listed Area)' : ''
  });

  if (notice && wsService) {
    wsService.broadcast('notice_generated', notice);
  }
}

module.exports = { init, onJWCEntry, onJWCExit, onProximityAlert, onAISDark };
