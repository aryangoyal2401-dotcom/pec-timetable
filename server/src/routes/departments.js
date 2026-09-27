const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(await db.all('SELECT * FROM departments ORDER BY name'));
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, short_name } = req.body;
  if (!name || !short_name) return res.status(400).json({ error: 'name and short_name required' });
  try {
    const r = await db.run('INSERT INTO departments (name, short_name) VALUES (?, ?)', [name, short_name]);
    res.status(201).json({ id: r.lastID, name, short_name });
  } catch { res.status(409).json({ error: 'Department already exists' }); }
});

module.exports = router;
