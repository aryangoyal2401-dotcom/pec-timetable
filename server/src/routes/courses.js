const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// ─── Course Offerings (Courses assigned to a batch for an Academic Term) ────
router.get('/offerings', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';
  let q = `
    SELECT co.id as offering_id, co.academic_term, co.class_id, co.course_id, co.semester_number,
      c.id, c.name, c.code, c.short_name, c.department_id,
      d.name as department_name, cl.name as class_name,
      COALESCE(co.semester_number, cs.semester, cl.semester) as semester,
      (SELECT COUNT(*) FROM course_components WHERE course_id = c.id) as component_count
    FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    JOIN classes cl ON co.class_id = cl.id
    LEFT JOIN class_semesters cs ON cs.class_id = cl.id AND cs.academic_term = co.academic_term
    LEFT JOIN departments d ON c.department_id = d.id
    WHERE co.academic_term = ?
  `;
  const params = [term];
  if (req.query.class_id) {
    q += ' AND co.class_id = ?';
    params.push(req.query.class_id);
  }
  q += ' ORDER BY cl.name, c.name';

  const offerings = await db.all(q, params);
  const allComponents = await db.all('SELECT * FROM course_components ORDER BY type');
  const offeringsWithComponents = offerings.map(o => ({
    ...o,
    components: allComponents.filter(comp => comp.course_id === o.id)
  }));
  res.json(offeringsWithComponents);
});

router.post('/offerings', async (req, res) => {
  const db = await getDb();
  const { academic_term = '2026-27-1', class_id, course_id, course_ids, semester_number } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const targetCourseIds = Array.isArray(course_ids) ? course_ids : (course_id ? [course_id] : []);
  if (targetCourseIds.length === 0) return res.status(400).json({ error: 'At least one course_id is required' });

  // Get current class semester if not provided
  let sem = semester_number;
  if (!sem) {
    const cs = await db.get('SELECT semester FROM class_semesters WHERE class_id = ? AND academic_term = ?', [class_id, academic_term]);
    if (cs) sem = cs.semester;
    else {
      const cl = await db.get('SELECT semester FROM classes WHERE id = ?', class_id);
      sem = cl?.semester || 1;
    }
  }

  for (const cId of targetCourseIds) {
    await db.run(
      `INSERT INTO course_offerings (academic_term, class_id, course_id, semester_number) VALUES (?, ?, ?, ?) ON CONFLICT (academic_term, class_id, course_id) DO NOTHING`,
      [academic_term, parseInt(class_id), parseInt(cId), parseInt(sem)]
    );
  }

  res.status(201).json({ success: true, count: targetCourseIds.length, academic_term, class_id });
});

router.delete('/offerings/:id', async (req, res) => {
  const db = await getDb();
  const offering = await db.get('SELECT * FROM course_offerings WHERE id = ?', req.params.id);
  if (!offering) return res.status(404).json({ error: 'Course offering not found' });

  // Remove teacher assignments and timetable entries for this offering in this term
  const comps = await db.all('SELECT id FROM course_components WHERE course_id = ?', offering.course_id);
  for (const comp of comps) {
    await db.run(
      'DELETE FROM timetable_entries WHERE course_component_id = ? AND class_id = ? AND academic_term = ?',
      [comp.id, offering.class_id, offering.academic_term]
    );
    await db.run(
      'DELETE FROM teacher_assignments WHERE course_component_id = ? AND class_id = ? AND academic_term = ?',
      [comp.id, offering.class_id, offering.academic_term]
    );
  }

  await db.run('DELETE FROM course_offerings WHERE id = ?', req.params.id);
  res.json({ success: true });
});

