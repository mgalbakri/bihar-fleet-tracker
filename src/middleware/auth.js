const jwt = require('jsonwebtoken');
const config = require('../../config/default');

function authenticateToken(req, res, next) {
  // Check Authorization header first, then cookie
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const tokenFromCookie = req.headers.cookie && parseCookie(req.headers.cookie, 'sentinel_token');
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    // For API requests, return 401 (use originalUrl since req.path is relative to mount point)
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // For page requests, redirect to login
    return res.redirect('/');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    return res.redirect('/');
  }
}

function parseCookie(cookieString, name) {
  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, val] = cookie.trim().split('=');
    acc[key] = val;
    return acc;
  }, {});
  return cookies[name];
}

module.exports = { authenticateToken };
