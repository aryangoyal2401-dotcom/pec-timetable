const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

// ─── Classes CRUD ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const db = await getDb();
  if (req.query.academic_term) {
    return res.json(await db.all(`
      SELECT c.*, COALESCE(cs.semester, c.semester) as semester, d.name as department_name,
        (SELECT COUNT(*) FROM student_groups WHERE class_id = c.id) as group_count,
        (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count_actual
      FROM classes c
      LEFT JOIN class_semesters cs ON cs.class_id = c.id AND cs.academic_term = ?
      LEFT JOIN departments d ON c.department_id = d.id
      ORDER BY COALESCE(cs.semester, c.semester), c.name
    `, [req.query.academic_term]));
  }
  res.json(await db.all(`
    SELECT c.*, d.name as department_name,
      (SELECT COUNT(*) FROM student_groups WHERE class_id = c.id) as group_count,
      (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count_actual
    FROM classes c
    LEFT JOIN departments d ON c.department_id = d.id
    ORDER BY c.semester, c.name
  `));
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const cls = await db.get('SELECT * FROM classes WHERE id = ?', req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  // Flat group list (no hierarchy enforced) with member count
  const groups = await db.all(`
    SELECT sg.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = sg.id) as member_count
    FROM student_groups sg
    WHERE sg.class_id = ?
    ORDER BY sg.group_type DESC, sg.name
  `, req.params.id);

  res.json({ ...cls, groups });
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { name, department_id, student_count = 60, semester } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.run(
      'INSERT INTO classes (name, department_id, student_count, semester) VALUES (?, ?, ?, ?)',
      [name, department_id || null, student_count, semester || null]
    );
    res.status(201).json({ id: r.lastID, name, department_id, student_count, semester });
  } catch { res.status(409).json({ error: 'Class name already exists' }); }
});

router.put('/:id', async (req, res) => {
  const db = await getDb();
  const cls = await db.get('SELECT * FROM classes WHERE id = ?', req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const { name, department_id, student_count, semester } = req.body;
  await db.run(
    'UPDATE classes SET name=?, department_id=?, student_count=?, semester=? WHERE id=?',
    [name ?? cls.name, department_id ?? cls.department_id, student_count ?? cls.student_count, semester ?? cls.semester, req.params.id]
  );
  res.json({ id: parseInt(req.params.id), ...req.body });
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM timetable_entries WHERE class_id = ?', req.params.id);
  await db.run('DELETE FROM teacher_assignments WHERE class_id = ?', req.params.id);
  await db.run('DELETE FROM students WHERE class_id = ?', req.params.id);
  await db.run('DELETE FROM student_groups WHERE class_id = ?', req.params.id);
  const r = await db.run('DELETE FROM classes WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Class not found' });
  res.json({ success: true });
});

// ─── Groups (flat — no hierarchy enforced) ────────────────────────────────────

router.get('/:id/groups', async (req, res) => {
  const db = await getDb();
  res.json(await db.all(`
    SELECT sg.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = sg.id) as member_count
    FROM student_groups sg
    WHERE sg.class_id = ?
    ORDER BY sg.group_type DESC, sg.name
  `, req.params.id));
});

// POST /:id/groups — create a group (lecture or lab, no forced parent)
router.post('/:id/groups', async (req, res) => {
  const db = await getDb();
  const { name, student_count = 0, group_type = 'lecture' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.run(
      `INSERT INTO student_groups (class_id, name, student_count, group_type, parent_id)
       VALUES (?, ?, ?, ?, NULL)`,
      [req.params.id, name, student_count, group_type]
    );
    res.status(201).json({
      id: r.lastID, class_id: parseInt(req.params.id),
      name, student_count, group_type, parent_id: null, member_count: 0,
    });
  } catch { res.status(409).json({ error: 'Group name already exists in this class' }); }
});

router.put('/:classId/groups/:groupId', async (req, res) => {
  const db = await getDb();
  const grp = await db.get('SELECT * FROM student_groups WHERE id = ? AND class_id = ?',
    [req.params.groupId, req.params.classId]);
  if (!grp) return res.status(404).json({ error: 'Group not found' });

  const { name, group_type, student_count } = req.body;
  const { member_count } = await db.get(
    'SELECT COUNT(*) as member_count FROM group_members WHERE group_id = ?',
    req.params.groupId
  );

  const updatedCount = member_count > 0 ? member_count : (student_count !== undefined ? parseInt(student_count) || 0 : grp.student_count);

  await db.run(
    'UPDATE student_groups SET name=?, group_type=?, student_count=? WHERE id=?',
    [name ?? grp.name, group_type ?? grp.group_type, updatedCount, req.params.groupId]
  );

  res.json({
    id: parseInt(req.params.groupId),
    class_id: parseInt(req.params.classId),
    name: name ?? grp.name,
    group_type: group_type ?? grp.group_type,
    student_count: updatedCount,
    member_count
  });
});

