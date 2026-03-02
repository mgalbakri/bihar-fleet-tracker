// Risk Engine -- computes 6-factor weighted risk scores for each vessel
// Factors: proximity(30%), corridor(25%), JWC presence(15%), AIS health(15%), vulnerability(10%), historical(5%)
const config = require('../../../config/default');
const { distanceNm } = require('../geo/proximity');
const zoneTracker = require('../ais/zone-tracker');
const gapDetector = require('../ais/gap-detector');

let db;

function init(database) {
  db = database;
}

/**
 * Calculate composite risk score for a single vessel
 * @param {Object} vessel - Vessel from registry (imo, name, lat, lng, dwt, type, etc.)
 * @param {Array} activeIncidents - Current active incidents with lat/lon
 * @returns {{ composite: number, level: string, factors: Object }}
 */
function scoreVessel(vessel, activeIncidents) {
  const w = config.risk.weights;
  const lat = vessel.lat;
  const lon = vessel.lng || vessel.lon;

  if (!lat || !lon) {
    return { composite: 0, level: 'LOW', factors: {} };
  }

  // Factor 1: Proximity to nearest active incident (30%)
  const proxScore = scoreProximity(lat, lon, activeIncidents);

  // Factor 2: Corridor risk level (25%)
  const corridorScore = scoreCorridor(lat, lon);

  // Factor 3: JWC zone presence (15%)
  const jwcScore = scoreJWCPresence(vessel.imo, lat, lon);

  // Factor 4: AIS health (15%)
  const aisScore = scoreAISHealth(vessel.imo);

  // Factor 5: Vessel vulnerability (10%)
  const vulnScore = scoreVulnerability(vessel);

  // Factor 6: Historical incident density (5%)
  const histScore = scoreHistorical(lat, lon);

  // Weighted composite (0-100)
  const composite = Math.round(
    proxScore * w.proximity +
    corridorScore * w.corridor +
    jwcScore * w.jwcPresence +
    aisScore * w.aisHealth +
    vulnScore * w.vulnerability +
    histScore * w.historical
  );

  const level = compositeToLevel(composite);

  return {
    composite,
    level,
    factors: {
      proximity: Math.round(proxScore),
      corridor: Math.round(corridorScore),
      jwc: Math.round(jwcScore),
      ais: Math.round(aisScore),
      vulnerability: Math.round(vulnScore),
      historical: Math.round(histScore)
    }
  };
}

function scoreProximity(lat, lon, incidents) {
  if (!incidents || incidents.length === 0) return 0;

  let minDistance = Infinity;
  for (const inc of incidents) {
    if (!inc.lat || !inc.lon) continue;
    const d = distanceNm(lat, lon, inc.lat, inc.lon);
    if (d < minDistance) minDistance = d;
  }

  if (minDistance === Infinity) return 0;

  // Scale: 0nm = 100, 10nm = 80, 25nm = 60, 50nm = 40, 100nm = 20, >200nm = 0
  if (minDistance <= 10) return 100;
  if (minDistance <= 25) return 80 - (minDistance - 10) * (20 / 15);
  if (minDistance <= 50) return 60 - (minDistance - 25) * (20 / 25);
  if (minDistance <= 100) return 40 - (minDistance - 50) * (20 / 50);
  if (minDistance <= 200) return 20 - (minDistance - 100) * (20 / 100);
  return 0;
}

function scoreCorridor(lat, lon) {
  if (!db) return 0;

  // Check which corridor the vessel is in and return its risk
  const zoneTrack = require('../ais/zone-tracker');
  // Use corridor status from DB
  var corridors = db.prepare('SELECT * FROM corridor_status').all();

  // Get vessel's corridor from zone checker
  var { checkCorridors } = require('../geo/zone-checker');
  var vesselCorridors = checkCorridors(lat, lon);

  if (vesselCorridors.length === 0) return 0;

  // Find highest risk corridor the vessel is in
  var statusMap = { BLACK: 100, RED: 75, AMBER: 50, GREEN: 10 };
  var maxScore = 0;

  for (var vc of vesselCorridors) {
    var cs = corridors.find(function(c) { return c.corridor_id === vc.id; });
    if (cs) {
      var s = statusMap[cs.status] || 0;
      if (s > maxScore) maxScore = s;
    }
  }

  return maxScore;
}

