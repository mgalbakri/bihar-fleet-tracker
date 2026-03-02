require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/default');

// Initialize database (creates tables on first run)
const db = require('./src/db/database');
const { runSeed } = require('./src/db/seed');
runSeed();

const { authenticateToken } = require('./src/middleware/auth');

const app = express();

// Production middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false, // Leaflet CDN and inline scripts need this relaxed
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());

// Rate limiting on auth endpoints (5 attempts per minute)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, try again in 1 minute' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

// General API rate limiting (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Block direct static access to app.html -- it requires auth
// This must come BEFORE express.static so it intercepts first
app.get('/app.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Static files are public (login page CSS/JS must load without auth)
// index: false prevents auto-serving index.html for '/' (we handle that explicitly)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- Unprotected Routes ---

// Health check (includes subsystem status)
app.get('/api/health', (req, res) => {
  const aisPoller = require('./src/services/ais/ais-poller');
  const weatherPoller = require('./src/services/weather/weather-poller');
  const threatPoller = require('./src/services/threat/threat-poller');
  const _newsPoller = require('./src/services/news/news-poller');
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    name: 'BIHAR SENTINEL',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    subsystems: {
      ais: aisPoller.getStatus(),
      weather: { cached: Object.keys(weatherPoller.getAllWeather()).length },
      threat: threatPoller.getStatus(),
      news: _newsPoller.getStatus(),
      websocket: { clients: wsService.getClientCount() },
      notices: { templates: 4 },
      database: { status: db ? 'connected' : 'disconnected' }
    },
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB'
    }
  });
});

// Data source status (tells the frontend what's live vs simulated)
app.get('/api/data-status', (req, res) => {
  const aisPoller = require('./src/services/ais/ais-poller');
  const aisStatus = aisPoller.getStatus();
  res.json({
    ais: {
      mode: aisStatus.simulationMode ? 'simulation' : 'live',
      provider: aisStatus.provider,
      configured: aisStatus.configured,
      lastPoll: aisStatus.lastPollTime,
      vessels: aisStatus.cachedPositions,
      stream: aisStatus.stream || null
    },
    weather: {
      mode: process.env.OPENWEATHERMAP_API_KEY && process.env.OPENWEATHERMAP_API_KEY !== 'your-owm-api-key' ? 'live' : 'default',
      configured: !!(process.env.OPENWEATHERMAP_API_KEY && process.env.OPENWEATHERMAP_API_KEY !== 'your-owm-api-key')
    },
    threats: {
      mode: 'live',
      sources: ['gCaptain', 'Seatrade Maritime'],
      optional: {
        centcom: false,
        marad: false,
        acled: !!(process.env.ACLED_API_KEY),
        ukmto: false
      }
    },
    news: {
      mode: 'live',
      feeds: 5
    }
  });
});

// Auth routes (login, refresh, logout)
app.use('/api/auth', require('./src/routes/auth'));

// Root serves login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Protected Routes (require valid JWT) ---

// Vessel routes
app.use('/api/vessels', authenticateToken, require('./src/routes/vessels'));

// Weather API (GET current weather for all vessels)
app.get('/api/weather', authenticateToken, (req, res) => {
  const weatherPoller = require('./src/services/weather/weather-poller');
  res.json(weatherPoller.getAllWeather());
});

// Zone routes (GeoJSON, zone checks, proximity)
app.use('/api/zones', authenticateToken, require('./src/routes/zones'));

// Incident routes (threat data)
app.use('/api/incidents', authenticateToken, require('./src/routes/incidents'));

// Alert routes (proximity alerts)
app.use('/api/alerts', authenticateToken, require('./src/routes/alerts'));

// Corridor routes (corridor status)
app.use('/api/corridors', authenticateToken, require('./src/routes/corridors'));

// Insurer notice routes
app.use('/api/notices', authenticateToken, require('./src/routes/notices'));

// Recommendation routes
app.use('/api/recommendations', authenticateToken, require('./src/routes/recommendations'));

// User management routes (admin only)
app.use('/api/users', authenticateToken, require('./src/routes/users'));

// News API (maritime news aggregation)
app.get('/api/news', authenticateToken, (req, res) => {
  const newsPoller = require('./src/services/news/news-poller');
  const limit = parseInt(req.query.limit) || 20;
  res.json(newsPoller.getNews(limit));
});

// Weather for a single vessel
app.get('/api/weather/:imo', authenticateToken, (req, res) => {
  const weatherPoller = require('./src/services/weather/weather-poller');
  const weather = weatherPoller.getWeather(req.params.imo);
  if (!weather) {
    return res.status(404).json({ error: 'No weather data for this vessel' });
  }
  res.json(weather);
});