router.delete('/:classId/groups/:groupId', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM timetable_entries WHERE group_id = ? AND class_id = ?',
    [req.params.groupId, req.params.classId]);
  await db.run('DELETE FROM teacher_assignments WHERE group_id = ? AND class_id = ?',
    [req.params.groupId, req.params.classId]);
  await db.run('DELETE FROM group_members WHERE group_id = ?', [req.params.groupId]);
  const r = await db.run('DELETE FROM student_groups WHERE id = ? AND class_id = ?',
    [req.params.groupId, req.params.classId]);
  if (r.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.json({ success: true });
});

// ─── Students ─────────────────────────────────────────────────────────────────

// GET all students in a class
router.get('/:id/students', async (req, res) => {
  const db = await getDb();
  const students = await db.all(`
    SELECT s.*,
      GROUP_CONCAT(sg.name, ', ') as group_names,
      GROUP_CONCAT(sg.id, ',') as group_ids
    FROM students s
    LEFT JOIN group_members gm ON s.id = gm.student_id
    LEFT JOIN student_groups sg ON gm.group_id = sg.id
    WHERE s.class_id = ?
    GROUP BY s.id
    ORDER BY s.roll_no
  `, req.params.id);
  res.json(students);
});

// POST /:id/students — add one student
router.post('/:id/students', async (req, res) => {
  const db = await getDb();
  const { roll_no, name } = req.body;
  if (!roll_no || !name) return res.status(400).json({ error: 'roll_no and name are required' });
  try {
    const r = await db.run(
      'INSERT INTO students (class_id, roll_no, name) VALUES (?, ?, ?)',
      [req.params.id, roll_no.trim(), name.trim()]
    );
    res.status(201).json({ id: r.lastID, class_id: parseInt(req.params.id), roll_no, name });
  } catch { res.status(409).json({ error: `Roll no ${roll_no} already exists in this class` }); }
});

// POST /:id/students/bulk — bulk add students
// Body: { students: [ { roll_no, name }, ... ] }
// OR:   { text: "101 Aryan Singh\n102 Ravi Kumar\n..." }  (space-separated, one per line)
router.post('/:id/students/bulk', async (req, res) => {
  const db = await getDb();
  let rows = [];

  if (req.body.students && Array.isArray(req.body.students)) {
    rows = req.body.students;
  } else if (req.body.text) {
    // Parse text: each line is "ROLL_NO Name Surname..."
    rows = req.body.text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(/[\s,\t]+/); // split on space, comma, or tab
        const roll_no = parts[0];
        const name    = parts.slice(1).join(' ');
        return { roll_no, name };
      })
      .filter(r => r.roll_no && r.name);
  }

  if (rows.length === 0) return res.status(400).json({ error: 'No valid student rows found' });

  let added = 0, skipped = 0, errors = [];
  for (const { roll_no, name } of rows) {
    try {
      await db.run(
        'INSERT INTO students (class_id, roll_no, name) VALUES (?, ?, ?) ON CONFLICT (class_id, roll_no) DO NOTHING',
        [req.params.id, roll_no.toString().trim(), name.trim()]
      );
      added++;
    } catch (e) {
      skipped++;
      errors.push(`${roll_no}: ${e.message}`);
    }
  }

  res.status(201).json({ added, skipped, errors: errors.slice(0, 10) });
});

// DELETE /:id/students/:studentId
router.delete('/:id/students/:studentId', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM students WHERE id = ? AND class_id = ?',
    [req.params.studentId, req.params.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Student not found' });
  res.json({ success: true });
});

// ─── Group Membership ─────────────────────────────────────────────────────────

// GET /:id/groups/:groupId/members
router.get('/:id/groups/:groupId/members', async (req, res) => {
  const db = await getDb();
  const members = await db.all(`
    SELECT s.* FROM students s
    JOIN group_members gm ON s.id = gm.student_id
    WHERE gm.group_id = ? AND s.class_id = ?
    ORDER BY s.roll_no
  `, [req.params.groupId, req.params.id]);
  res.json(members);
});

