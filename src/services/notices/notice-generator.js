// Notice Generator -- creates insurer notices from templates + event data
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db;

// Default config (would be admin-configurable in production)
const insurerConfig = {
  warRiskUnderwriter: 'War Risk Underwriter',
  hmInsurer: 'H&M Insurer',
  piClub: 'P&I Club',
  broker: 'Insurance Broker',
  policyNumber: 'WR-2026-BIHAR-001',
  dpaName: 'BIHAR Fleet Operations',
  dpaContact: 'ops@bihar.com',
  jwcCircular: 'LMA JWC/001'
};

// Template cache
const templates = {};

function init(database) {
  db = database;
  loadTemplates();
}

function loadTemplates() {
  const templateDir = path.join(__dirname, '..', '..', '..', 'config', 'notice-templates');
  const files = fs.readdirSync(templateDir);
  for (const file of files) {
    if (file.endsWith('.txt')) {
      const name = file.replace('.txt', '');
      templates[name] = fs.readFileSync(path.join(templateDir, file), 'utf8');
    }
  }
  console.log(`[NOTICES] Loaded ${Object.keys(templates).length} notice templates`);
}

/**
 * Fill a template with data by replacing {{PLACEHOLDER}} tokens
 */
function fillTemplate(templateName, data) {
  let content = templates[templateName];
  if (!content) {
    console.error(`[NOTICES] Template not found: ${templateName}`);
    return null;
  }

  // Standard fields always available
  const fields = {
    TIMESTAMP_UTC: new Date().toISOString(),
    WAR_RISK_UNDERWRITER: insurerConfig.warRiskUnderwriter,
    HM_INSURER: insurerConfig.hmInsurer,
    PI_CLUB: insurerConfig.piClub,
    BROKER: insurerConfig.broker,
    POLICY_NUMBER: insurerConfig.policyNumber,
    DPA_NAME: insurerConfig.dpaName,
    DPA_CONTACT: insurerConfig.dpaContact,
    JWC_CIRCULAR: insurerConfig.jwcCircular,
    ...data
  };

  for (const [key, value] of Object.entries(fields)) {
    content = content.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value || '');
  }

  return content;
}

/**
 * Generate a notice and store it in the database
 *
 * @param {string} noticeType - BTW, PROXIMITY, AIS_DARK, ZONE_EXIT, etc.
 * @param {object} vessel - Vessel data (name, imo, lat, lng, speed, course, etc.)
 * @param {string} triggerEvent - Human-readable description of what triggered this
 * @param {object} extraData - Additional data for template filling
 * @returns {object|null} - The created notice record
 */
