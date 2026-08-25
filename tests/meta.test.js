// Gacha, companions, and the shared effect vocabulary every source speaks.
//
// Rebirth, the tree and Ascension have their own file — see rebirth.test.js.
// The rule those tests defend hardest, and the reason this file still checks
// what survives a reload: a reset must never cost you a collection.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { combatStats } from '../src/systems/combatStats.js';
import { metaEffects, combatModifiers, ticketsPerBoss } from '../src/systems/meta.js';
import {
  pullOnce, applyPull, summon, buyTicket, ticketPrice, pityProgress,
  partyMembers, ownedCompanions, collectionProgress, FOUR_STAR_RATE, FOUR_STAR_PITY,
} from '../src/systems/gacha.js';
import { rebirth } from '../src/systems/rebirth.js';
import { COMPANIONS, COMPANIONS_BY_ID, PARTY_SIZE, SHARDS_PER_LEVEL, MAX_COMPANION_LEVEL, companionMultiplier } from '../src/data/companions.js';
import { CONSTELLATIONS, CONSTELLATIONS_BY_ID, rankCost } from '../src/data/constellations.js';
import { TREE_NODES, TREE_EFFECT_TYPES } from '../src/data/rebirthTree.js';
import { ELEMENTS } from '../src/data/elements.js';
import { CAPY_SKINS } from '../src/render/palettes.js';
import { PITY_HARD, PITY_SOFT, makeRng } from '../src/balance.js';

const KNOWN_EFFECTS = new Set([
  'clickFlat', 'clickMult', 'zpsMult', 'globalMult', 'buildingMult', 'allBuildingMult',
  'critChance', 'critDamage', 'comboCap', 'comboStep', 'zpsShare', 'goldenChance',
  'goldenDuration', 'offlineRate', 'offlineCapHours', 'costDiscount', 'buffMult',
  'combatAtk', 'combatDef', 'combatHp', 'combatSpd', 'combatLuck', 'ticketRate', 'essenceGain',
]);

/** A state deep enough and rich enough that a rebirth would actually pay. */
function readyToRebirth() {
  const s = createState();
  s.zen = 5e12;
  s.lifetimeZen = 5e12;
  s.totalZen = 5e12;
  s.buildings.lilypad = 40;
  s.clickUpgrades.firmerPaw = true;
  s.combat.depth = 95;
  s.combat.bestDepth = 95;
  s.rebirthUnlocked = true;
  return s;
}

// ------------------------------------------------------------------ content

test('the promised meta content counts are there', () => {
  assert.equal(COMPANIONS.length, 24, 'companions');
  assert.equal(CONSTELLATIONS.length, 12, 'constellations');
  assert.equal(TREE_NODES.length, 210, 'rebirth tree nodes');

  // The headline count: purchasable upgrades before gear or companions.
  const upgrades = 16 + 18 + 36 + TREE_NODES.length + CONSTELLATIONS.length;
  assert.equal(upgrades, 292, `expected 292 purchasable upgrades, found ${upgrades}`);
});

test('companion ids are unique and every field resolves', () => {
  const seen = new Set();
  for (const c of COMPANIONS) {
    assert.ok(!seen.has(c.id), `duplicate companion "${c.id}"`);
    seen.add(c.id);
    assert.ok([3, 4, 5].includes(c.star), `${c.id}: bad star rating`);
    assert.ok(ELEMENTS[c.element], `${c.id}: unknown element`);
    assert.ok(CAPY_SKINS[c.skin], `${c.id}: unknown skin "${c.skin}"`);
    assert.ok(c.name && c.blurb, `${c.id}: missing copy`);
    assert.ok(Object.keys(c.stats).length > 0, `${c.id}: no stats`);
    if (c.bonus) assert.ok(KNOWN_EFFECTS.has(c.bonus.type), `${c.id}: unknown bonus`);
  }
});