// POST /:id/groups/:groupId/members — add student(s) to a group
// Body: { student_ids: [1, 2, 3] }  OR  { student_id: 1 }
router.post('/:id/groups/:groupId/members', async (req, res) => {
  const db = await getDb();
  const gid = req.params.groupId;
  const ids = req.body.student_ids
    ? req.body.student_ids
    : req.body.student_id
      ? [req.body.student_id]
      : [];

  if (ids.length === 0) return res.status(400).json({ error: 'student_ids required' });

  let added = 0;
  for (const sid of ids) {
    const result = await db.run(
      'INSERT INTO group_members (group_id, student_id) VALUES (?, ?) ON CONFLICT (group_id, student_id) DO NOTHING',
      [gid, sid]
    );
    if (result.changes) added++;
  }

  // Auto-update student_count on the group
  const { cnt } = await db.get('SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?', gid);
  await db.run('UPDATE student_groups SET student_count = ? WHERE id = ?', [cnt, gid]);

  res.status(201).json({ added, total_members: cnt });
});

// DELETE /:id/groups/:groupId/members/:studentId
router.delete('/:id/groups/:groupId/members/:studentId', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM group_members WHERE group_id = ? AND student_id = ?',
    [req.params.groupId, req.params.studentId]);
  if (r.changes === 0) return res.status(404).json({ error: 'Member not found' });

  // Auto-update student_count
  const { cnt } = await db.get('SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?', req.params.groupId);
  await db.run('UPDATE student_groups SET student_count = ? WHERE id = ?', [cnt, req.params.groupId]);

  res.json({ success: true, total_members: cnt });
});

// PUT /:id/groups/:groupId/members/bulk — replace entire membership list
// Body: { student_ids: [1, 2, 3, ...] }
router.put('/:id/groups/:groupId/members/bulk', async (req, res) => {
  const db = await getDb();
  const gid = req.params.groupId;
  const ids = req.body.student_ids || [];

  // Replace all members
  await db.run('DELETE FROM group_members WHERE group_id = ?', gid);
  for (const sid of ids) {
    await db.run('INSERT INTO group_members (group_id, student_id) VALUES (?, ?) ON CONFLICT (group_id, student_id) DO NOTHING', [gid, sid]);
  }

  const { cnt } = await db.get('SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?', gid);
  await db.run('UPDATE student_groups SET student_count = ? WHERE id = ?', [cnt, gid]);

  res.json({ total_members: cnt });
});

// PUT /:id/groups/members/bulk — replace all group memberships for a class
// Students must belong to exactly one lecture group and exactly one lab group
// when those group types exist. Lecture and lab memberships are independent.
router.put('/:id/groups/members/bulk', async (req, res) => {
  const db = await getDb();
  const classId = req.params.id;
  const assignments = req.body.assignments;

  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments must be an array' });
  }

  const students = await db.all('SELECT id FROM students WHERE class_id = ?', classId);
  const groups = await db.all('SELECT id, group_type FROM student_groups WHERE class_id = ?', classId);
  const validStudentIds = new Set(students.map(student => student.id));
  const validGroups = new Map(groups.map(group => [group.id, group.group_type]));
  const assignedStudents = new Map();

  for (const assignment of assignments) {
    const groupId = Number(assignment.group_id);
    const studentIds = assignment.student_ids;
    const groupType = validGroups.get(groupId);
    if (!groupType || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: 'Each assignment must contain a valid group_id and student_ids array' });
    }

    for (const studentId of studentIds) {
      const id = Number(studentId);
      if (!validStudentIds.has(id)) {
        return res.status(400).json({ error: 'A student does not belong to this class' });
      }
      const studentTypes = assignedStudents.get(id) || new Set();
      if (studentTypes.has(groupType)) {
        return res.status(409).json({ error: `Student ${id} is assigned to more than one ${groupType} group` });
      }
      studentTypes.add(groupType);
      assignedStudents.set(id, studentTypes);
    }
  }

  for (const groupType of new Set(groups.map(group => group.group_type))) {
    const assignedCount = [...assignedStudents.values()].filter(types => types.has(groupType)).length;
    if (assignedCount !== students.length) {
      return res.status(400).json({
        error: `Every student must be assigned to exactly one ${groupType} group. ${students.length - assignedCount} student(s) are unassigned.`,
      });
    }
  }

  await db.exec('BEGIN TRANSACTION');
  try {
    await db.run(
      'DELETE FROM group_members WHERE group_id IN (SELECT id FROM student_groups WHERE class_id = ?)',
      classId
    );
    for (const assignment of assignments) {
      for (const studentId of assignment.student_ids) {
        await db.run(
          'INSERT INTO group_members (group_id, student_id) VALUES (?, ?)',
          [assignment.group_id, studentId]
        );
      }
      await db.run(
        'UPDATE student_groups SET student_count = ? WHERE id = ?',
        [assignment.student_ids.length, assignment.group_id]
      );
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  res.json({ total_students: students.length, total_groups: assignments.length });
});

module.exports = router;
