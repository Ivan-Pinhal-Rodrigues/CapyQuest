// The 20-rung rarity ladder, stars, refine and fuse.
//
// The change these tests defend: rarity used to belong to the *definition* — a
// Straw Hat was common and could never be anything else — and now it belongs to
// the *instance*. That means two things have to hold at once. A piece must be
// worth exactly what its rung says regardless of which piece it is, so no
// hand-authored stat block quietly becomes the only viable one at the top. And
// a save written before any of this existed has to load with its gear exactly
// as strong as it was, because the alternative is silently rewriting what
// somebody already owns.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import * as R from '../src/data/rarities.js';
import { GEAR, GEAR_BY_ID, SLOT_IDS, statsFor, gearScore } from '../src/data/gear.js';
import { resolveItem, equippedItems } from '../src/systems/equipment.js';
import { combatStats } from '../src/systems/combatStats.js';
import {
  addToInventory, equip, scrap, forge, forgePrice, rollLoot, rollStars, leafDrop,
  refine, refinePrice, canRefine, fuse, canFuse, fuseFodder, fuseAll, previewFuseAll, tierCeiling, MAX_FORGE,
} from '../src/systems/loot.js';
import { makeRng } from '../src/balance.js';

/** A state with enough of everything that only the rule under test can fail. */
function rich() {
  const s = createState();
  s.combat.shards = 1e12;
  s.leafs = 1e6;
  return s;
}

function maxForge(s, uid) {
  const entry = s.combat.inventory.find((i) => i.uid === uid);
  entry.forge = MAX_FORGE;
  return entry;
}

// ------------------------------------------------------------------ the ladder

