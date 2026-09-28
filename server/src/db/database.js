require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let pool = null;

async function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000, // Wait 15s for Neon DB to wake from sleep
      query_timeout: 10000
    });

    pool.sqliteWrapper = {
      _convertSql: (sql) => {
        let count = 1;
        return sql.replace(/\?/g, () => `$${count++}`);
      },
      all: async (sql, params = []) => {
        const p = Array.isArray(params) ? params : [params];
        const res = await pool.query(pool.sqliteWrapper._convertSql(sql), p);
        return res.rows;
      },
      get: async (sql, params = []) => {
        const p = Array.isArray(params) ? params : [params];
        const res = await pool.query(pool.sqliteWrapper._convertSql(sql), p);
        return res.rows[0];
      },
      run: async (sql, params = []) => {
        const p = Array.isArray(params) ? params : [params];
        const converted = pool.sqliteWrapper._convertSql(sql);
        let finalSql = converted;
        if (finalSql.trim().toUpperCase().startsWith('INSERT') && !finalSql.toUpperCase().includes('RETURNING')) {
           finalSql += ' RETURNING id';
        }
        
        try {
          const res = await pool.query(finalSql, p);
          return { lastID: res.rows[0]?.id || null, changes: res.rowCount };
        } catch (err) {
          if (err.code === '23505') {
            err.code = 'SQLITE_CONSTRAINT';
          }
          throw err;
        }
      },
      exec: async (sql) => {
        return pool.query(sql);
      }
    };
  }
  return pool.sqliteWrapper;
}

async function initDb() {
  const db = await getDb();
  console.log('Connecting to PostgreSQL...');
  
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schema);
  console.log('✅ Database schema initialized in PostgreSQL');
  return db;
}

module.exports = { getDb, initDb, pool };
