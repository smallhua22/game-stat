import test from 'node:test';
import assert from 'node:assert/strict';
import snapshots from '../named-snapshots.js';

const account = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stats = (mode = 'pawapuro') => ({ schemaVersion: 2, mode, activeSheet: 'hitters',
  sheets: { hitters: [{ rowId: id(1), name: 'Player', hr: '3', hiddenNote: 'keep', slashLine: '.250/.300/.400' }],
    pitchers: [{ rowId: id(2), name: 'Pitcher', ip: '10.2' }] },
  legacyLinks: { ['a'.repeat(64)]: { hitters: [id(1)], pitchers: [id(2)] } } });

// Supabase-shaped query mock: records queries and applies every predicate.
function backend() {
  const db = new Map(), calls = [];
  let error = null, pause = null, corrupt = null;
  const client = { from(table) {
    assert.equal(table, 'user_tables');
    const call = { op: 'select', filters: [] }; calls.push(call);
    const q = {
      select() { return q; }, insert(row) { call.op = 'insert'; call.row = row; return q; },
      delete() { call.op = 'delete'; return q; },
      eq(k, v) { call.filters.push([k, v]); return q; },
      like(k, v) { call.prefix = [k, v.slice(0, -1)]; return q; },
      gt(k, v) { call.after = [k, v]; return q; },
      order(k) { call.sort = k; return q; }, limit(n) { call.limit = n; return q; },
      single() { call.single = true; return q; }, maybeSingle() { call.single = true; return q; },
      async then(resolve, reject) {
        try {
          if (pause) await pause;
          if (error) return resolve({ error, data: null });
          let rows;
          if (call.op === 'insert') {
            const key = call.row.user_id + ':' + call.row.table_id;
            if (db.has(key)) return resolve({ error: new Error('duplicate'), data: null });
            db.set(key, structuredClone(call.row)); rows = [db.get(key)];
          } else {
            rows = [...db.values()].filter((r) => call.filters.every(([k, v]) => r[k] === v) &&
              (!call.prefix || r[call.prefix[0]].startsWith(call.prefix[1])) &&
              (!call.after || r[call.after[0]] > call.after[1]));
            if (call.sort) rows.sort((a, b) => a[call.sort].localeCompare(b[call.sort]));
            if (call.limit) rows = rows.slice(0, call.limit);
            if (call.op === 'delete') rows.forEach((r) => db.delete(r.user_id + ':' + r.table_id));
          }
          let data = structuredClone(call.single ? rows[0] ?? null : rows);
          if (corrupt) data = corrupt(data);
          resolve({ data, error: null });
        } catch (err) { reject(err); }
      }
    }; return q;
  } };
  return { client, db, calls, fail: (e) => { error = e; }, pause: (p) => { pause = p; }, corrupt: (fn) => { corrupt = fn; } };
}
function setup() {
  const b = backend(); let user = account, counter = 10;
  const store = snapshots.create(b.client, { userId: account, getUserId: () => user,
    uuid: () => id(counter++), now: () => new Date('2026-10-28T23:00:00.000Z') });
  return { ...b, store, switch: (next) => { user = next; } };
}

test('both modes capture hidden fields, unsynced edits, IDs and links independently of later mutations', async () => {
  for (const mode of ['pawapuro', 'prospi']) {
    const h = setup(), input = stats(mode);
    let release; h.pause(new Promise((r) => { release = r; }));
    const pending = h.store.save(mode, ' Week 1 ', input);
    input.sheets.hitters[0].hr = '8'; input.legacyLinks['a'.repeat(64)].hitters.length = 0;
    release(); const saved = await pending;
    assert.equal(saved.name, 'Week 1'); assert.equal(saved.createdAt, '2026-10-28T23:00:00.000Z');
    assert.equal(saved.stats.sheets.hitters[0].hr, '3');
    assert.equal(saved.stats.sheets.hitters[0].hiddenNote, 'keep');
    assert.deepEqual(saved.stats.legacyLinks['a'.repeat(64)].hitters, [id(1)]);
    saved.stats.sheets.hitters.length = 0;
    const loaded = await h.store.read(mode, saved.id);
    assert.equal(loaded.stats.sheets.hitters[0].rowId, id(1));
    assert.equal(loaded.stats.sheets.pitchers[0].ip, '10.2');
    assert.equal(h.calls[0].row.type, mode); assert.equal(h.calls[0].op, 'insert');
  }
});

