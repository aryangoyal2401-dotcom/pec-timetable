const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(await db.all('SELECT * FROM holidays ORDER BY date'));
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { date, name } = req.body;
  if (!date || !name) return res.status(400).json({ error: 'date and name required' });
  try {
    const r = await db.run('INSERT INTO holidays (date, name) VALUES (?, ?)', [date, name]);
    res.status(201).json({ id: r.lastID, date, name });
  } catch { res.status(409).json({ error: 'Holiday already exists for this date' }); }
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM holidays WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Holiday not found' });
  res.json({ success: true });
});

module.exports = router;
