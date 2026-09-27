const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');
const { validateEntry, getAvailableSlots } = require('../engine/constraintEngine');

const ENTRY_QUERY = `
  SELECT te.*,
    te.duration_hours,
    c.name as class_name,
    sg.name as group_name, sg.group_type, sg.parent_id as group_parent_id,
    t.name as teacher_name, t.designation,
    s.name as scholar_name, s.roll_no as scholar_roll_no,
    co.name as course_name, co.code as course_code, co.short_name as course_short_name,
    cc.type as component_type, cc.hours_per_week, cc.duration_hours as component_duration,
    r.name as room_name, r.type as room_type, r.capacity,
    ts.day, ts.period, ts.start_time, ts.end_time
  FROM timetable_entries te
  JOIN classes c ON te.class_id = c.id
  LEFT JOIN student_groups sg ON te.group_id = sg.id
  LEFT JOIN teachers t ON te.teacher_id = t.id
  LEFT JOIN scholars s ON te.scholar_id = s.id
  JOIN course_components cc ON te.course_component_id = cc.id
  JOIN courses co ON cc.course_id = co.id
  JOIN rooms r ON te.room_id = r.id
  JOIN time_slots ts ON te.time_slot_id = ts.id
`;

// ─── Available slots ─────────────────────────────────────────────────────────
router.get('/utils/available-slots', async (req, res) => {
  const { teacher_id, scholar_id, class_id, room_id, course_component_id, group_id, duration_hours, academic_term = '2026-27-1' } = req.query;
  if (!class_id || !room_id || !course_component_id) {
    return res.status(400).json({ error: 'class_id, room_id, course_component_id required' });
  }
  const slots = await getAvailableSlots({
    teacher_id: teacher_id ? parseInt(teacher_id) : null,
    scholar_id: scholar_id ? parseInt(scholar_id) : null,
    class_id: parseInt(class_id),
    room_id: parseInt(room_id),
    course_component_id: parseInt(course_component_id),
    group_id: group_id ? parseInt(group_id) : null,
    duration_hours: parseInt(duration_hours) || 1,
    academic_term,
  });
  res.json(slots);
});

// ─── Stats ───────────────────────────────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';

  const { count: totalEntries } = await db.get(
    'SELECT COUNT(*) as count FROM timetable_entries WHERE academic_term = ?',
    [term]
  );
  const teacherWorkloads = await db.all(`
    SELECT t.id, t.name, t.max_hours_week,
      COALESCE(SUM(CASE WHEN te.academic_term = ? THEN te.duration_hours ELSE 0 END), 0) as scheduled_hours
    FROM teachers t LEFT JOIN timetable_entries te ON t.id = te.teacher_id
    GROUP BY t.id ORDER BY scheduled_hours DESC
  `, [term]);

  const scholarWorkloads = await db.all(`
    SELECT s.id, s.name, s.max_hours_week,
      COALESCE(SUM(CASE WHEN te.academic_term = ? THEN te.duration_hours ELSE 0 END), 0) as scheduled_hours
    FROM scholars s LEFT JOIN timetable_entries te ON s.id = te.scholar_id
    GROUP BY s.id ORDER BY scheduled_hours DESC
  `, [term]);

  const roomUtilization = await db.all(`
    SELECT r.id, r.name, r.type,
      COUNT(CASE WHEN te.academic_term = ? THEN te.id ELSE NULL END) as booked_slots,
      ROUND(COUNT(CASE WHEN te.academic_term = ? THEN te.id ELSE NULL END) * 100.0 / 40, 1) as utilization_pct
    FROM rooms r LEFT JOIN timetable_entries te ON r.id = te.room_id
    GROUP BY r.id ORDER BY booked_slots DESC
  `, [term, term]);

  res.json({ totalEntries, conflicts: 0, teacherWorkloads, scholarWorkloads, roomUtilization, academic_term: term });
});