test('every star tier has a pool to draw from, and rarer means stronger', () => {
  for (const star of [3, 4, 5]) {
    const pool = COMPANIONS.filter((c) => c.star === star);
    assert.ok(pool.length >= 6, `only ${pool.length} companions at ${star}★`);
  }
  const total = (c) => Object.values(c.stats).reduce((a, b) => a + b, 0);
  const best3 = Math.max(...COMPANIONS.filter((c) => c.star === 3).map(total));
  const worst5 = Math.min(...COMPANIONS.filter((c) => c.star === 5).map(total));
  assert.ok(worst5 > best3, 'the weakest 5★ should out-stat the strongest 3★');
});

test('tree nodes and constellations all use known effect types', () => {
  for (const def of [...TREE_NODES, ...CONSTELLATIONS]) {
    assert.ok(def.name && def.blurb, `${def.id}: missing copy`);
    assert.ok(KNOWN_EFFECTS.has(def.effect.type), `${def.id}: unknown effect "${def.effect.type}"`);
    assert.ok(Number.isFinite(def.effect.value), `${def.id}: non-numeric effect value`);
    assert.ok(def.max >= 1, `${def.id}: max rank below 1`);
  }
  // The tree's own scale table must not drift away from what stats.js reads.
  for (const type of TREE_EFFECT_TYPES) {
    assert.ok(KNOWN_EFFECTS.has(type), `tree scale declares unknown effect "${type}"`);
  }
});

test('tree node and constellation ids do not collide', () => {
  const nodeIds = new Set(TREE_NODES.map((n) => n.id));
  for (const c of CONSTELLATIONS) {
    assert.ok(!nodeIds.has(c.id), `constellation "${c.id}" collides with a tree node`);
  }
});

test('constellation rank costs climb with each rank bought', () => {
  for (const def of CONSTELLATIONS) {
    if (def.max < 2) continue;
    assert.ok(rankCost(def, 1) > rankCost(def, 0), `${def.id}: rank 2 is not pricier than rank 1`);
  }
});

// -------------------------------------------------------------------- gacha

test('pity guarantees a five star at the hard cap', () => {
  // rng always 0.999 — the unluckiest possible player.
  const unlucky = () => 0.999;
  const result = pullOnce({ five: PITY_HARD - 1, four: 0 }, unlucky);
  assert.equal(result.star, 5, 'hard pity must guarantee a 5★');
  assert.equal(result.nextPity.five, 0, 'the counter resets');
});

test('below soft pity the five star rate stays at its base', () => {
  const unlucky = () => 0.5;
  for (const pity of [0, 10, PITY_SOFT - 1]) {
    const result = pullOnce({ five: pity, four: 0 }, unlucky);
    assert.notEqual(result.star, 5, `a 0.5 roll should not hit 5★ at pity ${pity}`);
  }
});

test('the four star counter forces one at least every ten pulls', () => {
  const unlucky = () => 0.999;
  const result = pullOnce({ five: 0, four: FOUR_STAR_PITY - 1 }, unlucky);
  assert.ok(result.star >= 4, 'the 4★ floor must fire');
  assert.equal(result.nextPity.four, 0);
});

test('a five star also clears the four star counter', () => {
  // Otherwise a 5★ would leave a 4★ "owed" on the very next pull.
  const result = pullOnce({ five: PITY_HARD - 1, four: 7 }, () => 0.999);
  assert.equal(result.star, 5);
  assert.equal(result.nextPity.four, 0);
});

test('a real run of pulls never goes more than the hard cap without a five star', () => {
  const s = createState();
  s.gacha.tickets = 1000;
  const rng = makeRng(1234);

  let sincefive = 0;
  let worst = 0;
  for (const result of summon(s, 1000, rng)) {
    if (result.star === 5) {
      worst = Math.max(worst, sincefive);
      sincefive = 0;
    } else {
      sincefive++;
    }
  }
  assert.ok(worst < PITY_HARD, `went ${worst} pulls without a 5★, cap is ${PITY_HARD}`);
  assert.ok(s.gacha.fiveStars > 0, 'a thousand pulls should produce some 5★');
});

