// news-poller.js -- Maritime news aggregation from free RSS feeds
// BIHAR SENTINEL

const cron = require('node-cron');
const RssParser = require('rss-parser');
const config = require('../../../config/default');

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

let newsCache = [];
let lastPollTime = null;
let isPolling = false;
let wsService = null;

const MAX_ARTICLES = 50;

const NEWS_FEEDS = [
  { name: 'gCaptain', url: 'https://gcaptain.com/feed/', category: 'industry' },
  { name: 'Seatrade Maritime', url: 'https://www.seatrade-maritime.com/rss.xml', category: 'industry' },
  { name: 'Splash247', url: 'https://splash247.com/feed/', category: 'industry' },
  { name: 'Hellenic Shipping', url: 'https://www.hellenicshippingnews.com/feed/', category: 'market' },
  { name: 'Offshore Energy', url: 'https://www.offshore-energy.biz/feed/', category: 'energy' }
];

function init(ws) {
  wsService = ws;

  const intervalMinutes = Math.round((config.news ? config.news.pollIntervalMs : 15 * 60 * 1000) / 60000);
  cron.schedule(`*/${intervalMinutes} * * * *`, function() {
    pollNow();
  });

  console.log(`[NEWS] News poller initialized (every ${intervalMinutes} min, ${NEWS_FEEDS.length} feeds)`);

  // Initial poll after 10 seconds (let other services start first)
  setTimeout(function() { pollNow(); }, 10000);
}

async function pollNow() {
  if (isPolling) return;
  isPolling = true;

  try {
    const allArticles = [];
    const results = await Promise.allSettled(
      NEWS_FEEDS.map(function(feed) { return fetchFeed(feed); })
    );

    let successCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        allArticles.push(...r.value);
        successCount++;
      }
    }

    // Deduplicate by link
    const seen = new Set();
    const deduped = [];
    for (const art of allArticles) {
      const key = art.link || art.title;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(art);
      }
    }

    // Sort by date, most recent first
    deduped.sort(function(a, b) {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    // Keep only latest MAX_ARTICLES
    newsCache = deduped.slice(0, MAX_ARTICLES);
    lastPollTime = new Date().toISOString();

    console.log(`[NEWS] Fetched ${newsCache.length} articles from ${successCount}/${NEWS_FEEDS.length} feeds`);

    // Broadcast to WebSocket clients
    if (wsService && newsCache.length > 0) {
      wsService.broadcast('news', newsCache.slice(0, 10));
    }
  } catch (err) {
    console.error('[NEWS] Poll error:', err.message);
  } finally {
    isPolling = false;
  }
}

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items.slice(0, 10).map(function(item) {
      // Clean up snippet - remove HTML tags and trim
      let snippet = (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').trim();
      if (snippet.length > 200) snippet = snippet.substring(0, 197) + '...';

      return {
        id: feed.name + ':' + (item.guid || item.link || item.title),
        title: (item.title || 'Untitled').trim(),
        snippet: snippet,
        link: item.link || '',
        source: feed.name,
        category: feed.category,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString()
      };
    });
  } catch (err) {
    console.error(`[NEWS] Failed to fetch ${feed.name}: ${err.message}`);
    return [];
  }
}

function getNews(limit) {
  return newsCache.slice(0, limit || 20);
}

function getStatus() {
  return {
    lastPollTime: lastPollTime,
    articleCount: newsCache.length,
    feeds: NEWS_FEEDS.length,
    isPolling: isPolling
  };
}

module.exports = { init, pollNow, getNews, getStatus };
