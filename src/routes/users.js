// User management routes (admin only)
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// GET /api/users -- list all users (admin only)
router.get('/', (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const db = require('../db/database');
    const users = db.prepare(
      'SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC'
    ).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users -- create a new user (admin only)
router.post('/', async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const db = require('../db/database');
    const { email, password, displayName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const validRoles = ['admin', 'dpa', 'operator', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'viewer';

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, hash, displayName || email, userRole);

    res.status(201).json({ id, email, display_name: displayName || email, role: userRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id -- delete a user (admin only, cannot delete self)
router.delete('/:id', (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const db = require('../db/database');

    // Prevent self-deletion
    if (req.user && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
