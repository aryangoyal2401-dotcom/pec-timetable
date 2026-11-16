const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { fallbackUserStore } = require('./auth');

router.use(requireAdmin);

router.get('/users', async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT email, name, picture, role, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    console.warn('⚠️ Fetching users from DB failed, using fallback store:', err.message);
    if (fallbackUserStore && fallbackUserStore.size > 0) {
      return res.json(Array.from(fallbackUserStore.values()));
    }
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:email/role', async (req, res) => {
  const { email } = req.params;
  const { role } = req.body;

  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Prevent demoting the super admin
  if (email === process.env.SUPER_ADMIN_EMAIL && role !== 'admin') {
    return res.status(403).json({ error: 'Cannot demote the super admin' });
  }

  try {
    const db = await getDb();
    const r = await db.run('UPDATE users SET role = ? WHERE email = ?', [role, email]);
    if (r.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (fallbackUserStore && fallbackUserStore.has(email)) {
      fallbackUserStore.get(email).role = role;
    }
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.warn('⚠️ Updating user role in DB failed, updating fallback store:', err.message);
    if (fallbackUserStore && fallbackUserStore.has(email)) {
      fallbackUserStore.get(email).role = role;
      return res.json({ message: 'Role updated successfully' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