// ─── Master Course Catalog Endpoints ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const db = await getDb();
  let q = `
    SELECT c.*, d.name as department_name, cl.name as class_name,
      (SELECT COUNT(*) FROM course_components WHERE course_id = c.id) as component_count
    FROM courses c
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN classes cl ON c.class_id = cl.id
  `;
  const params = [];
  if (req.query.class_id) {
    q += ' WHERE c.class_id = ?';
    params.push(req.query.class_id);
  }
  q += ' ORDER BY cl.name, c.name';
  const courses = await db.all(q, params);
  const allComponents = await db.all('SELECT * FROM course_components ORDER BY type');
  const coursesWithComponents = courses.map(c => ({
    ...c,
    components: allComponents.filter(comp => comp.course_id === c.id)
  }));
  res.json(coursesWithComponents);
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const course = await db.get(`
    SELECT c.*, d.name as department_name, cl.name as class_name
    FROM courses c
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN classes cl ON c.class_id = cl.id
    WHERE c.id = ?
  `, req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const components = await db.all('SELECT * FROM course_components WHERE course_id = ? ORDER BY type', req.params.id);
  res.json({ ...course, components });
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, code, short_name, department_id, class_id, semester, components } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.run(
      'INSERT INTO courses (name, code, short_name, department_id, class_id, semester) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code || null, short_name || null, department_id ? parseInt(department_id) : null, class_id ? parseInt(class_id) : null, semester ? parseInt(semester) : null]
    );
    const courseId = r.lastID;

    // If components array provided, insert all components
    if (Array.isArray(components) && components.length > 0) {
      for (const comp of components) {
        if (comp.type) {
          await db.run(
            'INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)',
            [courseId, comp.type, comp.hours_per_week || 1, comp.duration_hours || 1, comp.requires_lab ? 1 : 0]
          );
        }
      }
    }

    const createdComponents = await db.all('SELECT * FROM course_components WHERE course_id = ? ORDER BY type', courseId);
    res.status(201).json({ id: courseId, name, code, short_name, department_id, class_id, components: createdComponents });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Course code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const db = await getDb();
  const course = await db.get('SELECT * FROM courses WHERE id = ?', req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const { name, code, short_name, department_id, class_id, semester, components } = req.body;
  await db.run(
    'UPDATE courses SET name=?, code=?, short_name=?, department_id=?, class_id=?, semester=? WHERE id=?',
    [
      name ?? course.name,
      code ?? course.code,
      short_name !== undefined ? (short_name || null) : course.short_name,
      department_id !== undefined ? (department_id ? parseInt(department_id) : null) : course.department_id,
      class_id !== undefined ? (class_id ? parseInt(class_id) : null) : course.class_id,
      semester !== undefined ? (semester ? parseInt(semester) : null) : course.semester,
      req.params.id
    ]
  );

  if (Array.isArray(components)) {
    // If full components array supplied on edit, sync components
    const incomingCompTypes = components.map(c => c.type).filter(Boolean);
    const existingComps = await db.all('SELECT * FROM course_components WHERE course_id = ?', req.params.id);

    // Remove components that were unchecked/deleted
    for (const exComp of existingComps) {
      if (!incomingCompTypes.includes(exComp.type)) {
        await db.run('DELETE FROM timetable_entries WHERE course_component_id = ?', exComp.id);
        await db.run('DELETE FROM teacher_assignments WHERE course_component_id = ?', exComp.id);
        await db.run('DELETE FROM course_components WHERE id = ?', exComp.id);
      }
    }

    // Insert or update existing components
    for (const comp of components) {
      if (!comp.type) continue;
      const matched = existingComps.find(ec => ec.type === comp.type);
      if (matched) {
        await db.run(
          'UPDATE course_components SET hours_per_week=?, duration_hours=?, requires_lab=? WHERE id=?',
          [comp.hours_per_week || 1, comp.duration_hours || 1, comp.requires_lab ? 1 : 0, matched.id]
        );
      } else {
        await db.run(
          'INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, comp.type, comp.hours_per_week || 1, comp.duration_hours || 1, comp.requires_lab ? 1 : 0]
        );
      }
    }
  }

  const updatedComponents = await db.all('SELECT * FROM course_components WHERE course_id = ? ORDER BY type', req.params.id);
  res.json({ id: parseInt(req.params.id), name: name ?? course.name, code: code ?? course.code, short_name: short_name !== undefined ? short_name : course.short_name, department_id: department_id ?? course.department_id, components: updatedComponents });
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const comps = await db.all('SELECT id FROM course_components WHERE course_id = ?', req.params.id);
  for (const comp of comps) {
    await db.run('DELETE FROM timetable_entries WHERE course_component_id = ?', comp.id);
    await db.run('DELETE FROM teacher_assignments WHERE course_component_id = ?', comp.id);
  }
  await db.run('DELETE FROM course_components WHERE course_id = ?', req.params.id);
  const r = await db.run('DELETE FROM courses WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Course not found' });
  res.json({ success: true });
});

router.post('/:id/components', async (req, res) => {
  const db = await getDb();
  const { type, hours_per_week = 1, duration_hours = 1, requires_lab = false } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  try {
    const r = await db.run('INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, type, hours_per_week, duration_hours, requires_lab ? 1 : 0]);
    res.status(201).json({ id: r.lastID, course_id: parseInt(req.params.id), type, hours_per_week, duration_hours, requires_lab });
  } catch { res.status(409).json({ error: 'Component type already exists for this course' }); }
});

router.put('/:courseId/components/:compId', async (req, res) => {
  const db = await getDb();
  const comp = await db.get('SELECT * FROM course_components WHERE id = ? AND course_id = ?', [req.params.compId, req.params.courseId]);
  if (!comp) return res.status(404).json({ error: 'Component not found' });
  const { type, hours_per_week, duration_hours, requires_lab } = req.body;
  await db.run('UPDATE course_components SET type=?, hours_per_week=?, duration_hours=?, requires_lab=? WHERE id=?',
    [type ?? comp.type, hours_per_week ?? comp.hours_per_week, duration_hours ?? comp.duration_hours,
     requires_lab !== undefined ? (requires_lab ? 1 : 0) : comp.requires_lab, req.params.compId]);
  res.json({ id: parseInt(req.params.compId), ...req.body });
});

router.delete('/:courseId/components/:compId', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM timetable_entries WHERE course_component_id = ?', req.params.compId);
  await db.run('DELETE FROM teacher_assignments WHERE course_component_id = ?', req.params.compId);
  const r = await db.run('DELETE FROM course_components WHERE id = ? AND course_id = ?', [req.params.compId, req.params.courseId]);
  if (r.changes === 0) return res.status(404).json({ error: 'Component not found' });
  res.json({ success: true });
});

module.exports = router;
