const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// In-memory fallback user store when DB is unavailable (dev mode)
const fallbackUserStore = new Map(); // email -> user object

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];

    // Enforce PEC domain
    if (!email.endsWith('@pec.edu.in')) {
      return res.status(403).json({ error: 'Only @pec.edu.in emails are allowed.' });
    }

    // Attempt to get a DB connection – if it fails we fallback to in‑memory.
    let dbAvailable = true;
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      dbAvailable = false;
      console.warn('⚠️ DB not reachable, using in‑memory user store:', dbErr.message);
    }

    let user;
    if (dbAvailable) {
      // Normal flow: look up or create user in PostgreSQL
      user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        const role = email === process.env.SUPER_ADMIN_EMAIL ? 'admin' : 'viewer';
        const r = await db.run('INSERT INTO users (email, name, picture, role) VALUES (?, ?, ?, ?)', [email, name, picture, role]);
        user = { id: r.lastID, email, name, picture, role };
      } else {
        // Keep name/picture current
        await db.run('UPDATE users SET name = ?, picture = ? WHERE email = ?', [name, picture, email]);
        user.name = name;
        user.picture = picture;
      }
    } else {
      // Fallback: store user in memory for the session duration
      if (fallbackUserStore.has(email)) {
        user = fallbackUserStore.get(email);
        user.name = name;
        user.picture = picture;
      } else {
        const role = email === process.env.SUPER_ADMIN_EMAIL ? 'admin' : 'viewer';
        user = { email, name, picture, role };
        fallbackUserStore.set(email, user);
      }
    }

    // Issue JWT session cookie
    const token = jwt.sign(
      { email: user.email, name: user.name, picture: user.picture, role: user.role },
      process.env.JWT_SECRET,
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
    res.status(401).json({ error: 'Authentication failed' });
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
