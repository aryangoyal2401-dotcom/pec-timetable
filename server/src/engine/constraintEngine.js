/**
 * Constraint Engine (Async)
 * =========================
 * Validates every timetable assignment against hard constraints.
 * Supports multi-hour (duration_hours > 1) entries that span consecutive periods.
 */

const { getDb } = require('../db/database');

// ─── Helper: get all time_slot_ids spanned by a multi-hour entry ──────────
// Validates that slots are truly consecutive (no lunch gap between them).
async function getSpannedSlotIds(db, startSlotId, duration) {
  if (!duration || duration <= 1) return [startSlotId];

  const startSlot = await db.get('SELECT * FROM time_slots WHERE id = ?', startSlotId);
  if (!startSlot) throw new Error('Invalid start slot.');

  const ids = [startSlotId];
  let prevEnd = startSlot.end_time;

  for (let i = 1; i < duration; i++) {
    // Next slot must start EXACTLY where the previous one ends (no gap = no lunch in between)
    const next = await db.get(
      'SELECT * FROM time_slots WHERE day = ? AND start_time = ?',
      [startSlot.day, prevEnd]
    );
    if (!next) {
      throw new Error(
        `Cannot schedule a ${duration}-hour session starting at ${startSlot.start_time} on ${startSlot.day}. ` +
        `There is no consecutive slot after ${prevEnd} (lunch break or end of day).`
      );
    }
    ids.push(next.id);
    prevEnd = next.end_time;
  }
  return ids;
}