test('there are twenty rungs, named and coloured, in ascending order', () => {
  assert.equal(R.RARITIES.length, 20);
  assert.equal(R.MAX_TIER, 19);

  const names = new Set();
  R.RARITIES.forEach((r, i) => {
    assert.equal(r.tier, i, `rung ${i} is mislabelled`);
    assert.ok(!names.has(r.name), `duplicate rung name "${r.name}"`);
    names.add(r.name);
    assert.match(r.color, /^#[0-9a-f]{6}$/i, `${r.name}: not a colour`);
    assert.ok(r.glow, `${r.name}: no glow`);
  });

  assert.equal(R.RARITIES[0].name, 'Worn');
  assert.equal(R.RARITIES[19].name, 'Capybaric');
});

test('a bad rung or star count clamps rather than producing NaN', () => {
  for (const bad of [undefined, null, NaN, -4, 999, 'seven']) {
    assert.ok(R.RARITIES.includes(R.rarityFor(bad)), `rarityFor(${bad}) fell off the table`);
    assert.ok(Number.isFinite(R.budget(bad)), `budget(${bad}) is not a number`);
    assert.ok(Number.isFinite(R.starMult(bad)), `starMult(${bad}) is not a number`);
  }
  assert.equal(R.clampTier(-1), 0);
  assert.equal(R.clampTier(50), 19);
  assert.equal(R.clampStars(0), 1);
  assert.equal(R.clampStars(9), 5);
});

test('each rung is worth more than the one below, all the way up', () => {
  for (let tier = 1; tier <= R.MAX_TIER; tier++) {
    assert.ok(R.budget(tier) > R.budget(tier - 1), `rung ${tier} is not richer than ${tier - 1}`);
  }
  // Worn 1★ to Capybaric 5★. Strong enough to chase for a long time, not so
  // strong that one lucky fuse ends the game.
  const span = (R.budget(19) * R.starMult(5)) / R.budget(0);
  assert.ok(span > 500 && span < 8000, `ladder spans ×${Math.round(span)}`);
});

test('stars are worth a fixed step each, and five is the ceiling', () => {
  assert.equal(R.starMult(1), 1);
  assert.equal(R.MAX_STARS, 5);
  for (let s = 2; s <= 5; s++) {
    assert.ok(Math.abs(R.starMult(s) - R.starMult(s - 1) - R.STAR_STEP) < 1e-9);
  }
  assert.equal(R.starMult(6), R.starMult(5), 'a sixth star must not exist');
});

test('a 20/5★ beats a 19/5★ beats a 20/1★', () => {
  const def = GEAR_BY_ID.stickRod;
  const score = (tier, stars) => gearScore(statsFor(def, { tier, stars }));
  assert.ok(score(19, 5) > score(18, 5), 'the top rung must beat the one below at equal stars');
  assert.ok(score(18, 5) > score(19, 1), 'five stars must be worth more than a single rung');
});

// ---------------------------------------------------------- rate stats

test('crit and crit damage grow gently, because the game clamps them anyway', () => {
  const def = GEAR_BY_ID.moonMirror; // crit-shaped
  const low = statsFor(def, { tier: 0, stars: 1 });
  const high = statsFor(def, { tier: 19, stars: 5 });

  assert.ok(high.crit > low.crit, 'a crit piece should still gain crit as it climbs');
  assert.ok(high.crit < 1, `crit reached ${high.crit} — it would be wasted budget`);
  // The linear stats carry the exponential; the rates ride a much flatter curve.
  assert.ok(high.luck / low.luck > 100, 'the linear share must carry the ladder');
  assert.ok(high.crit / low.crit < 10, 'the rate share must not');
});

// ------------------------------------------------------------------- drops

test('a drop names its rung and its stars, not just its item', () => {
  const rng = makeRng(11);
  let seen = 0;
  for (let i = 0; i < 200; i++) {
    const drop = rollLoot(24, { isBoss: true, luck: 200, rng });
    if (!drop) continue;
    seen++;
    assert.ok(GEAR_BY_ID[drop.id], `unknown item ${drop.id}`);
    assert.equal(drop.def, GEAR_BY_ID[drop.id]);
    assert.ok(Number.isInteger(drop.tier) && drop.tier >= 0);
    assert.ok(drop.stars >= 1 && drop.stars <= R.MAX_STARS);
  }
  assert.ok(seen > 50, 'a boss at depth should be dropping');
});

test('the rung ceiling rises with depth and stops at the top of the ladder', () => {
  assert.equal(tierCeiling(0), 0);
  assert.ok(tierCeiling(20) > tierCeiling(10));
  assert.equal(tierCeiling(500), R.MAX_TIER);
  assert.equal(tierCeiling(-5), 0, 'a negative depth must not produce a negative rung');
});

test('most drops are one star and five is genuinely rare', () => {
  const rng = makeRng(3);
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) counts[rollStars(rng, 0)]++;
  assert.ok(counts[1] / 20000 > 0.85, `only ${counts[1]} of 20000 were 1★`);
  assert.ok(counts[5] / 20000 < 0.001, `${counts[5]} five-stars in 20000 is not rare`);
  assert.equal(counts[0], 0, 'a zero-star piece must never exist');
});

test('luck makes stars more likely without ever breaking the cap', () => {
  const roll = (luck) => {
    const rng = makeRng(99);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += rollStars(rng, luck);
    return sum;
  };
  assert.ok(roll(2000) > roll(0), 'luck should help');
  const rng = makeRng(1);
  for (let i = 0; i < 2000; i++) assert.ok(rollStars(rng, 1e9) <= R.MAX_STARS);
});

test('bosses trickle leafs and ordinary enemies never do', () => {
  const rng = makeRng(5);
  assert.equal(leafDrop(10, false, rng), 0);
  for (let i = 0; i < 100; i++) {
    const n = leafDrop(10, true, rng);
    assert.ok(n >= 1 && n <= 3, `boss dropped ${n} leafs`);
  }
});

// ------------------------------------------------------------------ refine

test('refine is gated on a fully enhanced piece', () => {
  const s = rich();
  const entry = addToInventory(s, 'bambooRod', { tier: 4 });
  assert.equal(canRefine(s, entry.uid).reason, 'enhance', 'a fresh drop must not be refinable');

  maxForge(s, entry.uid);
  assert.equal(canRefine(s, entry.uid).ok, true);
});