function scoreJWCPresence(imo, lat, lon) {
  var state = zoneTracker.getVesselZoneState(imo);
  if (state && state.inJWC) {
    var riskMap = { CRITICAL: 100, HIGH: 75, ELEVATED: 50, LOW: 25 };
    return riskMap[state.highestRisk] || 50;
  }

  // Fallback: direct geo check when zone tracker has no state
  if (lat && lon) {
    var { isInJWCZone } = require('../geo/zone-checker');
    if (isInJWCZone(lat, lon)) return 75; // Default HIGH when in zone but no tracker state
  }

  return 0;
}

function scoreAISHealth(imo) {
  var health = gapDetector.getHealth(imo);
  if (health === 'RED') return 100;
  if (health === 'AMBER') return 50;
  return 0; // GREEN or UNKNOWN
}

function scoreVulnerability(vessel) {
  var score = 0;

  // Slower vessels are more vulnerable
  if (vessel.speed !== undefined) {
    if (vessel.speed < 10) score += 30;
    else if (vessel.speed < 14) score += 15;
  }

  // Larger DWT = higher value target
  if (vessel.dwt) {
    if (vessel.dwt > 50000) score += 30;
    else if (vessel.dwt > 20000) score += 20;
    else if (vessel.dwt > 5000) score += 10;
  }

  // Tankers carrying crude are higher risk
  if (vessel.type === 'crude') score += 20;
  else if (vessel.type === 'tanker') score += 10;
  else if (vessel.type === 'lpg') score += 15;

  return Math.min(100, score);
}

function scoreHistorical(lat, lon) {
  if (!db) return 0;

  // Count incidents within 50nm in the last 90 days
  var incidents = db.prepare(`
    SELECT lat, lon FROM incidents
    WHERE status = 'active' AND timestamp > datetime('now', '-90 days')
    AND lat IS NOT NULL AND lon IS NOT NULL
  `).all();

  var nearby = 0;
  for (var inc of incidents) {
    var d = distanceNm(lat, lon, inc.lat, inc.lon);
    if (d <= 50) nearby++;
  }

  // Scale: 0 = 0, 1-2 = 25, 3-5 = 50, 6-10 = 75, 10+ = 100
  if (nearby === 0) return 0;
  if (nearby <= 2) return 25;
  if (nearby <= 5) return 50;
  if (nearby <= 10) return 75;
  return 100;
}

function compositeToLevel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'ELEVATED';
  return 'LOW';
}

/**
 * Calculate and store risk scores for all vessels
 * @param {Array} vessels - Fleet vessel list
 * @returns {Object} - Map of IMO to risk result
 */
function scoreFleet(vessels) {
  if (!db) return {};

  var incidents = db.prepare(`
    SELECT * FROM incidents WHERE status = 'active' AND lat IS NOT NULL AND lon IS NOT NULL
  `).all();

  var results = {};
  var storeStmt = db.prepare(`
    INSERT INTO risk_scores (vessel_imo, composite_score, risk_level, proximity_score, corridor_score, jwc_score, ais_score, vulnerability, historical_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  var storeAll = db.transaction(function(vessels) {
    for (var v of vessels) {
      var result = scoreVessel(v, incidents);
      results[v.imo] = result;

      // Enrich vessel objects in-place so downstream consumers see updated risk
      v.riskScore = result.composite;
      v.riskLevel = result.level;
      v.riskFactors = result.factors;

      storeStmt.run(
        v.imo, result.composite, result.level,
        result.factors.proximity, result.factors.corridor,
        result.factors.jwc, result.factors.ais,
        result.factors.vulnerability, result.factors.historical
      );
    }
  });

  storeAll(vessels);
  return results;
}

module.exports = { init, scoreVessel, scoreFleet };
