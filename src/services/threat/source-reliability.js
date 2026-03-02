// Source Reliability Tracker -- NATO-style source credibility scoring
const { v4: uuidv4 } = require('uuid');

let db;

const DEFAULT_SOURCES = [
  { name: 'UKMTO', type: 'SCRAPE', url: 'https://www.ukmto.org', reliability_score: 90 },
  { name: 'MARAD', type: 'RSS', url: 'https://www.maritime.dot.gov', reliability_score: 85 },
  { name: 'CENTCOM', type: 'RSS', url: 'https://www.centcom.mil', reliability_score: 80 },
  { name: 'ACLED', type: 'API', url: 'https://acleddata.com', reliability_score: 65 },
  { name: 'MANUAL', type: 'MANUAL', url: null, reliability_score: 70 }
];

function init(database) {
  db = database;

  // Ensure core tables exist (inline, independent of migration file parsing)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS threat_sources (
        id                    TEXT PRIMARY KEY,
        name                  TEXT NOT NULL UNIQUE,
        type                  TEXT NOT NULL,
        url                   TEXT,
        reliability_score     REAL DEFAULT 50,
        total_reports         INTEGER DEFAULT 0,
        confirmed_reports     INTEGER DEFAULT 0,
        false_reports         INTEGER DEFAULT 0,
        last_poll_at          TEXT,
        last_success_at       TEXT,
        poll_interval_minutes INTEGER DEFAULT 5,
        enabled               INTEGER DEFAULT 1,
        config                TEXT,
        created_at            TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS threat_actors (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        type                TEXT NOT NULL,
        description         TEXT,
        known_ttps          TEXT,
        active_regions      TEXT,
        threat_level        TEXT DEFAULT 'UNKNOWN',
        last_activity_date  TEXT,
        incident_count      INTEGER DEFAULT 0,
        created_at          TEXT DEFAULT (datetime('now')),
        updated_at          TEXT
      );
      CREATE TABLE IF NOT EXISTS incident_actors (
        incident_id TEXT NOT NULL REFERENCES incidents(id),
        actor_id    TEXT NOT NULL REFERENCES threat_actors(id),
        confidence  TEXT DEFAULT 'SUSPECTED',
        PRIMARY KEY (incident_id, actor_id)
      );
      CREATE INDEX IF NOT EXISTS idx_threat_sources_name ON threat_sources(name);
    `);
  } catch (err) {
    console.error('[RELIABILITY] Table creation error:', err.message);
  }

  // Run ALTER TABLE columns from migration (these may fail with 'duplicate column' on re-runs)
  const alterColumns = [
    'lifecycle_status TEXT DEFAULT \'REPORTED\'',
    'impact_area TEXT',
    'confidence_score REAL DEFAULT 50',
    'source_reliability TEXT DEFAULT \'UNKNOWN\'',
    'casualty_type TEXT',
    'casualty_count INTEGER DEFAULT 0',
    'vessel_damage TEXT',
    'environmental_impact TEXT',
    'cargo_impact TEXT',
    'attack_method TEXT',
    'suspect_actor_type TEXT',
    'evidence_sources TEXT',
    'related_incident_ids TEXT',
    'impact_radius_nm REAL',
    'recommended_clearance_nm REAL DEFAULT 50',
    'escalation_potential TEXT DEFAULT \'UNKNOWN\''
  ];
  for (const col of alterColumns) {
    try { db.exec(`ALTER TABLE incidents ADD COLUMN ${col};`); } catch (e) {
      // Expected on re-runs: duplicate column
    }
  }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_incidents_lifecycle ON incidents(lifecycle_status);'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_incidents_confidence ON incidents(confidence_score);'); } catch (e) {}
  console.log('[RELIABILITY] Migration 002 applied');

  try {
    seedDefaultSources();
  } catch (err) {
    console.error('[RELIABILITY] Seed error:', err.message);
  }
}

function seedDefaultSources() {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO threat_sources (id, name, type, url, reliability_score)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const src of DEFAULT_SOURCES) {
    stmt.run(uuidv4(), src.name, src.type, src.url, src.reliability_score);
  }
}

/**
 * Get reliability info for a source
 * @param {string} sourceName
 * @returns {{ score: number, rating: string, stats: Object }}
 */
function getSourceReliability(sourceName) {
  if (!db) return { score: 50, rating: 'UNKNOWN', stats: {} };
  const src = db.prepare('SELECT * FROM threat_sources WHERE name = ?').get(sourceName);
  if (!src) return { score: 50, rating: 'UNKNOWN', stats: {} };
  return {
    score: src.reliability_score,
    rating: scoreToRating(src.reliability_score),
    stats: {
      total: src.total_reports,
      confirmed: src.confirmed_reports,
      false: src.false_reports,
      lastPoll: src.last_poll_at
    }
  };
}

function scoreToRating(score) {
  if (score >= 90) return 'CONFIRMED';
  if (score >= 75) return 'RELIABLE';
  if (score >= 60) return 'USUALLY_RELIABLE';
  if (score >= 40) return 'FAIRLY_RELIABLE';
  return 'UNRELIABLE';
}

/** Incident from this source was confirmed as real */
function updateOnConfirm(sourceName) {
  if (!db) return;
  db.prepare(`
    UPDATE threat_sources
    SET reliability_score = MIN(100, reliability_score + 2),
        confirmed_reports = confirmed_reports + 1,
        total_reports = total_reports + 1
    WHERE name = ?
  `).run(sourceName);
}

/** Incident from this source was a false alarm */
function updateOnFalseAlarm(sourceName) {
  if (!db) return;
  db.prepare(`
    UPDATE threat_sources
    SET reliability_score = MAX(0, reliability_score - 5),
        false_reports = false_reports + 1,
        total_reports = total_reports + 1
    WHERE name = ?
  `).run(sourceName);
}

/** Incident resolved (real event) */
function updateOnResolve(sourceName) {
  if (!db) return;
  db.prepare(`
    UPDATE threat_sources
    SET reliability_score = MIN(100, reliability_score + 1),
        total_reports = total_reports + 1
    WHERE name = ?
  `).run(sourceName);
}

/** Record a successful poll */
function recordPoll(sourceName) {
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare('UPDATE threat_sources SET last_poll_at = ?, last_success_at = ? WHERE name = ?')
    .run(now, now, sourceName);
}

/** Get all source records */
function getAllSources() {
  if (!db) return [];
  return db.prepare('SELECT * FROM threat_sources ORDER BY reliability_score DESC').all();
}

module.exports = { init, getSourceReliability, updateOnConfirm, updateOnFalseAlarm, updateOnResolve, recordPoll, getAllSources, scoreToRating };
