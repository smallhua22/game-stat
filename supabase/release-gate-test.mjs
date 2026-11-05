#!/usr/bin/env node
// Only explicit PostgreSQL permission denials establish the anonymous-access gate.
// Importing this module is safe: network requests run only through the CLI or runGate.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function expectDenied(label, request, log = console) {
  try {
    const res = await request();
    let body;
    try { body = await res.json(); } catch { /* Non-JSON errors are inconclusive. */ }
    const denied = (res.status === 401 || res.status === 403) && body?.code === "42501";
    // Never print response bodies: a failed gate may have returned private records.
    if (denied) log.log(`OK: ${label} — PostgreSQL permission denied (${res.status}, 42501)`);
    else log.error(`FAIL: ${label} — expected permission denial, got HTTP ${res.status}`);
    return denied;
  } catch {
    log.error(`FAIL: ${label} — request or response failed; access policy is unverified`);
    return false;
  }
}

export async function runGate(url, key, { fetchImpl = fetch, log = console } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const request = (endpoint, options = {}) => fetchImpl(`${url}/rest/v1/${endpoint}`, {
    ...options, headers, redirect: "error", signal: AbortSignal.timeout(15000),
  });
  const checks = [
    ["anon SELECT on user_tables", () => request("user_tables?select=*")],
    ["anon INSERT into user_tables", () => request("user_tables", {
      method: "POST",
      body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", table_id: "pawapuro", data: {} }),
    })],
    ["anon RPC delete_account", () => request("rpc/delete_account", { method: "POST", body: "{}" })],
  ];
  const results = [];
  for (const [label, request] of checks) results.push(await expectDenied(label, request, log));
  const passed = results.every(Boolean);
  if (passed) log.log("Release gate PASSED — all three requests received explicit permission denials.");
  else log.error("Release gate FAILED — do NOT deploy. Denial was not established for every request.");
  return passed;
}

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  try {
    const html = readFileSync(path.join(path.dirname(filename), "..", "index.html"), "utf8");
    const extract = name => {
      const match = html.match(new RegExp(`const ${name}\\s*=\\s*"([^"]+)"`));
      if (!match) throw new Error(`Missing ${name}`);
      return match[1];
    };
    process.exitCode = await runGate(extract("SUPABASE_URL"), extract("SUPABASE_ANON_KEY")) ? 0 : 1;
  } catch {
    console.error("Release gate FAILED — configuration could not be read; do NOT deploy.");
    process.exitCode = 1;
  }
}
