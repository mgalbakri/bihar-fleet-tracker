// Google News RSS -- reliable, always-available source for maritime security incidents
// Google News aggregates from ALL major sources (Reuters, AP, BBC, gCaptain, Maritime Executive, etc.)
// This is the backbone of real-time incident detection
// BIHAR SENTINEL

const RssParser = require('rss-parser');

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

const SOURCE = 'GOOGLE_NEWS';

// Multiple targeted Google News RSS queries for maximum coverage
const GOOGLE_NEWS_FEEDS = [
  {
    name: 'Hormuz attacks',
    url: 'https://news.google.com/rss/search?q=%22strait+of+hormuz%22+attack+OR+struck+OR+missile+OR+sank+OR+hit+when:7d&hl=en&gl=US&ceid=US:en'
  },
  {
    name: 'Red Sea Houthi',
    url: 'https://news.google.com/rss/search?q=houthi+ship+OR+vessel+OR+tanker+attack+OR+missile+OR+drone+when:7d&hl=en&gl=US&ceid=US:en'
  },
  {
    name: 'Maritime attack general',
    url: 'https://news.google.com/rss/search?q=maritime+attack+OR+%22vessel+struck%22+OR+%22tanker+hit%22+OR+%22ship+sank%22+when:7d&hl=en&gl=US&ceid=US:en'
  },
  {
    name: 'Gulf of Aden piracy',
    url: 'https://news.google.com/rss/search?q=%22gulf+of+aden%22+OR+%22bab+el+mandeb%22+piracy+OR+hijack+OR+attack+when:7d&hl=en&gl=US&ceid=US:en'
  },
  {
    name: 'Iran naval',
    url: 'https://news.google.com/rss/search?q=iran+naval+OR+IRGC+ship+OR+vessel+OR+strait+when:3d&hl=en&gl=US&ceid=US:en'
  }
];

/**
 * Fetch security-relevant articles from Google News RSS
 * @returns {Promise<Array>} Filtered RSS items relevant to maritime security
 */
