const { getDb } = require('../server/src/db/database');

async function check() {
  const db = await getDb();
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  for (const t of tables) {
    const count = await db.get(`SELECT COUNT(*) as c FROM ${t.name}`);
    console.log(`${t.name}: ${count.c}`);
  }
}

check().catch(console.error);
