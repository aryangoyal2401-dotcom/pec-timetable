const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET all scholars (optionally filtered by department_id)
router.get('/', async (req, res) => {
  const db = await getDb();
  let query = `
    SELECT s.*, d.name as department_name, d.short_name as department_code,
      (SELECT COALESCE(SUM(te.duration_hours), 0) FROM timetable_entries te WHERE te.scholar_id = s.id) as scheduled_hours,
      (SELECT COUNT(*) FROM teacher_assignments ta WHERE ta.scholar_id = s.id) as assignment_count
    FROM scholars s
    LEFT JOIN departments d ON s.department_id = d.id
  `;
  const params = [];
  if (req.query.department_id) {
    query += ' WHERE s.department_id = ?';
    params.push(req.query.department_id);
  }
  query += ' ORDER BY s.name';
  res.json(await db.all(query, params));
});

// GET scholar by ID
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const scholar = await db.get(`
    SELECT s.*, d.name as department_name, d.short_name as department_code,
      (SELECT COALESCE(SUM(te.duration_hours), 0) FROM timetable_entries te WHERE te.scholar_id = s.id) as scheduled_hours
    FROM scholars s
    LEFT JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `, req.params.id);
  if (!scholar) return res.status(404).json({ error: 'Scholar not found' });
  res.json(scholar);
});

// POST create scholar
router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, roll_no, department_id, email, max_hours_week = 12 } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const r = await db.run(
      'INSERT INTO scholars (name, roll_no, department_id, email, max_hours_week) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), roll_no ? roll_no.trim() : null, department_id ? parseInt(department_id) : null, email ? email.trim() : null, parseInt(max_hours_week) || 12]
    );
    const created = await db.get(`
      SELECT s.*, d.name as department_name
      FROM scholars s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `, r.lastID);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Scholar with this Roll No / ID already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update scholar
router.put('/:id', async (req, res) => {
  const db = await getDb();
  const scholar = await db.get('SELECT * FROM scholars WHERE id = ?', req.params.id);
  if (!scholar) return res.status(404).json({ error: 'Scholar not found' });

  const { name, roll_no, department_id, email, max_hours_week } = req.body;

  try {
    await db.run(
      'UPDATE scholars SET name=?, roll_no=?, department_id=?, email=?, max_hours_week=? WHERE id=?',
      [
        name !== undefined ? name.trim() : scholar.name,
        roll_no !== undefined ? (roll_no ? roll_no.trim() : null) : scholar.roll_no,
        department_id !== undefined ? (department_id ? parseInt(department_id) : null) : scholar.department_id,
        email !== undefined ? (email ? email.trim() : null) : scholar.email,
        max_hours_week !== undefined ? parseInt(max_hours_week) || 12 : scholar.max_hours_week,
        req.params.id
      ]
    );
    const updated = await db.get(`
      SELECT s.*, d.name as department_name
      FROM scholars s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `, req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Scholar with this Roll No / ID already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE scholar
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  // Clear scholar reference in timetable_entries and teacher_assignments
  await db.run('UPDATE timetable_entries SET scholar_id = NULL WHERE scholar_id = ?', req.params.id);
  await db.run('UPDATE teacher_assignments SET scholar_id = NULL WHERE scholar_id = ?', req.params.id);
  const r = await db.run('DELETE FROM scholars WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Scholar not found' });
  res.json({ success: true });
});

module.exports = router;
