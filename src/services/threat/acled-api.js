// ACLED API Adapter -- fetches geocoded conflict data from Armed Conflict Location & Event Data
// Focuses on Yemen maritime-related events (Explosions/Remote violence)
// Free tier: rate-limited, weekly updates, data from 2015 to present

const config = require('../../../config/default');

const ACLED_BASE_URL = 'https://api.acleddata.com/acled/read';

/**
 * Fetch recent ACLED events for Yemen/maritime region
 * Uses the public API (rate-limited but sufficient for weekly pulls)
 *
 * @param {object} opts - Optional overrides
 * @param {number} opts.daysBack - How far back to look (default: 90)
 * @returns {Array} Raw ACLED event objects
 */
async function fetchAdvisories(opts) {
  const apiKey = process.env.ACLED_API_KEY;
  const apiEmail = process.env.ACLED_EMAIL;

  if (!apiKey || !apiEmail) {
    console.log('[ACLED] No API key/email configured -- using seed data only');
    return [];
  }

  const daysBack = (opts && opts.daysBack) || 90;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split('T')[0];

  // ACLED query params: Yemen, Explosions/Remote violence, recent events
  const params = new URLSearchParams({
    key: apiKey,
    email: apiEmail,
    country: 'Yemen',
    event_type: 'Explosions/Remote violence',
    event_date: sinceStr,
    event_date_where: '>=',
    limit: '500'
  });

  try {
    const resp = await fetch(ACLED_BASE_URL + '?' + params.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      console.error('[ACLED] API error: ' + resp.status);
      return [];
    }

    const data = await resp.json();
    if (!data.data || !Array.isArray(data.data)) {
      console.log('[ACLED] No events returned');
      return [];
    }

    console.log('[ACLED] Fetched ' + data.data.length + ' events');
    return data.data;
  } catch (err) {
    console.error('[ACLED] Fetch error:', err.message);
    return [];
  }
}

/**
 * Normalize an ACLED event into the standard incident format
 */
function normalizeAdvisory(event) {
  // ACLED event fields: data_id, event_date, event_type, sub_event_type,
  //   actor1, actor2, notes, latitude, longitude, fatalities

  const lat = parseFloat(event.latitude);
  const lon = parseFloat(event.longitude);

  // Classify incident type from sub_event_type and notes
  const type = classifyType(event.sub_event_type, event.notes || '');

  // Severity based on sub_event_type and fatalities
  const severity = classifySeverity(event.sub_event_type, event.fatalities);

  // Infer corridor from coordinates
  const corridor = inferCorridor(lat, lon);

  return {
    timestamp: event.event_date ? new Date(event.event_date).toISOString() : new Date().toISOString(),
    lat: isNaN(lat) ? null : lat,
    lon: isNaN(lon) ? null : lon,
    type: type,
    severity: severity,
    title: (event.sub_event_type || 'Conflict event') + ' -- ' + (event.admin1 || 'Yemen'),
    description: (event.notes || '').substring(0, 500),
    source: 'ACLED',
    sourceRef: 'ACLED-' + (event.data_id || Date.now()),
    verified: true, // ACLED data is peer-reviewed
    targetVessel: null,
    targetImo: null,
    weaponType: extractWeapon(event.notes || ''),
    attributedTo: event.actor1 || null,
    corridor: corridor
  };
}

function classifyType(subEventType, notes) {
  const sub = (subEventType || '').toLowerCase();
  const n = notes.toLowerCase();

  if (n.includes('drone') || n.includes('uav') || n.includes('unmanned')) return 'DRONE_ATTACK';
  if (n.includes('missile') || n.includes('asbm') || n.includes('cruise')) return 'MISSILE_ATTACK';
  if (n.includes('mine') || n.includes('waterborne ied')) return 'MINE_THREAT';
  if (n.includes('seiz') || n.includes('board') || n.includes('hijack')) return 'SEIZURE';
  if (sub.includes('shelling') || sub.includes('bombardment')) return 'MILITARY_ACTION';
  if (sub.includes('remote explosive') || sub.includes('air/drone')) return 'DRONE_ATTACK';
  return 'MILITARY_ACTION';
}

function classifySeverity(subEventType, fatalities) {
  const fat = parseInt(fatalities) || 0;
  if (fat >= 5) return 5;
  if (fat >= 1) return 4;
  const sub = (subEventType || '').toLowerCase();
  if (sub.includes('air/drone') || sub.includes('missile')) return 4;
  if (sub.includes('shelling')) return 3;
  return 3;
}

function extractWeapon(notes) {
  const n = notes.toLowerCase();
  if (n.includes('anti-ship ballistic missile') || n.includes('asbm')) return 'ASBM';
  if (n.includes('cruise missile')) return 'Cruise Missile';
  if (n.includes('drone') || n.includes('uav')) return 'UAV';
  if (n.includes('missile')) return 'Missile';
  if (n.includes('mine')) return 'Mine';
  return null;
}

function inferCorridor(lat, lon) {
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat >= 12.0 && lat <= 13.5 && lon >= 42.5 && lon <= 44.0) return 'BAB_EL_MANDEB';
  if (lat >= 11.5 && lat <= 15.0 && lon >= 44.0 && lon <= 52.0) return 'GULF_OF_ADEN';
  if (lat >= 13.0 && lat <= 20.0 && lon >= 38.0 && lon <= 44.0) return 'RED_SEA';
  if (lat >= 10.0 && lat <= 18.0 && lon >= 52.0 && lon <= 60.0) return 'ARABIAN_SEA';
  return null;
}

module.exports = { fetchAdvisories, normalizeAdvisory };
