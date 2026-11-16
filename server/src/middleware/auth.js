const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pec-cse-timetable-super-secret-key-2026';

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { email, name, picture, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  });
}

// Generic role‑based middleware – pass an array of allowed roles
function requireRole(allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.user && allowedRoles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: Insufficient role' });
      }
    });
  };
}

module.exports = { requireAuth, requireAdmin, requireRole };
