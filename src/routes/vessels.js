const express = require('express');
const path = require('path');
const zoneTracker = require('../services/ais/zone-tracker');
const gapDetector = require('../services/ais/gap-detector');
const router = express.Router();

const vesselsPath = path.join(__dirname, '..', '..', 'config', 'vessels.json');
let vesselsData = null;

function loadVessels() {
  vesselsData = require(vesselsPath);
  return vesselsData;
}

// GET /api/vessels - return all vessels with latest positions if available
router.get('/', (req, res) => {
  try {
    const vessels = vesselsData || loadVessels();
    const db = require('../db/database');

    // Enrich with latest AIS position from DB if available
    const latestPosStmt = db.prepare(`
      SELECT vessel_imo, lat, lon, sog, cog, heading, nav_status, destination, eta, ais_timestamp, source
      FROM vessel_positions
      WHERE id IN (
        SELECT MAX(id) FROM vessel_positions GROUP BY vessel_imo
      )
    `);
    const latestPositions = latestPosStmt.all();
    const posMap = {};
    for (const pos of latestPositions) {
      posMap[pos.vessel_imo] = pos;
    }

    // Enrich with latest risk score
    const riskStmt = db.prepare(`
      SELECT vessel_imo, composite_score, risk_level,
             proximity_score, corridor_score, jwc_score, ais_score, vulnerability, historical_score
      FROM risk_scores
      WHERE id IN (
        SELECT MAX(id) FROM risk_scores GROUP BY vessel_imo
      )
    `);
    const riskScores = riskStmt.all();
    const riskMap = {};
    for (const r of riskScores) {
      riskMap[r.vessel_imo] = r;
    }

    // Get zone and AIS health states
    const allZoneStates = zoneTracker.getAllZoneStates();
    const allAisHealth = gapDetector.getAllHealth();

    const enriched = vessels.map(v => {
      const pos = posMap[v.imo];
      const risk = riskMap[v.imo];
      const zoneState = allZoneStates[v.imo];
      const aisHealth = allAisHealth[v.imo] || 'UNKNOWN';

      // Derive origin port from most recent port call with a departure
      let originPort = null;
      if (v.portCalls && v.portCalls.length > 0) {
        const lastCall = v.portCalls[0];
        if (lastCall.departed && lastCall.departed !== '-') {
          originPort = lastCall.port;
        }
      }

      return {
        ...v,
        originPort,
        ...(pos ? {
          lat: pos.lat,
          lng: pos.lon,
          speed: pos.sog,
          course: pos.cog,
          heading: pos.heading,
          navStatus: pos.nav_status,
          destination: pos.destination || v.destination,
          eta: pos.eta || v.eta,
          aisTimestamp: pos.ais_timestamp,
          aisSource: pos.source
        } : {}),
        riskScore: risk ? risk.composite_score : 0,
        riskLevel: risk ? risk.risk_level : 'LOW',
        riskFactors: risk ? {
          proximity: risk.proximity_score || 0,
          corridor: risk.corridor_score || 0,
          jwc: risk.jwc_score || 0,
          ais: risk.ais_score || 0,
          vulnerability: risk.vulnerability || 0,
          historical: risk.historical_score || 0
        } : null,
        inJWC: zoneState ? zoneState.inJWC : false,
        jwcZones: zoneState ? zoneState.zones : [],
        highestRisk: zoneState ? zoneState.highestRisk : null,
        corridors: zoneState ? zoneState.corridors : [],
        aisHealth
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[VESSELS] Error:', err.message);
    res.status(500).json({ error: 'Failed to load vessels' });
  }
});

// --- Static routes BEFORE /:imo param route ---

// GET /api/vessels/zone-events/recent - recent JWC zone entry/exit events
router.get('/zone-events/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(zoneTracker.getRecentEvents(limit));
});

// GET /api/vessels/ais-gaps/active - active AIS gaps
router.get('/ais-gaps/active', (req, res) => {
  res.json(gapDetector.getActiveGaps());
});

// GET /api/vessels/:imo/track - AIS position history (oldest-first for polyline rendering)
router.get('/:imo/track', (req, res) => {
  try {
    const db = require('../db/database');
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const hours = parseInt(req.query.hours) || 72;

    const positions = db.prepare(`
      SELECT lat, lon AS lng, sog AS speed, cog AS course, heading, nav_status,
             destination, ais_timestamp, source
      FROM vessel_positions
      WHERE vessel_imo = ?
        AND ais_timestamp > datetime('now', '-' || ? || ' hours')
      ORDER BY ais_timestamp DESC
      LIMIT ?
    `).all(req.params.imo, hours, limit);

    res.json(positions.reverse()); // oldest first so polyline draws in correct direction
  } catch (err) {
    console.error('[VESSELS] Track error:', err.message);
    res.status(500).json({ error: 'Failed to load track' });
  }
});

// GET /api/vessels/:imo - return single vessel detail (must come AFTER static routes)
router.get('/:imo', (req, res) => {
  try {
    const vessels = vesselsData || loadVessels();
    const vessel = vessels.find(v => v.imo === req.params.imo);
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    const zoneState = zoneTracker.getVesselZoneState(vessel.imo);
    const aisHealth = gapDetector.getHealth(vessel.imo);
    res.json({
      ...vessel,
      inJWC: zoneState ? zoneState.inJWC : false,
      jwcZones: zoneState ? zoneState.zones : [],
      highestRisk: zoneState ? zoneState.highestRisk : null,
      corridors: zoneState ? zoneState.corridors : [],
      aisHealth
    });
  } catch (err) {
    console.error('[VESSELS] Error:', err.message);
    res.status(500).json({ error: 'Failed to load vessel' });
  }
});

module.exports = router;
