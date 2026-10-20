// Real Chromium + real app DOM; backend/auth are isolated, with no live network access.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!['/', '/index.html', '/row-identity.js', '/snapshot-comparison.js'].includes(path)) {
    response.writeHead(404).end(); return;
  }
  response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html');
  response.end(await readFile(new URL(path === '/' ? 'index.html' : path.slice(1), root)));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
function mockBackend() {
  const tables = Object.fromEntries(['pawapuro', 'prospi'].map((mode) => [mode,
    { schemaVersion: 2, mode, sheets: { hitters: [{ name: 'A', hr: '3' }],
      pitchers: [{ name: 'P', ip: '10.2', era: '3' }] } }]));
  window.qaWrites = [];
  window.supabase = { createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { user: { id: 'qa', email: 'qa@example.invalid' } } } }),
    onAuthStateChange() {}
  }, from() {
    let mode, payload;
    const query = { select() { return query; }, eq(key, value) { if (key === 'table_id') mode = value; return query; },
      update(value) { payload = value; return query; },
      upsert(value) { mode = value.table_id; payload = value; return query; },
      async maybeSingle() {
        if (payload) { tables[mode] = structuredClone(payload.data); window.qaWrites.push(mode); }
        return { data: { data: structuredClone(tables[mode]), updated_at: 'qa-version' }, error: null };
      } };
    return query;
  } }) };
}
let browser, page;
await mkdir('browser-artifacts', { recursive: true });
try {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    if (url === 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2') {
      return route.fulfill({ contentType: 'text/javascript', body: `(${mockBackend.toString()})()` });
    }
    return route.abort();
  });
  await page.goto(origin);
  await page.locator('main.app').waitFor({ state: 'visible' });
  await page.locator('.snapshot-panel summary').click();
  const output = async () => JSON.parse(await page.locator('#outputText').inputValue());
  const upload = async (selector, data, name = 'earlier.json') => {
    await page.locator(selector).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await page.waitForFunction((selector) => document.querySelector(selector).value === '', selector);
  };
  for (const mode of ['pawapuro', 'prospi']) {
    await page.locator('#modeSelect').selectOption(mode);
    await page.waitForFunction((mode) => JSON.parse(document.querySelector('#outputText').value).mode === mode, mode);
    for (const sheet of ['hitters', 'pitchers']) {
      await page.locator(`#${sheet}Tab`).click();
      const original = (await output()).sheets[sheet][0].rowId;
      assert.match(original, /^[a-f0-9-]{36}$/);
      await page.locator('#rows tr').first().getByRole('button', { name: '複製', exact: true }).click();
      let rows = (await output()).sheets[sheet];
      assert.notEqual(rows[1].rowId, original);
      await page.locator('#rows tr').first().locator('[data-field="name"]').fill('Renamed');
      await page.locator('#rows tr').first().getByRole('button', { name: '下移', exact: true }).click();
      rows = (await output()).sheets[sheet];
      assert.equal(rows[1].rowId, original);
      await page.locator('#addPlayer').click();
      rows = (await output()).sheets[sheet];
      assert.equal(new Set(rows.map((row) => row.rowId)).size, 3);
    }
    await page.locator('#hittersTab').click();
    const exported = await output();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#downloadJson').click();
    const download = await downloadPromise;
    assert.deepEqual(JSON.parse(await readFile(await download.path(), 'utf8')), exported);
    await upload('#jsonFile', exported, 'import.json');
    assert.deepEqual(await output(), exported);
    const earlier = structuredClone(exported);
    earlier.sheets.hitters[1].name = 'Old name'; earlier.sheets.hitters[1].hr = '1';
    await upload('#snapshotFile', earlier);
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('earlier.json'));
    assert.match(await page.locator('#snapshotRows tr').nth(1).innerText(), /Renamed\s+1\s+3\s+\+2\s+可比較/);
    assert.equal(await page.locator('#downloadComparison').isDisabled(), false);
    const report = async () => {
      const event = page.waitForEvent('download');
      await page.locator('#downloadComparison').click();
      const file = await event;
      assert.match(file.suggestedFilename(), new RegExp(`^game-stat-${mode}-`));
      return readFile(await file.path(), 'utf8');
    };
    const csv = await report();
    assert.ok(csv.startsWith('\ufeff"generated_at_utc"'));
    assert.ok(csv.includes('"Renamed","1","3","+2","可比較"'));
    assert.ok(csv.includes(`"${mode}","hitters","hr","earlier.json"`));
    await page.locator('#rows tr').nth(1).locator('[data-field="hr"]').fill('4');
    assert.ok((await report()).includes('"Renamed","1","4","+3","可比較"'));
    await page.locator('#rows tr').nth(1).locator('[data-field="hr"]').fill('3');
    await page.locator('#pitchersTab').click();
    await page.locator('#snapshotMetric').selectOption('ip');
    await page.locator('#rows tr').nth(1).locator('[data-field="ip"]').fill('11.1');
    assert.ok((await report()).includes('"10.2","11.1","+0.2"'));
    await page.locator('#rows tr').nth(1).locator('[data-field="ip"]').fill('10.2');
    await page.locator('#hittersTab').click();
    await page.evaluate(() => {
      window.originalObjectURL = URL.createObjectURL;
      URL.createObjectURL = () => { throw new Error('simulated download failure'); };
    });
    await page.locator('#downloadComparison').click();
    assert.match(await page.locator('#comparisonDownloadStatus').innerText(), /無法下載/);
    await page.evaluate(() => { URL.createObjectURL = window.originalObjectURL; });
    assert.ok((await report()).includes('"Renamed","1","3","+2"'));
    assert.match(await page.locator('#comparisonDownloadStatus').innerText(), /已開始下載/);
    // Flush any pre-existing autosave, then confirm repeated report downloads do not write.
    await page.waitForTimeout(1200);
    const writes = await page.evaluate(() => window.qaWrites.length);
    await report(); await report();
    assert.equal(await page.evaluate(() => window.qaWrites.length), writes);
    const legacy = structuredClone(earlier);
    legacy.sheets.hitters = [{ name: 'Renamed', hr: '2' }]; legacy.sheets.pitchers = [];
    await upload('#snapshotFile', legacy, 'legacy.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('legacy.json'));
    assert.match(await page.locator('#snapshotRows tr').nth(1).innerText(), /\+1\s+可比較/);
    const damaged = structuredClone(exported); damaged.sheets.hitters[0].rowId = 'broken';
    const previousRows = await page.locator('#snapshotRows').innerText();
    await upload('#snapshotFile', damaged, 'broken.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('無法比較'));
    assert.equal(await page.locator('#snapshotRows').innerText(), previousRows);
    assert.doesNotMatch(await page.locator('#snapshotStatus').innerText(), /rowId|UUID|修正/);
    await upload('#jsonFile', damaged, 'broken-import.json');
    assert.deepEqual(await output(), exported);
    await page.locator('#snapshotFile').setInputFiles([]);
    assert.equal(await page.locator('#snapshotRows').innerText(), previousRows);
    damaged.sheets.hitters[0].rowId = damaged.sheets.hitters[1].rowId;
    await upload('#snapshotFile', damaged, 'duplicate.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('重複'));
    assert.equal(await page.locator('#snapshotRows').innerText(), previousRows);
    const distinct = structuredClone(legacy);
    distinct.sheets.hitters[0].rowId = '22222222-2222-4222-8222-222222222222';
    await upload('#snapshotFile', distinct, 'distinct.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('distinct.json'));
    assert.match(await page.locator('#snapshotRows').innerText(), /未配對的快照列/);
    assert.doesNotMatch(await page.locator('#snapshotRows').innerText(), /可比較/);
    const ambiguous = structuredClone(legacy);
    ambiguous.sheets.hitters.push({ name: 'Renamed', hr: '1' });
    await upload('#snapshotFile', ambiguous, 'ambiguous.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('ambiguous.json'));
    assert.match(await page.locator('#snapshotRows').innerText(), /同名，無法配對/);
    await page.evaluate(() => {
      const text = File.prototype.text;
      window.restoreFileText = () => { File.prototype.text = text; };
      File.prototype.text = function () {
        if (this.name !== 'slow.json') return text.call(this);
        return new Promise((resolve) => { window.releaseSlow = async () => resolve(await text.call(this)); });
      };
    });
    await upload('#snapshotFile', earlier, 'slow.json');
    await upload('#snapshotFile', legacy, 'newest.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('newest.json'));
    await page.evaluate(async () => { await window.releaseSlow(); window.restoreFileText(); });
    assert.match(await page.locator('#snapshotStatus').innerText(), /newest.json/);
    await page.screenshot({ path: `browser-artifacts/${mode}.png`, fullPage: true });
    await page.locator('#clearSnapshot').click();
    assert.equal(await page.locator('#snapshotResults').isVisible(), false);
    assert.equal(await page.locator('#downloadComparison').isDisabled(), true);
    console.log(`PASS ${mode}: both sheets, lifecycle, download/import, matching/ambiguity, rejection, cancel/clear, stale upload`);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS real Chromium ${browser.version()}; isolated backend, no local-computer dependency`);
} catch (error) {
  if (page) await page.screenshot({ path: 'browser-artifacts/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
