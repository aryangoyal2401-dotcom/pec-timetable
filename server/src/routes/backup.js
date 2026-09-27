const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

const TABLES = [
  'academic_terms',
  'departments',
  'rooms',
  'teachers',
  'teacher_availability',
  'scholars',
  'classes',
  'class_semesters',
  'student_groups',
  'students',
  'group_members',
  'courses',
  'course_components',
  'course_offerings',
  'teacher_assignments',
  'timetable_entries',
  'room_bookings',
  'holidays',
];

// ─── Export all data as JSON ────────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const db = await getDb();
    const backup = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      data: {}
    };

    for (const table of TABLES) {
      try {
        backup.data[table] = await db.all(`SELECT * FROM ${table}`);
      } catch (err) {
        backup.data[table] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="timetable_backup_${Date.now()}.json"`);
    res.json(backup);
  } catch (err) {
    console.error('Export backup error:', err);
    res.status(500).json({ error: 'Failed to export backup', details: err.message });
  }
});

// ─── Import data from JSON ──────────────────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const db = await getDb();
    await db.exec('PRAGMA foreign_keys = OFF');
    await db.exec('BEGIN TRANSACTION');

    try {
      for (const table of TABLES) {
        if (Array.isArray(data[table])) {
          // Clear current table records
          await db.run(`DELETE FROM ${table}`);

          const rows = data[table];
          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

            for (const row of rows) {
              const values = columns.map(col => row[col]);
              await db.run(sql, values);
            }
          }
        }
      }

      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    } finally {
      await db.exec('PRAGMA foreign_keys = ON');
    }

    res.json({ success: true, message: 'Data restored successfully' });
  } catch (err) {
    console.error('Import backup error:', err);
    res.status(500).json({ error: 'Failed to restore backup', details: err.message });
  }
});

module.exports = router;
