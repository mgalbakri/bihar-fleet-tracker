// Recommendation Engine -- generates actionable guidance from risk scores
// Decision matrix maps risk level + corridor status + JWC + alerts to specific actions
const { v4: uuidv4 } = require('uuid');
const { distanceNm } = require('../geo/proximity');

let db;
let wsService;

// Safe ports by corridor region
const SAFE_PORTS = {
  BAB_EL_MANDEB: [
    { port: 'Djibouti', lat: 11.588, lon: 43.146 },
    { port: 'Aden', lat: 12.786, lon: 45.019 },
    { port: 'Salalah', lat: 16.940, lon: 54.000 }
  ],
  HORMUZ: [
    { port: 'Fujairah', lat: 25.129, lon: 56.326 },
    { port: 'Muscat', lat: 23.610, lon: 58.540 },
    { port: 'Khor Fakkan', lat: 25.340, lon: 56.350 }
  ],
  GULF_OF_ADEN: [
    { port: 'Djibouti', lat: 11.588, lon: 43.146 },
    { port: 'Salalah', lat: 16.940, lon: 54.000 },
    { port: 'Berbera', lat: 10.439, lon: 45.036 }
  ],
  SUEZ_APPROACH: [
    { port: 'Jeddah', lat: 21.486, lon: 39.193 },
    { port: 'Port Sudan', lat: 19.616, lon: 37.216 },
    { port: 'Yanbu', lat: 24.090, lon: 38.062 }
  ],
  ARABIAN_SEA: [
    { port: 'Mumbai', lat: 18.950, lon: 72.830 },
    { port: 'Karachi', lat: 24.847, lon: 66.987 },
    { port: 'Cochin', lat: 9.965, lon: 76.240 }
  ],
  SOMALI_BASIN: [
    { port: 'Mombasa', lat: -4.044, lon: 39.668 },
    { port: 'Dar es Salaam', lat: -6.824, lon: 39.270 },
    { port: 'Victoria', lat: -4.619, lon: 55.451 }
  ]
};

// Default safe ports when corridor is unknown
const DEFAULT_PORTS = [
  { port: 'Fujairah', lat: 25.129, lon: 56.326 },
  { port: 'Salalah', lat: 16.940, lon: 54.000 },
  { port: 'Djibouti', lat: 11.588, lon: 43.146 }
];

function init(database, ws) {
  db = database;
  wsService = ws;

  // Run migration
  try {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', '..', 'db', 'migrations', '001-recommendations.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      db.exec(sql);
      console.log('[RECOMMEND] Migration 001 applied');
    }
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('[RECOMMEND] Migration error:', err.message);
    }
  }
}

/**
 * Evaluate a single vessel and generate recommendation if warranted
 * @param {Object} vessel - {imo, name, lat, lng, speed, course, destination, riskScore, riskLevel, riskFactors}
 * @param {Object} context - {incidents, corridorStatuses, alerts, inJWC, aisHealth, corridorId}
 * @returns {Object|null} recommendation or null
 */
