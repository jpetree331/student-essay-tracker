/**
 * One-off: create essay_organizer DB + apply schema using DATABASE_URL from .env
 * Run: node scripts/ensure-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const urlStr = process.env.DATABASE_URL;
if (!urlStr) {
  console.error('DATABASE_URL missing in .env');
  process.exit(1);
}

let user, password, host, port, database;
try {
  const u = new URL(urlStr.replace(/^postgresql/i, 'http'));
  user = decodeURIComponent(u.username);
  password = decodeURIComponent(u.password);
  host = u.hostname;
  port = u.port || '5432';
  database = u.pathname.replace(/^\//, '');
} catch (e) {
  console.error('Could not parse DATABASE_URL:', e.message);
  process.exit(1);
}

const psql =
  process.env.PSQL_PATH || 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
if (!fs.existsSync(psql)) {
  console.error('psql not found at:', psql);
  console.error('Set PSQL_PATH in the environment to your psql.exe full path.');
  process.exit(1);
}

function run(args, opts = {}) {
  const env = { ...process.env, PGPASSWORD: password };
  const r = spawnSync(psql, args, {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
  return r;
}

const base = ['-U', user, '-h', host, '-p', port];

// 1) Connect to maintenance db
const maint = run([...base, '-d', 'postgres', '-c', 'SELECT 1']);
if (maint.status !== 0) {
  console.error('Cannot connect to PostgreSQL (database postgres):');
  console.error(maint.stderr || maint.stdout);
  process.exit(1);
}
console.log('Connected to PostgreSQL OK.');

// 2) Create database if missing
const exists = run([
  ...base,
  '-d',
  'postgres',
  '-tAc',
  `SELECT 1 FROM pg_database WHERE datname='${database.replace(/'/g, "''")}'`,
]);
if (exists.status !== 0) {
  console.error(exists.stderr);
  process.exit(1);
}
if (!exists.stdout.trim()) {
  console.log('Creating database:', database);
  const cr = run([
    ...base,
    '-d',
    'postgres',
    '-c',
    `CREATE DATABASE "${database.replace(/"/g, '""')}"`,
  ]);
  if (cr.status !== 0) {
    console.error(cr.stderr || cr.stdout);
    process.exit(1);
  }
  console.log('Database created.');
} else {
  console.log('Database already exists:', database);
}

// 3) schema.sql
const schemaPath = path.join(__dirname, '..', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('Missing schema.sql at', schemaPath);
  process.exit(1);
}
console.log('Applying schema.sql ...');
const schema = run([...base, '-d', database, '-f', schemaPath]);
if (schema.status !== 0) {
  console.error(schema.stderr || schema.stdout);
  process.exit(1);
}
console.log('schema.sql applied.');

const migrations = [
  'migration_007_comparison_reports.sql',
  'migration_008_iep_goals.sql',
  'migration_009_assignment_source_documents.sql',
  'migration_010_writing_goal.sql',
];
for (const name of migrations) {
  const mig = path.join(__dirname, '..', 'db', name);
  if (!fs.existsSync(mig)) continue;
  console.log('Applying', name, '...');
  const m = run([...base, '-d', database, '-f', mig]);
  if (m.status !== 0) {
    console.error(m.stderr || m.stdout);
    process.exit(1);
  }
  console.log(name, 'applied.');
}

console.log('Done. You can start the API.');
