const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../../config/default');
const db = require('../db/database');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minutes.` });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      // Increment failed attempts
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        // Lock for 30 minutes
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
          .run(attempts, lockUntil, user.id);
        return res.status(423).json({ error: 'Account locked due to too many failed attempts. Try again in 30 minutes.' });
      }
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login -- reset failed attempts, update last_login
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });
    const refreshToken = jwt.sign({ id: user.id }, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });

    // Set cookie for browser access
    res.cookie('sentinel_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        email: user.email,
        role: user.role,
        displayName: user.display_name
      }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Authentication service error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });

    res.cookie('sentinel_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('sentinel_token', { path: '/' });
  res.json({ status: 'ok' });
});

module.exports = router;
