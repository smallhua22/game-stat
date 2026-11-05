import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expectDenied, runGate } from "../supabase/release-gate-test.mjs";

const response = (status, body = { code: "42501" }) => ({ status, json: async () => body });
const quiet = { log() {}, error() {} };

test("only 401/403 with PostgreSQL insufficient_privilege proves denial", async () => {
  for (const status of [401, 403]) assert.equal(await expectDenied("check", async () => response(status), quiet), true);
  for (const status of [200, 201, 204, 301, 400, 404, 429, 500, 503]) {
    assert.equal(await expectDenied("check", async () => response(status), quiet), false, `HTTP ${status}`);
  }
});

test("auth/configuration errors and malformed responses are inconclusive", async () => {
  for (const body of [null, [], {}, { code: "PGRST301" }, { code: "42P01" }, { code: 42501 }, "Access denied"]) {
    assert.equal(await expectDenied("check", async () => response(401, body), quiet), false);
  }
  assert.equal(await expectDenied("check", async () => ({ status: 403, json: async () => { throw Error("HTML proxy error"); } }), quiet), false);
  assert.equal(await expectDenied("check", async () => { throw Error("network or timeout"); }, quiet), false);
});

test("all three scoped requests must prove denial; failures do not skip later checks", async () => {
  for (const failedIndex of [-1, 0, 1, 2]) {
    const calls = [];
    const passed = await runGate("https://example.invalid", "public-test-key", {
      log: quiet,
      fetchImpl: async (url, options) => {
        const index = calls.push({ url, options }) - 1;
        return response(index === failedIndex ? 503 : 401);
      },
    });
    assert.equal(passed, failedIndex === -1);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(c => c.url), [
      "https://example.invalid/rest/v1/user_tables?select=*",
      "https://example.invalid/rest/v1/user_tables",
      "https://example.invalid/rest/v1/rpc/delete_account",
    ]);
    assert.deepEqual(calls.map(c => c.options.method || "GET"), ["GET", "POST", "POST"]);
    assert.deepEqual(JSON.parse(calls[1].options.body), { user_id: "00000000-0000-0000-0000-000000000000", table_id: "pawapuro", data: {} });
    assert.equal(calls[2].options.body, "{}");
    for (const { options } of calls) {
      assert.equal(options.headers.Authorization, "Bearer public-test-key");
      assert.equal(options.headers.apikey, "public-test-key");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
    }
  }
});

test("logs do not disclose successful response data or thrown request details", async () => {
  const lines = [];
  const log = { log: x => lines.push(x), error: x => lines.push(x) };
  await expectDenied("SELECT", async () => response(200, [{ name: "private-player" }]), log);
  await expectDenied("INSERT", async () => { throw Error("secret-in-error"); }, log);
  assert.doesNotMatch(lines.join("\n"), /private-player|secret-in-error/);
  assert.match(lines.join("\n"), /FAIL/);
});

test("CLI extracts committed configuration and exits nonzero for inconclusive checks, offline", () => {
  for (const status of [401, 403, 200, 503]) {
    const stub = `globalThis.fetch = async () => new Response(JSON.stringify({code:'42501'}), {status:${status}});`;
    const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(stub)}`,
      fileURLToPath(new URL("../supabase/release-gate-test.mjs", import.meta.url))], { encoding: "utf8" });
    assert.equal(result.status, status === 401 || status === 403 ? 0 : 1, result.stderr);
    assert.match(result.stdout + result.stderr, /Release gate (PASSED|FAILED)/);
  }
});