function evaluateVessel(vessel, context) {
  if (!db) return null;

  const riskLevel = vessel.riskLevel || 'LOW';
  const corridorStatus = context.corridorStatus || 'GREEN';
  const inJWC = context.inJWC || false;
  const alertLevel = context.alertLevel || null;
  const aisHealth = context.aisHealth || 'GREEN';
  const corridorId = context.corridorId || null;

  // Determine action from decision matrix
  const decision = evaluateDecisionMatrix(riskLevel, corridorStatus, inJWC, alertLevel, aisHealth);
  if (!decision) return null;

  // Skip MAINTAIN_COURSE -- no action needed
  if (decision.actionType === 'MAINTAIN_COURSE' && decision.urgency === 'MEDIUM') return null;

  // Dedup: check if ACTIVE recommendation exists for same vessel + action within 1 hour
  const existing = db.prepare(`
    SELECT id FROM recommendations
    WHERE vessel_imo = ? AND action_type = ? AND status = 'ACTIVE'
    AND created_at > datetime('now', '-1 hour')
  `).get(vessel.imo, decision.actionType);

  if (existing) return null;

  // Supersede older active recommendations for this vessel
  db.prepare(`
    UPDATE recommendations SET status = 'SUPERSEDED'
    WHERE vessel_imo = ? AND status = 'ACTIVE' AND action_type = ?
  `).run(vessel.imo, decision.actionType);

  // Build recommendation
  const rec = buildRecommendation(vessel, decision, context);

  // Store
  db.prepare(`
    INSERT INTO recommendations (id, vessel_imo, incident_id, risk_score, urgency, action_type,
      recommendation_text, rationale, suggested_actions, alternative_ports,
      estimated_delay_hours, confidence_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    rec.id, rec.vessel_imo, rec.incident_id, rec.risk_score,
    rec.urgency, rec.action_type, rec.recommendation_text, rec.rationale,
    JSON.stringify(rec.suggested_actions), JSON.stringify(rec.alternative_ports),
    rec.estimated_delay_hours, rec.confidence_score
  );

  console.log(`[RECOMMEND] ${rec.urgency}: ${rec.action_type} for ${vessel.name}`);
  return rec;
}

/**
 * Decision matrix: maps risk factors to action + urgency
 */
function evaluateDecisionMatrix(riskLevel, corridorStatus, inJWC, alertLevel, aisHealth) {
  // AIS gap in JWC zone -- always urgent regardless of other factors
  if (aisHealth === 'RED' && inJWC) {
    return { actionType: 'RADIO_CONTACT', urgency: 'IMMEDIATE', secondary: 'EMERGENCY_PROCEDURES' };
  }

  if (riskLevel === 'CRITICAL') {
    if (corridorStatus === 'BLACK') {
      if (inJWC || alertLevel === 'DANGER') {
        return { actionType: 'DIVERT_PORT', urgency: 'IMMEDIATE', secondary: 'EMERGENCY_PROCEDURES' };
      }
      return { actionType: 'DIVERT_PORT', urgency: 'IMMEDIATE' };
    }
    if (corridorStatus === 'RED') {
      if (inJWC) {
        return { actionType: 'REDUCE_SPEED', urgency: 'URGENT', secondary: 'EMERGENCY_PROCEDURES' };
      }
      return { actionType: 'REDUCE_SPEED', urgency: 'URGENT', secondary: 'INCREASE_WATCH' };
    }
    // AMBER or GREEN corridor but CRITICAL risk
    if (alertLevel === 'DANGER') {
      return { actionType: 'AVOID_AREA', urgency: 'IMMEDIATE' };
    }
    return { actionType: 'CHANGE_ROUTE', urgency: 'URGENT' };
  }

  if (riskLevel === 'HIGH') {
    if (corridorStatus === 'BLACK') {
      if (inJWC) return { actionType: 'CHANGE_ROUTE', urgency: 'URGENT' };
      return { actionType: 'REDUCE_SPEED', urgency: 'HIGH' };
    }
    if (corridorStatus === 'RED' || corridorStatus === 'AMBER') {
      if (inJWC) return { actionType: 'INCREASE_WATCH', urgency: 'HIGH', secondary: 'REDUCE_SPEED' };
      return { actionType: 'INCREASE_WATCH', urgency: 'HIGH' };
    }
    return { actionType: 'INCREASE_WATCH', urgency: 'HIGH' };
  }

  if (riskLevel === 'ELEVATED') {
    if (inJWC) return { actionType: 'INCREASE_WATCH', urgency: 'MEDIUM' };
    return { actionType: 'MAINTAIN_COURSE', urgency: 'MEDIUM' };
  }

  // LOW risk
  return null;
}

/**
 * Build full recommendation object with text and actions
 */
function buildRecommendation(vessel, decision, context) {
  const lat = vessel.lat || 0;
  const lon = vessel.lng || vessel.lon || 0;
  const speed = vessel.speed || 12;

  // Find alternative ports if diversion recommended
  let altPorts = [];
  let estimatedDelay = 0;

  if (decision.actionType === 'DIVERT_PORT' || decision.actionType === 'CHANGE_ROUTE') {
    const portList = SAFE_PORTS[context.corridorId] || DEFAULT_PORTS;
    altPorts = portList.map(p => {
      const dist = distanceNm(lat, lon, p.lat, p.lon);
      const etaHours = speed > 0 ? Math.round(dist / speed * 10) / 10 : 999;
      return { ...p, distance_nm: Math.round(dist), eta_hours: etaHours };
    }).sort((a, b) => a.distance_nm - b.distance_nm).slice(0, 3);

    estimatedDelay = altPorts.length > 0 ? altPorts[0].eta_hours : 0;
  }

  // Build human-readable text
  const actionLabels = {
    DIVERT_PORT: 'DIVERT TO NEAREST SAFE PORT',
    REDUCE_SPEED: 'REDUCE SPEED TO MINIMUM STEERAGE',
    MAINTAIN_COURSE: 'MAINTAIN CURRENT COURSE AND SPEED',
    REQUEST_ESCORT: 'REQUEST NAVAL/ARMED ESCORT',
    CHANGE_ROUTE: 'ALTER COURSE TO AVOID THREAT AREA',
    INCREASE_WATCH: 'INCREASE WATCH AND HEIGHTEN READINESS',
    EMERGENCY_PROCEDURES: 'ACTIVATE EMERGENCY PROCEDURES',
    RADIO_CONTACT: 'ATTEMPT RADIO CONTACT IMMEDIATELY',
    AVOID_AREA: 'AVOID AREA — ACTIVE THREAT'
  };

  const label = actionLabels[decision.actionType] || decision.actionType;
  const nearestPort = altPorts.length > 0 ? ` Nearest safe port: ${altPorts[0].port} (${altPorts[0].distance_nm}nm, ETA ${altPorts[0].eta_hours}h).` : '';

  const recommendationText = `${decision.urgency}: ${label} for ${vessel.name}.${nearestPort}`;

  // Build rationale
  const reasons = [];
  if (vessel.riskLevel) reasons.push(`Risk level: ${vessel.riskLevel} (score: ${vessel.riskScore || 'N/A'})`);
  if (context.corridorStatus) reasons.push(`Corridor status: ${context.corridorStatus}`);
  if (context.inJWC) reasons.push('Vessel is inside JWC Listed Area');
  if (context.alertLevel) reasons.push(`Proximity alert: ${context.alertLevel}`);
  if (context.aisHealth === 'RED') reasons.push('AIS signal lost — vessel may be dark');
  const rationale = reasons.join('. ') + '.';

  // Build step-by-step actions
  const steps = buildActionSteps(decision, vessel, altPorts);

  return {
    id: uuidv4(),
    vessel_imo: vessel.imo,
    incident_id: context.incidentId || null,
    risk_score: vessel.riskScore || 0,
    urgency: decision.urgency,
    action_type: decision.actionType,
    recommendation_text: recommendationText,
    rationale: rationale,
    suggested_actions: steps,
    alternative_ports: altPorts,
    estimated_delay_hours: estimatedDelay,
    confidence_score: calculateConfidence(vessel, context),
    status: 'ACTIVE'
  };
}

function buildActionSteps(decision, vessel, altPorts) {
  const steps = [];

  switch (decision.actionType) {
    case 'DIVERT_PORT':
      steps.push('Alert Master and bridge team immediately');
      steps.push('Plot course to nearest safe port');
      if (altPorts.length > 0) steps.push(`Recommended diversion: ${altPorts[0].port} (${altPorts[0].distance_nm}nm)`);
      steps.push('Notify charterer and P&I club of deviation');
      steps.push('Increase radar watch and lookout');
      steps.push('Prepare Ship Security Plan level 3');
      break;
    case 'REDUCE_SPEED':
      steps.push('Reduce to minimum safe speed (5-8 knots)');
      steps.push('Increase lookout and radar surveillance');
      steps.push('Prepare fire hoses and anti-piracy measures');
      steps.push('Brief crew on emergency procedures');
      break;
    case 'CHANGE_ROUTE':
      steps.push('Identify alternative routing to avoid threat area');
      steps.push('Maintain minimum 50nm clearance from active incidents');
      if (altPorts.length > 0) steps.push(`Alternative waypoints near: ${altPorts.map(p => p.port).join(', ')}`);
      steps.push('Report route change to UKMTO and coast guard');
      break;
    case 'INCREASE_WATCH':
      steps.push('Double the watch on bridge');
      steps.push('Activate AIS and maintain continuous broadcast');
      steps.push('Monitor VHF Ch.16 and DSC');
      steps.push('Pre-position fire hoses and citadel supplies');
      steps.push('Brief all crew on Ship Security Plan procedures');
      break;
    case 'EMERGENCY_PROCEDURES':
      steps.push('Sound general alarm');
      steps.push('Activate Ship Security Plan level 3');
      steps.push('All crew to muster stations');
      steps.push('Prepare citadel for immediate use');
      steps.push('Contact UKMTO on +44 2392 222012');
      steps.push('Broadcast MAYDAY/PAN PAN if under direct threat');
      break;
    case 'RADIO_CONTACT':
      steps.push('Attempt contact on VHF Ch.16');
      steps.push('Try satellite phone to Master');
      steps.push('Contact UKMTO for last known position');
      steps.push('Alert coast guard if no contact within 30 minutes');
      steps.push('Prepare missing vessel report');
      break;
    case 'AVOID_AREA':
      steps.push('Do not enter threat zone');
      steps.push('Maintain minimum recommended clearance distance');
      steps.push('Monitor situation via UKMTO/MSCHOA advisories');
      steps.push('Consider holding position until area is clear');
      break;
    case 'REQUEST_ESCORT':
      steps.push('Contact MSCHOA for convoy scheduling');
      steps.push('Request naval escort through high-risk area');
      steps.push('Consider engaging private maritime security company');
      steps.push('Ensure vessel is registered with UKMTO');
      break;
    default:
      steps.push('Monitor situation and maintain awareness');
  }

  // Add secondary action steps
  if (decision.secondary) {
    steps.push(`Additionally: ${decision.secondary.replace(/_/g, ' ').toLowerCase()}`);
  }

  return steps;
}

function calculateConfidence(vessel, context) {
  let confidence = 50;
  if (vessel.riskScore >= 75) confidence += 20;
  else if (vessel.riskScore >= 50) confidence += 10;
  if (context.alertLevel === 'DANGER') confidence += 15;
  else if (context.alertLevel === 'CRITICAL') confidence += 10;
  if (context.inJWC) confidence += 10;
  if (context.corridorStatus === 'BLACK') confidence += 10;
  else if (context.corridorStatus === 'RED') confidence += 5;
  return Math.min(100, confidence);
}

/**
 * Evaluate all vessels and generate recommendations
 * @param {Array} vessels - Fleet data with risk scores
 * @param {Array} incidents - Active incidents
 * @param {Array} corridorStatuses - Corridor status records
 * @param {Array} alerts - Active proximity alerts
 * @returns {Array} New recommendations generated
 */
function evaluateAllVessels(vessels, incidents, corridorStatuses, alerts) {
  if (!db) return [];

  const statusMap = {};
  for (const cs of corridorStatuses) statusMap[cs.corridor_id] = cs.status;

  const alertMap = {};
  for (const a of alerts) {
    if (!alertMap[a.vessel_imo] || tierPriority(a.alert_level) > tierPriority(alertMap[a.vessel_imo])) {
      alertMap[a.vessel_imo] = a.alert_level;
    }
  }

  const zoneTracker = require('../ais/zone-tracker');
  const gapDetector = require('../ais/gap-detector');
  const { checkCorridors, isInJWCZone } = require('../geo/zone-checker');

  const newRecs = [];

  for (const v of vessels) {
    const lat = v.lat;
    const lon = v.lng || v.lon;
    if (!lat || !lon) continue;

    const corridors = checkCorridors(lat, lon);
    const corridorId = corridors.length > 0 ? corridors[0].id : null;
    const corridorSt = corridorId ? (statusMap[corridorId] || 'GREEN') : 'GREEN';

    // Compute inJWC directly from geometry -- zone tracker state may be stale or empty
    const zoneState = zoneTracker.getVesselZoneState(v.imo);
    const inJWC = zoneState ? zoneState.inJWC : isInJWCZone(lat, lon);

    const aisHealth = gapDetector.getHealth(v.imo);

    const context = {
      corridorStatus: corridorSt,
      corridorId: corridorId,
      inJWC: inJWC,
      alertLevel: alertMap[v.imo] || null,
      aisHealth: aisHealth,
      incidentId: null
    };

    const rec = evaluateVessel(v, context);
    if (rec) newRecs.push(rec);
  }

  if (newRecs.length > 0 && wsService) {
    wsService.broadcast('recommendations', newRecs);
    console.log(`[RECOMMEND] Generated ${newRecs.length} new recommendations`);
  }

  return newRecs;
}

function tierPriority(tier) {
  const map = { DANGER: 4, CRITICAL: 3, WARNING: 2, WATCH: 1 };
  return map[tier] || 0;
}

/**
 * Get active recommendations, optionally filtered by vessel
 */
function getActiveRecommendations(vesselImo) {
  if (!db) return [];
  if (vesselImo) {
    return db.prepare(
      'SELECT * FROM recommendations WHERE status IN (?, ?) AND vessel_imo = ? ORDER BY created_at DESC'
    ).all('ACTIVE', 'ACKNOWLEDGED', vesselImo);
  }
  return db.prepare(
    'SELECT * FROM recommendations WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 100'
  ).all('ACTIVE', 'ACKNOWLEDGED');
}

/**
 * Acknowledge a recommendation
 */
function acknowledgeRecommendation(id, userId) {
  if (!db) return null;
  db.prepare(
    'UPDATE recommendations SET status = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?'
  ).run('ACKNOWLEDGED', new Date().toISOString(), userId, id);
  return db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id);
}

/**
 * Mark recommendation as executing with action details
 */
function executeRecommendation(id, userId, actionTaken, notes) {
  if (!db) return null;
  const now = new Date().toISOString();

  db.prepare(
    'UPDATE recommendations SET status = ?, executed_at = ? WHERE id = ?'
  ).run('EXECUTING', now, id);

  // Log the response action
  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id);
  if (rec) {
    db.prepare(
      'INSERT INTO response_actions (id, recommendation_id, vessel_imo, action_taken, taken_by, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), id, rec.vessel_imo, actionTaken, userId, notes || '');
  }

  return rec;
}

/**
 * Dismiss a recommendation with reason
 */
function dismissRecommendation(id, userId, reason) {
  if (!db) return null;
  db.prepare(
    'UPDATE recommendations SET status = ?, outcome = ?, outcome_notes = ? WHERE id = ?'
  ).run('DISMISSED', 'Dismissed by operator', reason, id);
  return db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id);
}

/**
 * Get response action history for a recommendation
 */
function getRecommendationHistory(recommendationId) {
  if (!db) return [];
  return db.prepare(
    'SELECT * FROM response_actions WHERE recommendation_id = ? ORDER BY taken_at DESC'
  ).all(recommendationId);
}

module.exports = {
  init, evaluateVessel, evaluateAllVessels,
  getActiveRecommendations, acknowledgeRecommendation,
  executeRecommendation, dismissRecommendation, getRecommendationHistory
};