test('refine spends both currencies whether or not it lands', () => {
  const s = rich();
  const entry = addToInventory(s, 'bambooRod', { tier: 4 });
  maxForge(s, entry.uid);

  const price = refinePrice(entry);
  const shards = s.combat.shards;
  const leafs = s.leafs;

  const result = refine(s, entry.uid, () => 0.999); // certain failure
  assert.equal(result.ok, true);
  assert.equal(result.success, false);
  assert.equal(s.combat.shards, shards - price.shards);
  assert.equal(s.leafs, leafs - price.leafs);
  assert.equal(entry.stars, 1, 'a failed refine must not add a star');
  assert.equal(entry.refineFails, 1);
});

test('refine adds exactly one star when it lands, and stops at five', () => {
  const s = rich();
  const entry = addToInventory(s, 'bambooRod', { tier: 4 });
  maxForge(s, entry.uid);

  for (let expected = 2; expected <= R.MAX_STARS; expected++) {
    const result = refine(s, entry.uid, () => 0); // certain success
    assert.equal(result.success, true);
    assert.equal(entry.stars, expected);
    assert.equal(entry.refineFails, 0, 'a success clears the pity counter');
  }
  assert.equal(canRefine(s, entry.uid).reason, 'maxed');
  assert.equal(refine(s, entry.uid, () => 0).ok, false);
});

test('four failures and the fifth attempt is a certainty', () => {
  const s = rich();
  const entry = addToInventory(s, 'bambooRod', { tier: 4 });
  maxForge(s, entry.uid);

  for (let i = 0; i < R.REFINE_PITY; i++) refine(s, entry.uid, () => 0.999);
  assert.equal(entry.refineFails, R.REFINE_PITY);

  const result = refine(s, entry.uid, () => 0.999); // still the unluckiest roll
  assert.equal(result.success, true);
  assert.equal(result.pitied, true);
  assert.equal(entry.stars, 2);
});

test('refine refuses when either currency is short, and charges nothing', () => {
  const s = rich();
  const entry = addToInventory(s, 'bambooRod', { tier: 4 });
  maxForge(s, entry.uid);

  s.leafs = 0;
  assert.equal(refine(s, entry.uid).reason, 'leafs');
  s.leafs = 1e6;
  s.combat.shards = 0;
  assert.equal(refine(s, entry.uid).reason, 'shards');
  assert.equal(entry.stars, 1);
  assert.equal(s.leafs, 1e6, 'a refused refine must not charge');
});

test('the stated odds fall with every star and are always shown-able', () => {
  for (let stars = 1; stars < R.MAX_STARS; stars++) {
    const here = R.refineChance(stars);
    assert.ok(here > 0 && here < 1, `${stars}★ has odds of ${here}`);
    if (stars > 1) assert.ok(here < R.refineChance(stars - 1), 'odds must fall as stars rise');
  }
  assert.equal(R.refineChance(R.MAX_STARS), 0, 'there is no roll past five');
});

// -------------------------------------------------------------------- fuse

test('fuse eats three matching pieces and promotes one rung', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: 4 });
  target.forge = 7;
  target.stars = 3;
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: 4 });

  assert.equal(fuseFodder(s, target.uid).length, 3);
  const result = fuse(s, target.uid);

  assert.equal(result.ok, true);
  assert.equal(result.consumed, R.FUSE_COST);
  assert.equal(target.tier, 5, 'one rung, not two');
  assert.equal(target.forge, 7, 'fusing must not cost the enhancement');
  assert.equal(target.stars, 3, 'fusing must not cost the stars');
  assert.equal(s.combat.inventory.length, 1, 'the fodder is gone');
});

