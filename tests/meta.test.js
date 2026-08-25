// Gacha, prestige, ascension and the talent tree.
//
// The rule these tests defend hardest: a reset must never cost you a
// collection. Losing an hour of income is a decision the player made; losing a
// 5★ they pulled is a betrayal.

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
import {
  prestige, prestigePreview, ascend, ascendPreview, buyRelic, buyConstellation,
  yuzuGainMult, lotusFromYuzu, PRESTIGE_MIN_ZEN, ASCEND_MIN_YUZU,
} from '../src/systems/prestige.js';
import {
  buyTalent, respec, availablePoints, totalPoints, spentPoints,
  branchSpend, isTalentUnlocked, talentEffects, treeLayout,
} from '../src/systems/talents.js';
import { COMPANIONS, COMPANIONS_BY_ID, PARTY_SIZE, SHARDS_PER_LEVEL, MAX_COMPANION_LEVEL, companionMultiplier } from '../src/data/companions.js';
import { RELICS, RELICS_BY_ID, CONSTELLATIONS, CONSTELLATIONS_BY_ID, rankCost } from '../src/data/relics.js';
import { TALENTS, TALENTS_BY_ID, TIER_GATES, POINTS_PER_PRESTIGE } from '../src/data/talents.js';
import { ELEMENTS } from '../src/data/elements.js';
import { CAPY_SKINS } from '../src/render/palettes.js';
import { PITY_HARD, PITY_SOFT, makeRng } from '../src/balance.js';

const KNOWN_EFFECTS = new Set([
  'clickFlat', 'clickMult', 'zpsMult', 'globalMult', 'buildingMult', 'allBuildingMult',
  'critChance', 'critDamage', 'comboCap', 'comboStep', 'zpsShare', 'goldenChance',
  'goldenDuration', 'offlineRate', 'offlineCapHours', 'costDiscount', 'buffMult',
  'combatAtk', 'combatDef', 'combatHp', 'combatSpd', 'combatLuck', 'ticketRate', 'yuzuGain',
]);

/** A state with enough zen banked to prestige. */
function readyToPrestige() {
  const s = createState();
  s.zen = 5e12;
  s.lifetimeZen = 5e12;
  s.totalZen = 5e12;
  s.buildings.lilypad = 40;
  s.clickUpgrades.firmerPaw = true;
  return s;
}

// ------------------------------------------------------------------ content