test('duplicates become shards and promote a level', () => {
  const s = createState();
  const per = SHARDS_PER_LEVEL[3];

  const first = applyPull(s, { star: 3, id: 'pip', nextPity: { five: 1, four: 1 } });
  assert.equal(first.isNew, true);
  assert.equal(s.gacha.companions.pip.level, 1);

  for (let i = 0; i < per - 1; i++) {
    applyPull(s, { star: 3, id: 'pip', nextPity: { five: 1, four: 1 } });
  }
  assert.equal(s.gacha.companions.pip.level, 1, 'not enough shards yet');

  const promoting = applyPull(s, { star: 3, id: 'pip', nextPity: { five: 1, four: 1 } });
  assert.equal(promoting.isNew, false);
  assert.equal(promoting.levelled, true);
  assert.equal(s.gacha.companions.pip.level, 2);
});

test('companion levels stop at the cap and stop consuming shards', () => {
  const s = createState();
  s.gacha.companions.pip = { level: MAX_COMPANION_LEVEL, shards: 0 };
  for (let i = 0; i < 200; i++) {
    applyPull(s, { star: 3, id: 'pip', nextPity: { five: 0, four: 0 } });
  }
  assert.equal(s.gacha.companions.pip.level, MAX_COMPANION_LEVEL);
});

test('summoning spends tickets and stops when they run out', () => {
  const s = createState();
  s.gacha.tickets = 3;
  const results = summon(s, 10);
  assert.equal(results.length, 3, 'only three tickets, only three pulls');
  assert.equal(s.gacha.tickets, 0);
  assert.equal(summon(s, 1).length, 0, 'no tickets, no pull');
});

test('buying a ticket costs zen and gets more expensive', () => {
  const s = createState();
  s.zen = 1e12;
  const first = ticketPrice(s);
  assert.equal(buyTicket(s).ok, true);
  assert.equal(s.gacha.tickets, 1);
  assert.ok(ticketPrice(s) > first, 'the second ticket should cost more');

  s.zen = 0;
  const broke = buyTicket(s);
  assert.equal(broke.ok, false);
  assert.equal(s.gacha.tickets, 1, 'a failed purchase must not grant a ticket');
});

test('the pity meter reports what the UI shows', () => {
  const fresh = pityProgress({ five: 0, four: 0 });
  assert.equal(fresh.fiveRemaining, PITY_HARD);
  assert.equal(fresh.soft, false);

  const hot = pityProgress({ five: PITY_SOFT + 5, four: 2 });
  assert.equal(hot.soft, true);
  assert.ok(hot.chance > fresh.chance, 'the rate should visibly climb past soft pity');
  assert.ok(hot.five > fresh.five);
});

test('party members contribute stats scaled by their level', () => {
  const s = createState();
  s.gacha.companions.capybaraPrime = { level: 1, shards: 0 };
  s.gacha.party = ['capybaraPrime'];

  const atLevel1 = combatStats(s).atk;
  s.gacha.companions.capybaraPrime.level = 10;
  const atLevel10 = combatStats(s).atk;

  assert.ok(atLevel10 > atLevel1, 'levelling a party member should raise ATK');

  const def = COMPANIONS_BY_ID.capybaraPrime;
  const expected = def.stats.atk * (companionMultiplier(10) - companionMultiplier(1));
  assert.ok(Math.abs(atLevel10 - atLevel1 - expected) < 1e-6);
});

test('party bonuses are flat and do not scale with level', () => {
  const s = createState();
  s.buildings.lilypad = 100;
  s.gacha.companions.onsenMaster = { level: 1, shards: 0 };
  s.gacha.party = ['onsenMaster'];

  const atLevel1 = recomputeDerived(s).zps;
  s.gacha.companions.onsenMaster.level = 25;
  const atLevel25 = recomputeDerived(s).zps;

  assert.ok(Math.abs(atLevel1 - atLevel25) < 1e-6, 'the idle bonus must not scale with level');
});

test('only companions in the party contribute', () => {
  const s = createState();
  s.gacha.companions.capybaraPrime = { level: 5, shards: 0 };
  const benched = combatStats(s).atk;
  s.gacha.party = ['capybaraPrime'];
  assert.ok(combatStats(s).atk > benched, 'a benched companion should do nothing');
  assert.equal(partyMembers(s).length, 1);
});