test('fuse only accepts the same slot on the same rung, and never what you wear', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: 4 });

  addToInventory(s, 'strawHat', { tier: 4 }); // wrong slot
  addToInventory(s, 'stickRod', { tier: 3 }); // wrong rung
  const worn = addToInventory(s, 'stickRod', { tier: 4 });
  equip(s, worn.uid);

  assert.deepEqual(fuseFodder(s, target.uid), [], 'nothing here is valid fodder');
  assert.equal(canFuse(s, target.uid).reason, 'fodder');
  assert.equal(canFuse(s, target.uid).have, 0);
  assert.equal(fuse(s, target.uid).ok, false);
  assert.equal(s.combat.inventory.length, 4, 'a refused fuse must eat nothing');
});

test('fusing stops at the top of the ladder', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: R.MAX_TIER });
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: R.MAX_TIER });

  assert.equal(canFuse(s, target.uid).reason, 'maxed');
  assert.equal(s.combat.inventory.length, 4);
});

test('fusing a piece all the way up is possible and worth it', () => {
  const s = rich();
  const target = addToInventory(s, 'stickRod', { tier: 0 });
  const before = resolveItem(target).score;

  for (let tier = 0; tier < R.MAX_TIER; tier++) {
    for (let i = 0; i < R.FUSE_COST; i++) addToInventory(s, 'stickRod', { tier });
    assert.equal(fuse(s, target.uid).ok, true, `stuck fusing out of rung ${tier}`);
  }

  const item = resolveItem(target);
  assert.equal(item.tier, R.MAX_TIER);
  assert.equal(item.rarity.name, 'Capybaric');
  assert.ok(item.score / before > 500, `the whole climb was only ×${Math.round(item.score / before)}`);
});

// ---------------------------------------------------------------- fuse all

test('fuse all resolves every eligible group in one call, including a cascade', () => {
  const s = rich();
  // One slot with two full triples of fodder: the first fuse should promote a
  // target using three of them, and the second should find the remaining
  // three are themselves now a fusable group.
  const targetA = addToInventory(s, 'bambooRod', { tier: 2 });
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: 2 });
  const targetB = addToInventory(s, 'stickRod', { tier: 2 });
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: 2 });
  // A second, independent slot, so the bulk call has to cover more than one
  // slot in a single pass.
  const hat = addToInventory(s, 'strawHat', { tier: 1 });
  for (let i = 0; i < 3; i++) addToInventory(s, 'lilyCrown', { tier: 1 });

  const result = fuseAll(s);

  assert.equal(result.fused, 3, 'both rod triples plus the hat');
  assert.equal(result.consumed, 9);
  assert.equal(resolveItem(targetA).tier, 3);
  assert.equal(resolveItem(targetB).tier, 3);
  assert.equal(resolveItem(hat).tier, 2);
  // Whatever is left in the bag has no further eligible group.
  assert.equal(s.combat.inventory.filter((e) => canFuse(s, e.uid).ok).length, 0);
});

test('fuse all leaves a partial group alone rather than forcing it', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: 2 });
  addToInventory(s, 'stickRod', { tier: 2 });
  addToInventory(s, 'stickRod', { tier: 2 }); // only two — one short of FUSE_COST

  const result = fuseAll(s);

  assert.equal(result.fused, 0);
  assert.equal(resolveItem(target).tier, 2, 'unpromoted — there was never a full group');
  assert.equal(s.combat.inventory.length, 3, 'nothing eaten');
});

test('fuse all with no eligible duplicates anywhere is a no-op', () => {
  const s = rich();
  addToInventory(s, 'bambooRod', { tier: 2 });
  addToInventory(s, 'strawHat', { tier: 4 });

  assert.deepEqual(fuseAll(s), { fused: 0, consumed: 0, byTier: {} });
  assert.equal(s.combat.inventory.length, 2);
});

test('fuse all never touches what is equipped', () => {
  const s = rich();
  const worn = addToInventory(s, 'bambooRod', { tier: 2 });
  equip(s, worn.uid);
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: 2 });

  const result = fuseAll(s);

  assert.equal(result.fused, 0, 'the only possible target is worn, so nothing is eligible');
  assert.equal(resolveItem(worn).tier, 2);
  assert.equal(s.combat.inventory.length, 4, 'the three spares stay put, unconsumed');
});

