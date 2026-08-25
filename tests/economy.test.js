// Leafs, cases, boosts, cosmetics and the simulated store.
//
// The load-bearing tests here are the honesty ones. A case's displayed odds are
// generated from the same weights the roll uses, so the first thing checked is
// that those weights sum to one and that a roll can never leave the range the
// card promised. The second is that nothing in the store reaches for a payment
// path — PAYMENTS is off and the code has to stay incapable of pretending
// otherwise. The third is that a cosmetic never touches a number: buying a skin
// must leave the simulation bit-identical, or "cosmetic" is a lie.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { combatStats } from '../src/systems/combatStats.js';
import { resolveItem } from '../src/systems/equipment.js';
import { makeRng } from '../src/balance.js';
import { MAX_STARS, MAX_TIER, rarityFor } from '../src/data/rarities.js';
import { CASES, CASES_BY_ID, caseOdds, caseWeights, pityTier } from '../src/data/cases.js';
import { BOOSTS, BOOSTS_BY_ID } from '../src/data/boosts.js';
import {
  COSMETICS, COSMETIC_KINDS, SKINS, PONDS, TITLES, cosmeticKey, skinPaletteExists,
} from '../src/data/cosmetics.js';
import { openCase, canOpen, caseState, pityLeft } from '../src/systems/cases.js';
import {
  PAYMENTS, SIMULATED_NOTICE, LEAF_PACKS, LEAF_PACKS_BY_ID, DAILY_LEAFS,
  buyBoost, buyLeafPack, claimDailyLeafs, dailyLeafsReady, boostRemaining, activeBoost,
} from '../src/systems/store.js';
import {
  buyCosmetic, checkUnlocks, collection, equipCosmetic, equipped, grant, meetsNeed, owns,
} from '../src/systems/cosmetics.js';
import { dayKey } from '../src/systems/quests.js';

function funded(leafs = 1e6) {
  const s = createState();
  s.leafs = leafs;
  return s;
}

// -------------------------------------------------------------------- cases

test('there are three cases, no more, and each one is for something', () => {
  assert.equal(CASES.length, 3, 'three cases is the whole shop, by design');
  const seen = new Set();
  for (const def of CASES) {
    assert.ok(!seen.has(def.id), `duplicate case "${def.id}"`);
    seen.add(def.id);
    assert.ok(def.cost > 0 && def.name && def.blurb, `${def.id}: incomplete`);
    assert.ok(def.floor <= def.ceiling, `${def.id}: inverted range`);
    assert.ok(def.ceiling <= MAX_TIER, `${def.id}: reaches past the ladder`);
    assert.ok(def.guaranteed >= def.floor, `${def.id}: floor below its own guarantee`);
    assert.ok(def.pity > 0, `${def.id}: no pity at all`);
  }
  // Dearer cases must promise more, or the price is a lie.
  const byCost = [...CASES].sort((a, b) => a.cost - b.cost);
  for (let i = 1; i < byCost.length; i++) {
    assert.ok(byCost[i].guaranteed > byCost[i - 1].guaranteed, 'a dearer case must floor higher');
    assert.ok(byCost[i].ceiling > byCost[i - 1].ceiling, 'a dearer case must reach higher');
  }
});

