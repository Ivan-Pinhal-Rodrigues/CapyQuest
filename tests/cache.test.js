import test from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { fillCache, cacheInfo, collectCache, MIN_CACHE_MS } from '../src/systems/cache.js';
import { rebirth } from '../src/systems/rebirth.js';

const HOUR = 3600e3;

function derived(overrides = {}) {
  return { zps: 100, offlineRate: 0.6, offlineCapMs: 4 * HOUR, ...overrides };
}

test('an empty cache still reports its capacity', () => {
  const s = createState();
  const info = cacheInfo(s, derived());
  assert.equal(info.zen, 0);
  assert.equal(info.ratio, 0);
  assert.equal(info.capMs, 4 * HOUR);
  // The number that makes raising the rate legible before it has cost anything.
  assert.equal(info.perHour, 100 * 0.6 * 3600);
});

test('filling banks zen at the offline rate', () => {
  const s = createState();
  const r = fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  assert.equal(r.creditedMs, HOUR);
  assert.equal(r.lostMs, 0);
  assert.equal(r.zen, 100 * 0.6 * 3600);
  assert.equal(s.cache.zen, r.zen);
});

test('time past the cap spills instead of banking', () => {
  const s = createState();
  const r = fillCache(s, { zps: 100, elapsedMs: 10 * HOUR, capMs: 4 * HOUR, rate: 0.6 });
  assert.equal(r.creditedMs, 4 * HOUR);
  assert.equal(r.lostMs, 6 * HOUR);
  assert.equal(cacheInfo(s, derived()).full, true);
});

test('a second fill on a full tank adds nothing but is still counted as lost', () => {
  const s = createState();
  fillCache(s, { zps: 100, elapsedMs: 4 * HOUR, capMs: 4 * HOUR, rate: 0.6 });
  const before = s.cache.zen;
  const r = fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  assert.equal(r.zen, 0);
  assert.equal(r.lostMs, HOUR);
  assert.equal(s.cache.zen, before);
  assert.equal(s.cache.lostMs, HOUR);
});

test('fills accumulate rather than replacing', () => {
  const s = createState();
  fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  assert.equal(s.cache.ms, 2 * HOUR);
  assert.equal(s.cache.zen, 2 * 100 * 0.6 * 3600);
});

test('sitting on the cache cannot pay more than collecting would have', () => {
  // The tank stores zen, not time-owed. Getting ten times richer while the
  // cache waits must not retroactively enrich what is already in it.
  const s = createState();
  fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  const banked = s.cache.zen;
  assert.equal(cacheInfo(s, derived({ zps: 100000 })).zen, banked);
});

test('collecting empties the tank, spill marker included', () => {
  const s = createState();
  fillCache(s, { zps: 100, elapsedMs: 10 * HOUR, capMs: 4 * HOUR, rate: 0.6 });
  const got = collectCache(s);
  assert.ok(got.zen > 0);
  assert.equal(got.lostMs, 6 * HOUR);
  assert.equal(s.cache.zen, 0);
  assert.equal(s.cache.ms, 0);
  assert.equal(s.cache.lostMs, 0);
});

test('a zero-income pond banks time but no zen', () => {
  const s = createState();
  const r = fillCache(s, { zps: 0, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  assert.equal(r.zen, 0);
  assert.equal(r.creditedMs, HOUR);
});

test('a negative or nonsense elapsed span changes nothing', () => {
  const s = createState();
  for (const bad of [-HOUR, NaN, undefined, 'soon']) {
    fillCache(s, { zps: 100, elapsedMs: bad, capMs: 4 * HOUR, rate: 0.6 });
  }
  assert.equal(s.cache.zen, 0);
  assert.equal(s.cache.ms, 0);
});

test('the cache survives a save round-trip and is scrubbed of nonsense', () => {
  const s = createState();
  fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  const back = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.cache.zen, s.cache.zen);

  const broken = reconcileState({ ...JSON.parse(JSON.stringify(s)), cache: { zen: 'lots', ms: -5 } });
  assert.equal(broken.cache.zen, 0);
  assert.equal(broken.cache.ms, 0);
});

test('a save written before the cache existed still boots', () => {
  const s = createState();
  delete s.cache;
  const back = reconcileState(s);
  assert.deepEqual(back.cache, { zen: 0, ms: 0, lostMs: 0, since: 0 });
});

test('rebirth banks the cache into lifetime totals rather than dropping it', () => {
  // The tank holds zen and zen does not survive a rebirth, so the coins go.
  // What must not happen is that they vanish without ever having counted.
  const s = createState();
  s.combat.bestDepth = 400;
  s.rebirthUnlocked = true;
  fillCache(s, { zps: 100, elapsedMs: HOUR, capMs: 4 * HOUR, rate: 0.6 });
  const banked = s.cache.zen;
  const totalBefore = s.totalZen;

  const out = rebirth(s);
  assert.equal(out.ok, true);
  assert.equal(s.totalZen, totalBefore + banked);
  assert.equal(s.cache.zen, 0, 'the tank is empty on the other side');
});

test('the report threshold is a minute', () => {
  assert.equal(MIN_CACHE_MS, 60e3);
});