async function fetchAdvisories() {
  const allItems = [];
  const seenTitles = new Set();

  const results = await Promise.allSettled(
    GOOGLE_NEWS_FEEDS.map(async function(feed) {
      try {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items.map(function(item) {
          item._feedSource = feed.name;
          return item;
        });
      } catch (err) {
        console.error('[GOOGLE_NEWS] Failed to fetch "' + feed.name + '": ' + err.message);
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      for (const item of r.value) {
        // Deduplicate by title (Google News often returns same article from multiple queries)
        var titleKey = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          allItems.push(item);
        }
      }
    }
  }

  // Filter for genuine maritime security content (not opinion pieces, market analysis, etc.)
  var securityItems = allItems.filter(function(item) {
    var text = ((item.title || '') + ' ' + (item.contentSnippet || '')).toLowerCase();
    return isSecurityRelevant(text);
  });

  console.log('[GOOGLE_NEWS] Fetched ' + securityItems.length + ' security articles from ' + allItems.length + ' total');
  return securityItems.slice(0, 30);
}

/**
 * Check if article text is about a real maritime security incident (not opinion/analysis)
 */
function isSecurityRelevant(text) {
  // Must mention a vessel or maritime context
  var hasMaritimeContext = /ship|vessel|tanker|cargo|merchant|maritime|naval|warship|destroyer|frigate|carrier/.test(text);
  if (!hasMaritimeContext) return false;

  // Must have an action/event indicator
  var hasEvent = /attack|struck|hit|sank|sunk|damage|missile|drone|seized|hijack|piracy|mine|explosion|killed|dead|evacuated|intercept|destroy|fire|burning|collision|grounding/.test(text);
  return hasEvent;
}

/**
 * Transform Google News article into normalized incident format
 */
function normalizeAdvisory(item) {
  var text = (item.title || '') + ' ' + (item.contentSnippet || '');
  var coords = inferLocation(text);

  return {
    sourceId: SOURCE + ':' + (item.guid || item.link || item.title),
    source: SOURCE,
    sourceRef: item.link || item.guid || '',
    timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
    type: classifyFromText(text),
    severity: classifySeverity(text),
    title: cleanTitle(item.title || 'Maritime Security Report'),
    description: (item.contentSnippet || '').substring(0, 500),
    verified: true,
    targetVessel: extractVesselName(text),
    targetImo: null,
    weaponType: extractWeapon(text),
    attributedTo: extractAttribution(text),
    corridor: inferCorridor(text)
  };
}

/**
 * Clean Google News title (remove " - Source Name" suffix)
 */
function cleanTitle(title) {
  return title.replace(/\s*[-–—]\s*[A-Za-z][A-Za-z\s.]{2,30}$/, '').substring(0, 200);
}

/**
 * Infer approximate coordinates from location mentions in text
 */
function inferLocation(text) {
  var t = text.toLowerCase();

  // Specific areas first (more precise)
  if (t.includes('khasab')) return { lat: 26.18, lon: 56.25 };
  if (t.includes('fujairah')) return { lat: 25.12, lon: 56.33 };
  if (t.includes('muscat') || t.includes('off oman')) return { lat: 23.6, lon: 58.5 };
  if (t.includes('strait of hormuz') || t.includes('hormuz')) return { lat: 26.3, lon: 56.4 };
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
  if (t.includes('ras tanura')) return { lat: 26.64, lon: 50.15 };
  if (t.includes('jeddah')) return { lat: 21.49, lon: 39.17 };
  if (t.includes('dubai') || t.includes('uae')) return { lat: 25.2, lon: 55.3 };
  return null;
}

function classifyFromText(text) {
  var t = text.toUpperCase();
  if (t.includes('MISSILE') || t.includes('BALLISTIC')) return 'MISSILE_ATTACK';
  if (t.includes('DRONE') || t.includes('UAV') || t.includes('UAS')) return 'DRONE_ATTACK';
  if (t.includes('PIRACY') || t.includes('PIRATE') || t.includes('HIJACK')) return 'PIRACY';
  if (t.includes('MINE') || t.includes('LIMPET')) return 'MINE_THREAT';
  if (t.includes('SEIZURE') || t.includes('SEIZED') || t.includes('DETAINED')) return 'SEIZURE';
  if (t.includes('SANK') || t.includes('SUNK') || t.includes('DESTROY')) return 'MILITARY_ACTION';
  if (t.includes('ATTACK') || t.includes('STRUCK') || t.includes('HIT')) return 'ATTACK';
  if (t.includes('WAR ZONE') || t.includes('WAR RISK') || t.includes('HALT')) return 'ADVISORY';
  if (t.includes('SANCTION')) return 'SANCTIONS';
  return 'SECURITY_REPORT';
}

function classifySeverity(text) {
  var t = text.toUpperCase();
  if (t.includes('SANK') || t.includes('SUNK') || t.includes('KILLED') || t.includes('DEAD') || t.includes('EXPLOSION') || t.includes('DESTROY')) return 5;
  if (t.includes('STRUCK') || t.includes('HIT') || t.includes('DAMAGE') || t.includes('WAR ZONE')) return 4;
  if (t.includes('MISSILE') || t.includes('ATTACK') || t.includes('SEIZED')) return 4;
  if (t.includes('DRONE') || t.includes('THREAT') || t.includes('HALT')) return 3;
  if (t.includes('DIVERSION') || t.includes('REROUTE') || t.includes('RISK')) return 3;
  return 2;
}

function extractVesselName(text) {
  // Match MV/MT vessel names
  var mvMatch = text.match(/(?:MV|M\/V|MT|M\/T|USS|IRIN)\s+([A-Z][A-Z\s]{2,30}?)(?:\s*[,.\(\-]|$)/i);
  if (mvMatch) return mvMatch[1].trim();
  // Match vessel names in quotes
  var quoteMatch = text.match(/["""]([A-Z][A-Za-z\s]{2,25}?)["""]/);
  if (quoteMatch) return quoteMatch[1].trim();
  return null;
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
  if (t.includes('TORPEDO')) return 'TORPEDO';
  return null;
}

function extractAttribution(text) {
  var t = text.toUpperCase();
  if (t.includes('HOUTHI') || t.includes('ANSAR ALLAH')) return 'Houthi/Ansar Allah';
  if (t.includes('IRAN') || t.includes('IRGC') || t.includes('ISLAMIC REPUBLIC')) return 'Iran/IRGCN';
  if (t.includes('US NAVY') || t.includes('CENTCOM') || t.includes('AMERICAN')) return 'US Navy/CENTCOM';
  if (t.includes('PIRATE') || t.includes('PIRACY')) return 'Pirates';
  return null;
}

function inferCorridor(text) {
  var t = text.toUpperCase();
  if (t.includes('HORMUZ')) return 'HORMUZ';
  if (t.includes('BAB') && t.includes('MANDEB')) return 'BAB_EL_MANDEB';
  if (t.includes('ADEN')) return 'GULF_OF_ADEN';
  if (t.includes('RED SEA')) return 'BAB_EL_MANDEB';
  if (t.includes('ARABIAN SEA')) return 'ARABIAN_SEA';
  if (t.includes('SOMALI')) return 'SOMALI_BASIN';
  if (t.includes('SUEZ')) return 'SUEZ_APPROACH';
  return null;
}

module.exports = { fetchAdvisories, normalizeAdvisory, SOURCE };
