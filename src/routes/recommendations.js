// Recommendation API routes
const express = require('express');
const router = express.Router();
const recEngine = require('../services/risk/recommendation-engine');
const vesselsData = require('../../config/vessels.json');

// Lookup map: IMO -> vessel name
const vesselNameMap = {};
for (const v of vesselsData) {
  vesselNameMap[v.imo] = v.name || v.vessel_name || v.imo;
}

// GET /api/recommendations -- list active recommendations
router.get('/', (req, res) => {
  try {
    const { vessel_imo, urgency, status } = req.query;
    let recs = recEngine.getActiveRecommendations(vessel_imo || null);

    if (urgency) recs = recs.filter(r => r.urgency === urgency);
    if (status) recs = recs.filter(r => r.status === status);

    // Parse JSON fields for client
    recs = recs.map(parseRecJson);
    res.json(recs);
  } catch (err) {
    console.error('[RECOMMENDATIONS] List error:', err.message);
    res.status(500).json({ error: 'Failed to load recommendations' });
  }
});

// GET /api/recommendations/vessel/:imo -- recommendations for specific vessel
router.get('/vessel/:imo', (req, res) => {
  try {
    let recs = recEngine.getActiveRecommendations(req.params.imo);
    recs = recs.map(parseRecJson);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/:id -- single recommendation detail
router.get('/:id', (req, res) => {
  try {
    const db = require('../db/database');
    const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(parseRecJson(rec));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/acknowledge
router.post('/:id/acknowledge', (req, res) => {
  try {
    const rec = recEngine.acknowledgeRecommendation(req.params.id, req.user ? req.user.email : 'admin');
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(parseRecJson(rec));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/execute
router.post('/:id/execute', (req, res) => {
  try {
    const { action_taken, notes } = req.body;
    if (!action_taken) return res.status(400).json({ error: 'action_taken is required' });
    const rec = recEngine.executeRecommendation(req.params.id, req.user ? req.user.email : 'admin', action_taken, notes);
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(parseRecJson(rec));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/dismiss
router.post('/:id/dismiss', (req, res) => {
  try {
    const reason = req.body.reason || 'Dismissed by operator';
    const rec = recEngine.dismissRecommendation(req.params.id, req.user ? req.user.email : 'admin', reason);
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(parseRecJson(rec));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/:id/actions -- response action history
router.get('/:id/actions', (req, res) => {
  try {
    const actions = recEngine.getRecommendationHistory(req.params.id);
    res.json(actions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/evaluate -- force re-evaluation
router.post('/evaluate', (req, res) => {
  try {
    const db = require('../db/database');
    const vessels = require('../../../config/vessels.json');
    const incidents = db.prepare("SELECT * FROM incidents WHERE status = 'active'").all();
    const corridors = db.prepare('SELECT * FROM corridor_status').all();
    const alerts = db.prepare("SELECT * FROM proximity_alerts WHERE status = 'active'").all();

    const recs = recEngine.evaluateAllVessels(vessels, incidents, corridors, alerts);
    res.json({ status: 'ok', generated: recs.length, recommendations: recs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parseRecJson(rec) {
  if (!rec) return rec;
  try { rec.suggested_actions = JSON.parse(rec.suggested_actions || '[]'); } catch (e) { rec.suggested_actions = []; }
  try { rec.alternative_ports = JSON.parse(rec.alternative_ports || '[]'); } catch (e) { rec.alternative_ports = []; }
  // Enrich with vessel name from registry
  if (rec.vessel_imo && !rec.vessel_name) {
    rec.vessel_name = vesselNameMap[rec.vessel_imo] || rec.vessel_imo;
  }
  return rec;
}

module.exports = router;
