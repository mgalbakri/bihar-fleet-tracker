// MARAD (US Maritime Administration) RSS feed adapter
// Fetches maritime advisories from MARAD's public RSS feed

const RssParser = require('rss-parser');
const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

const SOURCE = 'MARAD';
const FEED_URL = 'https://www.maritime.dot.gov/rss.xml';

/**
 * Fetch latest MARAD advisories from RSS
 * @returns {Promise<Array>} Raw RSS items
 */
async function fetchAdvisories() {
  try {
    const feed = await parser.parseURL(FEED_URL);
    const maritime = feed.items.filter(function(item) {
      var title = (item.title || '').toLowerCase();
      var content = (item.contentSnippet || '').toLowerCase();
      return title.includes('advisory') || title.includes('alert') ||
             title.includes('maritime') || content.includes('vessel') ||
             content.includes('shipping') || content.includes('piracy');
    });
    console.log('[MARAD] Fetched ' + maritime.length + ' advisories from RSS');
    return maritime.slice(0, 20); // Limit to most recent 20
  } catch (err) {
    console.error('[MARAD] RSS fetch error:', err.message);
    return [];
  }
}

/**
 * Transform MARAD RSS item into normalized incident format
 */
function normalizeAdvisory(item) {
  var coords = extractCoords(item.contentSnippet || item.content || '');
  return {
    sourceId: SOURCE + ':' + (item.guid || item.link || item.title),
    source: SOURCE,
    sourceRef: item.link || item.guid || '',
    timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
    type: classifyFromText(item.title + ' ' + (item.contentSnippet || '')),
    severity: 3, // MARAD advisories are generally informational
    title: item.title || 'MARAD Advisory',
    description: (item.contentSnippet || '').substring(0, 500),
    verified: true,
    targetVessel: null,
    targetImo: null,
    weaponType: null,
    attributedTo: null,
    corridor: inferCorridor(item.title + ' ' + (item.contentSnippet || ''))
  };
}

/**
 * Try to extract lat/lon from text content
 */
function extractCoords(text) {
  // Match patterns like "12°30'N 043°15'E" or "12.5N, 43.25E" or "lat 12.5 lon 43.25"
  var dmsMatch = text.match(/(\d{1,3})[°]\s*(\d{1,2})['']\s*([NS])\s+(\d{1,3})[°]\s*(\d{1,2})['']\s*([EW])/);
  if (dmsMatch) {
    var lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60;
    if (dmsMatch[3] === 'S') lat = -lat;
    var lon = parseInt(dmsMatch[4]) + parseInt(dmsMatch[5]) / 60;
    if (dmsMatch[6] === 'W') lon = -lon;
    return { lat: lat, lon: lon };
  }
  // Match decimal degrees
  var decMatch = text.match(/(\d{1,3}\.\d+)\s*([NS])\s*[,\s]+\s*(\d{1,3}\.\d+)\s*([EW])/);
  if (decMatch) {
    var lat2 = parseFloat(decMatch[1]);
    if (decMatch[2] === 'S') lat2 = -lat2;
    var lon2 = parseFloat(decMatch[3]);
    if (decMatch[4] === 'W') lon2 = -lon2;
    return { lat: lat2, lon: lon2 };
  }
  return null;
}

function classifyFromText(text) {
  var t = text.toUpperCase();
  if (t.includes('MISSILE')) return 'MISSILE_ATTACK';
  if (t.includes('DRONE') || t.includes('UAV')) return 'DRONE_ATTACK';
  if (t.includes('PIRACY') || t.includes('PIRATE')) return 'PIRACY';
  if (t.includes('MINE')) return 'MINE_THREAT';
  if (t.includes('SEIZURE') || t.includes('DETAINED')) return 'SEIZURE';
  return 'ADVISORY';
}

function inferCorridor(text) {
  var t = text.toUpperCase();
  if (t.includes('HORMUZ')) return 'HORMUZ';
  if (t.includes('BAB') || t.includes('MANDEB')) return 'BAB_EL_MANDEB';
  if (t.includes('ADEN')) return 'GULF_OF_ADEN';
  if (t.includes('RED SEA')) return 'JWC_RED_SEA_SOUTH';
  if (t.includes('ARABIAN SEA')) return 'ARABIAN_SEA';
  if (t.includes('SOMALI')) return 'SOMALI_BASIN';
  if (t.includes('SUEZ')) return 'SUEZ_APPROACH';
  return null;
}

module.exports = { fetchAdvisories, normalizeAdvisory, SOURCE };
