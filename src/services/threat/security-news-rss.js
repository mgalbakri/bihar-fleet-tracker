// Security News RSS -- extract threat intelligence from maritime news feeds
// Filters gCaptain and Seatrade Maritime for security-relevant articles
// BIHAR SENTINEL

const RssParser = require('rss-parser');

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

const SOURCE = 'NEWS_INTEL';

const SECURITY_FEEDS = [
  { name: 'gCaptain', url: 'https://gcaptain.com/feed/' },
  { name: 'Seatrade', url: 'https://www.seatrade-maritime.com/rss.xml' }
];

// Keywords that indicate security-relevant content
const THREAT_KEYWORDS = [
  'attack', 'missile', 'drone', 'uav', 'houthi', 'piracy', 'pirate', 'hijack',
  'seized', 'seizure', 'detained', 'war zone', 'threat', 'strike', 'struck',
  'military', 'naval', 'explosion', 'damage', 'sank', 'tanker hit',
  'red sea', 'gulf of aden', 'hormuz', 'bab el mandeb', 'yemen',
  'transit halt', 'diversion', 'reroute', 'insurance', 'war risk',
  'sanctions', 'iran', 'irgc', 'navy', 'escort', 'convoy',
  'suspicious', 'boarding', 'armed', 'weapons', 'mine'
];

/**
 * Fetch security-relevant articles from maritime news RSS
 * @returns {Promise<Array>} Filtered RSS items relevant to maritime security
 */
async function fetchAdvisories() {
  const allItems = [];

  const results = await Promise.allSettled(
    SECURITY_FEEDS.map(async function(feed) {
      try {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items.map(function(item) {
          item._feedSource = feed.name;
          return item;
        });
      } catch (err) {
        console.error('[SECURITY_NEWS] Failed to fetch ' + feed.name + ': ' + err.message);
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      allItems.push(...r.value);
    }
  }

  // Filter for security relevance
  const securityItems = allItems.filter(function(item) {
    var text = ((item.title || '') + ' ' + (item.contentSnippet || '')).toLowerCase();
    return THREAT_KEYWORDS.some(function(kw) { return text.includes(kw); });
  });

  console.log('[SECURITY_NEWS] Fetched ' + securityItems.length + ' security articles from ' + allItems.length + ' total');
  return securityItems.slice(0, 20);
}

/**
 * Transform news article into normalized incident format
 */
function normalizeAdvisory(item) {
  var text = (item.title || '') + ' ' + (item.contentSnippet || '');
  var coords = extractCoords(text);

  // If no explicit coords, infer from location mentions
  if (!coords) coords = inferLocation(text);

  return {
    sourceId: SOURCE + ':' + (item.guid || item.link || item.title),
    source: SOURCE,
    sourceRef: item.link || item.guid || '',
    timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
    type: classifyFromText(text),
    severity: classifySeverity(text),
    title: (item.title || 'Maritime Security Report').substring(0, 200),
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

/**
 * Infer approximate coordinates from location mentions in text
 */
function inferLocation(text) {
  var t = text.toLowerCase();
  // Approximate center coords for commonly mentioned areas
  if (t.includes('strait of hormuz') || t.includes('hormuz')) return { lat: 26.5, lon: 56.3 };
  if (t.includes('bab el mandeb') || t.includes('bab al mandab')) return { lat: 12.6, lon: 43.3 };
  if (t.includes('gulf of aden')) return { lat: 12.0, lon: 47.0 };
  if (t.includes('southern red sea') || t.includes('south red sea')) return { lat: 14.0, lon: 42.5 };
  if (t.includes('red sea')) return { lat: 18.0, lon: 39.0 };
  if (t.includes('gulf of oman')) return { lat: 24.5, lon: 58.0 };
  if (t.includes('arabian sea')) return { lat: 15.0, lon: 60.0 };
  if (t.includes('somali') || t.includes('mogadishu')) return { lat: 5.0, lon: 48.0 };
  if (t.includes('suez')) return { lat: 30.0, lon: 32.5 };
  if (t.includes('persian gulf') || t.includes('arabian gulf')) return { lat: 26.0, lon: 52.0 };
  if (t.includes('yemen')) return { lat: 14.5, lon: 44.0 };
  return null;
}

function classifyFromText(text) {
  var t = text.toUpperCase();
  if (t.includes('MISSILE') || t.includes('BALLISTIC')) return 'MISSILE_ATTACK';
  if (t.includes('DRONE') || t.includes('UAV') || t.includes('UAS')) return 'DRONE_ATTACK';
  if (t.includes('PIRACY') || t.includes('PIRATE') || t.includes('HIJACK')) return 'PIRACY';
  if (t.includes('MINE') || t.includes('LIMPET')) return 'MINE_THREAT';
  if (t.includes('SEIZURE') || t.includes('SEIZED') || t.includes('DETAINED')) return 'SEIZURE';
  if (t.includes('ATTACK') || t.includes('STRUCK') || t.includes('HIT')) return 'ATTACK';
  if (t.includes('WAR ZONE') || t.includes('WAR RISK')) return 'ADVISORY';
  if (t.includes('SANCTION')) return 'SANCTIONS';
  if (t.includes('DIVERSION') || t.includes('REROUTE') || t.includes('HALT')) return 'ADVISORY';
  return 'SECURITY_REPORT';
}

function classifySeverity(text) {
  var t = text.toUpperCase();
  if (t.includes('SANK') || t.includes('KILLED') || t.includes('DEAD') || t.includes('EXPLOSION')) return 5;
  if (t.includes('STRUCK') || t.includes('HIT') || t.includes('DAMAGE') || t.includes('WAR ZONE')) return 4;
  if (t.includes('MISSILE') || t.includes('ATTACK') || t.includes('SEIZED')) return 4;
  if (t.includes('DRONE') || t.includes('THREAT') || t.includes('HALT')) return 3;
  if (t.includes('DIVERSION') || t.includes('REROUTE') || t.includes('RISK')) return 3;
  return 2;
}

function extractVesselName(text) {
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
  if (t.includes('USV')) return 'USV';
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
  if (t.includes('SUEZ')) return 'SUEZ_APPROACH';
  return null;
}

module.exports = { fetchAdvisories, normalizeAdvisory, SOURCE };
