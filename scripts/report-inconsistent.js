import fs from 'fs';
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
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const sql = `with recompute as (
      select a.id,
        coalesce((select sum(case when (v->>'cardsSeen') ~ '^[0-9]+(\\.[0-9]+)?$' then floor(((v->>'cardsSeen')::numeric)) else 0 end) from jsonb_each(a.breakdown) as e(k,v)),0)::int as total_seen,
        coalesce((select sum(least(
            case when (v->>'cardsCorrect') ~ '^[0-9]+(\\.[0-9]+)?$' then floor(((v->>'cardsCorrect')::numeric)) else 0 end,
            case when (v->>'cardsSeen') ~ '^[0-9]+(\\.[0-9]+)?$' then floor(((v->>'cardsSeen')::numeric)) else 0 end
          )) from jsonb_each(a.breakdown) as e(k,v)),0)::int as total_correct
      from public.user_deck_mission_attempts a
      where a.breakdown is not null
        and coalesce(a.ended_at, now()) >= now() - interval '60 days'
    )
    select count(*) as inconsistent_count
    from public.user_deck_mission_attempts a
    left join recompute r on r.id = a.id
    where coalesce(a.ended_at, now()) >= now() - interval '60 days'
      and (
        (a.breakdown is not null and (a.cards_seen is distinct from r.total_seen or a.cards_correct is distinct from r.total_correct))
        or a.cards_correct > a.cards_seen
        or a.cards_correct < 0
        or a.cards_seen < 0
      )`;
    const res = await client.query(sql);
    console.log(JSON.stringify(res.rows[0] || {}, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
