// Insurer Notice API routes
const express = require('express');
const router = express.Router();
const noticeGenerator = require('../services/notices/notice-generator');
const recipientManager = require('../services/notices/recipient-manager');

// GET /api/notices -- list notices with optional filters
router.get('/', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.vessel_imo) filters.vessel_imo = req.query.vessel_imo;
    if (req.query.notice_type) filters.notice_type = req.query.notice_type;
    if (req.query.limit) filters.limit = parseInt(req.query.limit) || 50;

    const notices = noticeGenerator.getAll(filters);
    res.json(notices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notices/pending -- pending notices only
router.get('/pending', (req, res) => {
  try {
    const pending = noticeGenerator.getPending();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Recipient routes (MUST come before /:id to avoid matching "recipients" as an ID) ---

// GET /api/notices/recipients -- list all recipients
router.get('/recipients', (req, res) => {
  try {
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    res.json(recipientManager.listRecipients(filters));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices/recipients -- add recipient
router.post('/recipients', (req, res) => {
  try {
    const recipient = recipientManager.addRecipient(req.body);
    if (!recipient) return res.status(500).json({ error: 'Failed to add recipient' });
    res.status(201).json(recipient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notices/recipients/:rid -- update recipient
router.put('/recipients/:rid', (req, res) => {
  try {
    const recipient = recipientManager.updateRecipient(req.params.rid, req.body);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    res.json(recipient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notices/recipients/:rid -- remove recipient
router.delete('/recipients/:rid', (req, res) => {
  try {
    recipientManager.removeRecipient(req.params.rid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices/bulk-dismiss -- dismiss all pending notices (optional: filter by vessel)
router.post('/bulk-dismiss', (req, res) => {
  try {
    const db = require('../db/database');
    const reason = req.body.reason || 'Bulk dismissed — stale startup notices';
    const vesselImo = req.body.vessel_imo || null;
    const now = new Date().toISOString();
    const reviewer = req.user ? req.user.email : 'admin';

    let query = `UPDATE insurer_notices SET status = 'DISMISSED', dismiss_reason = ?, reviewed_by = ?, reviewed_at = ?
                 WHERE status IN ('PENDING', 'AUTO_QUEUED')`;
    const params = [reason, reviewer, now];
    if (vesselImo) { query += ' AND vessel_imo = ?'; params.push(vesselImo); }

    const result = db.prepare(query).run(...params);
    res.json({ dismissed: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Notice detail and actions (/:id routes) ---

// GET /api/notices/:id -- single notice detail
router.get('/:id', (req, res) => {
  try {
    const db = require('../db/database');
    const notice = db.prepare('SELECT * FROM insurer_notices WHERE id = ?').get(req.params.id);
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices/:id/review -- mark notice as reviewed
router.post('/:id/review', (req, res) => {
  try {
    const notice = noticeGenerator.review(req.params.id, req.user ? req.user.email : 'admin');
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices/:id/send -- mark notice as sent (simulated)
router.post('/:id/send', (req, res) => {
  try {
    const recipients = req.body.recipients || ['war-risk@insurer.com', 'broker@broker.com'];
    const notice = noticeGenerator.markSent(req.params.id, recipients);
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices/:id/dismiss -- dismiss notice with reason
router.post('/:id/dismiss', (req, res) => {
  try {
    const reason = req.body.reason || 'Dismissed by operator';
    const notice = noticeGenerator.dismiss(req.params.id, reason, req.user ? req.user.email : 'admin');
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
