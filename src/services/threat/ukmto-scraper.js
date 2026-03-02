// UKMTO (United Kingdom Maritime Trade Operations) scraper
// Fetches maritime security advisories from UKMTO's public feed
// In production, this would scrape the actual UKMTO website
// For now, provides a structured adapter that returns sample data when the source is unavailable

const SOURCE = 'UKMTO';

/**
 * Fetch latest UKMTO advisories
 * @returns {Promise<Array>} Raw advisories in UKMTO format
 */
async function fetchAdvisories() {
  try {
    // UKMTO doesn't have a public API/RSS -- in production we'd scrape their site
    // For development, return empty (the seed data provides initial incidents)
    console.log('[UKMTO] Scraper check complete (stub mode -- no public API)');
    return [];
  } catch (err) {
    console.error('[UKMTO] Scraper error:', err.message);
    return [];
  }
}

/**
 * Transform UKMTO advisory into normalized incident format
 */
function normalizeAdvisory(advisory) {
  return {
    sourceId: SOURCE + ':' + (advisory.reference || advisory.id),
    source: SOURCE,
    sourceRef: advisory.reference || advisory.id,
    timestamp: advisory.timestamp || new Date().toISOString(),
    lat: advisory.lat || null,
    lon: advisory.lon || null,
    type: mapIncidentType(advisory.type || advisory.category),
    severity: mapSeverity(advisory.type || advisory.category),
    title: advisory.title || 'UKMTO Advisory',
    description: advisory.description || '',
    verified: true,
    targetVessel: advisory.vessel || null,
    targetImo: advisory.imo || null,
    weaponType: advisory.weaponType || null,
    attributedTo: advisory.attribution || null,
    corridor: advisory.corridor || null
  };
}

function mapIncidentType(type) {
  if (!type) return 'SUSPICIOUS_APPROACH';
  var t = type.toUpperCase();
  if (t.includes('MISSILE') || t.includes('STRIKE')) return 'MISSILE_ATTACK';
  if (t.includes('DRONE') || t.includes('UAV') || t.includes('UAS')) return 'DRONE_ATTACK';
  if (t.includes('PIRACY') || t.includes('BOARD')) return 'PIRACY';
  if (t.includes('MINE')) return 'MINE_THREAT';
  if (t.includes('SUSPICIOUS')) return 'SUSPICIOUS_APPROACH';
  if (t.includes('SEIZURE') || t.includes('DETAIN')) return 'SEIZURE';
  return 'SUSPICIOUS_APPROACH';
}

function mapSeverity(type) {
  if (!type) return 3;
  var t = type.toUpperCase();
  if (t.includes('MISSILE') || t.includes('STRIKE') || t.includes('EXPLOSION')) return 5;
  if (t.includes('DRONE') || t.includes('SEIZURE')) return 4;
  if (t.includes('PIRACY') || t.includes('BOARD')) return 4;
  if (t.includes('MINE')) return 4;
  return 3;
}

module.exports = { fetchAdvisories, normalizeAdvisory, SOURCE };
