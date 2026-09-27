/**
 * import-timetable.js
 * Imports the CSE 1 timetable (G1 + CSE1 lab) from the uploaded image.
 *
 * What this does:
 *  1. Fixes time_slots period constraint (1-8 → 1-10)
 *  2. Replaces time slots with the college's real schedule (9:00–19:00, 9 periods)
 *  3. Creates courses: CTN501 TOC, CTN502 SC, CTN503 SE, CTN504 DBMS
 *  4. Creates teachers: Dr. Ashpreet, Dr. Sandeep, Dr. Dipika, Dr. Shilpa
 *  5. Creates rooms: L21, L22, L407, CL 13, 306, Lab 301, Lab 405
 *  6. Creates class "CSE 1" with groups G1 (lecture) + CSE1 (lab)
 *  7. Creates teacher assignments
 *  8. Creates all timetable entries from the image
 *
 * Run: node import-timetable.js
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path    = require('path');

const DB_PATH = path.join(__dirname, 'server', 'data', 'timetable.db');

// ─── Helper: get existing row or insert and return id ─────────────────────
async function getOrCreate(db, table, where, extra = {}) {
  const wKeys = Object.keys(where);
  const wClause = wKeys.map(k => `${k} IS ?`).join(' AND ');
  const existing = await db.get(
    `SELECT id FROM ${table} WHERE ${wClause}`,
    wKeys.map(k => where[k] ?? null)
  );
  if (existing) return existing.id;

  const allData   = { ...where, ...extra };
  const cols      = Object.keys(allData).join(', ');
  const placeholders = Object.keys(allData).map(() => '?').join(', ');
  const result = await db.run(
    `INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${placeholders})`,
    Object.values(allData).map(v => v ?? null)
  );
  if (result.lastID) return result.lastID;

  // Race or duplicate — fetch again
  const found = await db.get(
    `SELECT id FROM ${table} WHERE ${wClause}`,
    wKeys.map(k => where[k] ?? null)
  );
  if (!found) throw new Error(`Failed to get/create row in ${table}: ${JSON.stringify(where)}`);
  return found.id;
}

// ─── Step 1: Fix period CHECK constraint (1–8 → 1–10) ────────────────────
async function fixPeriodConstraint(db) {
  const { sql } = await db.get(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='time_slots'`
  ) || {};

  if (!sql || !sql.includes('BETWEEN 1 AND 8')) {
    console.log('ℹ️  period constraint already OK');
    return;
  }

  console.log('🔧 Fixing period constraint (1–8 → 1–10)...');
  await db.exec(`
    CREATE TABLE time_slots_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      day        TEXT NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri','Sat')),
      period     INTEGER NOT NULL CHECK(period BETWEEN 1 AND 10),
      start_time TEXT NOT NULL,
      end_time   TEXT NOT NULL,
      UNIQUE(day, period)
    );
    INSERT OR IGNORE INTO time_slots_new SELECT * FROM time_slots;
    DROP TABLE time_slots;
    ALTER TABLE time_slots_new RENAME TO time_slots;
  `);
  console.log('✅ period constraint updated');
}

// ─── Also fix teacher_availability CHECK (1–8 → 1–10) ────────────────────
async function fixAvailabilityConstraint(db) {
  const { sql } = await db.get(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='teacher_availability'`
  ) || {};
  if (!sql || !sql.includes('BETWEEN 1 AND 8')) return;

  console.log('🔧 Fixing teacher_availability period constraint...');
  await db.exec(`
    CREATE TABLE teacher_availability_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      day        TEXT NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri','Sat')),
      period     INTEGER NOT NULL CHECK(period BETWEEN 1 AND 10),
      status     TEXT NOT NULL CHECK(status IN ('available','preferred','blocked')),
      UNIQUE(teacher_id, day, period)
    );
    INSERT OR IGNORE INTO teacher_availability_new SELECT * FROM teacher_availability;
    DROP TABLE teacher_availability;
    ALTER TABLE teacher_availability_new RENAME TO teacher_availability;
  `);
  console.log('✅ teacher_availability constraint updated');
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📥 Starting timetable import...\n');
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  await db.exec('PRAGMA foreign_keys = OFF');
  await db.exec('PRAGMA journal_mode = WAL');

  // ── Fix constraints ──────────────────────────────────────────────────────
  await fixPeriodConstraint(db);
  await fixAvailabilityConstraint(db);

  // ── Reset time slots to match this college's real schedule ───────────────
  // Image shows: 9–10, 10–11, 11–12, 12–1, [Lunch 1–2], 2–3, 3–4, 4–5, 5–6, 6–7
  // (all times PM where relevant)
  console.log('\n🗓️  Setting up college time slots (9:00–19:00)...');

  // Clear existing entries that reference old slots, then clear slots
  await db.exec('DELETE FROM timetable_entries');
  await db.exec('DELETE FROM time_slots');

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ALL_PERIODS = [
    { period: 1, start: '09:00', end: '10:00' },
    { period: 2, start: '10:00', end: '11:00' },
    { period: 3, start: '11:00', end: '12:00' },
    { period: 4, start: '12:00', end: '13:00' }, // tutorial / extra lecture slot
    // Lunch: 13:00–14:00 (no period)
    { period: 5, start: '14:00', end: '15:00' },
    { period: 6, start: '15:00', end: '16:00' },
    { period: 7, start: '16:00', end: '17:00' },
    { period: 8, start: '17:00', end: '18:00' },
    { period: 9, start: '18:00', end: '19:00' },
  ];
  const SAT_PERIODS = ALL_PERIODS.slice(0, 6); // Sat: P1–P6 only

  for (const day of DAYS) {
    for (const p of (day === 'Sat' ? SAT_PERIODS : ALL_PERIODS)) {
      await db.run(
        `INSERT OR IGNORE INTO time_slots (day, period, start_time, end_time) VALUES (?, ?, ?, ?)`,
        [day, p.period, p.start, p.end]
      );
    }
  }
  console.log('✅ Time slots created (Mon–Fri 9 periods, Sat 6 periods)');

  // ── Department ───────────────────────────────────────────────────────────
  console.log('\n🏫 Setting up department...');
  const deptId = await getOrCreate(db, 'departments',
    { short_name: 'CSE' },
    { name: 'Computer Science & Engineering' }
  );
  console.log(`   CSE dept id=${deptId}`);

  // ── Teachers ─────────────────────────────────────────────────────────────
  console.log('\n👩‍🏫 Setting up teachers...');
  const T = {};
  for (const [name, desig] of [
    ['Dr. Ashpreet', 'Associate Professor'],
    ['Dr. Sandeep',  'Associate Professor'],
    ['Dr. Dipika',   'Associate Professor'],
    ['Dr. Shilpa',   'Associate Professor'],
  ]) {
    T[name] = await getOrCreate(db, 'teachers',
      { name },
      { designation: desig, department_id: deptId, max_hours_week: 20 }
    );
    console.log(`   ${name} → id=${T[name]}`);
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────
  console.log('\n🚪 Setting up rooms...');
  const R = {};
  for (const [name, type, cap] of [
    ['L21',     'classroom', 60],
    ['L22',     'classroom', 60],
    ['L407',    'classroom', 60],
    ['CL 13',   'lab',       30],
    ['306',     'seminar',   30],
    ['Lab 301', 'lab',       30],
    ['Lab 405', 'lab',       30],
  ]) {
    R[name] = await getOrCreate(db, 'rooms',
      { name },
      { type, capacity: cap, department_id: deptId }
    );
    console.log(`   ${name} (${type}) → id=${R[name]}`);
  }

  // ── Courses + Components ──────────────────────────────────────────────────
  console.log('\n📚 Setting up courses...');

  // CTN501 Theory of Computation — Lecture (3h) + Tutorial (1h)
  const tocId    = await getOrCreate(db, 'courses', { code: 'CTN501' }, { name: 'Theory of Computation', department_id: deptId });
  const tocLec   = await getOrCreate(db, 'course_components', { course_id: tocId, type: 'lecture'  }, { hours_per_week: 3, duration_hours: 1, requires_lab: 0 });
  const tocTut   = await getOrCreate(db, 'course_components', { course_id: tocId, type: 'tutorial' }, { hours_per_week: 1, duration_hours: 1, requires_lab: 0 });
  console.log(`   CTN501 TOC → course=${tocId}  lec=${tocLec}  tut=${tocTut}`);

  // CTN502 Soft Computing — Lecture (3h) + Lab (1h)
  const scId     = await getOrCreate(db, 'courses', { code: 'CTN502' }, { name: 'Soft Computing', department_id: deptId });
  const scLec    = await getOrCreate(db, 'course_components', { course_id: scId, type: 'lecture' }, { hours_per_week: 3, duration_hours: 1, requires_lab: 0 });
  const scLab    = await getOrCreate(db, 'course_components', { course_id: scId, type: 'lab'     }, { hours_per_week: 1, duration_hours: 1, requires_lab: 1 });
  console.log(`   CTN502 SC  → course=${scId}   lec=${scLec}  lab=${scLab}`);

  // CTN503 Software Engineering — Lecture (4h)
  const seId     = await getOrCreate(db, 'courses', { code: 'CTN503' }, { name: 'Software Engineering', department_id: deptId });
  const seLec    = await getOrCreate(db, 'course_components', { course_id: seId, type: 'lecture' }, { hours_per_week: 4, duration_hours: 1, requires_lab: 0 });
  console.log(`   CTN503 SE  → course=${seId}   lec=${seLec}`);

  // CTN504 Database Management Systems — Lecture (3h) + Lab (1h)
  const dbmsId   = await getOrCreate(db, 'courses', { code: 'CTN504' }, { name: 'Database Management Systems', department_id: deptId });
  const dbmsLec  = await getOrCreate(db, 'course_components', { course_id: dbmsId, type: 'lecture' }, { hours_per_week: 3, duration_hours: 1, requires_lab: 0 });
  const dbmsLab  = await getOrCreate(db, 'course_components', { course_id: dbmsId, type: 'lab'     }, { hours_per_week: 1, duration_hours: 1, requires_lab: 1 });
  console.log(`   CTN504 DBMS→ course=${dbmsId} lec=${dbmsLec} lab=${dbmsLab}`);

  // ── Class ─────────────────────────────────────────────────────────────────
  console.log('\n🎓 Setting up class...');
  const classId = await getOrCreate(db, 'classes',
    { name: 'CSE 1' },
    { department_id: deptId, student_count: 60, semester: 5 }
  );
  console.log(`   CSE 1 → id=${classId}`);

  // ── Groups ────────────────────────────────────────────────────────────────
  console.log('\n👥 Setting up groups...');
  const g1Id   = await getOrCreate(db, 'student_groups',
    { class_id: classId, name: 'G1' },
    { student_count: 30, parent_id: null, group_type: 'lecture' }
  );
  const cse1Id = await getOrCreate(db, 'student_groups',
    { class_id: classId, name: 'CSE1' },
    { student_count: 10, parent_id: g1Id, group_type: 'lab' }
  );
  console.log(`   G1 → id=${g1Id}   CSE1 → id=${cse1Id} (sub-group of G1)`);

  // ── Teacher Assignments ───────────────────────────────────────────────────
  console.log('\n📋 Setting up teacher assignments...');
  const assignmentDefs = [
    { teacher: 'Dr. Sandeep',  comp: tocLec,  group: g1Id   }, // TOC lecture → G1
    { teacher: 'Dr. Sandeep',  comp: tocTut,  group: g1Id   }, // TOC tutorial → G1
    { teacher: 'Dr. Dipika',   comp: scLec,   group: g1Id   }, // SC lecture → G1
    { teacher: 'Dr. Dipika',   comp: scLab,   group: cse1Id }, // SC lab → CSE1
    { teacher: 'Dr. Ashpreet', comp: seLec,   group: g1Id   }, // SE lecture → G1
    { teacher: 'Dr. Shilpa',   comp: dbmsLec, group: g1Id   }, // DBMS lecture → G1
    { teacher: 'Dr. Shilpa',   comp: dbmsLab, group: cse1Id }, // DBMS lab → CSE1
  ];

  for (const a of assignmentDefs) {
    await db.run(
      `INSERT OR IGNORE INTO teacher_assignments (teacher_id, course_component_id, class_id, group_id) VALUES (?, ?, ?, ?)`,
      [T[a.teacher], a.comp, classId, a.group]
    );
    console.log(`   ${a.teacher} → ${a.comp === tocLec ? 'TOC lec' : a.comp === tocTut ? 'TOC tut' : a.comp === scLec ? 'SC lec' : a.comp === scLab ? 'SC lab' : a.comp === seLec ? 'SE lec' : a.comp === dbmsLec ? 'DBMS lec' : 'DBMS lab'} for ${a.group === g1Id ? 'G1' : 'CSE1'}`);
  }

  // ── Timetable Entries ─────────────────────────────────────────────────────
  console.log('\n📅 Inserting timetable entries...');

  // Helper: get time_slot id
  async function slot(day, period) {
    const s = await db.get(`SELECT id FROM time_slots WHERE day=? AND period=?`, [day, period]);
    if (!s) throw new Error(`Slot not found: ${day} P${period}`);
    return s.id;
  }

  // Image timetable entries:
  // Format: [day, period, component_id, teacher_name, room_name, group_id]
  const entries = [
    // ── Monday ────────────────────────────────────────────────────────
    ['Mon', 1, seLec,   'Dr. Ashpreet', 'L21',  g1Id  ], // CTN503 SE  9-10
    ['Mon', 2, tocLec,  'Dr. Sandeep',  'L21',  g1Id  ], // CTN501 TOC 10-11
    ['Mon', 4, tocTut,  'Dr. Sandeep',  '306',  g1Id  ], // CTN501 TOC Tutorial 12-1
    ['Mon', 6, scLec,   'Dr. Dipika',   'L21',  g1Id  ], // CTN502 SC  3-4

    // ── Tuesday ───────────────────────────────────────────────────────
    ['Tue', 3, dbmsLec, 'Dr. Shilpa',   'L22',  g1Id  ], // CTN504 DBMS 11-12
    ['Tue', 6, scLec,   'Dr. Dipika',   'L21',  g1Id  ], // CTN502 SC  3-4

    // ── Wednesday ─────────────────────────────────────────────────────
    ['Wed', 5, tocLec,  'Dr. Sandeep',  'L21',  g1Id  ], // CTN501 TOC 2-3

    // ── Thursday ──────────────────────────────────────────────────────
    ['Thu', 3, seLec,   'Dr. Ashpreet', 'L407',    g1Id  ], // CTN503 SE  11-12
    ['Thu', 4, dbmsLec, 'Dr. Shilpa',   'L407',    g1Id  ], // CTN504 DBMS 12-1
    ['Thu', 5, dbmsLab, 'Dr. Shilpa',   'Lab 301', cse1Id], // CSN5004 DBMS Lab 2-3 (CSE1)
    ['Thu', 7, tocLec,  'Dr. Sandeep',  'L21',     g1Id  ], // CTN501 TOC 4-5
    ['Thu', 9, scLab,   'Dr. Dipika',   'Lab 405', cse1Id], // CTN502 SC Lab 6-7 (CSE1)

    // ── Friday ────────────────────────────────────────────────────────
    ['Fri', 1, scLec,   'Dr. Dipika',   'L21',  g1Id  ], // CTN502 SC  9-10
    ['Fri', 2, seLec,   'Dr. Ashpreet', 'CL 13', g1Id ], // CTN503 SE  10-11
    ['Fri', 3, dbmsLec, 'Dr. Shilpa',   'L407', g1Id  ], // CTN504 DBMS 11-12
    ['Fri', 5, seLec,   'Dr. Ashpreet', 'L21',  g1Id  ], // CTN503 SE  2-3
  ];

  let ok = 0, fail = 0;
  for (const [day, period, comp, teacher, room, group] of entries) {
    try {
      const slotId = await slot(day, period);
      await db.run(
        `INSERT OR IGNORE INTO timetable_entries
          (class_id, group_id, course_component_id, teacher_id, room_id, time_slot_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [classId, group, comp, T[teacher], R[room], slotId]
      );
      ok++;
      const periodStr = ALL_PERIODS.find(p => p.period === period);
      console.log(`   ✅ ${day} P${period} (${periodStr?.start}) → ${teacher.split(' ')[1]}, ${room}, ${group === g1Id ? 'G1' : 'CSE1'}`);
    } catch (err) {
      fail++;
      console.warn(`   ⚠️  ${day} P${period} failed: ${err.message}`);
    }
  }

  await db.exec('PRAGMA foreign_keys = ON');
  await db.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Import complete: ${ok} entries added, ${fail} failed`);
  console.log(`🔄 Restart the server (node src/index.js) to see changes`);
  console.log(`${'─'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
});