test('matchStars keeps a mismatched duplicate out of the bulk fuse', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: 2, stars: 3 });
  addToInventory(s, 'stickRod', { tier: 2, stars: 3 });
  addToInventory(s, 'stickRod', { tier: 2, stars: 3 });
  // Same slot and rung, but 1★ — exactly the piece the guard exists to protect.
  const precious = addToInventory(s, 'stickRod', { tier: 2, stars: 1 });

  // Without the guard, three same-rung pieces are enough regardless of stars.
  const loose = fuseAll(s, { matchStars: false });
  assert.equal(loose.fused, 1);
  assert.equal(s.combat.inventory.find((e) => e.uid === precious.uid), undefined,
    'the 1★ piece was burned as filler');

  // Rebuild and check the guard actually stops that.
  const s2 = rich();
  const target2 = addToInventory(s2, 'bambooRod', { tier: 2, stars: 3 });
  addToInventory(s2, 'stickRod', { tier: 2, stars: 3 });
  addToInventory(s2, 'stickRod', { tier: 2, stars: 3 });
  const precious2 = addToInventory(s2, 'stickRod', { tier: 2, stars: 1 });

  const strict = fuseAll(s2, { matchStars: true });
  assert.equal(strict.fused, 0, 'only two 3★ fodder pieces exist — one short with the guard on');
  assert.equal(resolveItem(target2).tier, 2);
  assert.ok(s2.combat.inventory.some((e) => e.uid === precious2.uid), 'the 1★ piece survives');
});

test('preview reports what fuse all would do without mutating the real bag', () => {
  const s = rich();
  const target = addToInventory(s, 'bambooRod', { tier: 2 });
  for (let i = 0; i < 3; i++) addToInventory(s, 'stickRod', { tier: 2 });
  const before = s.combat.inventory.length;

  const preview = previewFuseAll(s);
  assert.equal(preview.fused, 1);
  assert.equal(s.combat.inventory.length, before, 'the preview must not touch the real bag');
  assert.equal(resolveItem(target).tier, 2, 'nor promote the real target');

  const real = fuseAll(s);
  assert.deepEqual(real, preview, 'the preview and the real run agree');
});

// ------------------------------------------------------- resolving a piece

test('an entry resolves to its rung, its stars and its enhancement together', () => {
  const s = createState();
  const entry = addToInventory(s, 'geodeCrown', { tier: 12, stars: 3 });
  entry.forge = 9;

  const item = resolveItem(entry);
  assert.equal(item.tier, 12);
  assert.equal(item.stars, 3);
  assert.equal(item.forge, 9);
  assert.equal(item.rarity.name, R.RARITIES[12].name);
  assert.ok(item.score > 0);
  assert.equal(item.name, GEAR_BY_ID.geodeCrown.name);
  assert.deepEqual(item.bonus, GEAR_BY_ID.geodeCrown.bonus, 'the bonus is untouched by any of it');
});

test('an entry for an item that no longer exists resolves to nothing, not a crash', () => {
  assert.equal(resolveItem({ uid: 'x', id: 'deletedHat', tier: 4 }), null);
  assert.equal(resolveItem(null), null);
});

test('scrap pays more for a better piece', () => {
  const low = createState();
  const a = addToInventory(low, 'stickRod', { tier: 2, stars: 1 });
  const high = createState();
  const b = addToInventory(high, 'stickRod', { tier: 12, stars: 4 });

  assert.ok(scrap(high, b.uid).shards > scrap(low, a.uid).shards);
});

test('the bag makes room by dropping the weakest piece, judged on the ladder', () => {
  const s = createState();
  const keeper = addToInventory(s, 'stickRod', { tier: 15, stars: 4 });
  for (let i = 0; i < 200; i++) addToInventory(s, 'stickRod', { tier: 0 });

  const survivors = s.combat.inventory.map((e) => e.uid);
  assert.ok(survivors.includes(keeper.uid), 'the best piece in the bag was thrown away');
});

