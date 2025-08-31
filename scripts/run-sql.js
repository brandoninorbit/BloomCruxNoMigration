/*
 Run a .sql file against DATABASE_URL using node-postgres. Reads .env.local if present.
 Usage:
   node scripts/run-sql.js path/to/file.sql
*/
import fs from 'fs';
// For Supabase pooler on some Windows/dev envs with self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
import path from 'path';
import { Client } from 'pg';

function loadEnvLocal(root) {
  const envPath = path.join(root, '.env.local');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal(process.cwd());
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: node scripts/run-sql.js <path-to-sql>');
    process.exit(1);
  }
  const sqlPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('DATABASE_URL not set in environment or .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('Migration applied:', path.basename(sqlPath));
  } catch (err) {
    try { await client.query('rollback'); } catch {}
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
