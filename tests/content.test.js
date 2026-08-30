// Guards on the content tables. These catch the mistakes that are easy to make
// while authoring 100+ entries by hand: duplicate ids, broken cross-references,
// a cost curve that accidentally goes backwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import { BUILDINGS, BUILDINGS_BY_ID, HABITATS } from '../src/data/buildings.js';
import { CLICK_UPGRADES } from '../src/data/clickUpgrades.js';
import { TIER_UPGRADES } from '../src/data/tierUpgrades.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { BUILDING_ART, CAPY_SKINS, PROP_PALETTE } from '../src/render/palettes.js';
import {
  ICONS, ALL_SPRITES, validateSprite, spriteChars, SHAPE_FAMILIES, familyShape,
  CAPY, EYES, GOLDEN_CAPY, YUZU, STEAM, SPARKLE,
} from '../src/render/sprites.js';
import { describeReward } from '../src/systems/achievements.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { createState } from '../src/state.js';
import { fmt } from '../src/ui/numbers.js';

const KNOWN_EFFECTS = new Set([
  'clickFlat', 'clickMult', 'zpsMult', 'globalMult', 'buildingMult', 'allBuildingMult',
  'critChance', 'critDamage', 'comboCap', 'comboStep', 'zpsShare', 'goldenChance',
  'goldenDuration', 'offlineRate', 'offlineCapHours', 'costDiscount', 'buffMult',
]);

function assertUniqueIds(entries, label) {
  const seen = new Set();
  for (const e of entries) {
    assert.ok(e.id, `${label}: entry without an id`);
    assert.ok(!seen.has(e.id), `${label}: duplicate id "${e.id}"`);
    seen.add(e.id);
  }
}

test('the promised content counts are actually there', () => {
  assert.equal(BUILDINGS.length, 48, 'generators');
  assert.equal(CLICK_UPGRADES.length, 16, 'tap upgrades');
  assert.equal(TIER_UPGRADES.length, 96, 'generator tier upgrades');
  assert.equal(ACHIEVEMENTS.length, 232, 'achievements');

  const upgradeTotal = CLICK_UPGRADES.length + TIER_UPGRADES.length;
  assert.ok(upgradeTotal >= 52, `expected 52+ purchasable upgrades, found ${upgradeTotal}`);
});

test('every id is unique within its table', () => {
  assertUniqueIds(BUILDINGS, 'buildings');
  assertUniqueIds(CLICK_UPGRADES, 'click upgrades');
  assertUniqueIds(TIER_UPGRADES, 'tier upgrades');
  assertUniqueIds(ACHIEVEMENTS, 'achievements');
});

test('ids do not collide across the two upgrade tables', () => {
  const clickIds = new Set(CLICK_UPGRADES.map((u) => u.id));
  for (const u of TIER_UPGRADES) {
    assert.ok(!clickIds.has(u.id), `tier upgrade "${u.id}" collides with a tap upgrade`);
  }
});

test('generators get more expensive and more productive down the list', () => {
  for (let i = 1; i < BUILDINGS.length; i++) {
    assert.ok(
      BUILDINGS[i].cost > BUILDINGS[i - 1].cost,
      `${BUILDINGS[i].id} is not pricier than ${BUILDINGS[i - 1].id}`,
    );
    assert.ok(
      BUILDINGS[i].rate > BUILDINGS[i - 1].rate,
      `${BUILDINGS[i].id} does not out-earn ${BUILDINGS[i - 1].id}`,
    );
  }
});

