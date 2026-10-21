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
  const output = async () => JSON.parse(await page.locator('#outputText').inputValue());
  for (const mode of ['pawapuro', 'prospi']) {
    await page.locator('#modeSelect').selectOption(mode);
    await page.waitForFunction((mode) => JSON.parse(document.querySelector('#outputText').value).mode === mode, mode);
    await page.locator('#hittersTab').click();
    await page.locator('#rows [data-field="hr"]').fill('8');
    await page.locator('#toggleColumns').click();
    await page.locator('#columnChecklist [data-field="hr"]').uncheck();
    assert.equal((await output()).sheets.hitters[0].hr, undefined);
    await page.locator('#toggleColumns').click();
    await page.locator('#pitchersTab').click();
    await page.locator('#rows [data-field="ip"]').fill('11.1');
    // Capture before debounce save: the download reads editable state, not the backend.
    const before = await page.evaluate(() => {
      clearTimeout(cloudSaveTimer); // Keep this edit unsynced to test the backup boundary.
      return { writes: qaWrites.length, data: JSON.stringify(buildStorageExport()) };
    });
    const downloading = page.waitForEvent('download');
    await page.locator('#downloadBackup').click();
    const download = await downloading;
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.match(download.suggestedFilename(), new RegExp(`^game-stat-${mode}-backup-.*\\.json$`));
    assert.equal(backup.sheets.hitters[0].hr, '8');
    assert.equal(backup.sheets.pitchers[0].ip, '11.1');
    assert.equal(backup.activeSheet, 'pitchers');
    assert.equal(backup.exportedAt, new Date(backup.exportedAt).toISOString());
    assert.equal(await page.evaluate(() => JSON.stringify(buildStorageExport())), before.data);
    assert.equal(await page.evaluate(() => qaWrites.length), before.writes);
    // Import the actual downloaded bytes, replacing a later edit.
    await page.locator('#rows [data-field="ip"]').fill('99.0');
    await page.locator('#jsonFile').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => document.querySelector('#jsonFile').value === '');
    // Compatible with the explicit import preview in PR #9, while retaining legacy import coverage.
    if (await page.locator('#importPreview').isVisible()) await page.locator('#confirmImport').click();
    const restored = await page.evaluate(() => buildStorageExport());
    assert.deepEqual(restored.sheets, backup.sheets);
    assert.equal(restored.activeSheet, backup.activeSheet);
    assert.equal((await output()).sheets.hitters[0].hr, undefined); // visibility preference unchanged
    await page.locator('.snapshot-panel summary').click();
    await page.locator('#snapshotFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('backup.json'));
    assert.doesNotMatch(await page.locator('#snapshotStatus').textContent(), /檔案未提供時間/);
    await page.locator('#snapshotMetric').selectOption('ip');
    assert.match(await page.locator('#snapshotRows').textContent(), /11.1/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `browser-artifacts/backup-${mode}.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.snapshot-panel summary').click();
    console.log(`PASS ${mode}: hidden fields, both sheets, edited values, real download, import round-trip, snapshot timestamp`);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS real Chromium ${browser.version()}; mocked backend and external requests blocked`);
} catch (error) {
  if (page) await page.screenshot({ path: 'browser-artifacts/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
