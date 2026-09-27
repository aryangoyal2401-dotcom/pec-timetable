const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';
  res.json(await db.all(`
    SELECT ta.*,
      t.name as teacher_name, t.designation,
      s.name as scholar_name, s.roll_no as scholar_roll_no,
      cc.type as component_type, cc.hours_per_week, cc.duration_hours, cc.requires_lab,
      c.name as course_name, c.code as course_code, c.short_name as course_short_name,
      cl.name as class_name,
      sg.name as group_name
    FROM teacher_assignments ta
    LEFT JOIN teachers t ON ta.teacher_id = t.id
    LEFT JOIN scholars s ON ta.scholar_id = s.id
    JOIN course_components cc ON ta.course_component_id = cc.id
    JOIN courses c ON cc.course_id = c.id
    JOIN classes cl ON ta.class_id = cl.id
    LEFT JOIN student_groups sg ON ta.group_id = sg.id
    WHERE ta.academic_term = ?
    ORDER BY cl.name, c.name, cc.type, sg.name
  `, [term]));
});

router.post('/assign', async (req, res) => {
  const db = await getDb();
  const { teacher_id, scholar_id, course_component_id, class_id, group_id, academic_term = '2026-27-1' } = req.body;
  if (!course_component_id || !class_id)
    return res.status(400).json({ error: 'course_component_id and class_id are required' });

  const cId = parseInt(class_id);
  const compId = parseInt(course_component_id);
  const gId = group_id ? parseInt(group_id) : null;
  const tId = teacher_id ? parseInt(teacher_id) : null;
  const sId = scholar_id ? parseInt(scholar_id) : null;

  const existing = gId
    ? await db.get(
        `SELECT id FROM teacher_assignments WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?`,
        [academic_term, compId, cId, gId]
      )
    : await db.get(
        `SELECT id FROM teacher_assignments WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL`,
        [academic_term, compId, cId]
      );

  // If neither teacher nor scholar is assigned -> delete existing assignment record
  if (!tId && !sId) {
    if (existing) {
      await db.run('DELETE FROM teacher_assignments WHERE id = ?', [existing.id]);
      
      // Auto-sync: delete from timetable_entries or set teacher to null
      // Actually, if we unassign a teacher entirely, we should just set the teacher to NULL in timetable
      if (gId) {
        await db.run(
          'UPDATE timetable_entries SET teacher_id = NULL, scholar_id = NULL WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
          [academic_term, compId, cId, gId]
        );
      } else {
        await db.run(
          'UPDATE timetable_entries SET teacher_id = NULL, scholar_id = NULL WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
          [academic_term, compId, cId]
        );
      }
    }
    return res.json({ success: true, unassigned: true });
  }

  if (existing) {
    await db.run(
      'UPDATE teacher_assignments SET teacher_id = ?, scholar_id = ? WHERE id = ?',
      [tId, sId, existing.id]
    );

    // Auto-sync
    if (gId) {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
        [tId, sId, academic_term, compId, cId, gId]
      );
    } else {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
        [tId, sId, academic_term, compId, cId]
      );
    }

    return res.json({
      id: existing.id,
      academic_term,
      teacher_id: tId,
      scholar_id: sId,
      course_component_id: compId,
      class_id: cId,
      group_id: gId
    });
  } else {
    try {
      const r = await db.run(
        'INSERT INTO teacher_assignments (academic_term, teacher_id, scholar_id, course_component_id, class_id, group_id) VALUES (?, ?, ?, ?, ?, ?)',
        [academic_term, tId, sId, compId, cId, gId]
      );

      // Auto-sync
      if (gId) {
        await db.run(
          'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
          [tId, sId, academic_term, compId, cId, gId]
        );
      } else {
        await db.run(
          'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
          [tId, sId, academic_term, compId, cId]
        );
      }

      return res.status(201).json({
        id: r.lastID,
        academic_term,
        teacher_id: tId,
        scholar_id: sId,
        course_component_id: compId,
        class_id: cId,
        group_id: gId
      });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT' || (err.message && err.message.includes('UNIQUE'))) {
        const conflict = gId
          ? await db.get(`SELECT id FROM teacher_assignments WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?`, [academic_term, compId, cId, gId])
          : await db.get(`SELECT id FROM teacher_assignments WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL`, [academic_term, compId, cId]);
        if (conflict) {
          await db.run('UPDATE teacher_assignments SET teacher_id = ?, scholar_id = ? WHERE id = ?', [tId, sId, conflict.id]);
          
          // Auto-sync
          if (gId) {
            await db.run(
              'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
              [tId, sId, academic_term, compId, cId, gId]
            );
          } else {
            await db.run(
              'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
              [tId, sId, academic_term, compId, cId]
            );
          }

          return res.json({ id: conflict.id, academic_term, teacher_id: tId, scholar_id: sId, course_component_id: compId, class_id: cId, group_id: gId });
        }
      }
      throw err;
    }
  }
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { teacher_id, scholar_id, course_component_id, class_id, group_id, academic_term = '2026-27-1' } = req.body;
  if (!course_component_id || !class_id)
    return res.status(400).json({ error: 'course_component_id, class_id required' });

  const tId = teacher_id ? parseInt(teacher_id) : null;
  const sId = scholar_id ? parseInt(scholar_id) : null;

  try {
    const r = await db.run(
      'INSERT INTO teacher_assignments (academic_term, teacher_id, scholar_id, course_component_id, class_id, group_id) VALUES (?, ?, ?, ?, ?, ?)',
      [academic_term, tId, sId, course_component_id, class_id, group_id || null]
    );

    // Auto-sync
    if (group_id) {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
        [tId, sId, academic_term, course_component_id, class_id, group_id]
      );
    } else {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = ?, scholar_id = ? WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
        [tId, sId, academic_term, course_component_id, class_id]
      );
    }

    res.status(201).json({ id: r.lastID, academic_term, teacher_id: tId, scholar_id: sId, course_component_id, class_id, group_id: group_id || null });
  } catch {
    res.status(409).json({ error: 'An assignment is already made for this component and class/group combination in this term' });
  }
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  
  // Need to get the assignment details before deleting to auto-sync
  const assignment = await db.get('SELECT * FROM teacher_assignments WHERE id = ?', [req.params.id]);
  
  await db.run('DELETE FROM teacher_assignments WHERE id = ?', [req.params.id]);

  if (assignment) {
    if (assignment.group_id) {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = NULL, scholar_id = NULL WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?',
        [assignment.academic_term, assignment.course_component_id, assignment.class_id, assignment.group_id]
      );
    } else {
      await db.run(
        'UPDATE timetable_entries SET teacher_id = NULL, scholar_id = NULL WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL',
        [assignment.academic_term, assignment.course_component_id, assignment.class_id]
      );
    }
  }

  res.json({ success: true });
});

router.get('/by-class/:classId', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';
  res.json(await db.all(`
    SELECT ta.*, 
           t.name as teacher_name, t.designation,
           s.name as scholar_name,
           cc.type as component_type
    FROM teacher_assignments ta
    LEFT JOIN teachers t ON ta.teacher_id = t.id
    LEFT JOIN scholars s ON ta.scholar_id = s.id
    JOIN course_components cc ON ta.course_component_id = cc.id
    WHERE ta.class_id = ? AND ta.academic_term = ?
  `, [req.params.classId, term]));
});

module.exports = router;
