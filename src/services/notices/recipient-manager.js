// Recipient Manager -- manages notice recipients and matching logic
const { v4: uuidv4 } = require('uuid');

let db;

function init(database) {
  db = database;

  // Ensure table exists (in case email-service migration didn't run yet)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notice_recipients (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL,
        role          TEXT NOT NULL,
        company       TEXT,
        vessel_imo    TEXT,
        notice_types  TEXT,
        active        INTEGER DEFAULT 1,
        created_at    TEXT DEFAULT (datetime('now')),
        updated_at    TEXT
      );
    `);
  } catch (e) { /* table likely exists */ }

  try {
    seedDefaultRecipients();
  } catch (err) {
    console.error('[RECIPIENTS] Seed error:', err.message);
  }
}

function seedDefaultRecipients() {
  if (!db) return;
  const count = db.prepare('SELECT COUNT(*) as cnt FROM notice_recipients').get();
  if (count && count.cnt > 0) return;

  const defaults = [
    { name: 'War Risk Underwriter', email: 'warrisk@insurer.example.com', role: 'INSURER', company: 'War Risk Syndicate' },
    { name: 'H&M Insurer', email: 'hm@insurer.example.com', role: 'INSURER', company: 'Hull & Machinery Group' },
    { name: 'P&I Club Contact', email: 'claims@pandi.example.com', role: 'P_AND_I', company: 'International P&I Club' },
    { name: 'Insurance Broker', email: 'broker@brokers.example.com', role: 'BROKER', company: 'Maritime Brokers Ltd' },
    { name: 'DPA Operations', email: 'ops@bihar.example.com', role: 'DPA', company: 'BIHAR Shipping' }
  ];

  const stmt = db.prepare(`
    INSERT INTO notice_recipients (id, name, email, role, company, active) VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const r of defaults) {
    stmt.run(uuidv4(), r.name, r.email, r.role, r.company);
  }
  console.log('[RECIPIENTS] Seeded default recipients');
}

/**
 * Find matching recipients for a notice
 * @param {string} noticeType - e.g. BTW, PROXIMITY
 * @param {string} vesselImo - Vessel IMO number
 * @returns {Array} Matching recipients
 */
function getRecipientsForNotice(noticeType, vesselImo) {
  if (!db) return [];
  const all = db.prepare('SELECT * FROM notice_recipients WHERE active = 1').all();
  return all.filter(r => {
    // Check vessel filter
    if (r.vessel_imo && r.vessel_imo !== vesselImo) return false;
    // Check notice type filter
    if (r.notice_types) {
      try {
        const types = JSON.parse(r.notice_types);
        if (!types.includes(noticeType)) return false;
      } catch (e) { /* no filter */ }
    }
    return true;
  });
}

function addRecipient(data) {
  if (!db) return null;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO notice_recipients (id, name, email, role, company, vessel_imo, notice_types, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, data.name, data.email, data.role, data.company || null, data.vessel_imo || null, data.notice_types ? JSON.stringify(data.notice_types) : null);
  return db.prepare('SELECT * FROM notice_recipients WHERE id = ?').get(id);
}

function updateRecipient(id, data) {
  if (!db) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE notice_recipients SET name = ?, email = ?, role = ?, company = ?, vessel_imo = ?, notice_types = ?, active = ?, updated_at = ?
    WHERE id = ?
  `).run(data.name, data.email, data.role, data.company || null, data.vessel_imo || null,
    data.notice_types ? JSON.stringify(data.notice_types) : null, data.active !== undefined ? data.active : 1, now, id);
  return db.prepare('SELECT * FROM notice_recipients WHERE id = ?').get(id);
}

function removeRecipient(id) {
  if (!db) return;
  db.prepare('DELETE FROM notice_recipients WHERE id = ?').run(id);
}

function listRecipients(filters) {
  if (!db) return [];
  let query = 'SELECT * FROM notice_recipients WHERE 1=1';
  const params = [];
  if (filters && filters.role) { query += ' AND role = ?'; params.push(filters.role); }
  if (filters && filters.active !== undefined) { query += ' AND active = ?'; params.push(filters.active ? 1 : 0); }
  query += ' ORDER BY role, name';
  return db.prepare(query).all(...params);
}

module.exports = { init, getRecipientsForNotice, addRecipient, updateRecipient, removeRecipient, listRecipients };