test('the generator cost ladder climbs at a steady slope', () => {
  // The test that should have existed. "Costs increase" was true of a ladder
  // whose thirteenth rung cost twelve thousand times the twelfth — six of the
  // eighteen generators had paybacks between 12 years and 45 billion years, and
  // a monotonicity check waved all of it through.
  //
  // The first step is deliberately gentle: the second generator should be easy
  // to reach on minute one. Everything after it stays on one slope.
  const steps = [];
  for (let i = 1; i < BUILDINGS.length; i++) {
    steps.push({ id: BUILDINGS[i].id, ratio: BUILDINGS[i].cost / BUILDINGS[i - 1].cost });
  }

  assert.ok(steps[0].ratio >= 5, `the opening step is only x${steps[0].ratio.toFixed(1)}`);
  for (const step of steps.slice(1)) {
    assert.ok(
      step.ratio >= 8 && step.ratio <= 20,
      `${step.id} costs x${step.ratio.toFixed(1)} the one before it — the ladder is x8-20`,
    );
  }

  // Belt and braces against a digit-count typo specifically: no single step may
  // be wildly out of line with the rest, whatever the absolute bounds allow.
  const sorted = steps.map((s) => s.ratio).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const step of steps.slice(1)) {
    assert.ok(
      step.ratio < median * 2,
      `${step.id} jumps x${step.ratio.toFixed(1)} against a median step of x${median.toFixed(1)}`,
    );
  }
});

test('payback rises down the ladder, and never jumps', () => {
  // Payback must rise, so a later generator is a bigger commitment rather than
  // a strictly better deal.
  //
  // The Lily Pad is exempt. It and the Yuzu Sapling both repay in 100s, which
  // is the one place payback does not rise: the opening purchase is a tutorial
  // rather than a deal, and the second one not being *worse* is what teaches
  // that generators are worth buying.
  for (let i = 2; i < BUILDINGS.length; i++) {
    const prev = BUILDINGS[i - 1].cost / BUILDINGS[i - 1].rate;
    const here = BUILDINGS[i].cost / BUILDINGS[i].rate;
    assert.ok(here > prev, `${BUILDINGS[i].id} repays faster than the generator before it`);

    // The bound that catches the original bug, and the one that survived the
    // ladder growing to forty-eight. A "payback under a year" cap used to stand
    // here; at eighteen rungs it was a fine proxy and at forty-eight it is
    // arithmetically impossible, because eighteen already ends at 181 days.
    // What actually went wrong in the bug was the STEP: six digit-count typos
    // in a row, one of which multiplied payback by 3,120 between adjacent
    // rungs. A designed curve never does that.
    //
    // The bound is 5 because the shipped curve's own largest step is 2.93, at
    // the Hot Spring Resort, and a limit set just above the real data is a
    // limit that fails the next time anybody tunes anything. Five leaves the
    // curve room and still sits three orders of magnitude below the bug.
    assert.ok(here / prev < 5,
      `${BUILDINGS[i].id} takes x${(here / prev).toFixed(0)} the payback of the rung before it`);
  }

  // The first eighteen keep their original absolute cap, unchanged. Nothing
  // about them moved, so nothing about the rule that measured them should.
  for (const b of BUILDINGS.slice(0, 18)) {
    const days = b.cost / b.rate / 86400;
    assert.ok(days < 365, `${b.id} takes ${days.toFixed(0)} days to repay itself`);
  }
});

test('the whole ladder is reachable with the multipliers the game hands out', () => {
  // The absolute check, done properly rather than by proxy.
  //
  // Raw cost/rate ignores every multiplier, and past the eighteenth rung the
  // multipliers ARE the game — generator 48 repays in 13 years at ×1 and in
  // about two minutes for a player who has actually got there. So this measures
  // the multiplier from the real code instead of guessing at it: if a later
  // change nerfs essence scaling or the achievement rewards, the deep end of
  // the ladder silently drifts out of reach and this is what notices.
  const deep = createState();
  // 50 rebirths, deepest stage 60 each — through the real (banded) payout
  // formula rather than a hand-written copy of it, so a later change to the
  // curve can't silently drift this fixture out of sync with the code it is
  // meant to approximate.
  deep.lifetimeEssence = B.essenceFromStage(60) * 50;
  for (const a of ACHIEVEMENTS) deep.achievements[a.id] = true;
  for (const u of TIER_UPGRADES) deep.tierUpgrades[u.id] = true;

  const { globalMult } = recomputeDerived(deep, { now: Date.UTC(2030, 0, 1) });
  // Plus the ×2 and ×3 a line's own two tier upgrades give it.
  const mult = globalMult * 6;
  assert.ok(mult > 1e5, `a deep player only reaches x${mult.toExponential(1)} — the ladder needs more`);

  for (const b of BUILDINGS) {
    const seconds = b.cost / b.rate / mult;
    assert.ok(seconds < 86400,
      `${b.id} still takes ${(seconds / 3600).toFixed(1)}h to repay at x${mult.toExponential(1)}`);
  }
});

