const { getDb } = require('./database');

async function seedDatabase() {
  const db = await getDb();

  // Check if already seeded
  const existing = await db.get('SELECT COUNT(*) as count FROM departments');
  if (existing.count > 0) {
    console.log('ℹ️  Database already seeded, skipping.');
    return;
  }

  console.log('🌱 Seeding database with demo CSE data...');

  // ─── Department ──────────────────────────────────────────
  await db.run(`INSERT INTO departments (name, short_name) VALUES (?, ?)`, ['Computer Science & Engineering', 'CSE']);
  const { id: deptId } = await db.get('SELECT id FROM departments WHERE short_name = ?', ['CSE']);

  // ─── Time Slots (Mon–Sat, continuous 07:00–21:00) ─────────
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const periods = Array.from({ length: 14 }, (_, index) => {
    const hour = index + 7;
    return {
      period: index + 1,
      start: `${String(hour).padStart(2, '0')}:00`,
      end: `${String(hour + 1).padStart(2, '0')}:00`,
    };
  });
  for (const day of days) {
    for (const p of periods) {
      await db.run(`INSERT INTO time_slots (day, period, start_time, end_time) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, [day, p.period, p.start, p.end]);
    }
  }

  // ─── Rooms ───────────────────────────────────────────────
  const rooms = [
    ['Room A-101', 60, 'classroom', deptId, 'Block A, Floor 1'],
    ['Room A-102', 60, 'classroom', deptId, 'Block A, Floor 1'],
    ['Room B-201', 60, 'classroom', deptId, 'Block B, Floor 2'],
    ['Room B-202', 60, 'classroom', deptId, 'Block B, Floor 2'],
    ['Lab CS-1',   40, 'lab',       deptId, 'Block C, Floor 1'],
    ['Lab CS-2',   40, 'lab',       deptId, 'Block C, Floor 1'],
    ['Seminar Hall', 120, 'seminar', deptId, 'Block D, Floor 0'],
  ];
  for (const r of rooms) {
    await db.run(`INSERT INTO rooms (name, capacity, type, department_id, location) VALUES (?, ?, ?, ?, ?)`, r);
  }

  // ─── Teachers ────────────────────────────────────────────
  const teachers = [
    ['Dr. Anita Sharma',   'Professor',           deptId, 16],
    ['Dr. Rajesh Gupta',   'Professor',           deptId, 16],
    ['Prof. Meera Nair',   'Associate Professor', deptId, 18],
    ['Prof. Suresh Patel', 'Associate Professor', deptId, 18],
    ['Mr. Vikram Singh',   'Assistant Professor', deptId, 20],
    ['Ms. Priya Reddy',    'Assistant Professor', deptId, 20],
    ['Mr. Arun Kumar',     'Assistant Professor', deptId, 20],
    ['Ms. Divya Menon',    'Assistant Professor', deptId, 20],
  ];
  for (const t of teachers) {
    await db.run(`INSERT INTO teachers (name, designation, department_id, max_hours_week) VALUES (?, ?, ?, ?)`, t);
  }

  // Default availability for all teachers
  const allTeachers = await db.all('SELECT id FROM teachers');
  for (const t of allTeachers) {
    for (const day of days) {
      for (const p of periods) {
        await db.run(
          `INSERT INTO teacher_availability (teacher_id, day, period, status) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [t.id, day, p.period, 'available']
        );
      }
    }
  }

  // ─── Classes ─────────────────────────────────────────────
  const classes = [
    ['CSE 3A', deptId, 60, 3],
    ['CSE 3B', deptId, 60, 3],
    ['CSE 5A', deptId, 58, 5],
    ['CSE 5B', deptId, 55, 5],
  ];
  for (const c of classes) {
    await db.run(`INSERT INTO classes (name, department_id, student_count, semester) VALUES (?, ?, ?, ?)`, c);
  }

  // Student groups for each class
  const allClasses = await db.all('SELECT id FROM classes');
  for (const cls of allClasses) {
    await db.run(`INSERT INTO student_groups (class_id, name, student_count) VALUES (?, ?, ?)`, [cls.id, 'Group A', 20]);
    await db.run(`INSERT INTO student_groups (class_id, name, student_count) VALUES (?, ?, ?)`, [cls.id, 'Group B', 20]);
    await db.run(`INSERT INTO student_groups (class_id, name, student_count) VALUES (?, ?, ?)`, [cls.id, 'Group C', 20]);
  }

  // ─── Courses ─────────────────────────────────────────────
  const coursesData = [
    ['Database Management Systems', 'CSN301', deptId],
    ['Operating Systems',           'CSN302', deptId],
    ['Computer Networks',           'CSN303', deptId],
    ['Artificial Intelligence',     'CSN304', deptId],
    ['Theory of Computation',       'CSN305', deptId],
    ['Software Engineering',        'CSN501', deptId],
    ['Machine Learning',            'CSN502', deptId],
    ['Compiler Design',             'CSN503', deptId],
  ];
  for (const c of coursesData) {
    await db.run(`INSERT INTO courses (name, code, department_id) VALUES (?, ?, ?)`, c);
  }

  // Course components
  const allCourses = await db.all('SELECT id, code FROM courses');
  for (const course of allCourses) {
    await db.run(`INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)`,
      [course.id, 'lecture', 3, 1, 0]);

    if (['CSN301','CSN302','CSN303'].includes(course.code)) {
      await db.run(`INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)`,
        [course.id, 'lab', 2, 2, 1]);
    }
    if (['CSN501','CSN502'].includes(course.code)) {
      await db.run(`INSERT INTO course_components (course_id, type, hours_per_week, duration_hours, requires_lab) VALUES (?, ?, ?, ?, ?)`,
        [course.id, 'tutorial', 1, 1, 0]);
    }
  }

  // ─── Holidays ────────────────────────────────────────────
  const holidays = [
    ['2025-08-15', 'Independence Day'],
    ['2025-10-02', 'Gandhi Jayanti'],
    ['2025-10-24', 'Dussehra'],
    ['2025-11-12', 'Diwali'],
    ['2025-11-13', 'Diwali Holiday'],
  ];
  for (const h of holidays) {
    await db.run(`INSERT INTO holidays (date, name) VALUES (?, ?)`, h);
  }

  // Seed super admin user
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'aryangoyal.bt24cse@pec.edu.in';
  await db.run(
    `INSERT INTO users (email, name, role) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING`,
    [adminEmail, 'Super Admin', 'admin']
  );
  
  // Also seed academic terms
  await db.run(`INSERT INTO academic_terms (code, name, is_active) VALUES ('2026-27-1', 'Academic Semester 2026-27 (Odd / Term 1)', 1) ON CONFLICT DO NOTHING`);
  await db.run(`INSERT INTO academic_terms (code, name, is_active) VALUES ('2026-27-2', 'Academic Semester 2026-27 (Even / Term 2)', 0) ON CONFLICT DO NOTHING`);

  // Migrate existing courses.class_id associations into course_offerings for 2026-27-1
  const coursesWithClass = await db.all(`
    SELECT co.id as course_id, co.class_id, cl.semester
    FROM courses co
    JOIN classes cl ON co.class_id = cl.id
    WHERE co.class_id IS NOT NULL
  `);
  for (const row of coursesWithClass) {
    await db.run(
      `INSERT INTO course_offerings (academic_term, class_id, course_id, semester_number) VALUES ('2026-27-1', ?, ?, ?) ON CONFLICT DO NOTHING`,
      [row.class_id, row.course_id, row.semester || null]
    );
  }

  console.log('✅ Demo data seeded successfully!');
}

module.exports = { seedDatabase };