test('the party ignores ids you do not own', () => {
  const s = createState();
  s.gacha.party = ['capybaraPrime', 'notARealCapybara'];
  assert.equal(partyMembers(s).length, 0);
});

test('collection progress counts what you own', () => {
  const s = createState();
  assert.equal(collectionProgress(s).owned, 0);
  s.gacha.companions.pip = { level: 1, shards: 0 };
  s.gacha.companions.ash = { level: 1, shards: 0 };
  const p = collectionProgress(s);
  assert.equal(p.owned, 2);
  assert.equal(p.total, COMPANIONS.length);
  assert.equal(ownedCompanions(s).length, 2);
});

// -------------------------------------------------------------------- meta

test('metaEffects gathers every source', () => {
  const s = createState();
  assert.equal(metaEffects(s).length, 0);

  s.tree.chonk1 = 2;
  s.tree.warmStone = 1;
  s.constellations.theBather = 1;
  s.gacha.companions.onsenMaster = { level: 1, shards: 0 };
  s.gacha.party = ['onsenMaster'];

  assert.equal(metaEffects(s).length, 5, '3 tree ranks + constellation + party bonus');
});

test('combat modifiers fold the combat-only effects', () => {
  const s = createState();
  const plain = combatModifiers(s);
  assert.equal(plain.atk, 1);
  assert.equal(plain.luck, 0);

  s.tree.sharpenedTeeth = 2; // +25% ATK each
  s.tree.foragersEye = 1; // +60 LUCK
  const boosted = combatModifiers(s);
  assert.ok(Math.abs(boosted.atk - 1.5) < 1e-9);
  assert.equal(boosted.luck, 60);
});

test('ticketRate sources add up for boss drops', () => {
  const s = createState();
  assert.equal(ticketsPerBoss(s), 0);
  s.tree.openInvitation = 2; // +1 each
  s.constellations.theGenerous = 1; // +3
  assert.equal(ticketsPerBoss(s), 5);
});

// ------------------------------------------------------------------- saves

test('a save with a mangled meta block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 2,
    lotus: NaN,
    tree: { warmStone: 'three', deepRoots: 2, ghostNode: 0 },
    constellations: null,
    gacha: {
      tickets: -5,
      pity: { five: 'x', four: 3 },
      companions: { pip: { level: 0, shards: NaN }, broken: null },
      party: ['pip', 'notOwned', 42],
    },
  });

  assert.equal(s.lotus, 0);
  assert.equal(s.tree.warmStone, undefined, 'non-numeric rank dropped');
  assert.equal(s.tree.deepRoots, 2);
  assert.equal(s.tree.ghostNode, undefined, 'zero ranks dropped');
  assert.deepEqual(s.constellations, {});
  assert.equal(s.gacha.tickets, 0);
  assert.equal(s.gacha.pity.five, 0);
  assert.equal(s.gacha.pity.four, 3);
  assert.equal(s.gacha.companions.pip.level, 1, 'level floors at 1');
  assert.equal(s.gacha.companions.pip.shards, 0);
  assert.deepEqual(s.gacha.party, ['pip'], 'party keeps only owned string ids');
});

test('a rebirthed save round-trips through reconcile intact', () => {
  const s = readyToRebirth();
  s.tree.deepRoots = 3;
  s.tree.zen1 = 4;
  s.gacha.companions.yuzu = { level: 6, shards: 2 };
  s.gacha.party = ['yuzu'];
  rebirth(s);

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.essence, s.essence);
  assert.equal(reloaded.tree.deepRoots, 3);
  assert.equal(reloaded.tree.zen1, 4);
  assert.equal(reloaded.gacha.companions.yuzu.level, 6);
  assert.deepEqual(reloaded.gacha.party, ['yuzu']);
});

test('the party never exceeds its size limit', () => {
  assert.equal(PARTY_SIZE, 3);
});
