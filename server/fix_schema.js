const { Pool } = require('pg');

async function fix() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_syt8hDru5HMJ@ep-old-haze-b36b7ovu-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
  const queries = `
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      roll_no TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(class_id, roll_no)
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, student_id)
    );
  `;
  try {
    await pool.query(queries);
    console.log('Tables created');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
fix();
