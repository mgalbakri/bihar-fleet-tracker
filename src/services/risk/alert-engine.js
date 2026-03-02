// Alert Engine -- generates proximity alerts when vessels are near active incidents
// 4 tiers: DANGER(10nm), CRITICAL(25nm), WARNING(50nm), WATCH(100nm)
const { v4: uuidv4 } = require('uuid');
const { findVesselsInRange } = require('../geo/proximity');
const aisCache = require('../ais/ais-cache');

let db;
let wsService;

// Cooldown tracking: prevent duplicate alerts for the same vessel/incident pair
const cooldowns = new Map();
const COOLDOWN_MINUTES = 30;

function init(database, ws) {
  db = database;
  wsService = ws;
}

/**
 * Check all vessels against all active incidents and generate alerts
 * @param {Array} vessels - Fleet vessel list (with lat/lng)
 * @returns {Array} New alerts generated
 */
function checkAllProximity(vessels) {
  if (!db) return [];

  var incidents = db.prepare(`
    SELECT * FROM incidents WHERE status = 'active' AND lat IS NOT NULL AND lon IS NOT NULL
  `).all();

  if (incidents.length === 0) return [];

  var newAlerts = [];

  // Get current positions from cache (more recent than registry)
  var posMap = {};
  var positions = aisCache.getAll();
  for (var p of positions) {
    posMap[p.imo] = { lat: p.lat, lon: p.lon };
  }

  for (var inc of incidents) {
    // Build vessel position list
    var vesselPositions = vessels.map(function(v) {
      var pos = posMap[v.imo];
      return {
        imo: v.imo,
        name: v.name,
        lat: pos ? pos.lat : v.lat,
        lon: pos ? pos.lon : (v.lng || v.lon)
      };
    }).filter(function(v) { return v.lat && v.lon; });

    // Find vessels in range of this incident
    var inRange = findVesselsInRange(vesselPositions, inc.lat, inc.lon);

    for (var match of inRange) {
      // Check cooldown
      var cooldownKey = match.imo + ':' + inc.id;
      var lastAlert = cooldowns.get(cooldownKey);
      if (lastAlert && (Date.now() - lastAlert) < COOLDOWN_MINUTES * 60 * 1000) {
        continue;
      }

      // Check if alert already exists and is active
      var existing = db.prepare(
        'SELECT id FROM proximity_alerts WHERE vessel_imo = ? AND incident_id = ? AND status = ? AND alert_level = ?'
      ).get(match.imo, inc.id, 'active', match.tier);

      if (existing) continue;

      // Find vessel name
      var vessel = vesselPositions.find(function(v) { return v.imo === match.imo; });
      var vesselName = vessel ? vessel.name : match.imo;

      var alert = {
        id: uuidv4(),
        vesselImo: match.imo,
        vesselName: vesselName,
        incidentId: inc.id,
        alertLevel: match.tier,
        distanceNm: match.distance,
        vesselLat: vessel ? vessel.lat : null,
        vesselLon: vessel ? vessel.lon : null,
        incidentTitle: inc.title,
        incidentType: inc.type,
        corridor: inc.corridor
      };

      // Store in DB
      db.prepare(`
        INSERT INTO proximity_alerts (id, vessel_imo, vessel_name, incident_id, alert_level, distance_nm, vessel_lat, vessel_lon, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        alert.id, alert.vesselImo, alert.vesselName, alert.incidentId,
        alert.alertLevel, alert.distanceNm, alert.vesselLat, alert.vesselLon
      );

      newAlerts.push(alert);
      cooldowns.set(cooldownKey, Date.now());
    }
  }

  // Broadcast new alerts
  if (newAlerts.length > 0 && wsService) {
    wsService.broadcast('proximity_alerts', newAlerts);
    var critCount = newAlerts.filter(function(a) { return a.alertLevel === 'DANGER' || a.alertLevel === 'CRITICAL'; }).length;
    if (critCount > 0) {
      console.log('[ALERT] ' + critCount + ' CRITICAL/DANGER proximity alerts generated');
    }
  }

  return newAlerts;
}

/**
 * Get active alerts, optionally filtered
 */
function getActiveAlerts(vesselImo) {
  if (!db) return [];
  if (vesselImo) {
    return db.prepare(
      'SELECT * FROM proximity_alerts WHERE status = ? AND vessel_imo = ? ORDER BY created_at DESC'
    ).all('active', vesselImo);
  }
  return db.prepare(
    'SELECT * FROM proximity_alerts WHERE status = ? ORDER BY created_at DESC LIMIT 100'
  ).all('active');
}

/**
 * Acknowledge an alert
 */
function acknowledgeAlert(alertId, userId) {
  if (!db) return null;
  db.prepare(
    'UPDATE proximity_alerts SET status = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?'
  ).run('acknowledged', new Date().toISOString(), userId, alertId);
  return db.prepare('SELECT * FROM proximity_alerts WHERE id = ?').get(alertId);
}

module.exports = { init, checkAllProximity, getActiveAlerts, acknowledgeAlert };