async function validateEntry(entry, excludeEntryId = null) {
  const db = await getDb();
  const term = entry.academic_term || '2026-27-1';

  const slot = await db.get('SELECT * FROM time_slots WHERE id = ?', entry.time_slot_id);
  if (!slot) return fail('INVALID_SLOT', 'The selected time slot does not exist.', {});

  const room = await db.get('SELECT * FROM rooms WHERE id = ?', entry.room_id);
  if (!room) return fail('INVALID_ROOM', 'The selected room does not exist.', {});

  let teacher = null;
  if (entry.teacher_id) {
    teacher = await db.get('SELECT * FROM teachers WHERE id = ?', entry.teacher_id);
    if (!teacher) return fail('INVALID_TEACHER', 'The selected teacher does not exist.', {});
  }

  let scholar = null;
  if (entry.scholar_id) {
    scholar = await db.get('SELECT * FROM scholars WHERE id = ?', entry.scholar_id);
    if (!scholar) return fail('INVALID_SCHOLAR', 'The selected scholar does not exist.', {});
  }

  const cls = await db.get('SELECT * FROM classes WHERE id = ?', entry.class_id);
  if (!cls) return fail('INVALID_CLASS', 'The selected class does not exist.', {});

  const component = await db.get(`
    SELECT cc.*, c.name as course_name, c.code as course_code
    FROM course_components cc
    JOIN courses c ON cc.course_id = c.id
    WHERE cc.id = ?
  `, entry.course_component_id);
  if (!component) return fail('INVALID_COMPONENT', 'The selected course component does not exist.', {});

  const isLabComponent = component.type === 'lab';

  // ─── Resolve all time slot IDs spanned by this entry ────────────────────
  const duration = entry.duration_hours || component.duration_hours || 1;
  let spannedSlotIds;
  try {
    spannedSlotIds = await getSpannedSlotIds(db, entry.time_slot_id, duration);
  } catch (e) {
    return fail('NON_CONSECUTIVE_SLOTS', e.message, { duration });
  }

  // ─── 1. Teacher Conflict (all spanned slots) ─────────────────────────────
  // Rule: Teachers can supervise multiple parallel lab groups simultaneously at the same slot.
  // For lectures / tutorials, teachers cannot be double-booked.
  if (teacher) {
    for (const slotId of spannedSlotIds) {
      let q = `
        SELECT te.id, c.name as class_name, co.name as course_name, cc.type as existing_comp_type
        FROM timetable_entries te
        JOIN classes c ON te.class_id = c.id
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        WHERE te.academic_term = ? AND te.teacher_id = ? AND te.time_slot_id = ?
      `;
      const params = [term, entry.teacher_id, slotId];
      if (excludeEntryId) { q += ' AND te.id != ?'; params.push(excludeEntryId); }
      const conflicts = await db.all(q, params);

      for (const conflict of conflicts) {
        // Allow if BOTH current component and existing component are labs (parallel lab supervision)
        const isParallelLab = isLabComponent && conflict.existing_comp_type === 'lab';
        if (!isParallelLab) {
          return fail('TEACHER_CONFLICT',
            `${teacher.name} is already teaching "${conflict.course_name}" (${conflict.existing_comp_type}) for ${conflict.class_name} at this slot in term ${term}.`,
            { teacher_name: teacher.name });
        }
      }
    }

    // Also check: existing multi-hour entries that OVERLAP our start slot
    {
      const q = `
        SELECT te.id, co.name as course_name, c.name as class_name, cc.type as existing_comp_type,
               ts.period as entry_period, te.duration_hours as entry_dur
        FROM timetable_entries te
        JOIN time_slots ts ON te.time_slot_id = ts.id
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        JOIN classes c ON te.class_id = c.id
        WHERE te.academic_term = ?
          AND te.teacher_id = ?
          AND ts.day = ?
          AND ts.period + te.duration_hours - 1 >= ?
          AND ts.period <= ?
          ${excludeEntryId ? 'AND te.id != ?' : ''}
      `;
      const params = [term, entry.teacher_id, slot.day, slot.period, slot.period + duration - 1];
      if (excludeEntryId) params.push(excludeEntryId);
      const overlaps = await db.all(q, params);
      for (const overlap of overlaps) {
        const isParallelLab = isLabComponent && overlap.existing_comp_type === 'lab';
        if (!isParallelLab) {
          return fail('TEACHER_CONFLICT',
            `${teacher.name} is already teaching "${overlap.course_name}" (${overlap.existing_comp_type}) for ${overlap.class_name} — ` +
            `it overlaps with this ${duration}-hour session in term ${term}.`,
            { teacher_name: teacher.name });
        }
      }
    }
  }

  // ─── 1b. Scholar Conflict (Strict: NO double-booking allowed) ────────────
  if (scholar) {
    for (const slotId of spannedSlotIds) {
      let q = `
        SELECT te.id, c.name as class_name, co.name as course_name, cc.type as comp_type
        FROM timetable_entries te
        JOIN classes c ON te.class_id = c.id
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        WHERE te.academic_term = ? AND te.scholar_id = ? AND te.time_slot_id = ?
      `;
      const params = [term, entry.scholar_id, slotId];
      if (excludeEntryId) { q += ' AND te.id != ?'; params.push(excludeEntryId); }
      const conflict = await db.get(q, params);
      if (conflict) {
        return fail('SCHOLAR_CONFLICT',
          `Scholar ${scholar.name} is already assigned to "${conflict.course_name}" (${conflict.comp_type}) for ${conflict.class_name} at this slot in term ${term}.`,
          { scholar_name: scholar.name });
      }
    }

    // Overlap check for multi-hour entries for scholar
    {
      const q = `
        SELECT te.id, co.name as course_name, c.name as class_name, cc.type as comp_type,
               ts.period as entry_period, te.duration_hours as entry_dur
        FROM timetable_entries te
        JOIN time_slots ts ON te.time_slot_id = ts.id
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        JOIN classes c ON te.class_id = c.id
        WHERE te.academic_term = ?
          AND te.scholar_id = ?
          AND ts.day = ?
          AND ts.period + te.duration_hours - 1 >= ?
          AND ts.period <= ?
          ${excludeEntryId ? 'AND te.id != ?' : ''}
      `;
      const params = [term, entry.scholar_id, slot.day, slot.period, slot.period + duration - 1];
      if (excludeEntryId) params.push(excludeEntryId);
      const overlap = await db.get(q, params);
      if (overlap) {
        return fail('SCHOLAR_CONFLICT',
          `Scholar ${scholar.name} is already assigned to "${overlap.course_name}" (${overlap.comp_type}) for ${overlap.class_name} — overlaps with this session in term ${term}.`,
          { scholar_name: scholar.name });
      }
    }
  }

  // ─── 2. Room Conflict (all spanned slots) ────────────────────────────────
  for (const slotId of spannedSlotIds) {
    let q = `SELECT te.id, c.name as class_name, co.name as course_name
      FROM timetable_entries te
      JOIN classes c ON te.class_id = c.id
      JOIN course_components cc ON te.course_component_id = cc.id
      JOIN courses co ON cc.course_id = co.id
      WHERE te.academic_term = ? AND te.room_id = ? AND te.time_slot_id = ?`;
    const params = [term, entry.room_id, slotId];
    if (excludeEntryId) { q += ' AND te.id != ?'; params.push(excludeEntryId); }
    const conflict = await db.get(q, params);
    if (conflict) return fail('ROOM_CONFLICT',
      `${room.name} is already occupied by "${conflict.course_name}" (${conflict.class_name}) at this slot in term ${term}.`,
      { room_name: room.name });
  }

  // Also check overlap for room with multi-hour entries
  {
    const q = `
      SELECT te.id, co.name as course_name, c.name as class_name
      FROM timetable_entries te
      JOIN time_slots ts ON te.time_slot_id = ts.id
      JOIN course_components cc ON te.course_component_id = cc.id
      JOIN courses co ON cc.course_id = co.id
      JOIN classes c ON te.class_id = c.id
      WHERE te.academic_term = ?
        AND te.room_id = ?
        AND ts.day = ?
        AND ts.period + te.duration_hours - 1 >= ?
        AND ts.period <= ?
        ${excludeEntryId ? 'AND te.id != ?' : ''}
    `;
    const params = [term, entry.room_id, slot.day, slot.period, slot.period + duration - 1];
    if (excludeEntryId) params.push(excludeEntryId);
    const overlap = await db.get(q, params);
    if (overlap) return fail('ROOM_CONFLICT',
      `${room.name} is occupied by "${overlap.course_name}" — overlaps with this ${duration}-hour session in term ${term}.`,
      { room_name: room.name });
  }

  // ─── 3. Student Group Conflict (student-overlap-based) ───────────────────
  for (const slotId of spannedSlotIds) {
    let q, params;

    if (entry.group_id) {
      q = `
        SELECT te.id, co.name as course_name, sg.name as group_name, te.group_id as existing_group_id
        FROM timetable_entries te
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        LEFT JOIN student_groups sg ON te.group_id = sg.id
        WHERE te.academic_term = ? AND te.class_id = ? AND te.time_slot_id = ?
          AND (
            te.group_id IS NULL
            OR te.group_id = ?
            OR EXISTS (
              SELECT 1 FROM group_members m1
              JOIN group_members m2 ON m1.student_id = m2.student_id
              WHERE m1.group_id = ? AND m2.group_id = te.group_id
            )
          )`;
      params = [term, entry.class_id, slotId, entry.group_id, entry.group_id];
    } else {
      // Whole-class entry — blocks any other entry at this slot for this class in this term
      q = `SELECT te.id, co.name as course_name, sg.name as group_name
        FROM timetable_entries te
        JOIN course_components cc ON te.course_component_id = cc.id
        JOIN courses co ON cc.course_id = co.id
        LEFT JOIN student_groups sg ON te.group_id = sg.id
        WHERE te.academic_term = ? AND te.class_id = ? AND te.time_slot_id = ?`;
      params = [term, entry.class_id, slotId];
    }

    if (excludeEntryId) { q += ' AND te.id != ?'; params.push(excludeEntryId); }
    const conflict = await db.get(q, params);
    if (conflict) {
      const who = conflict.group_name ? `group "${conflict.group_name}"` : 'the whole class';
      return fail('STUDENT_GROUP_CONFLICT',
        `${cls.name}: ${who} is already scheduled with "${conflict.course_name}" at this time slot in term ${term}.`,
        { class_name: cls.name });
    }
  }

  // Overlap check for existing multi-hour entries that span into our slots
  if (entry.group_id) {
    const q = `
      SELECT te.id, co.name as course_name, sg.name as group_name
      FROM timetable_entries te
      JOIN time_slots ts ON te.time_slot_id = ts.id
      JOIN course_components cc ON te.course_component_id = cc.id
      JOIN courses co ON cc.course_id = co.id
      LEFT JOIN student_groups sg ON te.group_id = sg.id
      WHERE te.academic_term = ?
        AND te.class_id = ?
        AND ts.day = ?
        AND ts.period + te.duration_hours - 1 >= ?
        AND ts.period <= ?
        AND (
          te.group_id IS NULL
          OR te.group_id = ?
          OR EXISTS (
            SELECT 1 FROM group_members m1
            JOIN group_members m2 ON m1.student_id = m2.student_id
            WHERE m1.group_id = ? AND m2.group_id = te.group_id
          )
        )
        ${excludeEntryId ? 'AND te.id != ?' : ''}
    `;
    const params = [term, entry.class_id, slot.day, slot.period, slot.period + duration - 1,
      entry.group_id, entry.group_id];
    if (excludeEntryId) params.push(excludeEntryId);
    const overlap = await db.get(q, params);
    if (overlap) {
      const who = overlap.group_name ? `group "${overlap.group_name}"` : 'the whole class';
      return fail('STUDENT_GROUP_CONFLICT',
        `${cls.name}: ${who} has "${overlap.course_name}" overlapping with this ${duration}-hour session in term ${term}.`,
        { class_name: cls.name });
    }
  }

  // ─── 4. Teacher Availability ─────────────────────────────────────────────
  if (teacher) {
    for (const slotId of spannedSlotIds) {
      const s = await db.get('SELECT * FROM time_slots WHERE id = ?', slotId);
      const avail = await db.get(
        `SELECT status FROM teacher_availability WHERE teacher_id = ? AND day = ? AND period = ?`,
        [entry.teacher_id, s.day, s.period]
      );
      if (avail && avail.status === 'blocked') {
        return fail('TEACHER_UNAVAILABLE',
          `${teacher.name} is marked as unavailable on ${s.day} Period ${s.period} (${s.start_time}–${s.end_time}).`,
          { day: s.day, period: s.period });
      }
    }
  }

  // ─── 5. Room Booking Conflict ─────────────────────────────────────────────
  for (const slotId of spannedSlotIds) {
    const booking = await db.get(
      `SELECT * FROM room_bookings WHERE room_id = ? AND time_slot_id = ?`,
      [entry.room_id, slotId]
    );
    if (booking) return fail('ROOM_BOOKING_CONFLICT',
      `${room.name} is already booked by "${booking.booked_by}" for "${booking.purpose}" at this slot.`,
      { booked_by: booking.booked_by });
  }

  // ─── 6. Room Capacity ─────────────────────────────────────────────────────
  {
    let groupSize = cls.student_count;
    const actualClassCount = await db.get('SELECT COUNT(*) as count FROM students WHERE class_id = ?', cls.id);
    if (actualClassCount && Number(actualClassCount.count) > 0) {
      groupSize = Number(actualClassCount.count);
    }

    if (entry.group_id) {
      const grp = await db.get('SELECT * FROM student_groups WHERE id = ?', entry.group_id);
      if (grp) {
        const actualGroupCount = await db.get('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?', grp.id);
        if (actualGroupCount && Number(actualGroupCount.count) > 0) {
          groupSize = Number(actualGroupCount.count);
        } else if (grp.student_count > 0) {
          groupSize = grp.student_count;
        }
      }
    }
    if (room.capacity < groupSize) {
      return fail('ROOM_CAPACITY',
        `${room.name} (capacity: ${room.capacity}) is too small for ${groupSize} students.`,
        { room_capacity: room.capacity, group_size: groupSize });
    }
  }

  // ─── 7. Room Type Match ───────────────────────────────────────────────────
  {
    if (component.requires_lab && room.type !== 'lab') {
      return fail('ROOM_TYPE_MISMATCH',
        `${component.course_name} (${component.type}) requires a lab. ${room.name} is a ${room.type}.`,
        { required_type: 'lab', actual_type: room.type });
    }
  }

  // ─── 9. Teacher Workload ──────────────────────────────────────────────────
  if (teacher) {
    let q = `SELECT COALESCE(SUM(duration_hours), 0) as hours FROM timetable_entries WHERE academic_term = ? AND teacher_id = ?`;
    const params = [term, entry.teacher_id];
    if (excludeEntryId) { q += ' AND id != ?'; params.push(excludeEntryId); }
    const { hours } = await db.get(q, params);
    const numHours = Number(hours);
    if (numHours + duration > teacher.max_hours_week) {
      return fail('TEACHER_WORKLOAD_EXCEEDED',
        `${teacher.name} has reached their maximum workload of ${teacher.max_hours_week} hours/week for term ${term}. Currently assigned: ${numHours}h, adding ${duration}h would exceed limit.`,
        { current_hours: numHours, max_hours: teacher.max_hours_week });
    }
  }

  // ─── 9b. Scholar Workload ─────────────────────────────────────────────────
  if (scholar) {
    let q = `SELECT COALESCE(SUM(duration_hours), 0) as hours FROM timetable_entries WHERE academic_term = ? AND scholar_id = ?`;
    const params = [term, entry.scholar_id];
    if (excludeEntryId) { q += ' AND id != ?'; params.push(excludeEntryId); }
    const { hours } = await db.get(q, params);
    const numHours = Number(hours);
    if (numHours + duration > scholar.max_hours_week) {
      return fail('SCHOLAR_WORKLOAD_EXCEEDED',
        `Scholar ${scholar.name} has reached maximum workload of ${scholar.max_hours_week} hours/week for term ${term}. Currently assigned: ${numHours}h, adding ${duration}h would exceed limit.`,
        { current_hours: numHours, max_hours: scholar.max_hours_week });
    }
  }

  // ─── 10. Course Hours Exceeded ────────────────────────────────────────────
  {
    let q, params;
    let scopeLabel;

    if (entry.group_id) {
      q = `SELECT COALESCE(SUM(duration_hours), 0) as scheduled FROM timetable_entries
           WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id = ?`;
      params = [term, entry.course_component_id, entry.class_id, entry.group_id];
      const grp = await db.get('SELECT name FROM student_groups WHERE id = ?', entry.group_id);
      scopeLabel = grp ? grp.name : `Group ${entry.group_id}`;
    } else {
      q = `SELECT COALESCE(SUM(duration_hours), 0) as scheduled FROM timetable_entries
           WHERE academic_term = ? AND course_component_id = ? AND class_id = ? AND group_id IS NULL`;
      params = [term, entry.course_component_id, entry.class_id];
      scopeLabel = cls.name;
    }

    if (excludeEntryId) { q += ' AND id != ?'; params.push(excludeEntryId); }
    const { scheduled } = await db.get(q, params);
    const numScheduled = Number(scheduled);
    if (numScheduled + duration > component.hours_per_week) {
      return fail('COURSE_HOURS_EXCEEDED',
        `${component.course_name} (${component.type}) for ${scopeLabel} already has ${numScheduled}h scheduled of ${component.hours_per_week}h required in term ${term}. Adding ${duration}h would exceed limit.`,
        { scheduled: numScheduled, required: component.hours_per_week, scope: scopeLabel });
    }
  }

  return { valid: true };
}

async function getAvailableSlots({ teacher_id, scholar_id, class_id, room_id, course_component_id, group_id, duration_hours }) {
  const db = await getDb();
  const allSlots = await db.all('SELECT * FROM time_slots ORDER BY day, period');
  const available = [];
  const duration = parseInt(duration_hours) || 1;
  for (const slot of allSlots) {
    const result = await validateEntry({
      teacher_id: teacher_id || null,
      scholar_id: scholar_id || null,
      class_id, room_id, course_component_id,
      group_id: group_id || null,
      time_slot_id: slot.id,
      duration_hours: duration,
    });
    if (result.valid) available.push(slot);
  }
  return available;
}

function fail(constraint, message, details) {
  return { valid: false, constraint, message, details };
}

module.exports = { validateEntry, getAvailableSlots, getSpannedSlotIds };
