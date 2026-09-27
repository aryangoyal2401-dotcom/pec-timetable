const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

router.get('/users', async (req, res) => {
  const db = await getDb();
  try {
    const users = await db.all('SELECT email, name, picture, role, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:email/role', async (req, res) => {
  const db = await getDb();
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
    const r = await db.run('UPDATE users SET role = ? WHERE email = ?', [role, email]);
    if (r.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