function generate(noticeType, vessel, triggerEvent, extraData) {
  if (!db) return null;

  const templateMap = {
    BTW: 'btw',
    '7DAY': 'advance-7day',
    AWRP: 'awrp',
    ZONE_EXIT: 'zone-exit',
    PROXIMITY: 'proximity',
    AIS_DARK: 'ais-dark',
    CLAIM: 'claims',
    MONTHLY: 'monthly'
  };

  const templateName = templateMap[noticeType];
  if (!templateName || !templates[templateName]) {
    console.warn(`[NOTICES] No template for notice type: ${noticeType}`);
    return null;
  }

  // Build template data from vessel + extra
  const templateData = {
    VESSEL_NAME: vessel.name || '',
    IMO: vessel.imo || '',
    FLAG: vessel.flag || 'Marshall Islands',
    LAT: (vessel.lat || 0).toFixed(4),
    LNG: (vessel.lng || 0).toFixed(4),
    SPEED: vessel.speed || 0,
    COURSE: vessel.course || 0,
    DESTINATION: vessel.destination || 'Not reported',
    POSITION_TIME: new Date().toISOString(),
    ...(extraData || {})
  };

  const content = fillTemplate(templateName, templateData);
  if (!content) return null;

  // Determine deadline based on notice type
  const deadlines = {
    BTW: 'IMMEDIATELY',
    PROXIMITY: '1 hour',
    AIS_DARK: '2 hours',
    ZONE_EXIT: '24 hours',
    '7DAY': '7 days before entry',
    AWRP: '24 hours',
    CLAIM: 'IMMEDIATELY',
    MONTHLY: '5th business day'
  };

  // Determine auto-send
  const autoSendTypes = ['ZONE_EXIT', 'AWRP', 'MONTHLY'];
  const status = autoSendTypes.includes(noticeType) ? 'AUTO_QUEUED' : 'PENDING';

  const now = new Date().toISOString();
  const zoneId = extraData ? (extraData.JWC_ZONE_ID || null) : null;
  const incidentId = extraData ? (extraData.INCIDENT_ID || null) : null;

  // DB-level dedup: skip if a live notice already exists for this vessel+type+zone within 24h
  try {
    const existing = db.prepare(`
      SELECT id FROM insurer_notices
      WHERE notice_type = ? AND vessel_imo = ?
        AND (zone_id = ? OR (zone_id IS NULL AND ? IS NULL))
        AND status IN ('PENDING', 'AUTO_QUEUED', 'REVIEWED')
        AND generated_at > datetime('now', '-24 hours')
      LIMIT 1
    `).get(noticeType, vessel.imo, zoneId, zoneId);
    if (existing) return null;
  } catch (e) { /* table may not exist yet on first boot */ }

  try {
    const stmt = db.prepare(`
      INSERT INTO insurer_notices
        (notice_type, vessel_imo, vessel_name, trigger_event, trigger_timestamp,
         generated_at, due_by, status, notice_content, policy_ref, zone_id, incident_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      noticeType,
      vessel.imo,
      vessel.name,
      triggerEvent,
      now,
      now,
      deadlines[noticeType] || null,
      status,
      content,
      insurerConfig.policyNumber,
      zoneId,
      incidentId
    );

    const notice = {
      id: result.lastInsertRowid,
      notice_type: noticeType,
      vessel_imo: vessel.imo,
      vessel_name: vessel.name,
      trigger_event: triggerEvent,
      generated_at: now,
      due_by: deadlines[noticeType],
      status,
      notice_content: content
    };

    console.log(`[NOTICES] Generated ${noticeType} notice for ${vessel.name} (${status})`);
    return notice;

  } catch (err) {
    console.error('[NOTICES] Failed to generate notice:', err.message);
    return null;
  }
}

/**
 * Get all pending notices
 */
function getPending() {
  if (!db) return [];
  return db.prepare(`
    SELECT * FROM insurer_notices
    WHERE status IN ('PENDING', 'AUTO_QUEUED')
    ORDER BY generated_at DESC
  `).all();
}

/**
 * Get all notices with optional filters
 */
function getAll(filters) {
  if (!db) return [];
  let query = 'SELECT * FROM insurer_notices WHERE 1=1';
  const params = [];

  if (filters && filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters && filters.vessel_imo) {
    query += ' AND vessel_imo = ?';
    params.push(filters.vessel_imo);
  }
  if (filters && filters.notice_type) {
    query += ' AND notice_type = ?';
    params.push(filters.notice_type);
  }

  query += ' ORDER BY generated_at DESC';

  if (filters && filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params);
}

/**
 * Mark a notice as reviewed (ready to send)
 */
function review(noticeId, userId) {
  if (!db) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE insurer_notices SET status = 'REVIEWED', reviewed_by = ?, reviewed_at = ? WHERE id = ?
  `).run(userId, now, noticeId);
  return db.prepare('SELECT * FROM insurer_notices WHERE id = ?').get(noticeId);
}

/**
 * Mark a notice as sent
 */
function markSent(noticeId, recipients) {
  if (!db) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE insurer_notices SET status = 'SENT', sent_at = ?, sent_to = ? WHERE id = ?
  `).run(now, JSON.stringify(recipients), noticeId);
  return db.prepare('SELECT * FROM insurer_notices WHERE id = ?').get(noticeId);
}

/**
 * Dismiss a notice with reason
 */
function dismiss(noticeId, reason, userId) {
  if (!db) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE insurer_notices SET status = 'DISMISSED', dismiss_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?
  `).run(reason, userId, now, noticeId);
  return db.prepare('SELECT * FROM insurer_notices WHERE id = ?').get(noticeId);
}

module.exports = { init, generate, getPending, getAll, review, markSent, dismiss };