test('the odds on the card sum to one and name real rungs', () => {
  for (const def of CASES) {
    const odds = caseOdds(def);
    const total = odds.reduce((a, o) => a + o.chance, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${def.id}: odds sum to ${total}`);
    for (const row of odds) {
      assert.ok(row.chance > 0, `${def.id}: a listed rung with no chance of appearing`);
      assert.equal(rarityFor(row.tier).tier, row.tier);
      assert.ok(row.tier >= def.guaranteed && row.tier <= def.ceiling);
    }
    // Rarer must always be rarer, top to bottom.
    for (let i = 1; i < odds.length; i++) {
      assert.ok(odds[i].chance < odds[i - 1].chance, `${def.id}: a higher rung is not rarer`);
    }
  }
});

test('the displayed odds are the odds the roll uses', () => {
  // Not "close to" — the same table. If caseOdds ever stops being derived from
  // caseWeights this fails, which is the point.
  for (const def of CASES) {
    const weights = caseWeights(def);
    const odds = caseOdds(def);
    const total = weights.reduce((a, w) => a + w.weight, 0);
    assert.equal(weights.length, odds.length);
    weights.forEach((w, i) => {
      assert.equal(w.tier, odds[i].tier);
      assert.ok(Math.abs(w.weight / total - odds[i].chance) < 1e-12);
    });
  }
});

test('a case never produces anything below its stated floor', () => {
  for (const def of CASES) {
    const s = funded();
    const rng = makeRng(17);
    for (let i = 0; i < 400; i++) {
      const result = openCase(s, def.id, rng);
      assert.equal(result.ok, true);
      assert.ok(result.tier >= def.guaranteed, `${def.id} produced ${result.tier}, floor is ${def.guaranteed}`);
      assert.ok(result.tier <= def.ceiling, `${def.id} produced ${result.tier}, ceiling is ${def.ceiling}`);
      assert.ok(result.stars >= 1 && result.stars <= MAX_STARS);
      assert.ok(result.entry, 'a case must actually put something in the bag');
      assert.ok(resolveItem(result.entry).tier === result.tier);
    }
  }
});

test('a case charges leafs and refuses when they are not there', () => {
  const s = createState();
  s.leafs = 150;

  assert.equal(canOpen(s, 'astral').reason, 'leafs');
  assert.equal(openCase(s, 'astral').ok, false);
  assert.equal(s.leafs, 150, 'a refused open must not charge');
  assert.equal(s.combat.inventory.length, 0);

  const result = openCase(s, 'reed', makeRng(2));
  assert.equal(result.ok, true);
  assert.equal(s.leafs, 150 - CASES_BY_ID.reed.cost);
  assert.equal(openCase(s, 'nope').reason, 'unknown');
});

test('pity is a real counter, and it fires', () => {
  const s = funded();
  const def = CASES_BY_ID.reed;

  // The unluckiest possible roller: every weighted pick lands at the bottom.
  const unlucky = () => 0;
  let pitied = 0;
  for (let i = 0; i < def.pity + 1; i++) {
    const result = openCase(s, 'reed', unlucky);
    if (result.pitied) pitied++;
  }
  assert.equal(pitied, 1, 'pity should have fired exactly once by now');
  assert.equal(caseState(s, 'reed').since, 0, 'a pitied open resets the counter');
});

test('the pity counter shown is the pity counter used', () => {
  const s = funded();
  const def = CASES_BY_ID.onsen;
  assert.equal(pityLeft(s, 'onsen'), def.pity);

  openCase(s, 'onsen', () => 0); // a bottom-of-the-range roll
  assert.equal(pityLeft(s, 'onsen'), def.pity - 1);
  assert.equal(pityLeft(s, 'noSuchCase'), 0);
});

test('a pitied open lands where the card said it would', () => {
  const s = funded();
  const def = CASES_BY_ID.astral;
  const counters = caseState(s, 'astral');
  counters.since = def.pity;

  const result = openCase(s, 'astral', () => 0);
  assert.equal(result.pitied, true);
  assert.equal(result.tier, pityTier(def));
});

test('a dearer case really does pay better on average', () => {
  const average = (id) => {
    const s = funded(1e9);
    const rng = makeRng(41);
    let sum = 0;
    for (let i = 0; i < 500; i++) sum += openCase(s, id, rng).tier;
    return sum / 500;
  };
  assert.ok(average('onsen') > average('reed'));
  assert.ok(average('astral') > average('onsen'));
});

test('a case star-boost helps without inventing a sixth star', () => {
  const stars = (id) => {
    const s = funded(1e9);
    const rng = makeRng(8);
    let sum = 0;
    for (let i = 0; i < 800; i++) {
      const r = openCase(s, id, rng);
      assert.ok(r.stars <= MAX_STARS, `${id} rolled ${r.stars} stars`);
      sum += r.stars;
    }
    return sum;
  };
  assert.ok(stars('astral') > stars('reed'), 'the boosted case should star more often');
});

// ------------------------------------------------------------------- boosts

test('boosts speak the effect vocabulary and actually change the numbers', () => {
  const known = new Set([
    'clickFlat', 'clickMult', 'zpsMult', 'globalMult', 'buildingMult', 'allBuildingMult',
    'critChance', 'critDamage', 'comboCap', 'comboStep', 'zpsShare', 'goldenChance',
    'goldenDuration', 'offlineRate', 'offlineCapHours', 'costDiscount', 'buffMult',
    'combatAtk', 'combatDef', 'combatHp', 'combatSpd', 'combatLuck', 'ticketRate',
  ]);
  for (const def of BOOSTS) {
    assert.ok(def.name && def.blurb && def.icon, `${def.id}: incomplete`);
    assert.ok(def.cost > 0 && def.hours > 0, `${def.id}: free or instant`);
    assert.ok(def.effects.length > 0, `${def.id}: does nothing`);
    for (const e of def.effects) {
      assert.ok(known.has(e.type), `${def.id}: unknown effect "${e.type}"`);
      assert.ok(Number.isFinite(e.value), `${def.id}: non-numeric effect`);
    }
  }

  const s = funded();
  s.buildings.lilypad = 100;
  const before = recomputeDerived(s).zps;
  assert.equal(buyBoost(s, 'coinRush').ok, true);
  assert.ok(Math.abs(recomputeDerived(s).zps - before * 2) < 1e-6, 'Coin Rush should double income');
});

test('a boost expires, and an expired one stops counting', () => {
  const now = 1_000_000;
  const s = funded();
  s.buildings.lilypad = 100;
  buyBoost(s, 'coinRush', now);

  const boosted = recomputeDerived(s, { now: now + 1000 }).zps;
  const after = recomputeDerived(s, { now: now + 2 * 3600e3 }).zps;
  assert.ok(after < boosted, 'the boost should have run out');
  assert.equal(boostRemaining(s, 'coinRush', now + 2 * 3600e3), 0);
});

test('buying a running boost extends it rather than wasting it', () => {
  const now = 5_000_000;
  const s = funded();
  const first = buyBoost(s, 'coinRush', now);
  const second = buyBoost(s, 'coinRush', now);

  assert.equal(second.extended, true);
  assert.equal(second.until, first.until + BOOSTS_BY_ID.coinRush.hours * 3600e3);
  assert.equal(s.buffs.filter((b) => b.id === 'coinRush').length, 1, 'no duplicate stacks');
});

test('a boost refuses when the leafs are short, and charges nothing', () => {
  const s = createState();
  s.leafs = 1;
  assert.equal(buyBoost(s, 'coinRush').reason, 'leafs');
  assert.equal(s.leafs, 1);
  assert.deepEqual(s.buffs, []);
  assert.equal(buyBoost(s, 'notABoost').reason, 'unknown');
});

// -------------------------------------------------------------------- store

test('the store cannot take real money, and says so', () => {
  assert.equal(PAYMENTS, false, 'this flag must stay off until there is a real backend');
  assert.match(SIMULATED_NOTICE, /simulated/i);
  assert.match(SIMULATED_NOTICE, /no real payment/i);
});

test('leaf packs are price tags, and buying one only adds leafs', () => {
  assert.ok(LEAF_PACKS.length >= 3);
  const best = LEAF_PACKS.filter((p) => p.best);
  assert.equal(best.length, 1, 'exactly one pack carries the badge');

  // Bigger packs must genuinely be better value, or the badge is dishonest.
  const rate = (p) => p.leafs / Number(p.price.replace(/[^\d.]/g, ''));
  const sorted = [...LEAF_PACKS].sort((a, b) => a.leafs - b.leafs);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(rate(sorted[i]) > rate(sorted[i - 1]), `${sorted[i].id} is worse value than a smaller pack`);
  }

  const s = createState();
  const before = { ...s };
  const result = buyLeafPack(s, 'armful');
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(s.leafs, LEAF_PACKS_BY_ID.armful.leafs);
  assert.equal(s.lifetimeLeafs, LEAF_PACKS_BY_ID.armful.leafs);
  assert.equal(s.store.packs.armful, 1);
  assert.equal(s.zen, before.zen, 'a leaf pack must not touch anything else');
  assert.equal(buyLeafPack(s, 'nope').ok, false);
});

test('the free daily is once a day and lands just short of a Reed Case', () => {
  const s = createState();
  const cost = CASES_BY_ID.reed.cost;
  assert.ok(DAILY_LEAFS < cost, 'a full case a day would make the case pointless');
  assert.ok(DAILY_LEAFS > cost * 0.6, 'too far short and it stops feeling like progress');
  assert.ok(DAILY_LEAFS * 2 > cost, 'two days should always be enough');

  const monday = Date.UTC(2026, 2, 2, 9);
  assert.equal(dailyLeafsReady(s, monday), true);
  assert.equal(claimDailyLeafs(s, monday).leafs, DAILY_LEAFS);
  assert.equal(s.leafs, DAILY_LEAFS);
  assert.equal(s.store.leafDay, dayKey(monday));

  assert.equal(dailyLeafsReady(s, monday), false);
  assert.equal(claimDailyLeafs(s, monday).reason, 'claimed');
  assert.equal(s.leafs, DAILY_LEAFS, 'claiming twice must not pay twice');

  const tuesday = monday + 86400e3;
  assert.equal(dailyLeafsReady(s, tuesday), true);
  assert.equal(claimDailyLeafs(s, tuesday).ok, true);
  assert.equal(s.leafs, DAILY_LEAFS * 2);
});

// --------------------------------------------------------------- cosmetics

test('every cosmetic is complete, unique, and reachable one way or another', () => {
  const seen = new Set();
  for (const def of COSMETICS) {
    const key = cosmeticKey(def.kind, def.id);
    assert.ok(!seen.has(key), `duplicate cosmetic "${key}"`);
    seen.add(key);
    assert.ok(def.name && def.blurb, `${key}: incomplete`);
    assert.ok(['start', 'play', 'store', 'pass'].includes(def.source), `${key}: unknown source`);
    if (def.source === 'store') assert.ok(def.cost > 0, `${key}: for sale at no price`);
    if (def.source === 'play') assert.ok(def.need, `${key}: earned, but no condition`);
  }
  assert.ok(SKINS.length >= 5 && PONDS.length >= 5 && TITLES.length >= 5);
});

test('every skin names a palette the renderer actually has', () => {
  // The one way this table can lie: promise a look the renderer cannot draw.
  for (const skin of SKINS) {
    assert.ok(skinPaletteExists(skin.id), `skin "${skin.id}" has no palette`);
  }
});

test('every kind has a free default, and it is owned from the start', () => {
  const s = createState();
  for (const kind of COSMETIC_KINDS) {
    const def = kind.items.find((i) => i.id === kind.defaultId);
    assert.ok(def, `${kind.id}: default "${kind.defaultId}" is not in the table`);
    assert.equal(def.source, 'start', `${kind.id}: the default must be free`);
    assert.equal(owns(s, kind.id, kind.defaultId), true);
    assert.equal(equipped(s, kind.id), kind.defaultId);
  }
});

test('cosmetics change nothing about the simulation', () => {
  // This is the promise the word "cosmetic" makes, so it is worth an assertion
  // rather than a comment: same state, every look, identical numbers.
  const s = funded();
  s.buildings.lilypad = 100;
  s.combat.xp = 40000;

  const before = { zps: recomputeDerived(s).zps, power: combatStats(s).power };
  for (const def of COSMETICS) {
    grant(s, def.kind, def.id);
    equipCosmetic(s, def.kind, def.id);
    assert.equal(recomputeDerived(s).zps, before.zps, `${def.name} moved income`);
    assert.equal(combatStats(s).power, before.power, `${def.name} moved combat`);
  }
});

test('an earned cosmetic opens itself the moment its condition is met', () => {
  const s = createState();
  assert.equal(owns(s, 'skin', 'golden'), false);
  assert.deepEqual(checkUnlocks(s), [], 'nothing should open on a fresh save');

  s.stats.goldens = 50;
  const opened = checkUnlocks(s);
  assert.ok(opened.some((d) => d.id === 'golden'), 'Golden should have opened');
  assert.equal(owns(s, 'skin', 'golden'), true);

  assert.deepEqual(checkUnlocks(s), [], 'a second pass must not re-announce it');
});

test('every earned condition reads a counter that exists', () => {
  const s = createState();
  for (const def of COSMETICS) {
    if (def.source !== 'play') continue;
    assert.equal(meetsNeed(s, def.need), false, `${def.name} is already met on a fresh save`);
    // And it must become reachable: satisfy the counters and it opens.
    const rich = createState();
    rich.stats.goldens = 1e6;
    rich.stats.drops = 1e6;
    rich.stats.bestStars = 5;
    rich.rebirthCount = 1e6;
    rich.combat.bossKills = 1e6;
    rich.combat.bestDepth = 1e6;
    rich.login.total = 1e6;
    assert.equal(meetsNeed(rich, def.need), true, `${def.name} can never be earned`);
  }
});

test('a pass cosmetic cannot be bought, only earned by playing the season', () => {
  const s = createState();
  s.leafs = 1e9;
  assert.equal(buyCosmetic(s, 'skin', 'seasonal').reason, 'notForSale');
  assert.equal(owns(s, 'skin', 'seasonal'), false);
  assert.deepEqual(checkUnlocks(s), [], 'a pass look must not open itself');
});

test('a store cosmetic is bought once, and only with the leafs for it', () => {
  const s = createState();
  s.leafs = 100;
  assert.equal(buyCosmetic(s, 'skin', 'void').reason, 'leafs');
  assert.equal(s.leafs, 100);

  s.leafs = 1e6;
  const result = buyCosmetic(s, 'skin', 'void');
  assert.equal(result.ok, true);
  assert.equal(s.leafs, 1e6 - result.price);
  assert.equal(buyCosmetic(s, 'skin', 'void').reason, 'owned');
  assert.equal(buyCosmetic(s, 'skin', 'classic').reason, 'notForSale');
  assert.equal(buyCosmetic(s, 'skin', 'golden').reason, 'notForSale', 'an earned look is not for sale');
});

test('you can only wear what you own', () => {
  const s = createState();
  assert.equal(equipCosmetic(s, 'skin', 'void').reason, 'locked');
  assert.equal(equipped(s, 'skin'), 'classic');

  grant(s, 'skin', 'void');
  assert.equal(equipCosmetic(s, 'skin', 'void').ok, true);
  assert.equal(equipped(s, 'skin'), 'void');
  assert.equal(equipCosmetic(s, 'hairdo', 'x').reason, 'unknown');
});

test('a save naming a look you do not own falls back rather than breaking', () => {
  const s = reconcileState({ version: 2, cosmetics: { owned: [], skin: 'void', pond: 42, title: null } });
  assert.equal(equipped(s, 'skin'), 'classic', 'an unowned skin must not stick');
  assert.equal(s.cosmetics.pond, 'dusk', 'a non-string is repaired');
  assert.equal(s.cosmetics.title, 'bather');
  assert.deepEqual(s.cosmetics.owned, []);
});

test('the collection counter matches what is actually owned', () => {
  const s = createState();
  const start = collection(s, 'skin');
  assert.equal(start.total, SKINS.length);
  assert.equal(start.owned, SKINS.filter((x) => x.source === 'start').length);

  grant(s, 'skin', 'void');
  assert.equal(collection(s, 'skin').owned, start.owned + 1);
});

// --------------------------------------------------------------- persistence

test('a mangled economy block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 2,
    leafs: NaN,
    lifetimeLeafs: -20,
    cases: { reed: { opened: 'many', since: NaN }, broken: null },
    cosmetics: 'not an object',
    store: { leafDay: 42, packs: { armful: 'two' } },
  });

  assert.equal(s.leafs, 0);
  assert.equal(s.lifetimeLeafs, 0);
  assert.equal(s.cases.reed.opened, 0);
  assert.equal(s.cases.reed.since, 0);
  assert.equal(s.cases.broken.opened, 0);
  assert.deepEqual(s.cosmetics.owned, []);
  assert.equal(s.cosmetics.skin, 'classic');
  assert.equal(s.store.leafDay, null, 'a bad day key must not block the daily forever');
  assert.equal(s.store.packs.armful, 0);
  assert.equal(dailyLeafsReady(s), true);
});

test('the economy survives a reload with everything intact', () => {
  const s = funded(5000);
  claimDailyLeafs(s);
  openCase(s, 'reed', makeRng(3));
  buyBoost(s, 'coinRush');
  buyCosmetic(s, 'skin', 'midnight');
  equipCosmetic(s, 'skin', 'midnight');

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.leafs, s.leafs);
  assert.equal(reloaded.lifetimeLeafs, s.lifetimeLeafs);
  assert.equal(reloaded.cases.reed.opened, 1);
  assert.equal(reloaded.combat.inventory.length, 1);
  assert.ok(owns(reloaded, 'skin', 'midnight'));
  assert.equal(equipped(reloaded, 'skin'), 'midnight');
  assert.ok(activeBoost(reloaded, 'coinRush'), 'a running boost survives a reload');
});
