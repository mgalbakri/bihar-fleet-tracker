// Incident Normalizer -- deduplicates and standardizes incidents from all threat sources
const { v4: uuidv4 } = require('uuid');

let db;

function init(database) {
  db = database;
}

// Valid incident types
const INCIDENT_TYPES = [
  'MISSILE_ATTACK', 'DRONE_ATTACK', 'PIRACY', 'MINE_THREAT',
  'SEIZURE', 'SUSPICIOUS_APPROACH', 'MILITARY_ACTION', 'ADVISORY',
  'ATTACK', 'SANCTIONS', 'SECURITY_REPORT'
];

/**
 * Process a batch of normalized advisories -- deduplicate and store new ones
 * @param {Array} advisories - Already normalized via source-specific normalizeAdvisory()
 * @returns {{ inserted: number, duplicates: number, errors: number }}
 */
function processAdvisories(advisories) {
  if (!db) return { inserted: 0, duplicates: 0, errors: 0 };

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  const checkStmt = db.prepare('SELECT id FROM incidents WHERE source = ? AND source_ref = ?');
  const insertStmt = db.prepare(`
    INSERT INTO incidents (id, timestamp, lat, lon, type, severity, title, description,
      source, source_ref, verified, target_vessel, target_imo, weapon_type,
      attributed_to, corridor, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const process = db.transaction(function(advisories) {
    for (const adv of advisories) {
      try {
        // Skip if missing required fields (lat/lon required by DB schema)
        if (!adv.title || !adv.source) {
          errors++;
          continue;
        }
        if (adv.lat == null || adv.lon == null) {
          continue; // Skip silently -- no displayable location
        }

        // Deduplicate by source + sourceRef
        if (adv.sourceRef) {
          var existing = checkStmt.get(adv.source, adv.sourceRef);
          if (existing) {
            duplicates++;
            continue;
          }
        }

        // Validate and normalize type
        var type = INCIDENT_TYPES.includes(adv.type) ? adv.type : 'ADVISORY';
        var severity = Math.min(5, Math.max(1, adv.severity || 3));

        insertStmt.run(
          uuidv4(),
          adv.timestamp || new Date().toISOString(),
          adv.lat,
          adv.lon,
          type,
          severity,
          adv.title.substring(0, 200),
          (adv.description || '').substring(0, 1000),
          adv.source,
          adv.sourceRef || '',
          adv.verified ? 1 : 0,
          adv.targetVessel || null,
          adv.targetImo || null,
          adv.weaponType || null,
          adv.attributedTo || null,
          adv.corridor || null
        );
        inserted++;
      } catch (err) {
        console.error('[NORMALIZER] Error processing advisory:', err.message);
        errors++;
      }
    }
  });

  process(advisories);

  if (inserted > 0) {
    console.log('[NORMALIZER] Processed: ' + inserted + ' new, ' + duplicates + ' duplicates, ' + errors + ' errors');
  }

  return { inserted, duplicates, errors };
}

module.exports = { init, processAdvisories, INCIDENT_TYPES };
