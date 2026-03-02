// OSINT X (Twitter) Stub -- requires X API Bearer Token to function
// Monitors maritime security accounts for real-time threat intelligence
// Tagged as UNVERIFIED source in the incident pipeline

const MONITORED_ACCOUNTS = [
  'UK_MTO',           // UKMTO official
  'ABORDAR_JMA',      // Ambrey Intelligence
  'MaritimeSecurity',  // Maritime security feeds
  'CENTCOMDigMedia'   // CENTCOM digital media
];

const MARITIME_KEYWORDS = [
  'vessel', 'ship', 'tanker', 'maritime', 'Gulf of Aden',
  'Red Sea', 'Bab el-Mandeb', 'Houthi', 'drone', 'missile',
  'hijack', 'piracy', 'Hormuz', 'ASBM', 'USV'
];

/**
 * Fetch recent maritime security posts from X
 * Requires TWITTER_BEARER_TOKEN environment variable
 */
async function fetchAdvisories() {
  const token = process.env.TWITTER_BEARER_TOKEN;

  if (!token) {
    // Silent in production -- this is an optional data source
    return [];
  }

  // X API v2 search endpoint
  const query = MARITIME_KEYWORDS.slice(0, 5).join(' OR ') + ' (attack OR incident OR warning)';

  try {
    const resp = await fetch(
      'https://api.twitter.com/2/tweets/search/recent?query=' +
        encodeURIComponent(query) +
        '&max_results=20&tweet.fields=created_at,author_id,geo',
      {
        headers: { 'Authorization': 'Bearer ' + token },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!resp.ok) {
      console.error('[OSINT-X] API error: ' + resp.status);
      return [];
    }

    const data = await resp.json();
    if (!data.data) return [];

    console.log('[OSINT-X] Fetched ' + data.data.length + ' posts');
    return data.data;
  } catch (err) {
    console.error('[OSINT-X] Fetch error:', err.message);
    return [];
  }
}

/**
 * Normalize an X post into the standard incident format
 */
function normalizeAdvisory(post) {
  return {
    timestamp: post.created_at || new Date().toISOString(),
    lat: null, // X posts rarely have geo; would need NLP extraction
    lon: null,
    type: 'ADVISORY',
    severity: 2, // OSINT is unverified, default low severity
    title: (post.text || '').substring(0, 120),
    description: post.text || '',
    source: 'OSINT_X',
    sourceRef: 'X-' + (post.id || Date.now()),
    verified: false, // Always unverified until analyst review
    corridor: null
  };
}

function getStatus() {
  return {
    configured: !!process.env.TWITTER_BEARER_TOKEN,
    accounts: MONITORED_ACCOUNTS.length,
    keywords: MARITIME_KEYWORDS.length
  };
}

module.exports = { fetchAdvisories, normalizeAdvisory, getStatus };