test('the deep end of the ladder stays inside the numbers the game can hold', () => {
  // Thirty more generators multiply late income by an enormous factor, and
  // three things downstream read that number: the float ceiling, the offline
  // tank, and `fmt`. Measured rather than reasoned about — "probably fine" is
  // what a balance pass says right before an idle game starts printing ∞.
  const deep = createState();
  deep.lifetimeEssence = Math.floor(8 * 60 ** 1.7) * 50;
  for (const a of ACHIEVEMENTS) deep.achievements[a.id] = true;
  for (const u of TIER_UPGRADES) deep.tierUpgrades[u.id] = true;
  for (const b of BUILDINGS) deep.buildings[b.id] = 100;

  const d = recomputeDerived(deep, { now: Date.UTC(2030, 0, 1) });
  assert.ok(Number.isFinite(d.zps), 'income at 100 of everything is not a finite number');

  // 245 orders of magnitude of headroom when this was written. Asserting 60 is
  // enough to catch a change that eats most of it while leaving room to tune.
  const headroom = 300 - Math.log10(d.zps);
  assert.ok(headroom > 60, `only ${headroom.toFixed(0)} orders of magnitude below VALUE_CEILING`);

  // The offline tank is the largest single number a player is ever shown, and
  // fmt() has a finite suffix ladder — a number past the end of it renders as
  // something meaningless rather than failing loudly.
  const tank = d.zps * d.offlineRate * (d.offlineCapMs / 1000);
  assert.ok(Number.isFinite(tank));
  const shown = fmt(tank);
  assert.ok(/^[\d.]+[A-Za-z]+$/.test(shown), `a full offline tank renders as "${shown}"`);
  assert.ok(!/e\+|Infinity|NaN/.test(shown), `a full offline tank renders as "${shown}"`);
});

test('every generator has complete art and copy', () => {
  for (const b of BUILDINGS) {
    assert.ok(b.name, `${b.id}: missing name`);
    assert.ok(b.blurb, `${b.id}: missing blurb`);
    assert.equal(b.stages?.length, 2, `${b.id}: needs two later stage names`);
    for (const n of b.stages) assert.ok(n, `${b.id}: blank stage name`);
    assert.ok(HABITATS.includes(b.habitat), `${b.id}: unknown habitat "${b.habitat}"`);
    const art = BUILDING_ART[b.id];
    assert.ok(art, `${b.id}: no art mapping`);
    assert.ok(SHAPE_FAMILIES[b.family], `${b.id}: unknown family "${b.family}"`);
  }
});

test('generator icon palettes cover every character their shape uses', () => {
  // All three stages, because a palette missing a character renders holes and
  // the second and third drawings are only reached after an upgrade — the
  // slowest possible place to find out.
  for (const b of BUILDINGS) {
    const palette = BUILDING_ART[b.id].palette;
    for (const stage of [0, 1, 2]) {
      const shape = ICONS[familyShape(b.family, stage)];
      for (const row of shape.rows) {
        for (const ch of row) {
          assert.ok(ch in palette, `${b.id} stage ${stage}: palette has no entry for "${ch}"`);
        }
      }
    }
  }
});

test('tier upgrades point at real generators and stay in order', () => {
  for (const u of TIER_UPGRADES) {
    assert.ok(BUILDINGS_BY_ID[u.buildingId], `${u.id}: unknown generator`);
    assert.equal(u.req.building.id, u.buildingId, `${u.id}: requirement targets another generator`);
    assert.ok(u.name, `${u.id}: missing name`);
    assert.ok(u.blurb, `${u.id}: missing blurb`);
  }

  for (const b of BUILDINGS) {
    const tiers = TIER_UPGRADES.filter((u) => u.buildingId === b.id);
    assert.equal(tiers.length, 2, `${b.id} should have exactly 2 tier upgrades`);
    assert.ok(tiers[1].cost > tiers[0].cost, `${b.id}: tier 2 is not pricier than tier 1`);
    assert.ok(
      tiers[1].req.building.count > tiers[0].req.building.count,
      `${b.id}: tier 2 unlocks no later than tier 1`,
    );
  }
});

