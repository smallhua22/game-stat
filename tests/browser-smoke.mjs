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
    const overviewBaseline = structuredClone(earlier);
    overviewBaseline.sheets.pitchers[1].ip = '9.2';
    await upload('#snapshotFile', overviewBaseline, 'overview.json');
    await page.waitForFunction(() => document.querySelector('#snapshotStatus').textContent.includes('overview.json'));
    for (const sheet of ['hitters', 'pitchers']) {
      await page.locator(`#${sheet}Tab`).click();
      const current = await output();
      const selected = current.sheets[sheet][1].rowId;
      await page.waitForTimeout(1000); // Let legitimate earlier edits/tab autosaves settle.
      const writes = await page.evaluate(() => window.qaWrites.length);
      await page.locator('#overviewPlayer').selectOption(selected);
      const card = page.locator('.player-metric').filter({ has: page.getByRole('heading', { name: sheet === 'hitters' ? 'HR' : 'IP', exact: true }) });
      assert.match(await card.innerText(), sheet === 'hitters' ? /較早快照\s+1\s+目前\s+3\s+差值 \+2/ : /較早快照\s+9.2\s+目前\s+10.2\s+差值 \+1.0/);
      assert.ok(await page.locator('.player-metric').count() > 5);
      await page.locator('#overviewPlayer').selectOption(current.sheets[sheet][0].rowId);
      await page.locator('#overviewPlayer').selectOption(selected);
      assert.equal(await page.locator('#overviewPlayer').inputValue(), selected);
      assert.deepEqual(await output(), current);
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => window.qaWrites.length), writes);
      await page.locator('#playerOverview').screenshot({ path: `browser-artifacts/${mode}-${sheet}-overview.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('#playerOverview').evaluate((el) => el.scrollWidth <= el.clientWidth), true);
      await page.locator('#playerOverview').screenshot({ path: `browser-artifacts/${mode}-${sheet}-overview-mobile.png` });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.screenshot({ path: `browser-artifacts/${mode}.png`, fullPage: true });
    await page.locator('#clearSnapshot').click();
    assert.equal(await page.locator('#snapshotResults').isVisible(), false);
    assert.equal(await page.locator('#playerOverview').isVisible(), false);
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
