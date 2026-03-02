// Corridor Status Calculator -- determines GREEN/AMBER/RED/BLACK for each corridor
// Based on incident count in last 7 days + trend vs previous 7 days
const config = require('../../../config/default');
const { checkCorridors } = require('../geo/zone-checker');
const aisCache = require('../ais/ais-cache');

let db;
let wsService;

function init(database, ws) {
  db = database;
  wsService = ws;
}

/**
 * Recalculate status for all corridors based on current incident data
 * @param {Array} vessels - Fleet vessel list
 */
function recalculate(vessels) {
  if (!db) return;

  var corridorIds = ['HORMUZ', 'BAB_EL_MANDEB', 'GULF_OF_ADEN', 'SUEZ_APPROACH', 'ARABIAN_SEA', 'SOMALI_BASIN'];

  // Count incidents per corridor in last 7 days and previous 7 days
  var current7d = db.prepare(`
    SELECT corridor, COUNT(*) as count FROM incidents
    WHERE status = 'active' AND corridor IS NOT NULL
    AND timestamp > datetime('now', '-7 days')
    GROUP BY corridor
  `).all();

  var prev7d = db.prepare(`
    SELECT corridor, COUNT(*) as count FROM incidents
    WHERE status = 'active' AND corridor IS NOT NULL
    AND timestamp > datetime('now', '-14 days') AND timestamp <= datetime('now', '-7 days')
    GROUP BY corridor
  `).all();

  var currentMap = {};
  for (var c of current7d) currentMap[c.corridor] = c.count;
  var prevMap = {};
  for (var p of prev7d) prevMap[p.corridor] = p.count;

  // Count BIHAR vessels per corridor
  var vesselCounts = countVesselsPerCorridor(vessels);

  // Get last incident per corridor
  var lastIncidents = db.prepare(`
    SELECT corridor, MAX(timestamp) as last_ts, type as last_type FROM incidents
    WHERE status = 'active' AND corridor IS NOT NULL
    GROUP BY corridor
  `).all();
  var lastIncMap = {};
  for (var li of lastIncidents) lastIncMap[li.corridor] = li;

  // Update each corridor
  var updateStmt = db.prepare(`
    UPDATE corridor_status
    SET status = ?, incident_count_7d = ?, incident_count_prev_7d = ?,
        trend = ?, bihar_vessels_count = ?, last_incident_date = ?,
        last_incident_type = ?, updated_at = ?
    WHERE corridor_id = ?
  `);

  var results = {};
  var updateAll = db.transaction(function() {
    for (var id of corridorIds) {
      var count = currentMap[id] || 0;
      var prevCount = prevMap[id] || 0;
      var status = calculateStatus(count);
      var trend = calculateTrend(count, prevCount);
      var biharCount = vesselCounts[id] || 0;
      var lastInc = lastIncMap[id];

      updateStmt.run(
        status, count, prevCount, trend, biharCount,
        lastInc ? lastInc.last_ts : null,
        lastInc ? lastInc.last_type : null,
        new Date().toISOString(),
        id
      );

      results[id] = { status: status, incidents7d: count, trend: trend, vessels: biharCount };
    }
  });

  updateAll();

  // Broadcast updated corridor statuses
  if (wsService) {
    var all = db.prepare('SELECT * FROM corridor_status').all();
    wsService.broadcast('corridor_status', all);
  }

  return results;
}

function calculateStatus(incidentCount7d) {
  var t = config.corridors.statusThresholds;
  if (incidentCount7d >= t.BLACK.minIncidents7d) return 'BLACK';
  if (incidentCount7d > t.AMBER.maxIncidents7d) return 'RED';
  if (incidentCount7d > t.GREEN.maxIncidents7d) return 'AMBER';
  return 'GREEN';
}

function calculateTrend(current, previous) {
  if (current > previous) return 'WORSENING';
  if (current < previous) return 'IMPROVING';
  return 'STABLE';
}

function countVesselsPerCorridor(vessels) {
  var counts = {};
  var positions = aisCache.getAll();
  var posMap = {};
  for (var p of positions) posMap[p.imo] = p;

  for (var v of vessels) {
    var pos = posMap[v.imo];
    var lat = pos ? pos.lat : v.lat;
    var lon = pos ? pos.lon : (v.lng || v.lon);
    if (!lat || !lon) continue;

    var corrs = checkCorridors(lat, lon);
    for (var c of corrs) {
      counts[c.id] = (counts[c.id] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Get current corridor statuses
 */
function getAll() {
  if (!db) return [];
  return db.prepare('SELECT * FROM corridor_status ORDER BY corridor_id').all();
}

module.exports = { init, recalculate, getAll };
