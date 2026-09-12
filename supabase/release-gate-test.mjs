#!/usr/bin/env node
// Automated version of the manual browser-console release gate described in
// docs/spec-supabase-login.md#release-gate-test. Confirms an unauthenticated
// (anon-key-only) caller is denied read, write, and RPC access to
// public.user_tables before every deploy. Uses only the public anon key
// already committed in index.html — no credentials needed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
const html = readFileSync(indexPath, "utf8");

function extractConst(name) {
  const match = html.match(new RegExp(`const ${name}\\s*=\\s*"([^"]+)"`));
  if (!match) throw new Error(`Could not find ${name} in index.html`);
  return match[1];
}

const SUPABASE_URL = extractConst("SUPABASE_URL");
const SUPABASE_ANON_KEY = extractConst("SUPABASE_ANON_KEY");

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function expectDenied(label, request) {
  const res = await request();
  const body = await res.text();
  if (res.ok) {
    console.error(`FAIL: ${label} — expected denial, got ${res.status}\n${body}`);
    return false;
  }
  console.log(`OK:   ${label} — denied (${res.status})`);
  return true;
}

const checks = [
  () => expectDenied("anon SELECT on user_tables", () =>
    fetch(`${SUPABASE_URL}/rest/v1/user_tables?select=*`, { headers })),

  () => expectDenied("anon INSERT into user_tables", () =>
    fetch(`${SUPABASE_URL}/rest/v1/user_tables`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000000",
        table_id: "pawapuro",
        data: {},
      }),
    })),

  () => expectDenied("anon RPC delete_account", () =>
    fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_account`, {
      method: "POST",
      headers,
      body: "{}",
    })),
];

const results = [];
for (const check of checks) results.push(await check());

if (results.every(Boolean)) {
  console.log("\nRelease gate PASSED — anon access is denied on all three checks.");
  process.exit(0);
} else {
  console.error("\nRelease gate FAILED — do NOT deploy. See failures above.");
  process.exit(1);
}
