// Incident routes -- CRUD for security incidents
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// GET /api/incidents -- list incidents with optional filters
router.get('/', (req, res) => {
  try {
    const db = require('../db/database');
    const { status, corridor, type, source, limit } = req.query;

    let query = 'SELECT * FROM incidents WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (corridor) {
      query += ' AND corridor = ?';
      params.push(corridor);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit) || 100);

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    console.error('[INCIDENTS] List error:', err.message);
    res.status(500).json({ error: 'Failed to load incidents' });
  }
});

// GET /api/incidents/heatmap -- weighted heatmap data points
// MUST be before /:id to avoid matching "heatmap" as an incident ID
router.get('/heatmap', (req, res) => {
  try {
    const db = require('../db/database');
    const period = req.query.period || '90d';

    // Parse period into days
    const periodDays = { '30d': 30, '90d': 90, '6mo': 180, '12mo': 365 };
    const days = periodDays[period] || 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const incidents = db.prepare(`
      SELECT lat, lon, severity, type, timestamp FROM incidents
      WHERE lat IS NOT NULL AND lon IS NOT NULL
        AND timestamp >= ?
      ORDER BY timestamp DESC
    `).all(since);

    // Weight by recency and severity
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;

    // Severity multipliers: missile/drone attacks weighted higher
    const typeWeight = {
      MISSILE_ATTACK: 1.5, DRONE_ATTACK: 1.3, PIRACY: 1.2,
      MINE_THREAT: 1.4, SEIZURE: 1.1, MILITARY_ACTION: 1.0,
      SUSPICIOUS_APPROACH: 0.7, ADVISORY: 0.4
    };

    const points = incidents.map(inc => {
      const age = now - new Date(inc.timestamp).getTime();
      const recencyFactor = Math.max(0.1, 1 - (age / maxAge));
      const sevFactor = (inc.severity || 3) / 5;
      const typeFactor = typeWeight[inc.type] || 0.8;
      const intensity = recencyFactor * sevFactor * typeFactor;

      return [inc.lat, inc.lon, Math.round(intensity * 100) / 100];
    });

    res.json({
      period: period,
      count: points.length,
      points: points
    });
  } catch (err) {
    console.error('[HEATMAP] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate heatmap data' });
  }
});

// GET /api/incidents/:id -- single incident detail
router.get('/:id', (req, res) => {
  try {
    const db = require('../db/database');
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    // Include update history
    const updates = db.prepare(
      'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY timestamp DESC'
    ).all(req.params.id);

    res.json({ ...incident, updates });
  } catch (err) {
    console.error('[INCIDENTS] Detail error:', err.message);
    res.status(500).json({ error: 'Failed to load incident' });
  }
});

// POST /api/incidents -- manual incident entry
router.post('/', (req, res) => {
  try {
    const db = require('../db/database');
    const { lat, lon, type, severity, title, description, corridor, targetVessel, targetImo, weaponType, attributedTo } = req.body;

    if (!lat || !lon || !type || !title) {
      return res.status(400).json({ error: 'lat, lon, type, and title are required' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO incidents (id, timestamp, lat, lon, type, severity, title, description,
        source, source_ref, verified, target_vessel, target_imo, weapon_type,
        attributed_to, corridor, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', '', 0, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      id, new Date().toISOString(), lat, lon, type,
      severity || 3, title, description || '',
      targetVessel || null, targetImo || null,
      weaponType || null, attributedTo || null,
      corridor || null, req.user ? req.user.email : 'unknown'
    );

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    res.status(201).json(incident);
  } catch (err) {
    console.error('[INCIDENTS] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// PATCH /api/incidents/:id/status -- update incident status
router.patch('/:id/status', (req, res) => {
  try {
    const db = require('../db/database');
    const { status, note } = req.body;

    if (!status || !['active', 'monitoring', 'resolved', 'expired', 'false_alarm'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: active, monitoring, resolved, expired, false_alarm' });
    }

    db.prepare('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);

    // Log update
    if (note) {
      db.prepare('INSERT INTO incident_updates (id, incident_id, note, source, updated_by) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), req.params.id, note, 'MANUAL', req.user ? req.user.email : 'unknown');
    }

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    res.json(incident);
  } catch (err) {
    console.error('[INCIDENTS] Status update error:', err.message);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

module.exports = router;
