// Incident Lifecycle Manager -- manages status transitions and auto-expiry
const { v4: uuidv4 } = require('uuid');

let db;

// Valid transitions
const TRANSITIONS = {
  REPORTED:     ['INVESTIGATING', 'CONFIRMED', 'UNCONFIRMED', 'RESOLVED'],
  INVESTIGATING: ['CONFIRMED', 'UNCONFIRMED', 'RESOLVED'],
  CONFIRMED:    ['RESOLVED'],
  UNCONFIRMED:  ['RESOLVED', 'ARCHIVED'],
  RESOLVED:     ['ARCHIVED'],
  ARCHIVED:     []
};

function init(database) {
  db = database;
}

/**
 * Transition an incident to a new lifecycle status
 * @param {string} incidentId
 * @param {string} newStatus
 * @param {string} userId
 * @param {string} notes
 * @returns {Object|null} Updated incident
 */
function transitionStatus(incidentId, newStatus, userId, notes) {
  if (!db) return null;

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
  if (!incident) return null;

  const currentStatus = incident.lifecycle_status || 'REPORTED';
  const valid = TRANSITIONS[currentStatus] || [];

  if (!valid.includes(newStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} -> ${newStatus}. Valid: ${valid.join(', ')}`);
  }

  const now = new Date().toISOString();

  // Update lifecycle status
  db.prepare('UPDATE incidents SET lifecycle_status = ?, updated_at = ? WHERE id = ?')
    .run(newStatus, now, incidentId);

  // Map lifecycle to legacy status field for backward compatibility
  const statusMap = {
    REPORTED: 'active', INVESTIGATING: 'active', CONFIRMED: 'active',
    UNCONFIRMED: 'active', RESOLVED: 'resolved', ARCHIVED: 'expired'
  };
  if (statusMap[newStatus]) {
    db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(statusMap[newStatus], incidentId);
  }

  // If confirmed/false_alarm, update source reliability
  if (newStatus === 'CONFIRMED' && incident.source) {
    try {
      const sourceReliability = require('./source-reliability');
      sourceReliability.updateOnConfirm(incident.source);
    } catch (e) { /* optional */ }
  }
  if (newStatus === 'UNCONFIRMED' && incident.source) {
    try {
      const sourceReliability = require('./source-reliability');
      sourceReliability.updateOnFalseAlarm(incident.source);
    } catch (e) { /* optional */ }
  }

  // Log the transition
  db.prepare(
    'INSERT INTO incident_updates (id, incident_id, note, source, updated_by) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), incidentId, `Status changed: ${currentStatus} -> ${newStatus}. ${notes || ''}`.trim(), 'LIFECYCLE', userId || 'system');

  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
}

/**
 * Get valid next transitions for current status
 */
function getValidTransitions(currentStatus) {
  return TRANSITIONS[currentStatus] || [];
}

/**
 * Auto-transition stale incidents
 * - No updates for 7 days -> RESOLVED
 * - In RESOLVED for 30 days -> ARCHIVED
 * - Expiry_hours elapsed -> RESOLVED
 */
function runAutoTransitions() {
  if (!db) return { resolved: 0, archived: 0, expired: 0 };

  let resolved = 0;
  let archived = 0;
  let expired = 0;

  // Auto-expire based on expiry_hours
  const expirable = db.prepare(`
    SELECT id, timestamp, expiry_hours FROM incidents
    WHERE status = 'active' AND expiry_hours IS NOT NULL
    AND lifecycle_status IN ('REPORTED', 'INVESTIGATING', 'CONFIRMED')
  `).all();

  for (const inc of expirable) {
    const created = new Date(inc.timestamp).getTime();
    const expiryMs = (inc.expiry_hours || 168) * 60 * 60 * 1000;
    if (Date.now() - created > expiryMs) {
      try {
        transitionStatus(inc.id, 'RESOLVED', 'system', 'Auto-resolved: expiry time elapsed');
        expired++;
      } catch (e) { /* skip invalid transitions */ }
    }
  }

  // Auto-resolve: no updates for 7 days
  const stale = db.prepare(`
    SELECT id FROM incidents
    WHERE status = 'active'
    AND lifecycle_status IN ('REPORTED', 'INVESTIGATING')
    AND updated_at < datetime('now', '-7 days')
  `).all();

  for (const inc of stale) {
    try {
      transitionStatus(inc.id, 'RESOLVED', 'system', 'Auto-resolved: no updates for 7 days');
      resolved++;
    } catch (e) { /* skip */ }
  }

  // Auto-archive: in RESOLVED for 30 days
  const archivable = db.prepare(`
    SELECT id FROM incidents
    WHERE lifecycle_status = 'RESOLVED'
    AND updated_at < datetime('now', '-30 days')
  `).all();

  for (const inc of archivable) {
    try {
      transitionStatus(inc.id, 'ARCHIVED', 'system', 'Auto-archived: resolved for 30+ days');
      archived++;
    } catch (e) { /* skip */ }
  }

  if (resolved + archived + expired > 0) {
    console.log(`[LIFECYCLE] Auto-transitions: ${expired} expired, ${resolved} resolved, ${archived} archived`);
  }

  return { resolved, archived, expired };
}

/**
 * Get lifecycle history for an incident
 */
function getLifecycleHistory(incidentId) {
  if (!db) return [];
  return db.prepare(
    "SELECT * FROM incident_updates WHERE incident_id = ? AND source = 'LIFECYCLE' ORDER BY timestamp DESC"
  ).all(incidentId);
}

module.exports = { init, transitionStatus, getValidTransitions, runAutoTransitions, getLifecycleHistory, TRANSITIONS };
