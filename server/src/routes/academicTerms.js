const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// ─── GET all academic terms ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const db = await getDb();
  const terms = await db.all('SELECT * FROM academic_terms ORDER BY code ASC');
  res.json(terms);
});

// ─── POST create academic term ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const db = await getDb();
  const { code, name, start_date, end_date, is_active } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Term code (e.g. 2026-27-2) and name are required' });
  }

  try {
    if (is_active) {
      await db.run('UPDATE academic_terms SET is_active = 0');
    }
    const r = await db.run(
      'INSERT INTO academic_terms (code, name, is_active, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [code.trim(), name.trim(), is_active ? 1 : 0, start_date || null, end_date || null]
    );

    // Determine if there is a previous term to rollover from
    const prevTerm = await db.get('SELECT code FROM academic_terms WHERE id != ? ORDER BY id DESC LIMIT 1', [r.lastID]);
    
    const classes = await db.all('SELECT id, semester FROM classes');
    for (const cl of classes) {
      let targetSemester = cl.semester || 1;
      
      if (prevTerm) {
        // Find what semester this class was in the previous term
        const prevClassSem = await db.get('SELECT semester FROM class_semesters WHERE academic_term = ? AND class_id = ?', [prevTerm.code, cl.id]);
        if (prevClassSem) {
           targetSemester = prevClassSem.semester + 1;
        }
      }

      await db.run(
        `INSERT INTO class_semesters (academic_term, class_id, semester) VALUES (?, ?, ?) ON CONFLICT (academic_term, class_id) DO NOTHING`,
        [code.trim(), cl.id, targetSemester]
      );
    }

    const created = await db.get('SELECT * FROM academic_terms WHERE id = ?', r.lastID);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Academic term code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT set active term ─────────────────────────────────────────────────────
router.put('/:code/active', async (req, res) => {
  const db = await getDb();
  const term = await db.get('SELECT * FROM academic_terms WHERE code = ?', req.params.code);
  if (!term) return res.status(404).json({ error: 'Academic term not found' });

  await db.run('UPDATE academic_terms SET is_active = 0');
  await db.run('UPDATE academic_terms SET is_active = 1 WHERE code = ?', req.params.code);
  res.json({ success: true, active_term: req.params.code });
});

// ─── GET class semesters for a term ──────────────────────────────────────────
router.get('/class-semesters', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';
  const rows = await db.all(`
    SELECT cs.id, cs.academic_term, cs.class_id, cs.semester,
      cl.name as class_name, cl.student_count, d.name as department_name
    FROM class_semesters cs
    JOIN classes cl ON cs.class_id = cl.id
    LEFT JOIN departments d ON cl.department_id = d.id
    WHERE cs.academic_term = ?
    ORDER BY cl.name
  `, [term]);
  res.json(rows);
});

// ─── PUT update class semester in a term ─────────────────────────────────────
router.put('/class-semesters', async (req, res) => {
  const db = await getDb();
  const { academic_term, class_id, semester } = req.body;
  if (!academic_term || !class_id || !semester) {
    return res.status(400).json({ error: 'academic_term, class_id, and semester are required' });
  }

  await db.run(`
    INSERT INTO class_semesters (academic_term, class_id, semester)
    VALUES (?, ?, ?)
    ON CONFLICT(academic_term, class_id) DO UPDATE SET semester = excluded.semester
  `, [academic_term, parseInt(class_id), parseInt(semester)]);

  res.json({ success: true, academic_term, class_id, semester: parseInt(semester) });
});

// ─── POST Rollover / Advance Batches to Next Term ────────────────────────────
// e.g. from '2026-27-1' to '2026-27-2', increments each batch's semester (Sem 1->2, 3->4, 5->6, 7->8)
router.post('/rollover', async (req, res) => {
  const db = await getDb();
  const { from_term, to_term, increment_semester = true } = req.body;
  if (!from_term || !to_term) {
    return res.status(400).json({ error: 'from_term and to_term are required' });
  }

  // Check if target term exists, if not create it
  let targetTerm = await db.get('SELECT * FROM academic_terms WHERE code = ?', to_term);
  if (!targetTerm) {
    await db.run(
      'INSERT INTO academic_terms (code, name, is_active) VALUES (?, ?, 0)',
      [to_term, `Academic Semester ${to_term}`]
    );
  }

  // Get current class semesters in from_term
  const currentClassSemesters = await db.all(
    'SELECT class_id, semester FROM class_semesters WHERE academic_term = ?',
    [from_term]
  );

  let advancedCount = 0;
  for (const cs of currentClassSemesters) {
    const nextSemester = increment_semester ? cs.semester + 1 : cs.semester;

    await db.run(`
      INSERT INTO class_semesters (academic_term, class_id, semester)
      VALUES (?, ?, ?)
      ON CONFLICT(academic_term, class_id) DO UPDATE SET semester = excluded.semester
    `, [to_term, cs.class_id, nextSemester]);
    advancedCount++;
  }

  res.json({
    success: true,
    message: `Advanced ${advancedCount} batches to term ${to_term}`,
    to_term,
  });
});

module.exports = router;