// ─── Schedule Status ──────────────────────────────────────────────────────────
// Returns per-class, per-component, per-group progress with full group hierarchy for a term
router.get('/status/schedule', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';
  const { class_id } = req.query;

  const classFilter = class_id ? 'AND ta.class_id = ?' : '';
  const classParams = class_id ? [term, class_id] : [term];

  // All teacher assignments = what SHOULD be scheduled in this academic term
  const assignments = await db.all(`
    SELECT ta.id, ta.academic_term, ta.class_id, ta.teacher_id, ta.scholar_id, ta.course_component_id, ta.group_id,
      cl.name as class_name,
      t.name as teacher_name,
      s.name as scholar_name,
      cc.type as component_type, cc.hours_per_week, cc.duration_hours as session_duration,
      co.name as course_name, co.code as course_code, co.short_name as course_short_name,
      sg.name as group_name, sg.group_type, sg.parent_id as group_parent_id,
      pg.name as parent_group_name
    FROM teacher_assignments ta
    JOIN classes cl ON ta.class_id = cl.id
    LEFT JOIN teachers t ON ta.teacher_id = t.id
    LEFT JOIN scholars s ON ta.scholar_id = s.id
    JOIN course_components cc ON ta.course_component_id = cc.id
    JOIN courses co ON cc.course_id = co.id
    LEFT JOIN student_groups sg ON ta.group_id = sg.id
    LEFT JOIN student_groups pg ON sg.parent_id = pg.id
    WHERE ta.academic_term = ? ${classFilter}
      AND NOT (
        ta.group_id IS NULL AND EXISTS (
          SELECT 1 FROM teacher_assignments grouped_assignment
          WHERE grouped_assignment.academic_term = ta.academic_term
            AND grouped_assignment.class_id = ta.class_id
            AND grouped_assignment.course_component_id = ta.course_component_id
            AND grouped_assignment.group_id IS NOT NULL
        )
      )
    ORDER BY cl.name, sg.group_type DESC, sg.parent_id NULLS FIRST, sg.name, co.name, cc.type
  `, classParams);

  // Count scheduled hours (SUM of duration_hours) per (class, component, group) in this term
  const scheduled = await db.all(`
    SELECT class_id, course_component_id, group_id,
      COALESCE(SUM(duration_hours), 0) as scheduled_hours
    FROM timetable_entries
    WHERE academic_term = ? ${class_id ? 'AND class_id = ?' : ''}
    GROUP BY class_id, course_component_id, group_id
  `, class_id ? [term, class_id] : [term]);

  const scheduledMap = {};
  scheduled.forEach(s => {
    const key = `${s.class_id}-${s.course_component_id}-${s.group_id ?? 'null'}`;
    scheduledMap[key] = s.scheduled_hours;
  });

  const result = assignments.map(a => {
    const key = `${a.class_id}-${a.course_component_id}-${a.group_id ?? 'null'}`;
    const done = scheduledMap[key] || 0;
    const sessions_required = Math.ceil(a.hours_per_week / (a.session_duration || 1));
    const sessions_done = Math.floor(done / (a.session_duration || 1));
    return {
      ...a,
      scheduled_hours: done,
      required_hours: a.hours_per_week,
      remaining: Math.max(0, a.hours_per_week - done),
      sessions_required,
      sessions_done,
      status: done >= a.hours_per_week ? 'complete' : done > 0 ? 'partial' : 'not_started',
    };
  });

  res.json(result);
});

// ─── GET all entries (with filters) ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const db = await getDb();
  const term = req.query.academic_term || '2026-27-1';

  let query = ENTRY_QUERY + ' WHERE te.academic_term = ?';
  const params = [term];

  if (req.query.class_id)   { query += ' AND te.class_id = ?';   params.push(req.query.class_id); }
  if (req.query.teacher_id) { query += ' AND te.teacher_id = ?'; params.push(req.query.teacher_id); }
  if (req.query.scholar_id) { query += ' AND te.scholar_id = ?'; params.push(req.query.scholar_id); }
  if (req.query.room_id)    { query += ' AND te.room_id = ?';    params.push(req.query.room_id); }

  query += ' ORDER BY ts.day, ts.period';
  res.json(await db.all(query, params));
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const entry = await db.get(ENTRY_QUERY + ' WHERE te.id = ?', req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  res.json(entry);
});