test('lists page explicitly and isolate current data, modes and accounts; deletion is exact and idempotent', async () => {
  const h = setup();
  const a = await h.store.save('pawapuro', 'One', stats());
  const b = await h.store.save('pawapuro', 'Two', stats());
  await h.store.save('prospi', 'Other mode', stats('prospi'));
  const row = [...h.db.values()][0];
  h.db.set('other', { ...row, user_id: other });
  h.db.set('current', { ...row, table_id: 'pawapuro' });
  const page = await h.store.list('pawapuro', { limit: 1 });
  assert.deepEqual(page.items.map((s) => s.id), [a.id]); assert.equal(page.nextCursor, a.id);
  const last = await h.store.list('pawapuro', { after: page.nextCursor, limit: 1 });
  assert.deepEqual(last.items.map((s) => s.id), [b.id]); assert.equal(last.nextCursor, null);
  assert.equal(await h.store.read('prospi', a.id), null);
  assert.equal(await h.store.remove('prospi', a.id), false);
  assert.equal(await h.store.remove('pawapuro', a.id), true);
  assert.equal(await h.store.remove('pawapuro', a.id), false);
  assert.equal(await h.store.read('pawapuro', a.id), null);
  assert.equal(h.db.has('current'), true); assert.equal(h.db.has('other'), true);
  for (const call of h.calls.filter((c) => c.op !== 'insert')) {
    assert.ok(call.filters.some(([k, v]) => k === 'user_id' && v === account));
    assert.ok(call.filters.some(([k]) => k === 'type'));
    assert.ok(call.prefix || call.filters.some(([k, v]) => k === 'table_id' && v.startsWith('snapshot:')));
  }
});

test('invalid names, IDs, modes, cursors, unsafe or corrupt stats fail before a query', async () => {
  const h = setup();
  for (const name of ['', ' '.repeat(3), 'a'.repeat(81), 'bad\nname'])
    await assert.rejects(h.store.save('pawapuro', name, stats()));
  for (const change of [s => { delete s.sheets.hitters[0].rowId; }, s => { s.sheets.pitchers[0].rowId = id(1); },
    s => { s.legacyLinks = { bad: {} }; }, s => { s.sheets.hitters[0].hr = NaN; },
    s => { s.activeSheet = 'bad'; }, s => { s.mode = 'prospi'; }]) {
    const input = stats(); change(input); await assert.rejects(h.store.save('pawapuro', 'Invalid', input));
  }
  for (const invalid of ['pawapuro', 'snapshot:bad', 'snapshot:' + other + '%']) {
    await assert.rejects(h.store.read('pawapuro', invalid));
    await assert.rejects(h.store.remove('pawapuro', invalid));
  }
  await assert.rejects(h.store.list('bad')); await assert.rejects(h.store.list('pawapuro', { limit: 101 }));
  await assert.rejects(h.store.list('pawapuro', { after: 'pawapuro' }));
  assert.equal(h.calls.length, 0);
});

test('storage failures and ID collisions never become successful saves or empty lists', async () => {
  const h = setup(), offline = new Error('offline'); h.fail(offline);
  for (const task of [() => h.store.save('pawapuro', 'One', stats()), () => h.store.read('pawapuro', 'snapshot:' + id(10)),
    () => h.store.list('pawapuro'), () => h.store.remove('pawapuro', 'snapshot:' + id(10))])
    await assert.rejects(task(), (e) => e === offline || (e.cause === offline && e.snapshotId.startsWith('snapshot:')));
  h.fail(null);
  const fixed = snapshots.create(h.client, { userId: account, getUserId: () => account, uuid: () => id(99) });
  await fixed.save('pawapuro', 'First', stats());
  await assert.rejects(fixed.save('pawapuro', 'Second', stats()), /duplicate/);
  assert.equal((await fixed.read('pawapuro', 'snapshot:' + id(99))).name, 'First');
});

test('account switches reject new calls and in-flight results without retrying writes', async () => {
  const h = setup(); let release; h.pause(new Promise((r) => { release = r; }));
  const pending = h.store.save('pawapuro', 'One', stats());
  h.switch(other); release();
  await assert.rejects(pending, /Account changed/);
  await assert.rejects(h.store.list('pawapuro'), /Account changed/);
  assert.equal(h.calls.length, 1); // Save outcome may be committed: caller must reconcile, never auto-retry.
});

test('corrupt returned records are rejected, not silently omitted or allowed to spoof scope', async () => {
  const h = setup(), saved = await h.store.save('pawapuro', 'One', stats());
  for (const change of [r => { r.user_id = other; }, r => { r.type = 'prospi'; },
    r => { r.table_id = 'pawapuro'; }, r => { r.data.createdAt = 'yesterday'; },
    r => { r.data.stats.sheets.hitters[0].rowId = 'bad'; }, r => { r.data.name = ''; }]) {
    h.corrupt((row) => { change(row); return row; });
    await assert.rejects(h.store.read('pawapuro', saved.id));
  }
  h.corrupt((row) => { row.data.id = 'spoof'; row.data.mode = 'prospi'; return row; });
  assert.equal((await h.store.read('pawapuro', saved.id)).id, saved.id);
  h.corrupt((rows) => { rows[0].user_id = other; return rows; });
  await assert.rejects(h.store.list('pawapuro'));
});

test('a recreated service reads stored versions; late read/list/delete results cannot reach a switched account', async () => {
  for (const operation of ['read', 'list', 'remove']) {
    const h = setup(), saved = await h.store.save('pawapuro', 'Persisted', stats());
    const fresh = snapshots.create(h.client, { userId: account, getUserId: () => account });
    assert.equal((await fresh.read('pawapuro', saved.id)).name, 'Persisted');
    let release; h.pause(new Promise((r) => { release = r; }));
    const pending = h.store[operation]('pawapuro', ...(operation === 'list' ? [] : [saved.id]));
    h.switch(null); release();
    await assert.rejects(pending, /Account changed/);
    assert.equal(h.calls.length, 3); // No automatic retries or cross-account queries.
  }
});
