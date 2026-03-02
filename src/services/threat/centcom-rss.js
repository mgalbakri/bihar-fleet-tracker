// CENTCOM (US Central Command) press release RSS adapter
// Fetches maritime-related press releases from CENTCOM

const RssParser = require('rss-parser');
const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

const SOURCE = 'CENTCOM';
const FEED_URL = 'https://www.centcom.mil/RSS/';

/**
 * Fetch latest CENTCOM press releases from RSS
 * @returns {Promise<Array>} Raw RSS items filtered for maritime relevance
 */
async function fetchAdvisories() {
  try {
    const feed = await parser.parseURL(FEED_URL);
    const maritime = feed.items.filter(function(item) {
      var text = ((item.title || '') + ' ' + (item.contentSnippet || '')).toLowerCase();
      return text.includes('maritime') || text.includes('vessel') ||
             text.includes('houthi') || text.includes('red sea') ||
             text.includes('gulf of aden') || text.includes('shipping') ||
             text.includes('naval') || text.includes('strait') ||
             text.includes('merchant') || text.includes('tanker');
    });
    console.log('[CENTCOM] Fetched ' + maritime.length + ' maritime releases from RSS');
    return maritime.slice(0, 20);
  } catch (err) {
    console.error('[CENTCOM] RSS fetch error:', err.message);
    return [];
  }
}

/**
 * Transform CENTCOM RSS item into normalized incident format
 */
function normalizeAdvisory(item) {
  var coords = extractCoords(item.contentSnippet || item.content || '');
  var text = (item.title || '') + ' ' + (item.contentSnippet || '');

  return {
    sourceId: SOURCE + ':' + (item.guid || item.link || item.title),
    source: SOURCE,
    sourceRef: item.link || item.guid || '',
    timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
    type: classifyFromText(text),
    severity: classifySeverity(text),
    title: item.title || 'CENTCOM Release',
    description: (item.contentSnippet || '').substring(0, 500),
    verified: true,
    targetVessel: extractVesselName(text),
    targetImo: null,
    weaponType: extractWeapon(text),
    attributedTo: extractAttribution(text),
    corridor: inferCorridor(text)
  };
}

function extractCoords(text) {
  var dmsMatch = text.match(/(\d{1,3})[°]\s*(\d{1,2})['']\s*([NS])\s+(\d{1,3})[°]\s*(\d{1,2})['']\s*([EW])/);
  if (dmsMatch) {
    var lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60;
    if (dmsMatch[3] === 'S') lat = -lat;
    var lon = parseInt(dmsMatch[4]) + parseInt(dmsMatch[5]) / 60;
    if (dmsMatch[6] === 'W') lon = -lon;
    return { lat: lat, lon: lon };
  }
  return null;
}

function classifyFromText(text) {
  var t = text.toUpperCase();
  if (t.includes('MISSILE') || t.includes('BALLISTIC')) return 'MISSILE_ATTACK';
  if (t.includes('DRONE') || t.includes('UAV') || t.includes('UAS') || t.includes('UNMANNED')) return 'DRONE_ATTACK';
  if (t.includes('PIRACY') || t.includes('PIRATE') || t.includes('HIJACK')) return 'PIRACY';
  if (t.includes('MINE') || t.includes('LIMPET')) return 'MINE_THREAT';
  if (t.includes('SEIZURE') || t.includes('SEIZED') || t.includes('DETAINED')) return 'SEIZURE';
  if (t.includes('DESTROY') || t.includes('INTERCEPT') || t.includes('ENGAGE')) return 'MILITARY_ACTION';
  return 'ADVISORY';
}

function classifySeverity(text) {
  var t = text.toUpperCase();
  if (t.includes('STRUCK') || t.includes('HIT') || t.includes('DAMAGE') || t.includes('EXPLOSION') || t.includes('SANK')) return 5;
  if (t.includes('MISSILE') || t.includes('ATTACK') || t.includes('SEIZED')) return 4;
  if (t.includes('DRONE') || t.includes('ATTEMPT')) return 4;
  return 3;
}

function extractVesselName(text) {
  // Look for patterns like "MV VESSEL NAME" or "M/V VESSEL NAME"
  var mvMatch = text.match(/(?:MV|M\/V|MT|M\/T)\s+([A-Z][A-Z\s]{2,30}?)(?:\s*[,.\(]|$)/i);
  return mvMatch ? mvMatch[1].trim() : null;
}

function extractWeapon(text) {
  var t = text.toUpperCase();
  if (t.includes('ANTI-SHIP BALLISTIC MISSILE') || t.includes('ASBM')) return 'ASBM';
  if (t.includes('CRUISE MISSILE')) return 'CRUISE_MISSILE';
  if (t.includes('BALLISTIC MISSILE')) return 'BALLISTIC_MISSILE';
  if (t.includes('MISSILE')) return 'MISSILE';
  if (t.includes('DRONE') || t.includes('UAV') || t.includes('UAS')) return 'UAV';
  if (t.includes('USV') || t.includes('UNMANNED SURFACE')) return 'USV';
  if (t.includes('MINE') || t.includes('LIMPET')) return 'MINE';
  return null;
}

function extractAttribution(text) {
  var t = text.toUpperCase();
  if (t.includes('HOUTHI') || t.includes('ANSAR ALLAH')) return 'Houthi';
  if (t.includes('IRAN') || t.includes('IRGC')) return 'Iran/IRGC';
  if (t.includes('PIRATE') || t.includes('PIRACY')) return 'Pirates';
  return null;
}

function inferCorridor(text) {
  var t = text.toUpperCase();
  if (t.includes('HORMUZ')) return 'HORMUZ';
  if (t.includes('BAB') || t.includes('MANDEB')) return 'BAB_EL_MANDEB';
  if (t.includes('ADEN')) return 'GULF_OF_ADEN';
  if (t.includes('RED SEA')) return 'JWC_RED_SEA_SOUTH';
  if (t.includes('ARABIAN SEA')) return 'ARABIAN_SEA';
  if (t.includes('SOMALI')) return 'SOMALI_BASIN';
  return null;
}

module.exports = { fetchAdvisories, normalizeAdvisory, SOURCE };
