const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(await db.all(`
    SELECT rb.*, r.name as room_name, r.type as room_type,
      ts.day, ts.period, ts.start_time, ts.end_time
    FROM room_bookings rb
    JOIN rooms r ON rb.room_id = r.id
    JOIN time_slots ts ON rb.time_slot_id = ts.id
    ORDER BY ts.day, ts.period
  `));
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { room_id, time_slot_id, date, booked_by, purpose } = req.body;
  if (!room_id || !time_slot_id || !booked_by) return res.status(400).json({ error: 'room_id, time_slot_id, booked_by required' });

  const existingBooking = await db.get('SELECT * FROM room_bookings WHERE room_id = ? AND time_slot_id = ?', [room_id, time_slot_id]);
  if (existingBooking) return res.status(409).json({ error: `Room already booked by "${existingBooking.booked_by}" at this slot` });

  const existingEntry = await db.get('SELECT * FROM timetable_entries WHERE room_id = ? AND time_slot_id = ?', [room_id, time_slot_id]);
  if (existingEntry) return res.status(409).json({ error: 'Room is already used in the academic timetable at this slot' });

  const r = await db.run('INSERT INTO room_bookings (room_id, time_slot_id, date, booked_by, purpose) VALUES (?, ?, ?, ?, ?)',
    [room_id, time_slot_id, date || null, booked_by, purpose || null]);
  res.status(201).json({ id: r.lastID, room_id, time_slot_id, date, booked_by, purpose });
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM room_bookings WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Booking not found' });
  res.json({ success: true });
});

module.exports = router;
