import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const snapshot = "snapshot:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const historyId = (mode) => mode === "pawapuro"
  ? "snapshot:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  : "snapshot:cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const setup = await readFile(new URL("../setup.sql", import.meta.url), "utf8");

// Real PostgreSQL execution; only Supabase's identity plumbing is a local fixture.
async function database(run) {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      INSERT INTO auth.users VALUES ('${alice}'), ('${bob}');
    `);
    await db.exec(setup); // Do not copy policies: test the repository's actual schema.
    for (const user of [alice, bob]) {
      for (const mode of ["pawapuro", "prospi"]) {
        for (const id of [mode, historyId(mode)]) {
          await db.query("INSERT INTO public.user_tables(user_id,table_id,type,data) VALUES ($1,$2,$3,$4)",
            [user, id, mode, { marker: `${user}/${id}` }]);
        }
      }
    }
    await run(db);
  } finally { await db.close(); }
}

async function as(db, role, user, run) {
  assert.ok(["anon", "authenticated"].includes(role));
  await db.exec("BEGIN");
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
    const { rows: [context] } = await db.query(`
      SELECT current_user AS name, rolsuper, rolbypassrls,
        row_security_active('public.user_tables') AS rls
      FROM pg_roles WHERE rolname = current_user
    `);
    assert.deepEqual(context, { name: role, rolsuper: false, rolbypassrls: false, rls: true });
    return await run();
  } finally { await db.exec("ROLLBACK"); }
}
const denied = (operation) => assert.rejects(operation, (error) => error.code === "42501");
const insert = (db, user, id, mode) => db.query(
  "INSERT INTO public.user_tables(user_id,table_id,type,data) VALUES ($1,$2,$3,$4) RETURNING table_id",
  [user, id, mode, { snapshotVersion: 1, name: "Week 1", stats: { marker: "saved" } }]);

test("owners can save, read and delete named history in both modes without changing current stats", () => database(async (db) => {
  for (const mode of ["pawapuro", "prospi"]) {
    await as(db, "authenticated", alice, async () => {
      assert.equal((await insert(db, alice, snapshot, mode)).rows.length, 1);
      const { rows } = await db.query("SELECT data FROM public.user_tables WHERE table_id=$1", [snapshot]);
      assert.equal(rows[0].data.name, "Week 1");
      await db.query("UPDATE public.user_tables SET data=$1 WHERE table_id=$2", [{ marker: "edited" }, mode]);
      assert.equal((await db.query("SELECT data FROM public.user_tables WHERE table_id=$1", [snapshot])).rows[0].data.name, "Week 1");
      assert.equal((await db.query("DELETE FROM public.user_tables WHERE table_id=$1 RETURNING table_id", [snapshot])).rows.length, 1);
      assert.equal((await db.query("SELECT data FROM public.user_tables WHERE table_id=$1", [mode])).rows[0].data.marker, "edited");
    });
  }
}));

test("unfiltered reads and guessed IDs cannot expose or mutate another account's current or history rows", () => database(async (db) => {
  await as(db, "authenticated", alice, async () => {
    const { rows } = await db.query("SELECT user_id FROM public.user_tables");
    assert.equal(rows.length, 4);
    assert.ok(rows.every((row) => row.user_id === alice));
    assert.equal((await db.query("SELECT * FROM public.user_tables WHERE user_id=$1", [bob])).rows.length, 0);
    assert.equal((await db.query("UPDATE public.user_tables SET data='{}' WHERE user_id=$1 RETURNING table_id", [bob])).rows.length, 0);
    assert.equal((await db.query("DELETE FROM public.user_tables WHERE user_id=$1 RETURNING table_id", [bob])).rows.length, 0);
    assert.equal((await db.query("SELECT table_id FROM public.user_tables WHERE user_id=$1 AND table_id=$2", [bob, historyId("pawapuro")])).rows.length, 0);
  });
  assert.equal((await db.query("SELECT * FROM public.user_tables WHERE user_id=$1", [bob])).rows.length, 4);
}));

test("spoofed ownership on insert or update is rejected, not silently reassigned", () => database(async (db) => {
  await as(db, "authenticated", alice, () => denied(() => insert(db, bob, snapshot, "pawapuro")));
  await as(db, "authenticated", alice, () => denied(() => db.query(
    "UPDATE public.user_tables SET user_id=$1,table_id='stolen' WHERE table_id='pawapuro'", [bob])));
}));

test("anonymous access is denied by table and RPC privileges, even with a forged claim", () => database(async (db) => {
  for (const sql of [
    "SELECT * FROM public.user_tables",
    `INSERT INTO public.user_tables(user_id,table_id,type,data) VALUES ('${alice}','x','pawapuro','{}')`,
    "UPDATE public.user_tables SET data='{}'",
    "DELETE FROM public.user_tables",
    "SELECT public.delete_account()"
  ]) await as(db, "anon", alice, () => denied(() => db.exec(sql)));
}));

test("authenticated role without a user claim sees no rows and cannot insert", () => database(async (db) => {
  await as(db, "authenticated", null, async () => {
    assert.equal((await db.query("SELECT * FROM public.user_tables")).rows.length, 0);
    assert.equal((await db.query("DELETE FROM public.user_tables RETURNING table_id")).rows.length, 0);
    await db.query("SELECT public.delete_account()");
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM public.user_tables")).rows.length, 8);
  });
  await as(db, "authenticated", null, () => denied(() => insert(db, alice, snapshot, "pawapuro")));
}));

test("account-data deletion removes only the caller's current and historical rows", () => database(async (db) => {
  await as(db, "authenticated", alice, async () => {
    await db.query("SELECT public.delete_account()");
    assert.equal((await db.query("SELECT * FROM public.user_tables")).rows.length, 0);
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM public.user_tables WHERE user_id=$1", [bob])).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM auth.users")).rows.length, 2);
  });
}));

test("snapshot collision and invalid mode fail; legacy current writes still default type", () => database(async (db) => {
  await as(db, "authenticated", alice, () => assert.rejects(
    () => insert(db, alice, historyId("pawapuro"), "pawapuro"), (error) => error.code === "23505"));
  await as(db, "authenticated", alice, () => assert.rejects(
    () => insert(db, alice, snapshot, "unknown"), (error) => error.code === "23503"));
  await as(db, "authenticated", alice, async () => {
    await db.exec("DELETE FROM public.user_tables WHERE table_id='pawapuro'");
    const { rows } = await db.query("INSERT INTO public.user_tables(user_id,table_id,data) VALUES ($1,'pawapuro','{}') RETURNING type", [alice]);
    assert.equal(rows[0].type, "pawapuro");
  });
}));
