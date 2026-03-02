// Alert routes -- proximity alert management
const express = require('express');
const alertEngine = require('../services/risk/alert-engine');
const router = express.Router();

// GET /api/alerts -- list active alerts
router.get('/', (req, res) => {
  const vesselImo = req.query.vessel;
  res.json(alertEngine.getActiveAlerts(vesselImo || null));
});

// POST /api/alerts/:id/acknowledge -- acknowledge an alert
router.post('/:id/acknowledge', (req, res) => {
  const userId = req.user ? req.user.email : 'unknown';
  const result = alertEngine.acknowledgeAlert(req.params.id, userId);
  if (!result) return res.status(404).json({ error: 'Alert not found' });
  res.json(result);
});

module.exports = router;
