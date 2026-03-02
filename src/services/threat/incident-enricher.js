// Incident Enricher -- auto-classifies and enriches incidents with metadata
const { distanceNm } = require('../geo/proximity');

let db;
let zoneChecker;

// Recommended clearance by incident type (nautical miles)
const CLEARANCE_BY_TYPE = {
  MISSILE_ATTACK: 100,
  DRONE_ATTACK: 75,
  MINE_THREAT: 50,
  PIRACY: 30,
  SEIZURE: 40,
  SUSPICIOUS_APPROACH: 20,
  MILITARY_ACTION: 60,
  ADVISORY: 25
};

function init(database, zoneCheckerService) {
  db = database;
  zoneChecker = zoneCheckerService;
}

/**
 * Enrich an incident with auto-classified metadata
 * @param {Object} incident - Raw incident {lat, lon, type, severity, source, corridor, ...}
 * @returns {Object} Enriched fields to merge into the incident
 */
function enrichIncident(incident) {
  const enriched = {};

  // Auto-classify impact area
  enriched.impact_area = classifyImpactArea(incident.lat, incident.lon);

  // Set recommended clearance based on type
  enriched.recommended_clearance_nm = CLEARANCE_BY_TYPE[incident.type] || 50;

  // Auto-set confidence score
  const sourceReliability = getSourceScore(incident.source);
  enriched.confidence_score = calculateConfidence(incident, sourceReliability);
  enriched.source_reliability = getSourceRating(sourceReliability);

  // Assess escalation potential
  enriched.escalation_potential = assessEscalation(incident);

  // Find related incidents
  const related = findRelatedIncidents(incident);
  if (related.length > 0) {
    enriched.related_incident_ids = JSON.stringify(related);
    // Boost confidence if corroborated
    if (related.length >= 2) enriched.confidence_score = Math.min(100, enriched.confidence_score + 15);
  }

  // Set impact radius based on type and severity
  enriched.impact_radius_nm = Math.round((CLEARANCE_BY_TYPE[incident.type] || 50) * (incident.severity || 3) / 5);

  return enriched;
}

/**
 * Classify impact area based on geographic location
 */
function classifyImpactArea(lat, lon) {
  if (!zoneChecker || !lat || !lon) return 'OPEN_SEA';

  const jwcZones = zoneChecker.checkJWCZones(lat, lon);
  const corridors = zoneChecker.checkCorridors(lat, lon);

  if (jwcZones.length > 0) {
    const highest = jwcZones.reduce((a, b) =>
      riskPriority(a.riskLevel) > riskPriority(b.riskLevel) ? a : b
    );
    if (highest.riskLevel === 'CRITICAL') return 'WAR_ZONE';
    return 'PIRACY_HOTSPOT';
  }

  if (corridors.length > 0) return 'TRADE_ROUTE';
  return 'OPEN_SEA';
}

function riskPriority(level) {
  return { CRITICAL: 4, HIGH: 3, ELEVATED: 2, LOW: 1 }[level] || 0;
}

/**
 * Calculate confidence score based on source reliability and corroboration
 */
function calculateConfidence(incident, sourceScore) {
  let confidence = sourceScore; // Start with source reliability
  if (incident.verified) confidence += 20;
  if (incident.severity >= 4) confidence += 5; // High severity incidents tend to be more verified
  return Math.min(100, Math.max(0, confidence));
}

function getSourceScore(sourceName) {
  if (!db) return 50;
  try {
    const src = db.prepare('SELECT reliability_score FROM threat_sources WHERE name = ?').get(sourceName);
    return src ? src.reliability_score : 50;
  } catch (e) {
    return 50;
  }
}

function getSourceRating(score) {
  if (score >= 90) return 'CONFIRMED';
  if (score >= 75) return 'RELIABLE';
  if (score >= 60) return 'USUALLY_RELIABLE';
  if (score >= 40) return 'FAIRLY_RELIABLE';
  return 'UNRELIABLE';
}

/**
 * Find related incidents within 100nm and 72 hours
 */
function findRelatedIncidents(incident) {
  if (!db || !incident.lat || !incident.lon) return [];

  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const nearby = db.prepare(`
    SELECT id, lat, lon, type, timestamp FROM incidents
    WHERE status = 'active' AND timestamp > ? AND id != ?
    AND lat IS NOT NULL AND lon IS NOT NULL
  `).all(cutoff, incident.id || '');

  const related = [];
  for (const other of nearby) {
    const dist = distanceNm(incident.lat, incident.lon, other.lat, other.lon);
    if (dist <= 100) {
      related.push(other.id);
    }
  }
  return related;
}

/**
 * Assess escalation potential based on context
 */
function assessEscalation(incident) {
  if (!db) return 'UNKNOWN';

  // Count recent incidents in same corridor
  const recentCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM incidents
    WHERE corridor = ? AND status = 'active'
    AND timestamp > datetime('now', '-24 hours')
  `).get(incident.corridor || '');

  const count = recentCount ? recentCount.cnt : 0;

  if (count >= 3 || (incident.severity >= 4 && incident.type === 'MISSILE_ATTACK')) return 'HIGH';
  if (count >= 2 || incident.severity >= 4) return 'MEDIUM';
  if (incident.severity <= 2) return 'LOW';
  return 'UNKNOWN';
}

module.exports = { init, enrichIncident, classifyImpactArea, findRelatedIncidents, assessEscalation, calculateConfidence };
