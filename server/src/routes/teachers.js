const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(await db.all(`SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id ORDER BY t.name`));
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const teacher = await db.get(`SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?`, req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  const availability = await db.all('SELECT * FROM teacher_availability WHERE teacher_id = ?', req.params.id);
  res.json({ ...teacher, availability });
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, designation, department_id, max_hours_week = 18 } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const r = await db.run('INSERT INTO teachers (name, designation, department_id, max_hours_week) VALUES (?, ?, ?, ?)', [name, designation || null, department_id || null, max_hours_week]);
  res.status(201).json({ id: r.lastID, name, designation, department_id, max_hours_week });
});

router.put('/:id', async (req, res) => {
  const db = await getDb();
  const t = await db.get('SELECT * FROM teachers WHERE id = ?', req.params.id);
  if (!t) return res.status(404).json({ error: 'Teacher not found' });
  const { name, designation, department_id, max_hours_week } = req.body;
  await db.run('UPDATE teachers SET name=?, designation=?, department_id=?, max_hours_week=? WHERE id=?',
    [name ?? t.name, designation ?? t.designation, department_id ?? t.department_id, max_hours_week ?? t.max_hours_week, req.params.id]);
  res.json({ id: parseInt(req.params.id), ...req.body });
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM timetable_entries WHERE teacher_id = ?', req.params.id);
  await db.run('DELETE FROM teacher_assignments WHERE teacher_id = ?', req.params.id);
  await db.run('DELETE FROM teacher_availability WHERE teacher_id = ?', req.params.id);
  const r = await db.run('DELETE FROM teachers WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Teacher not found' });
  res.json({ success: true });
});

router.put('/:id/availability', async (req, res) => {
  const db = await getDb();
  const { availability } = req.body;
  if (!Array.isArray(availability)) return res.status(400).json({ error: 'availability must be an array' });
  for (const item of availability) {
    await db.run(`INSERT INTO teacher_availability (teacher_id, day, period, status) VALUES (?, ?, ?, ?)
      ON CONFLICT(teacher_id, day, period) DO UPDATE SET status = excluded.status`,
      [req.params.id, item.day, item.period, item.status]);
  }
  res.json({ success: true, updated: availability.length });
});

router.get('/:id/workload', async (req, res) => {
  const db = await getDb();
  const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  const { hours } = await db.get('SELECT COALESCE(SUM(duration_hours), 0) as hours FROM timetable_entries WHERE teacher_id = ?', req.params.id);
  res.json({ teacher_id: parseInt(req.params.id), teacher_name: teacher.name, scheduled_hours: hours, max_hours: teacher.max_hours_week, remaining_hours: teacher.max_hours_week - hours });
});

module.exports = router;
