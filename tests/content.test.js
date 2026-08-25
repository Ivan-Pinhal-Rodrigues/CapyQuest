// Guards on the content tables. These catch the mistakes that are easy to make
// while authoring 100+ entries by hand: duplicate ids, broken cross-references,
// a cost curve that accidentally goes backwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS, BUILDINGS_BY_ID } from '../src/data/buildings.js';
import { CLICK_UPGRADES } from '../src/data/clickUpgrades.js';
import { TIER_UPGRADES } from '../src/data/tierUpgrades.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { BUILDING_ART, CAPY_SKINS, PROP_PALETTE } from '../src/render/palettes.js';
import {
  ICONS, ALL_SPRITES, validateSprite, spriteChars,
  CAPY, EYES, GOLDEN_CAPY, YUZU, STEAM, SPARKLE,
} from '../src/render/sprites.js';
import { describeReward } from '../src/systems/achievements.js';

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
  assert.equal(BUILDINGS.length, 18, 'generators');
  assert.equal(CLICK_UPGRADES.length, 16, 'tap upgrades');
  assert.equal(TIER_UPGRADES.length, 36, 'generator tier upgrades');
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

test('every generator pays for itself in a length of time a player would accept', () => {
  // Payback is the number that decides whether a generator is content or
  // decoration. The last one is a long-term goal bought across rebirths; none
  // of them may be a goal measured in geological time.
  for (const b of BUILDINGS) {
    const days = b.cost / b.rate / 86400;
    assert.ok(days < 365, `${b.id} takes ${days.toFixed(0)} days to repay itself`);
  }

  // And payback must rise down the list, so later generators are a bigger
  // commitment rather than a strictly better deal.
  //
  // The Lily Pad is exempt: it repays in 150s against the Yuzu Sapling's 100s,
  // deliberately. The first purchase is a tutorial rather than a deal, and the
  // second one being visibly better is what teaches that generators improve.
  for (let i = 2; i < BUILDINGS.length; i++) {
    const prev = BUILDINGS[i - 1].cost / BUILDINGS[i - 1].rate;
    const here = BUILDINGS[i].cost / BUILDINGS[i].rate;
    assert.ok(here > prev, `${BUILDINGS[i].id} repays faster than the generator before it`);
  }
});

test('every generator has complete art and copy', () => {
  for (const b of BUILDINGS) {
    assert.ok(b.name, `${b.id}: missing name`);
    assert.ok(b.blurb, `${b.id}: missing blurb`);
    const art = BUILDING_ART[b.id];
    assert.ok(art, `${b.id}: no art mapping`);
    assert.ok(ICONS[art.shape], `${b.id}: unknown icon shape "${art.shape}"`);
  }
});

test('generator icon palettes cover every character their shape uses', () => {
  for (const [id, art] of Object.entries(BUILDING_ART)) {
    const shape = ICONS[art.shape];
    for (const row of shape.rows) {
      for (const ch of row) {
        assert.ok(ch in art.palette, `${id}: palette has no entry for "${ch}"`);
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
