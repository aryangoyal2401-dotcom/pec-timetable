const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(await db.all(`SELECT r.*, d.name as department_name FROM rooms r LEFT JOIN departments d ON r.department_id = d.id ORDER BY r.type, r.name`));
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const room = await db.get('SELECT * FROM rooms WHERE id = ?', req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, capacity = 30, type, department_id, location } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  try {
    const r = await db.run('INSERT INTO rooms (name, capacity, type, department_id, location) VALUES (?, ?, ?, ?, ?)', [name, capacity, type, department_id || null, location || null]);
    res.status(201).json({ id: r.lastID, name, capacity, type, department_id, location });
  } catch { res.status(409).json({ error: 'Room name already exists' }); }
});

router.put('/:id', async (req, res) => {
  const db = await getDb();
  const room = await db.get('SELECT * FROM rooms WHERE id = ?', req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { name, capacity, type, department_id, location } = req.body;
  await db.run('UPDATE rooms SET name=?, capacity=?, type=?, department_id=?, location=? WHERE id=?',
    [name ?? room.name, capacity ?? room.capacity, type ?? room.type, department_id ?? room.department_id, location ?? room.location, req.params.id]);
  res.json({ id: parseInt(req.params.id), ...req.body });
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM timetable_entries WHERE room_id = ?', req.params.id);
  await db.run('DELETE FROM room_bookings WHERE room_id = ?', req.params.id);
  const r = await db.run('DELETE FROM rooms WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Room not found' });
  res.json({ success: true });
});

module.exports = router;