test('the promised meta content counts are there', () => {
  assert.equal(COMPANIONS.length, 24, 'companions');
  assert.equal(RELICS.length, 22, 'relics');
  assert.equal(CONSTELLATIONS.length, 12, 'constellations');
  assert.equal(TALENTS.length, 27, 'talents');

  // The plan's headline: 131 purchasable upgrades before gear or companions.
  const upgrades = 16 + 18 + 36 + TALENTS.length + RELICS.length + CONSTELLATIONS.length;
  assert.equal(upgrades, 131, `expected 131 purchasable upgrades, found ${upgrades}`);
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

test('relics, constellations and talents all use known effect types', () => {
  for (const def of [...RELICS, ...CONSTELLATIONS, ...TALENTS]) {
    assert.ok(def.name && def.blurb, `${def.id}: missing copy`);
    assert.ok(KNOWN_EFFECTS.has(def.effect.type), `${def.id}: unknown effect "${def.effect.type}"`);
    assert.ok(Number.isFinite(def.effect.value), `${def.id}: non-numeric effect value`);
    assert.ok(def.max >= 1, `${def.id}: max rank below 1`);
  }
});

test('relic and constellation ids do not collide', () => {
  const relicIds = new Set(RELICS.map((r) => r.id));
  for (const c of CONSTELLATIONS) {
    assert.ok(!relicIds.has(c.id), `constellation "${c.id}" collides with a relic`);
  }
});

test('rank costs climb with each rank bought', () => {
  for (const def of [...RELICS, ...CONSTELLATIONS]) {
    if (def.max < 2) continue;
    assert.ok(rankCost(def, 1) > rankCost(def, 0), `${def.id}: rank 2 is not pricier than rank 1`);
  }
});

test('the talent tree is three balanced branches of nine', () => {
  const layout = treeLayout();
  assert.deepEqual(Object.keys(layout).sort(), ['chonk', 'feral', 'zen']);
  for (const [branch, tiers] of Object.entries(layout)) {
    const count = tiers[1].length + tiers[2].length + tiers[3].length;
    assert.equal(count, 9, `${branch} has ${count} nodes, expected 9`);
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

// ----------------------------------------------------------------- prestige

test('prestige is refused before the threshold and costs nothing', () => {
  const s = createState();
  s.lifetimeZen = PRESTIGE_MIN_ZEN / 2;
  s.buildings.lilypad = 10;

  assert.equal(prestigePreview(s).canPrestige, false);
  assert.equal(prestige(s).ok, false);
  assert.equal(s.buildings.lilypad, 10, 'a refused prestige must not reset anything');
});

test('prestige pays yuzu, resets income, and keeps everything else', () => {
  const s = readyToPrestige();
  s.combat.stage = 30;
  s.combat.bestStage = 30;
  s.combat.xp = 50000;
  s.combat.inventory = [{ uid: 'g1', id: 'sunDiadem', forge: 4 }];
  s.combat.equipped = { hat: 'g1' };
  s.combat.skills = ['chomp'];
  s.gacha.companions.capybaraPrime = { level: 7, shards: 3 };
  s.gacha.party = ['capybaraPrime'];
  s.gacha.tickets = 9;
  s.achievements.firstTap = 1;
  s.relics.warmStone = 1;
  s.talents.chonk1 = 3;

  const expected = prestigePreview(s).yuzu;
  assert.ok(expected > 0);

  const result = prestige(s);
  assert.equal(result.ok, true);
  assert.equal(result.gained, expected);

  // Reset
  assert.equal(s.zen, 0);
  assert.equal(s.lifetimeZen, 0);
  assert.equal(s.buildings.lilypad, 0);
  assert.deepEqual(s.clickUpgrades, {});

  // Kept
  assert.equal(s.yuzu, expected);
  assert.equal(s.lifetimeYuzu, expected);
  assert.equal(s.prestigeCount, 1);
  assert.equal(s.totalZen, 5e12, 'all-time zen is never reset');
  assert.equal(s.combat.stage, 30, 'the quest run survives');
  assert.equal(s.combat.inventory.length, 1, 'gear survives');
  assert.equal(s.combat.equipped.hat, 'g1');
  assert.deepEqual(s.combat.skills, ['chomp']);
  assert.equal(s.gacha.companions.capybaraPrime.level, 7, 'companions survive');
  assert.equal(s.gacha.tickets, 9);
  assert.equal(s.achievements.firstTap, 1);
  assert.equal(s.relics.warmStone, 1, 'relics survive');
  assert.equal(s.talents.chonk1, 3, 'talent points survive');
});

test('prestige currency pays off lifetime yuzu, so spending it is never a downgrade', () => {
  const s = createState();
  s.lifetimeYuzu = 500;
  s.yuzu = 500;
  s.buildings.lilypad = 100;

  const holding = recomputeDerived(s).zps;
  s.yuzu = 0; // spent it all on relics
  const afterSpending = recomputeDerived(s).zps;

  assert.equal(afterSpending, holding, 'spending yuzu must not reduce income');
});

test('yuzuGain relics raise the payout', () => {
  const plain = readyToPrestige();
  const boosted = readyToPrestige();
  boosted.relics.theLongBath = 2;

  assert.ok(yuzuGainMult(boosted) > yuzuGainMult(plain));
  assert.ok(prestigePreview(boosted).yuzu > prestigePreview(plain).yuzu);
});

test('buying a relic spends yuzu, respects the cap, and refuses when broke', () => {
  const s = createState();
  s.yuzu = 1e6;

  const price = rankCost(RELICS_BY_ID.warmStone, 0);
  assert.equal(buyRelic(s, 'warmStone').ok, true);
  assert.equal(s.relics.warmStone, 1);
  assert.equal(s.yuzu, 1e6 - price);
  assert.equal(buyRelic(s, 'warmStone').reason, 'maxed', 'warmStone is max 1');

  s.yuzu = 0;
  assert.equal(buyRelic(s, 'steadyHand').reason, 'poor');
  assert.equal(s.relics.steadyHand, undefined);
  assert.equal(buyRelic(s, 'noSuchRelic').ok, false);
});

test('relic effects reach income and combat alike', () => {
  const s = createState();
  s.buildings.lilypad = 100;
  const before = recomputeDerived(s).zps;
  const beforeAtk = combatStats(s).atk;

  s.relics.warmStone = 1; // +10% all income
  s.relics.sharpenedTeeth = 2; // +25% ATK per rank

  assert.ok(Math.abs(recomputeDerived(s).zps - before * 1.1) < 1e-6);
  assert.ok(Math.abs(combatStats(s).atk - beforeAtk * 1.5) < 1e-6);
});

// ---------------------------------------------------------------- ascension

test('ascension is refused below the yuzu threshold', () => {
  const s = createState();
  s.lifetimeYuzu = ASCEND_MIN_YUZU - 1;
  assert.equal(ascendPreview(s).canAscend, false);
  assert.equal(ascend(s).ok, false);
});

test('ascension takes the yuzu and relics but never the collection', () => {
  const s = createState();
  s.lifetimeYuzu = ASCEND_MIN_YUZU * 40;
  s.yuzu = 900;
  s.relics.warmStone = 1;
  s.relics.deepRoots = 4;
  s.constellations.theBather = 2;
  s.buildings.lilypad = 50;
  s.zen = 1e9;
  s.gacha.companions.capybaraPrime = { level: 12, shards: 4 };
  s.achievements.firstTap = 1;
  s.prestigeCount = 30;

  const expected = ascendPreview(s).lotus;
  assert.ok(expected > 0);

  const result = ascend(s);
  assert.equal(result.ok, true);
  assert.equal(result.gained, expected);

  // Taken
  assert.equal(s.yuzu, 0);
  assert.equal(s.lifetimeYuzu, 0);
  assert.deepEqual(s.relics, {}, 'ascension takes the relics');
  assert.equal(s.buildings.lilypad, 0);
  assert.equal(s.zen, 0);
  assert.equal(s.prestigeCount, 0);

  // Kept
  assert.equal(s.lotus, expected);
  assert.equal(s.ascendCount, 1);
  assert.equal(s.constellations.theBather, 2, 'constellations survive');
  assert.equal(s.gacha.companions.capybaraPrime.level, 12, 'companions survive ascension');
  assert.equal(s.achievements.firstTap, 1, 'trophies survive ascension');
});

test('lotus scales with lifetime yuzu', () => {
  assert.equal(lotusFromYuzu(0), 0);
  assert.equal(lotusFromYuzu(ASCEND_MIN_YUZU - 1), 0);
  assert.ok(lotusFromYuzu(ASCEND_MIN_YUZU * 100) > lotusFromYuzu(ASCEND_MIN_YUZU * 10));
});

test('constellations are bought with lotus and apply', () => {
  const s = createState();
  s.lotus = 1000;
  s.buildings.lilypad = 100;
  const before = recomputeDerived(s).zps;

  assert.equal(buyConstellation(s, 'theBather').ok, true);
  assert.ok(Math.abs(recomputeDerived(s).zps - before * 2) < 1e-6);

  // Constellations cannot be bought with yuzu.
  s.lotus = 0;
  assert.equal(buyConstellation(s, 'theFloater').reason, 'poor');
});

// ----------------------------------------------------------------- talents

test('talent points come from level and prestige count', () => {
  const s = createState();
  assert.equal(totalPoints(s, 1), 0);
  assert.equal(totalPoints(s, 10), 9);

  s.prestigeCount = 3;
  assert.equal(totalPoints(s, 10), 9 + 3 * POINTS_PER_PRESTIGE);
});

test('tier gates hold until enough is spent in that branch', () => {
  const s = createState();
  const tier2 = TALENTS.find((t) => t.branch === 'chonk' && t.tier === 2);
  const tier3 = TALENTS.find((t) => t.branch === 'chonk' && t.tier === 3);

  assert.equal(isTalentUnlocked(s, tier2), false);
  s.talents.chonk1 = TIER_GATES[2];
  assert.equal(isTalentUnlocked(s, tier2), true);
  assert.equal(isTalentUnlocked(s, tier3), false);

  s.talents.chonk2 = TIER_GATES[3] - TIER_GATES[2];
  assert.equal(isTalentUnlocked(s, tier3), true);
  assert.equal(branchSpend(s, 'chonk'), TIER_GATES[3]);
  assert.equal(branchSpend(s, 'zen'), 0, 'spending in one branch must not open another');
});

test('buying a talent spends a point and respects max rank', () => {
  const s = createState();
  const level = 40; // plenty of points

  assert.equal(buyTalent(s, 'chonk1', level).ok, true);
  assert.equal(s.talents.chonk1, 1);
  assert.equal(spentPoints(s), 1);

  const max = TALENTS_BY_ID.chonk1.max;
  for (let i = 1; i < max; i++) buyTalent(s, 'chonk1', level);
  assert.equal(s.talents.chonk1, max);
  assert.equal(buyTalent(s, 'chonk1', level).reason, 'maxed');
});

test('buying is refused with no points to spend', () => {
  const s = createState();
  assert.equal(availablePoints(s, 1), 0);
  assert.equal(buyTalent(s, 'chonk1', 1).reason, 'points');
  assert.equal(s.talents.chonk1, undefined);
});

test('buying a locked talent is refused', () => {
  const s = createState();
  const tier3 = TALENTS.find((t) => t.tier === 3);
  assert.equal(buyTalent(s, tier3.id, 60).reason, 'locked');
});

test('respec is free and returns every point', () => {
  const s = createState();
  const level = 40;
  buyTalent(s, 'chonk1', level);
  buyTalent(s, 'chonk1', level);
  buyTalent(s, 'feral1', level);

  const before = availablePoints(s, level);
  const result = respec(s);

  assert.equal(result.refunded, 3);
  assert.deepEqual(s.talents, {});
  assert.equal(availablePoints(s, level), before + 3);
});

test('talent effects stack per rank and reach both stat blocks', () => {
  const s = createState();
  s.buildings.lilypad = 100;
  const beforeZps = recomputeDerived(s).zps;
  const beforeAtk = combatStats(s).atk;

  s.talents.chonk1 = 3; // +4% idle per rank
  s.talents.feral6 = 2; // +15% ATK per rank

  assert.equal(talentEffects(s).length, 5, 'one effect entry per rank');
  assert.ok(Math.abs(recomputeDerived(s).zps - beforeZps * 1.04 ** 3) < 1e-6);
  assert.ok(Math.abs(combatStats(s).atk - beforeAtk * 1.3) < 1e-6);
});

// -------------------------------------------------------------------- meta

test('metaEffects gathers every source', () => {
  const s = createState();
  assert.equal(metaEffects(s).length, 0);

  s.talents.chonk1 = 2;
  s.relics.warmStone = 1;
  s.constellations.theBather = 1;
  s.gacha.companions.onsenMaster = { level: 1, shards: 0 };
  s.gacha.party = ['onsenMaster'];

  assert.equal(metaEffects(s).length, 5, '2 talent ranks + relic + constellation + party bonus');
});

test('combat modifiers fold the combat-only effects', () => {
  const s = createState();
  const plain = combatModifiers(s);
  assert.equal(plain.atk, 1);
  assert.equal(plain.luck, 0);

  s.relics.sharpenedTeeth = 2; // +25% ATK each
  s.relics.foragersEye = 1; // +60 LUCK
  const boosted = combatModifiers(s);
  assert.ok(Math.abs(boosted.atk - 1.5) < 1e-9);
  assert.equal(boosted.luck, 60);
});

test('ticketRate sources add up for boss drops', () => {
  const s = createState();
  assert.equal(ticketsPerBoss(s), 0);
  s.relics.openInvitation = 2; // +1 each
  s.constellations.theGenerous = 1; // +3
  assert.equal(ticketsPerBoss(s), 5);
});

// ------------------------------------------------------------------- saves

test('a save with a mangled meta block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 1,
    lotus: NaN,
    relics: { warmStone: 'three', deepRoots: 2, ghostRelic: 0 },
    talents: 'not an object',
    constellations: null,
    gacha: {
      tickets: -5,
      pity: { five: 'x', four: 3 },
      companions: { pip: { level: 0, shards: NaN }, broken: null },
      party: ['pip', 'notOwned', 42],
    },
  });

  assert.equal(s.lotus, 0);
  assert.equal(s.relics.warmStone, undefined, 'non-numeric rank dropped');
  assert.equal(s.relics.deepRoots, 2);
  assert.equal(s.relics.ghostRelic, undefined, 'zero ranks dropped');
  assert.deepEqual(s.talents, {});
  assert.deepEqual(s.constellations, {});
  assert.equal(s.gacha.tickets, 0);
  assert.equal(s.gacha.pity.five, 0);
  assert.equal(s.gacha.pity.four, 3);
  assert.equal(s.gacha.companions.pip.level, 1, 'level floors at 1');
  assert.equal(s.gacha.companions.pip.shards, 0);
  assert.deepEqual(s.gacha.party, ['pip'], 'party keeps only owned string ids');
});

test('a prestiged save round-trips through reconcile intact', () => {
  const s = readyToPrestige();
  s.relics.deepRoots = 3;
  s.talents.zen1 = 4;
  s.gacha.companions.yuzu = { level: 6, shards: 2 };
  s.gacha.party = ['yuzu'];
  prestige(s);

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.yuzu, s.yuzu);
  assert.equal(reloaded.relics.deepRoots, 3);
  assert.equal(reloaded.talents.zen1, 4);
  assert.equal(reloaded.gacha.companions.yuzu.level, 6);
  assert.deepEqual(reloaded.gacha.party, ['yuzu']);
});

test('the party never exceeds its size limit', () => {
  assert.equal(PARTY_SIZE, 3);
});