test('every upgrade effect uses a known effect type', () => {
  for (const u of [...CLICK_UPGRADES, ...TIER_UPGRADES]) {
    assert.ok(u.effects?.length, `${u.id}: no effects`);
    for (const e of u.effects) {
      assert.ok(KNOWN_EFFECTS.has(e.type), `${u.id}: unknown effect "${e.type}"`);
      assert.ok(Number.isFinite(e.value), `${u.id}: non-numeric effect value`);
      if (e.type === 'buildingMult') {
        assert.ok(BUILDINGS_BY_ID[e.id], `${u.id}: effect targets unknown generator "${e.id}"`);
      }
    }
  }
});

test('tap upgrades that require another upgrade reference a real one', () => {
  const ids = new Set(CLICK_UPGRADES.map((u) => u.id));
  for (const u of CLICK_UPGRADES) {
    if (!u.req?.upgrade) continue;
    assert.ok(ids.has(u.req.upgrade), `${u.id}: requires unknown upgrade "${u.req.upgrade}"`);
  }
});

test('tap upgrades get steadily more expensive', () => {
  for (let i = 1; i < CLICK_UPGRADES.length; i++) {
    assert.ok(
      CLICK_UPGRADES[i].cost > CLICK_UPGRADES[i - 1].cost,
      `${CLICK_UPGRADES[i].id} is not pricier than the one before it`,
    );
  }
});

test('every achievement pays out something describable', () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.name, `${a.id}: missing name`);
    assert.ok(a.blurb, `${a.id}: missing blurb`);
    assert.ok(a.req && Object.keys(a.req).length, `${a.id}: no unlock condition`);
    assert.ok(a.reward, `${a.id}: no reward — achievements must pay`);
    assert.ok(KNOWN_EFFECTS.has(a.reward.type), `${a.id}: unknown reward "${a.reward.type}"`);
    assert.ok(describeReward(a.reward).length > 0, `${a.id}: reward has no description`);
  }
});

test('achievement rewards targeting a generator reference a real one', () => {
  for (const a of ACHIEVEMENTS) {
    if (a.reward.type !== 'buildingMult') continue;
    assert.ok(BUILDINGS_BY_ID[a.reward.id], `${a.id}: reward targets unknown generator`);
  }
});

test('every sprite grid is rectangular', () => {
  const problems = [];
  for (const [name, spr] of Object.entries(ALL_SPRITES)) {
    problems.push(...validateSprite(name, spr));
  }
  assert.deepEqual(problems, []);
});

test('every sprite is fully covered by the palette it is drawn with', () => {
  // A character with no palette entry renders as a transparent hole, which is
  // easy to miss by eye and impossible to miss here. The capybara sprite
  // includes its own water, so its palette must carry the water colours too.
  const pairs = [
    ...Object.entries(CAPY_SKINS).map(([skin, palette]) => [`CAPY/${skin}`, CAPY, palette]),
    ...Object.entries(EYES).flatMap(([mood, spr]) =>
      Object.entries(CAPY_SKINS).map(([skin, palette]) => [`EYES.${mood}/${skin}`, spr, palette]),
    ),
    ['GOLDEN_CAPY', GOLDEN_CAPY, CAPY_SKINS.golden],
    ['YUZU', YUZU, PROP_PALETTE],
    ['STEAM', STEAM, PROP_PALETTE],
    ['SPARKLE', SPARKLE, PROP_PALETTE],
  ];

  const missing = [];
  for (const [name, spr, palette] of pairs) {
    for (const ch of spriteChars(spr)) {
      if (!(ch in palette)) missing.push(`${name}: no palette entry for "${ch}"`);
    }
  }
  assert.deepEqual(missing, []);
});

test('palette entries resolve to a colour or to transparent, never undefined', () => {
  for (const [name, palette] of Object.entries({ ...CAPY_SKINS, PROP_PALETTE })) {
    for (const [ch, value] of Object.entries(palette)) {
      assert.ok(
        value === null || (typeof value === 'string' && value.startsWith('#')),
        `${name}: "${ch}" is not a colour or null`,
      );
    }
  }
});
