-- ============================================================
-- Academic Timetable System — PostgreSQL Schema
-- ============================================================

-- ─── Users & Roles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  picture    TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Academic Terms / Semesters ──────────────────────────────
CREATE TABLE IF NOT EXISTS academic_terms (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0,
  start_date  TEXT,
  end_date    TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Departments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  short_name  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Rooms ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  capacity      INTEGER NOT NULL DEFAULT 30,
  type          TEXT NOT NULL CHECK(type IN ('classroom','lab','seminar','conference','auditorium')),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location      TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Teachers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  designation     TEXT,
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  max_hours_week  INTEGER NOT NULL DEFAULT 18,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Teacher Availability ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_availability (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day         TEXT NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri','Sat')),
  period      INTEGER NOT NULL CHECK(period BETWEEN 1 AND 14),
  status      TEXT NOT NULL CHECK(status IN ('available','preferred','blocked')),
  UNIQUE(teacher_id, day, period)
);

-- ─── Classes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  student_count   INTEGER NOT NULL DEFAULT 60,
  semester        INTEGER,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Class Semesters per Academic Term ────────────────────────
CREATE TABLE IF NOT EXISTS class_semesters (
  id             SERIAL PRIMARY KEY,
  academic_term  TEXT NOT NULL REFERENCES academic_terms(code) ON DELETE CASCADE,
  class_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  semester       INTEGER NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academic_term, class_id)
);

-- ─── Student Groups ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_groups (
  id          SERIAL PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES student_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  group_type  TEXT NOT NULL DEFAULT 'lab',
  student_count INTEGER DEFAULT 0,
  UNIQUE(class_id, name)
);

-- ─── Scholars (TAs / PhD / Research Scholars) ────────────────
CREATE TABLE IF NOT EXISTS scholars (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  designation     TEXT,
  roll_no         TEXT UNIQUE,
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  email           TEXT,
  max_hours_week  INTEGER NOT NULL DEFAULT 12,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Master Course Catalog ────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  code            TEXT UNIQUE,
  short_name      TEXT,
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  class_id        INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  semester        INTEGER,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Course Components ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_components (
  id              SERIAL PRIMARY KEY,
  course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK(type IN ('lecture','lab','tutorial')),
  hours_per_week  INTEGER NOT NULL DEFAULT 1,
  duration_hours  INTEGER NOT NULL DEFAULT 1,
  requires_lab    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(course_id, type)
);

-- ─── Course Offerings / Batch Enrollments per Term ───────────
CREATE TABLE IF NOT EXISTS course_offerings (
  id              SERIAL PRIMARY KEY,
  academic_term   TEXT NOT NULL DEFAULT '2026-27-1' REFERENCES academic_terms(code) ON DELETE CASCADE,
  class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester_number INTEGER,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academic_term, class_id, course_id)
);

-- ─── Teacher Assignments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id                    SERIAL PRIMARY KEY,
  academic_term         TEXT NOT NULL DEFAULT '2026-27-1',
  teacher_id            INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  scholar_id            INTEGER REFERENCES scholars(id) ON DELETE SET NULL,
  course_component_id   INTEGER NOT NULL REFERENCES course_components(id) ON DELETE CASCADE,
  class_id              INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  group_id              INTEGER REFERENCES student_groups(id) ON DELETE CASCADE,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academic_term, course_component_id, class_id, group_id)
);

-- ─── Time Slots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_slots (
  id          SERIAL PRIMARY KEY,
  day         TEXT NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri','Sat')),
  period      INTEGER NOT NULL CHECK(period BETWEEN 1 AND 14),
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  UNIQUE(day, period)
);

-- ─── Timetable Entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_entries (
  id                    SERIAL PRIMARY KEY,
  academic_term         TEXT NOT NULL DEFAULT '2026-27-1',
  class_id              INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  group_id              INTEGER REFERENCES student_groups(id) ON DELETE SET NULL,
  course_component_id   INTEGER NOT NULL REFERENCES course_components(id) ON DELETE CASCADE,
  teacher_id            INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  scholar_id            INTEGER REFERENCES scholars(id) ON DELETE SET NULL,
  room_id               INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  time_slot_id          INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  duration_hours        INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Room Bookings (Non-academic) ────────────────────────────
CREATE TABLE IF NOT EXISTS room_bookings (
  id          SERIAL PRIMARY KEY,
  room_id     INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  date        TEXT,
  booked_by   TEXT NOT NULL,
  purpose     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Holidays ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id          SERIAL PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Students ------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(class_id, roll_no)
);

-- --- Group Members -------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