// --- Start Server ---

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`[SENTINEL] Server running on http://localhost:${PORT}`);
  console.log(`[SENTINEL] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Initialize WebSocket server
const wsService = require('./src/services/websocket');
wsService.init(server);

// Initialize AIS poller
const aisPoller = require('./src/services/ais/ais-poller');
aisPoller.init(db, wsService);

// Initialize weather poller
const weatherPoller = require('./src/services/weather/weather-poller');
weatherPoller.init(wsService);

// Initialize threat data poller
const threatPoller = require('./src/services/threat/threat-poller');
threatPoller.init(db, wsService);

// Initialize news aggregation poller
const newsPoller = require('./src/services/news/news-poller');
newsPoller.init(wsService);

// Initialize risk engine, alert engine, corridor status
const riskEngine = require('./src/services/risk/risk-engine');
const alertEngine = require('./src/services/risk/alert-engine');
const corridorStatus = require('./src/services/risk/corridor-status');
riskEngine.init(db);
alertEngine.init(db, wsService);
corridorStatus.init(db, wsService);

// Initialize insurer notice system
const noticeGenerator = require('./src/services/notices/notice-generator');
const noticeTriggers = require('./src/services/notices/notice-triggers');
noticeGenerator.init(db);
noticeTriggers.init(wsService);

// Initialize new services: recommendation engine, incident enrichment, notice delivery
const recommendationEngine = require('./src/services/risk/recommendation-engine');
const sourceReliability = require('./src/services/threat/source-reliability');
const incidentEnricher = require('./src/services/threat/incident-enricher');
const incidentLifecycle = require('./src/services/threat/incident-lifecycle');
const emailService = require('./src/services/notices/email-service');
const recipientManager = require('./src/services/notices/recipient-manager');
const pdfGenerator = require('./src/services/notices/pdf-generator');

recommendationEngine.init(db, wsService);
sourceReliability.init(db);
incidentEnricher.init(db, require('./src/services/geo/zone-checker'));
incidentLifecycle.init(db);
emailService.init(db, { mode: process.env.EMAIL_MODE || 'none' });
recipientManager.init(db);
pdfGenerator.init();

// Hook notice triggers into zone-tracker events (JWC entry/exit -> BTW/Exit notices)
const vesselsData = require('./config/vessels.json');
const zoneTracker = require('./src/services/ais/zone-tracker');
zoneTracker.onEvent(function(event) {
  const vesselData = vesselsData.find(v => v.imo === event.vesselImo);
  if (event.eventType === 'ENTRY') {
    noticeTriggers.onJWCEntry(event, vesselData);
  } else if (event.eventType === 'EXIT') {
    noticeTriggers.onJWCExit(event, vesselData);
  }
});

// Run initial risk scoring + recommendations after a short delay (let AIS data load)
setTimeout(() => {
  riskEngine.scoreFleet(vesselsData);
  alertEngine.checkAllProximity(vesselsData);
  corridorStatus.recalculate(vesselsData);

  // Run recommendation evaluation after risk scores are computed
  try {
    const incidents = db.prepare("SELECT * FROM incidents WHERE status = 'active'").all();
    const corridors = corridorStatus.getAll();
    const alerts = db.prepare("SELECT * FROM proximity_alerts WHERE status = 'active'").all();
    recommendationEngine.evaluateAllVessels(vesselsData, incidents, corridors, alerts);
  } catch (e) { console.error('[RECS] Initial evaluation error:', e.message); }

  // Run incident lifecycle auto-transitions
  try { incidentLifecycle.runAutoTransitions(); } catch (e) {}

  console.log('[RISK] Initial risk scoring + recommendations complete');
}, 5000);

// Force refresh all data sources (protected)
app.post('/api/refresh', authenticateToken, async (req, res) => {
  try {
    // Run all pollers concurrently
    await Promise.allSettled([
      aisPoller.pollNow(),
      threatPoller.pollNow(),
      newsPoller.pollNow()
    ]);

    // Re-run risk engine after fresh data
    riskEngine.scoreFleet(vesselsData);
    alertEngine.checkAllProximity(vesselsData);
    corridorStatus.recalculate(vesselsData);

    const incidents = db.prepare("SELECT * FROM incidents WHERE status = 'active'").all();
    const corridors = corridorStatus.getAll();
    const alerts = db.prepare("SELECT * FROM proximity_alerts WHERE status = 'active'").all();
    recommendationEngine.evaluateAllVessels(vesselsData, incidents, corridors, alerts);

    res.json({
      status: 'ok',
      ais: aisPoller.getStatus(),
      threat: threatPoller.getStatus(),
      news: newsPoller.getStatus(),
      activeIncidents: incidents.length,
      activeAlerts: alerts.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug route: force AIS poll (protected)
app.post('/api/debug/poll-ais', authenticateToken, async (req, res) => {
  await aisPoller.pollNow();
  res.json({ status: 'ok', ais: aisPoller.getStatus() });
});

// Debug route: force full risk + recommendation recalculation (protected)
app.post('/api/debug/rescore', authenticateToken, (req, res) => {
  try {
    riskEngine.scoreFleet(vesselsData);
    alertEngine.checkAllProximity(vesselsData);
    corridorStatus.recalculate(vesselsData);

    const incidents = db.prepare("SELECT * FROM incidents WHERE status = 'active'").all();
    const corridors = corridorStatus.getAll();
    const alerts = db.prepare("SELECT * FROM proximity_alerts WHERE status = 'active'").all();
    const recs = recommendationEngine.evaluateAllVessels(vesselsData, incidents, corridors, alerts);

    res.json({
      status: 'ok',
      activeIncidents: incidents.length,
      activeAlerts: alerts.length,
      newRecommendations: recs.length,
      recommendations: recs.map(r => ({ vessel: r.vessel_imo, action: r.action_type, urgency: r.urgency }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug route: generate a test notice (protected)
app.post('/api/debug/test-notice', authenticateToken, (req, res) => {
  const vessel = vesselsData[0]; // First vessel in fleet
  const notice = noticeGenerator.generate('BTW', {
    name: vessel.name,
    imo: vessel.imo,
    flag: vessel.flag || 'Marshall Islands',
    lat: vessel.lat || 25.5,
    lng: vessel.lng || 56.3,
    speed: 12.5,
    course: 180,
    destination: vessel.destination || 'Fujairah'
  }, 'TEST: Vessel entered JWC zone: Gulf of Oman', {
    JWC_ZONE_NAME: 'Gulf of Oman (Test)',
    JWC_ZONE_ID: 'test-zone',
    ETA_EXIT: 'Approx 48 hours'
  });
  if (notice) {
    wsService.broadcast('notice_generated', notice);
    res.json({ status: 'ok', notice });
  } else {
    res.status(500).json({ error: 'Failed to generate notice' });
  }
});

module.exports = { app, server, wsService };