// --------------------------------------------------------------- migration

test('gear saved before the ladder existed keeps exactly the power it had', () => {
  // A v1 entry has no tier and no stars. It must resolve onto the rung its
  // definition normally drops at — which is where it always was — rather than
  // onto rung 0, which would quietly halve what somebody already owned.
  const s = reconcileState({
    version: 2,
    combat: {
      inventory: [{ uid: 'g1', id: 'geodeCrown', forge: 6 }],
      equipped: { hat: 'g1' },
    },
  });

  const entry = s.combat.inventory[0];
  assert.equal(entry.stars, 1);
  assert.equal(entry.tier, undefined, 'the rung stays implicit so the definition decides');

  const item = resolveItem(entry);
  assert.equal(item.tier, GEAR_BY_ID.geodeCrown.tier);
  assert.deepEqual(item.stats, statsFor(GEAR_BY_ID.geodeCrown, { forge: 6 }));
  assert.ok(combatStats(s).atk > 0);
  assert.equal(equippedItems(s).length, 1);
});

test('a hand-edited entry is repaired rather than trusted', () => {
  const s = reconcileState({
    version: 2,
    combat: {
      inventory: [
        { uid: 'a', id: 'stickRod', tier: 900, stars: 99, forge: 400, refineFails: -3 },
        { uid: 'b', id: 'stickRod', tier: -8, stars: 0, forge: NaN },
        { uid: 'c', id: 'stickRod', tier: 'four' },
      ],
    },
  });

  const [a, b, c] = s.combat.inventory;
  assert.equal(a.tier, 19);
  assert.equal(a.stars, 5);
  assert.equal(a.forge, MAX_FORGE);
  assert.equal(a.refineFails, 0);
  assert.equal(b.tier, 0);
  assert.equal(b.stars, 1);
  assert.equal(b.forge, 0);
  assert.equal(c.tier, 0, 'an unparseable rung falls to the bottom, not to NaN');

  for (const entry of s.combat.inventory) {
    const item = resolveItem(entry);
    for (const value of Object.values(item.stats)) {
      assert.ok(Number.isFinite(value), `${entry.uid} produced a broken stat`);
    }
  }
});

test('every slot still fills, and a full kit is stronger than none', () => {
  const s = createState();
  const bare = combatStats(s).power;
  for (const slot of SLOT_IDS) {
    const def = GEAR.find((g) => g.slot === slot);
    const entry = addToInventory(s, def.id, { tier: 10, stars: 2 });
    equip(s, entry.uid);
  }
  assert.equal(equippedItems(s).length, SLOT_IDS.length);
  assert.ok(combatStats(s).power > bare);
});

test('enhancement, stars and rung all raise the same piece independently', () => {
  const s = createState();
  const base = addToInventory(s, 'bambooRod', { tier: 6, stars: 1 });
  const score = () => resolveItem(base).score;
  const start = score();

  base.forge = 15;
  const enhanced = score();
  assert.ok(enhanced > start, 'enhancement should help');

  base.stars = 4;
  const starred = score();
  assert.ok(starred > enhanced, 'stars should help');

  base.tier = 12;
  assert.ok(score() > starred, 'rungs should help');
});

test('forge prices are finite for every rung of every piece', () => {
  const s = createState();
  for (const def of GEAR) {
    for (const tier of [0, 10, 19]) {
      const entry = addToInventory(s, def.id, { tier });
      const price = forgePrice(entry);
      assert.ok(Number.isFinite(price) && price > 0, `${def.id} at rung ${tier}: price ${price}`);
    }
  }
  assert.equal(forgePrice({ id: 'notAThing', forge: 0 }), Infinity);
});

test('enhancing still refuses when the shards are not there', () => {
  const s = createState();
  const entry = addToInventory(s, 'bambooRod', { tier: 8 });
  s.combat.shards = 0;
  assert.equal(forge(s, entry.uid).reason, 'shards');
  assert.equal(entry.forge, 0);
});
