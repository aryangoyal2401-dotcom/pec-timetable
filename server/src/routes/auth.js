require('dotenv').config();
const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'pec-cse-timetable-super-secret-key-2026';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'aryangoyal.bt24cse@pec.edu.in';

// In-memory fallback user store when DB is unavailable (dev mode)
const fallbackUserStore = new Map(); // email -> user object

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function resolveUser(email, name, picture, requestedRole = null) {
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
  const targetRole = isSuperAdmin ? 'admin' : (requestedRole || 'viewer');

  try {
    const db = await getDb();
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      const r = await db.run(
        'INSERT INTO users (email, name, picture, role) VALUES (?, ?, ?, ?)',
        [email, name, picture, targetRole]
      );
      user = { id: r.lastID, email, name, picture, role: targetRole };
    } else {
      let roleToSet = user.role;
      if (isSuperAdmin && user.role !== 'admin') {
        roleToSet = 'admin';
        await db.run('UPDATE users SET role = ? WHERE email = ?', ['admin', email]);
      } else if (requestedRole && !isSuperAdmin) {
        roleToSet = requestedRole;
        await db.run('UPDATE users SET role = ? WHERE email = ?', [requestedRole, email]);
      }
      await db.run('UPDATE users SET name = ?, picture = ? WHERE email = ?', [name, picture, email]);
      user.name = name;
      user.picture = picture;
      user.role = roleToSet;
    }
    // Also keep in fallback cache
    fallbackUserStore.set(email, { ...user });
    return user;
  } catch (dbErr) {
    console.warn('⚠️ DB operation failed, falling back to in-memory user store:', dbErr.message);
    let user = fallbackUserStore.get(email);
    if (!user) {
      user = {
        email,
        name: name || email.split('@')[0],
        picture: picture || null,
        role: targetRole,
        created_at: new Date().toISOString()
      };
      fallbackUserStore.set(email, user);
    } else {
      if (name) user.name = name;
      if (picture) user.picture = picture;
      if (isSuperAdmin) {
        user.role = 'admin';
      } else if (requestedRole) {
        user.role = requestedRole;
      }
    }
    return user;
  }
}

router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }

  try {
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('Google verifyIdToken failed, attempting fallback JWT decode for local dev:', verifyErr.message);
      payload = jwt.decode(credential);
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google credential token' });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || null;

    // Enforce PEC domain
    if (!email.endsWith('@pec.edu.in')) {
      return res.status(403).json({ error: 'Only @pec.edu.in emails are allowed.' });
    }

    const user = await resolveUser(email, name, picture);

    // Issue JWT session cookie
    const token = jwt.sign(
      { email: user.email, name: user.name, picture: user.picture, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Login successful', user: { email: user.email, name: user.name, picture: user.picture, role: user.role } });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed. Please check your credentials.' });
  }
});

// Dev / Local testing login endpoint
router.post('/dev-login', async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@pec.edu.in')) {
      return res.status(403).json({ error: 'Only @pec.edu.in emails are allowed.' });
    }

    const displayName = name || cleanEmail.split('@')[0];
    const user = await resolveUser(cleanEmail, displayName, null, role);

    const token = jwt.sign(
      { email: user.email, name: user.name, picture: user.picture, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Dev login successful',
      user: { email: user.email, name: user.name, picture: user.picture, role: user.role }
    });
  } catch (error) {
    console.error('Dev Login Error:', error);
    res.status(500).json({ error: error.message || 'Dev login failed' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
module.exports.fallbackUserStore = fallbackUserStore;
