// Save/load, migration and shop logic. A save bug loses somebody's whole run,
// so these lean hard on the ugly cases: missing fields, NaN, corrupt JSON.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState, SAVE_VERSION } from '../src/state.js';
import { exportSave, importSave, saveState, loadState, migrate, SAVE_KEY } from '../src/save.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { buyBuilding, buyUpgrade, quoteBuilding, totalBuildings } from '../src/systems/shop.js';
import { checkAchievements } from '../src/systems/achievements.js';
import { BUILDINGS_BY_ID } from '../src/data/buildings.js';
import { ComboTracker, resolveClick } from '../src/systems/clicker.js';

/** Minimal in-memory stand-in for localStorage. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('a fresh state has every generator at zero', () => {
  const s = createState();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.zen, 0);
  assert.ok(Object.keys(s.buildings).length > 0);
  assert.ok(Object.values(s.buildings).every((v) => v === 0));
});

test('save survives a round trip through storage', () => {
  const storage = memoryStorage();
  const s = createState();
  s.zen = 12345.678;
  s.lifetimeClicks = 99;
  s.buildings.lilypad = 7;
  s.clickUpgrades.firmerPaw = true;

  assert.equal(saveState(s, storage), true);
  const loaded = loadState(storage);

  assert.equal(loaded.zen, 12345.678);
  assert.equal(loaded.lifetimeClicks, 99);
  assert.equal(loaded.buildings.lilypad, 7);
  assert.equal(loaded.clickUpgrades.firmerPaw, true);
});

test('derived state is never written to disk', () => {
  const storage = memoryStorage();
  const s = createState();
  s.derived = { zps: 999 };
  saveState(s, storage);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).derived, undefined);
});

test('loading an empty or corrupt store does not throw', () => {
  assert.equal(loadState(memoryStorage()), null);

  const broken = memoryStorage();
  broken.setItem(SAVE_KEY, '{not json at all');
  assert.equal(loadState(broken), null);
  // The unreadable original is kept rather than silently destroyed.
  assert.ok(broken._map.has('capyquest:save:backup'));
});

test('reconcile backfills missing fields and scrubs bad numbers', () => {
  const partial = {
    version: SAVE_VERSION,
    zen: NaN,
    lifetimeZen: -50,
    buildings: { lilypad: 3, notARealBuilding: 99 },
    stats: { crits: 'banana' },
  };
  const s = reconcileState(partial);

  assert.equal(s.zen, 0, 'NaN zen should reset to 0');
  assert.equal(s.lifetimeZen, 0, 'negative zen should reset to 0');
  assert.equal(s.buildings.lilypad, 3, 'known generator preserved');
  assert.equal(s.buildings.notARealBuilding, undefined, 'unknown generator dropped');
  assert.equal(s.buildings.onsenBasin, 0, 'missing generator backfilled');
  assert.equal(s.stats.crits, 0, 'non-numeric stat scrubbed');
  assert.ok(s.settings.sound !== undefined, 'settings backfilled');
});

test('expired buffs do not survive a reload', () => {
  const now = 1_000_000;
  const s = reconcileState(
    { version: SAVE_VERSION, buffs: [{ id: 'old', until: now - 1 }, { id: 'live', until: now + 5000 }] },
    now,
  );
  assert.equal(s.buffs.length, 1);
  assert.equal(s.buffs[0].id, 'live');
});

test('migrate leaves a current-version save alone', () => {
  const s = createState();
  assert.equal(migrate(s).version, SAVE_VERSION);
});

test('export and import round-trip, including non-ASCII flavour text', () => {
  const s = createState();
  s.zen = 4.2e18;
  s.buildings.onsenBasin = 42;
  s.note = 'em dash — and yuzu 🍋';

  const code = exportSave(s);
  assert.ok(code.startsWith('CAPY1.'));

  const back = importSave(code);
  assert.equal(back.zen, 4.2e18);
  assert.equal(back.buildings.onsenBasin, 42);
  assert.equal(back.note, 'em dash — and yuzu 🍋');
});

test('import rejects junk with a readable message', () => {
  assert.throws(() => importSave('hello'), /CapyQuest save code/);
  assert.throws(() => importSave(''), /CapyQuest save code/);
  assert.throws(() => importSave(`CAPY1.${Buffer.from('{"a":1}').toString('base64')}`), /game data/);
});

// ---------------------------------------------------------------- shop

test('buying a generator spends exactly the quoted price', () => {
  const s = createState();
  s.zen = 1000;
  const quote = quoteBuilding(s, BUILDINGS_BY_ID.lilypad, 10);
  const result = buyBuilding(s, 'lilypad', 10);

  assert.equal(result.ok, true);
  assert.equal(result.count, 10);
  assert.ok(Math.abs(result.spent - quote.cost) < 1e-9);
  assert.ok(Math.abs(s.zen - (1000 - quote.cost)) < 1e-9);
  assert.equal(s.buildings.lilypad, 10);
});

test('buying is refused when you cannot afford it, and costs nothing', () => {
  const s = createState();
  s.zen = 5;
  const result = buyBuilding(s, 'lilypad', 1);
  assert.equal(result.ok, false);
  assert.equal(s.zen, 5);
  assert.equal(s.buildings.lilypad, 0);
});

test('buy max never leaves the player in debt', () => {
  const s = createState();
  s.zen = 987654;
  const result = buyBuilding(s, 'lilypad', 'max');
  assert.equal(result.ok, true);
  assert.ok(s.zen >= 0, 'zen went negative');
  assert.ok(result.count > 0);
});

test('upgrades cannot be bought twice, while locked, or while broke', () => {
  const s = createState();
  s.zen = 1e9;

  assert.equal(buyUpgrade(s, 'firmerPaw').reason, 'locked', 'needs 25 taps first');

  s.lifetimeClicks = 25;
  assert.equal(buyUpgrade(s, 'firmerPaw').ok, true);
  assert.equal(buyUpgrade(s, 'firmerPaw').reason, 'owned');

  s.zen = 0;
  s.lifetimeClicks = 100;
  assert.equal(buyUpgrade(s, 'twoPaws').reason, 'poor');
  assert.equal(buyUpgrade(s, 'noSuchUpgrade').ok, false);
});

// ------------------------------------------------------------- derived

test('derived income reflects generators, upgrades and achievements', () => {
  const s = createState();
  const base = recomputeDerived(s);
  assert.equal(base.zps, 0);
  assert.equal(base.clickValue, 1);

  s.buildings.lilypad = 10;
  const withPads = recomputeDerived(s);
  assert.ok(Math.abs(withPads.zps - 1) < 1e-9, '10 pads at 0.1/s = 1/s');

  s.tierUpgrades.lilypad_t1 = true;
  assert.ok(Math.abs(recomputeDerived(s).zps - 2) < 1e-9, 'tier 1 doubles the line');

  s.clickUpgrades.firmerPaw = true; // +1 flat
  s.clickUpgrades.callusedToes = true; // x2
  assert.equal(recomputeDerived(s).clickValue, (1 + 1) * 2);
});

test('combo raises click value and is capped', () => {
  const s = createState();
  const cap = recomputeDerived(s).comboCap;
  const atCap = recomputeDerived(s, { comboPoints: cap });
  const wayOver = recomputeDerived(s, { comboPoints: cap + 500 });
  assert.equal(atCap.clickValue, wayOver.clickValue, 'combo past the cap must not pay more');
  assert.ok(atCap.clickValue > recomputeDerived(s).clickValue);
});

test('active buffs multiply income and expired ones do not', () => {
  const now = 1_000_000;
  const s = createState();
  s.buildings.lilypad = 100;

  const plain = recomputeDerived(s, { now });
  s.buffs = [{ id: 'frenzy', name: 'Frenzy', until: now + 5000, effects: [{ type: 'buffMult', value: 7 }] }];
  assert.ok(Math.abs(recomputeDerived(s, { now }).zps - plain.zps * 7) < 1e-9);

  s.buffs = [{ id: 'frenzy', name: 'Frenzy', until: now - 1, effects: [{ type: 'buffMult', value: 7 }] }];
  assert.ok(Math.abs(recomputeDerived(s, { now }).zps - plain.zps) < 1e-9);
});

test('an unknown effect type from a newer save is ignored, not fatal', () => {
  const s = createState();
  s.buffs = [{ id: 'x', name: 'X', until: Date.now() + 1e6, effects: [{ type: 'fromTheFuture', value: 3 }] }];
  assert.doesNotThrow(() => recomputeDerived(s));
});

// -------------------------------------------------------- clicking

test('combo builds on taps and drains between them', () => {
  const combo = new ComboTracker();
  let t = 10_000;
  for (let i = 0; i < 5; i++) combo.hit((t += 100), 25);
  assert.equal(combo.points, 5);

  combo.tick(t + 10_000);
  assert.equal(combo.points, 0, 'combo should drain away when idle');
});

test('combo cannot exceed the cap', () => {
  const combo = new ComboTracker();
  let t = 0;
  for (let i = 0; i < 100; i++) combo.hit((t += 50), 25);
  assert.equal(combo.points, 25);
});

test('a click pays crit damage exactly when the roll crits', () => {
  const derived = { clickValue: 10, critChance: 0.5, critMult: 3 };
  assert.deepEqual(resolveClick(derived, () => 0.1), { amount: 30, crit: true });
  assert.deepEqual(resolveClick(derived, () => 0.9), { amount: 10, crit: false });
});

// ---------------------------------------------------- achievements

test('achievements unlock once and only once', () => {
  const s = createState();
  s.lifetimeClicks = 1;
  const first = checkAchievements(s, 123);
  assert.ok(first.some((a) => a.id === 'firstTap'));
  assert.equal(s.achievements.firstTap, 123);
  assert.equal(checkAchievements(s, 456).length, 0, 'no re-unlocking');
});

test('the diversified achievement needs one of every generator', () => {
  const s = createState();
  for (const id of Object.keys(s.buildings)) s.buildings[id] = 1;
  const unlocked = checkAchievements(s);
  assert.ok(unlocked.some((a) => a.id === 'diversified'));
  assert.equal(totalBuildings(s), Object.keys(s.buildings).length);
});

test('achievement rewards feed straight back into derived stats', () => {
  const s = createState();
  const before = recomputeDerived(s).globalMult;
  s.lifetimeClicks = 1;
  checkAchievements(s);
  assert.ok(recomputeDerived(s).globalMult > before, 'First Contact should boost income');
});
