import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import linking from '../legacy-linking.js';
import comparison from '../snapshot-comparison.js';
const id = () => webcrypto.randomUUID();
const fixture = (mode) => ({ schemaVersion: 2, mode, sheets: {
  hitters: [{ name: ' Ben ', hr: '1' }, { name: 'Alex', hr: '2' }, { name: 'Chris', hr: '3' }],
  pitchers: [{ name: 'Ben', ip: '10.2' }] } });

test('snapshot key ignores property order and filename/timestamp, but separates mode, rows and stats', async () => {
  const data = fixture('pawapuro');
  const key = await linking.key(data);
  assert.equal(await linking.key({ exportedAt: 'later', sheets: data.sheets, mode: data.mode }), key);
  for (const changed of [fixture('prospi'), { ...data, sheets: { ...data.sheets, hitters: [...data.sheets.hitters].reverse() } }]) {
    assert.notEqual(await linking.key(changed), key);
  }
  data.sheets.hitters[0].hr = '4';
  assert.notEqual(await linking.key(data), key);
});

test('both modes: explicit resolutions survive renames, serialization and deleted targets without guessing', async () => {
  for (const mode of ['pawapuro', 'prospi']) {
    const data = fixture(mode), original = JSON.stringify(data);
    const current = { sheets: { hitters: ['Ben', 'Alex', 'Alex'].map((name) => ({ name, rowId: id(), hr: '8' })),
      pitchers: [{ name: 'Ben', rowId: id(), ip: '11.1' }] } };
    const plan = linking.plan(data, current);
    assert.equal(plan.hitters[0], current.sheets.hitters[0].rowId);
    assert.equal(plan.hitters[1], ''); assert.equal(plan.hitters[2], '');
    assert.throws(() => linking.resolve(data, current, plan), /選擇/);
    plan.hitters[1] = current.sheets.hitters[2].rowId; plan.hitters[2] = 'new';
    const saved = linking.resolve(data, current, plan), key = await linking.key(data);
    const restored = linking.clean(JSON.parse(JSON.stringify({ [key]: saved })))[key];
    current.sheets.hitters[2].name = 'Renamed';
    assert.deepEqual(linking.plan(data, current, restored), saved);
    const linked = linking.apply(data, restored);
    assert.equal(comparison.compare(current.sheets.hitters, linked.sheets.hitters, 'hr')[2].delta, 6);
    current.sheets.hitters.push({ name: 'Chris', rowId: id(), hr: '9' });
    assert.equal(comparison.compare(current.sheets.hitters, linked.sheets.hitters, 'hr')[3].delta, null);
    assert.equal(JSON.stringify(data), original);
    current.sheets.hitters = [];
    assert.deepEqual(linking.plan(data, current, restored), saved);
    assert.equal(linking.apply(data, restored).sheets.pitchers[0].rowId, saved.pitchers[0]);
  }
});

test('duplicate choices and collision with identified rows are rejected; malformed saved records ignored', () => {
  const data = fixture('pawapuro'), target = id(), current = { sheets: { hitters: [], pitchers: [] } };
  const selected = { hitters: [target, target, 'new'], pitchers: ['new'] };
  assert.throws(() => linking.resolve(data, current, selected), /重複/);
  data.sheets.hitters[0].rowId = target;
  assert.throws(() => linking.resolve(data, current, selected), /重複/);
  assert.deepEqual(linking.clean({ bad: {}, ['a'.repeat(64)]: { hitters: [target], pitchers: [target] } }), {});
  assert.deepEqual(linking.clean(null), {});
});

test('incompatible saved metadata is ignored before it can break comparison', () => {
  const data = fixture('pawapuro'), current = { sheets: { hitters: [], pitchers: [] } };
  data.sheets.hitters[0].rowId = id();
  const record = { hitters: [id(), data.sheets.hitters[0].rowId, id()], pitchers: [id()] };
  assert.equal(linking.apply(data, record), data);
  assert.equal(linking.plan(data, current, record).hitters[1], '');
  assert.equal(linking.apply(data, { hitters: [], pitchers: [] }), data);
});
