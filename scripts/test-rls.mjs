// Sanity check: signup trigger + tenant isolation. Runs inside a transaction and rolls back.
import { readFileSync } from "node:fs";
import pg from "pg";
const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };
const as = async (uid) => {
  await c.query(`reset role`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
  await c.query(`set local role authenticated`);
};
try {
  await c.query("begin");
  const a = "00000000-0000-4000-8000-00000000000a", b = "00000000-0000-4000-8000-00000000000b";
  for (const [id, email] of [[a, "a@test.dev"], [b, "b@test.dev"]])
    await c.query(`insert into auth.users (id, email, aud, role, raw_user_meta_data) values ($1,$2,'authenticated','authenticated',$3)`,
      [id, email, JSON.stringify({ full_name: email.split("@")[0], training_opt_in: true, terms_accepted: true })]);

  const ws = (await c.query(`select w.id, w.data_training_opt_in, m.role from workspaces w join workspace_members m on m.workspace_id=w.id where w.owner_id=$1`, [a])).rows;
  ok(ws.length === 1 && ws[0].role === "owner" && ws[0].data_training_opt_in, "signup creates personal workspace + owner + consent");
  ok((await c.query(`select 1 from profiles where id=$1`, [a])).rowCount === 1, "signup creates profile");
  const wsA = ws[0].id;

  await as(a);
  const brand = (await c.query(`insert into brands (workspace_id, name, created_by) values ($1,'Chai Co',$2) returning id`, [wsA, a])).rows[0].id;
  await c.query(`insert into brand_versions (brand_id, model, source, created_by) values ($1, '{"name":"Chai Co"}', 'user', $2)`, [brand, a]);
  await c.query(`insert into brand_versions (brand_id, model, source, created_by) values ($1, '{"name":"Chai Co 2"}', 'stage', $2)`, [brand, a]);
  const cur = (await c.query(`select b.name, v.version from brands b join brand_versions v on v.id=b.current_version_id where b.id=$1`, [brand])).rows[0];
  ok(cur?.version === 2 && cur.name === "Chai Co 2", "brand_versions numbered and current_version_id updated");
  const post = (await c.query(`insert into posts (brand_id, content, original_content, created_by) values ($1,'{"caption":"x"}','{"caption":"x"}',$2) returning id, workspace_id`, [brand, a])).rows[0];
  ok(post.workspace_id === wsA, "posts inherit workspace_id from brand");
  await c.query(`update posts set content='{"caption":"y"}', original_content='{"caption":"hacked"}' where id=$1`, [post.id]);
  ok((await c.query(`select original_content->>'caption' c from posts where id=$1`, [post.id])).rows[0].c === "x", "original_content is frozen");
  await c.query(`insert into content_events (post_id, user_id, event, props) values ($1,$2,'edited','{"edit_ratio":0.2}')`, [post.id, a]);
  await c.query(`insert into generation_feedback (post_id, user_id, rating, reasons) values ($1,$2,1,'{}')`, [post.id, a]);
  const q = (await c.query(`select was_edited, last_edit_ratio, avg_rating from v_post_quality where post_id=$1`, [post.id])).rows[0];
  ok(q.was_edited && q.last_edit_ratio === 0.2 && q.avg_rating === 1, "v_post_quality joins edits + rating");

  // Onboarding: AI calls logged before the brand exists get linked when it's created.
  await c.query(`reset role`);
  const pendingId = "00000000-0000-4000-8000-0000000000cc";
  await c.query(`insert into llm_calls (feature, workspace_id, pending_brand_id) values ('stage:extract', $1, $2)`, [wsA, pendingId]);
  await as(a);
  await c.query(`insert into brands (id, workspace_id, name, created_by) values ($1,$2,'Later Co',$3)`, [pendingId, wsA, a]);
  const linked = (await c.query(`select brand_id from llm_calls where feature='stage:extract'`)).rows[0];
  ok(linked?.brand_id === pendingId, "pending LLM calls are linked when the brand is saved (and readable by members)");

  await as(b);
  ok((await c.query(`select * from brands`)).rowCount === 0, "user B cannot see A's brands");
  ok((await c.query(`select * from posts`)).rowCount === 0, "user B cannot see A's posts");
  ok((await c.query(`select * from workspaces where id=$1`, [wsA])).rowCount === 0, "user B cannot see A's workspace");
  let blocked = false;
  try { await c.query("savepoint s"); await c.query(`insert into brands (workspace_id, name) values ($1,'evil')`, [wsA]); } catch { blocked = true; await c.query("rollback to savepoint s"); }
  ok(blocked, "user B cannot insert into A's workspace");
  blocked = false;
  try { await c.query("savepoint s2"); await c.query(`insert into llm_calls (feature) values ('x')`); } catch { blocked = true; await c.query("rollback to savepoint s2"); }
  ok(blocked, "clients cannot write llm_calls directly");

  // ── 0003 security hardening ────────────────────────────────────────────────
  await c.query(`reset role`);
  const wsB = (await c.query(`select id from workspaces where owner_id=$1`, [b])).rows[0].id;
  await c.query(`insert into workspace_members (workspace_id, user_id, role) values ($1,$2,'admin')`, [wsA, b]);

  // An admin must not be able to move their membership row into another workspace.
  await as(b);
  blocked = false;
  try { await c.query("savepoint s3"); await c.query(`update workspace_members set workspace_id=$1 where user_id=$2 and workspace_id=$3`, [wsB, b, wsA]); } catch { blocked = true; await c.query("rollback to savepoint s3"); }
  ok(blocked, "admin cannot rewrite workspace_id of a membership");
  // An admin must not be able to demote or edit the owner row.
  const demote = await c.query(`update workspace_members set role='viewer' where user_id=$1 and workspace_id=$2`, [a, wsA]);
  ok(demote.rowCount === 0, "admin cannot demote the owner");
  // An admin must not be able to promote themselves to owner.
  blocked = false;
  try { await c.query("savepoint s4"); await c.query(`update workspace_members set role='owner' where user_id=$1 and workspace_id=$2`, [b, wsA]); } catch { blocked = true; await c.query("rollback to savepoint s4"); }
  ok(blocked, "admin cannot promote themselves to owner");

  // Tenant mixing on UPDATE: a post cannot be re-pointed at another workspace.
  await as(a);
  await c.query(`update posts set workspace_id=$1 where id=$2`, [wsB, post.id]).catch(() => {});
  await c.query(`reset role`);
  ok((await c.query(`select workspace_id from posts where id=$1`, [post.id])).rows[0].workspace_id === wsA, "posts keep their brand's workspace_id on UPDATE");

  // post_metrics inherits the workspace from its publication, not from the client.
  await as(a);
  const pub = (await c.query(`insert into post_publications (post_id, platform) values ($1,'instagram') returning id`, [post.id])).rows[0].id;
  const met = (await c.query(`insert into post_metrics (publication_id, workspace_id, likes) values ($1,$2,5) returning workspace_id`, [pub, wsA])).rows[0];
  ok(met.workspace_id === wsA, "post_metrics inherits workspace_id from its publication");
  blocked = false;
  try { await c.query("savepoint s5"); await c.query(`insert into post_metrics (publication_id, workspace_id, likes) values ($1,$2,5)`, [pub, wsB]); } catch { blocked = true; await c.query("rollback to savepoint s5"); }
  const metB = (await c.query(`select workspace_id from post_metrics where publication_id=$1`, [pub])).rows;
  ok(metB.every((r) => r.workspace_id === wsA), "post_metrics cannot be filed under another workspace");

  // Feedback cannot cite another workspace's llm_call.
  await c.query(`reset role`);
  const foreignCall = (await c.query(`insert into llm_calls (feature, workspace_id) values ('x', $1) returning id`, [wsB])).rows[0].id;
  await as(a);
  blocked = false;
  try { await c.query("savepoint s6"); await c.query(`insert into generation_feedback (workspace_id, llm_call_id, user_id, rating) values ($1,$2,$3,1)`, [wsA, foreignCall, a]); } catch { blocked = true; await c.query("rollback to savepoint s6"); }
  ok(blocked, "feedback cannot reference another workspace's llm_call");
} finally {
  await c.query("rollback");
  await c.end();
}
