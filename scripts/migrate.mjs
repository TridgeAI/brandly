// Applies supabase/migrations/*.sql in filename order, once each.
// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env.local).");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`);
const done = new Set((await client.query(`select name from public._migrations`)).rows.map((r) => r.name));

const checkOnly = process.argv.includes("--check");
for (const f of files) {
  if (done.has(f)) continue;
  if (checkOnly) { console.log(`pending  ${f}`); continue; }
  const sql = readFileSync(join(dir, f), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(`insert into public._migrations(name) values ($1)`, [f]);
    await client.query("commit");
    console.log(`applied  ${f}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`FAILED   ${f}\n${err.message}`);
    await client.end();
    process.exit(1);
  }
}
console.log("Migrations up to date.");
await client.end();
