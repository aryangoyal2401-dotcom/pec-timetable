require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const util = require('util');

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
  'time_slots',
  'timetable_entries',
  'room_bookings',
  'holidays',
];

async function migrate() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    query_timeout: 30000
  });

  const sqliteDb = new sqlite3.Database(path.join(__dirname, 'data/timetable.db'));
  const sqliteAll = util.promisify(sqliteDb.all).bind(sqliteDb);

  console.log('Starting data migration from SQLite to PostgreSQL...');

  try {
    for (const table of TABLES) {
      console.log(`Migrating table: ${table}`);
      let rows;
      try {
        rows = await sqliteAll(`SELECT * FROM ${table}`);
      } catch (e) {
        console.warn(`Skipping table ${table} due to error: ${e.message}`);
        continue;
      }
      
      if (rows.length === 0) continue;

      await pgPool.query(`DELETE FROM ${table}`);

      const columns = Object.keys(rows[0]);
      
      // Batch insert
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const allValues = [];
        const placeholders = [];
        
        let paramIndex = 1;
        for (const row of batch) {
          const rowPlaceholders = [];
          for (const col of columns) {
            allValues.push(row[col]);
            rowPlaceholders.push(`$${paramIndex++}`);
          }
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        }
        
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
        await pgPool.query(sql, allValues);
      }
      
      if (columns.includes('id')) {
         try {
             await pgPool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}) + 1, 1), false)`);
         } catch (seqErr) {
             console.warn(`Could not reset sequence for ${table}:`, seqErr.message);
         }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

migrate();