// ─── POST — create entry ─────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      academic_term = '2026-27-1',
      class_id, group_id, course_component_id, teacher_id, scholar_id, room_id, time_slot_id, duration_hours
    } = req.body;

    if (!class_id || !course_component_id || !room_id || !time_slot_id) {
      return res.status(400).json({ error: 'class_id, course_component_id, room_id, time_slot_id required' });
    }

    const dur = parseInt(duration_hours) || 1;
    const tId = teacher_id ? parseInt(teacher_id) : null;
    const sId = scholar_id ? parseInt(scholar_id) : null;

    const db = await getDb();
    const assignedFaculty = await db.get(
      `SELECT teacher_id, scholar_id FROM teacher_assignments
       WHERE academic_term = ? AND class_id = ? AND course_component_id = ?
         AND (group_id = ? OR (group_id IS NULL AND CAST(? AS INTEGER) IS NULL))`,
      [academic_term, class_id, course_component_id, group_id || null, group_id || null]
    );

    // If a specific assignment was configured and differs, check teacher
    if (assignedFaculty && assignedFaculty.teacher_id && tId && Number(assignedFaculty.teacher_id) !== Number(tId)) {
      return res.status(409).json({
        error: 'Teacher differs from assigned faculty for this academic term',
      });
    }

    const validation = await validateEntry({
      academic_term,
      class_id: parseInt(class_id),
      group_id: group_id ? parseInt(group_id) : null,
      course_component_id: parseInt(course_component_id),
      teacher_id: tId,
      scholar_id: sId,
      room_id: parseInt(room_id),
      time_slot_id: parseInt(time_slot_id),
      duration_hours: dur,
    });
    if (!validation.valid) {
      return res.status(409).json({
        error: 'Constraint violation',
        constraint: validation.constraint,
        message: validation.message,
        details: validation.details,
      });
    }

    const r = await db.run(
      'INSERT INTO timetable_entries (academic_term, class_id, group_id, course_component_id, teacher_id, scholar_id, room_id, time_slot_id, duration_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [academic_term, class_id, group_id || null, course_component_id, tId, sId, room_id, time_slot_id, dur]
    );
    const entry = await db.get(ENTRY_QUERY + ' WHERE te.id = ?', r.lastID);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// ─── PUT — update entry ──────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM timetable_entries WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const entry = {
      academic_term:       req.body.academic_term       || existing.academic_term || '2026-27-1',
      class_id:            req.body.class_id            !== undefined ? (req.body.class_id ? parseInt(req.body.class_id) : null) : existing.class_id,
      group_id:            req.body.group_id            !== undefined ? (req.body.group_id ? parseInt(req.body.group_id) : null) : existing.group_id,
      course_component_id: req.body.course_component_id !== undefined ? parseInt(req.body.course_component_id) : existing.course_component_id,
      teacher_id:          req.body.teacher_id          !== undefined ? (req.body.teacher_id ? parseInt(req.body.teacher_id) : null) : existing.teacher_id,
      scholar_id:          req.body.scholar_id          !== undefined ? (req.body.scholar_id ? parseInt(req.body.scholar_id) : null) : existing.scholar_id,
      room_id:             req.body.room_id             !== undefined ? parseInt(req.body.room_id) : existing.room_id,
      time_slot_id:        req.body.time_slot_id        !== undefined ? parseInt(req.body.time_slot_id) : existing.time_slot_id,
      duration_hours:      parseInt(req.body.duration_hours ?? existing.duration_hours) || 1,
    };

    const validation = await validateEntry(entry, parseInt(req.params.id));
    if (!validation.valid) {
      return res.status(409).json({
        error: 'Constraint violation',
        constraint: validation.constraint,
        message: validation.message,
        details: validation.details,
      });
    }

    await db.run(
      'UPDATE timetable_entries SET academic_term=?, class_id=?, group_id=?, course_component_id=?, teacher_id=?, scholar_id=?, room_id=?, time_slot_id=?, duration_hours=? WHERE id=?',
      [entry.academic_term, entry.class_id, entry.group_id, entry.course_component_id, entry.teacher_id, entry.scholar_id,
       entry.room_id, entry.time_slot_id, entry.duration_hours, req.params.id]
    );

    const updated = await db.get(ENTRY_QUERY + ' WHERE te.id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM timetable_entries WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

module.exports = router;
