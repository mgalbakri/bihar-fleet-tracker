// Threat Poller -- orchestrates all threat data scrapers on a schedule
const cron = require('node-cron');
const config = require('../../../config/default');
const ukmtoScraper = require('./ukmto-scraper');
const maradRss = require('./marad-rss');
const centcomRss = require('./centcom-rss');
const acledApi = require('./acled-api');
const securityNews = require('./security-news-rss');
const normalizer = require('./incident-normalizer');

let db;
let wsService;
let lastPollTime = null;
let isPolling = false;

function init(database, ws) {
  db = database;
  wsService = ws;
  normalizer.init(database);

  // Schedule regular polling (every 15 minutes)
  var intervalMinutes = Math.round(config.threat.pollIntervalMs / 60000);
  cron.schedule('*/' + intervalMinutes + ' * * * *', function() {
    pollNow();
  });

  console.log('[THREAT] Poller initialized (every ' + intervalMinutes + ' min)');

  // Run initial poll after 10s delay (let server stabilize)
  setTimeout(function() { pollNow(); }, 10000);
}

async function pollNow() {
  if (isPolling) {
    console.log('[THREAT] Poll already in progress, skipping');
    return;
  }
  isPolling = true;
  var start = Date.now();
  var totalInserted = 0;

  try {
    // Run all scrapers in parallel
    // MARAD/CENTCOM gov feeds may return 403 -- security news RSS is the primary live source
    var results = await Promise.allSettled([
      fetchAndNormalize(ukmtoScraper),
      fetchAndNormalize(maradRss),
      fetchAndNormalize(centcomRss),
      fetchAndNormalize(acledApi),
      fetchAndNormalize(securityNews)
    ]);

    for (var r of results) {
      if (r.status === 'fulfilled') {
        totalInserted += r.value.inserted;
      }
    }

    lastPollTime = new Date().toISOString();
    var elapsed = Date.now() - start;

    if (totalInserted > 0) {
      console.log('[THREAT] Poll complete: ' + totalInserted + ' new incidents (' + elapsed + 'ms)');
      // Broadcast new incidents to connected clients
      if (wsService) {
        var recent = getRecentIncidents(10);
        wsService.broadcast('incidents', recent);
      }
    } else {
      console.log('[THREAT] Poll complete: no new incidents (' + elapsed + 'ms)');
    }
  } catch (err) {
    console.error('[THREAT] Poll error:', err.message);
  } finally {
    isPolling = false;
  }
}

async function fetchAndNormalize(scraper) {
  var raw = await scraper.fetchAdvisories();
  if (raw.length === 0) return { inserted: 0, duplicates: 0, errors: 0 };

  var normalized = raw.map(function(item) {
    return scraper.normalizeAdvisory(item);
  });

  return normalizer.processAdvisories(normalized);
}

function getRecentIncidents(limit) {
  if (!db) return [];
  return db.prepare(
    'SELECT * FROM incidents WHERE status = ? ORDER BY timestamp DESC LIMIT ?'
  ).all('active', limit || 20);
}

function getStatus() {
  return {
    lastPollTime: lastPollTime,
    isPolling: isPolling,
    sources: ['UKMTO', 'MARAD', 'CENTCOM', 'ACLED', 'NEWS_INTEL']
  };
}

module.exports = { init, pollNow, getRecentIncidents, getStatus };
