/**
 * Apply all db/migration_*.sql files in order using DATABASE_URL (no psql required).
 * Safe to run multiple times (migrations use IF NOT EXISTS).
 *
 *   npm run db:migrate
 *
 * Windows without psql on PATH: use this instead of `psql ... -f ...`.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in .env');
  process.exit(1);
}

function listMigrations() {
  const dir = path.join(__dirname, '..', 'db');
  const names = fs
    .readdirSync(dir)
    .filter((f) => /^migration_\d+_.*\.sql$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/^migration_(\d+)_/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/^migration_(\d+)_/)?.[1] || '0', 10);
      return na - nb;
    });
  return names.map((name) => ({ name, full: path.join(dir, name) }));
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const files = listMigrations();
    if (!files.length) {
      console.log('No migration_*.sql files in db/.');
      return;
    }
    for (const { name, full } of files) {
      const sql = fs.readFileSync(full, 'utf8').trim();
      if (!sql) continue;
      process.stdout.write(`Applying ${name} ... `);
      await client.query(sql);
      console.log('ok');
    }
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
