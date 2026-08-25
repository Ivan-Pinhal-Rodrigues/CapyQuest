// Combat, gear, loot and the forge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/balance.js';
import { makeRng } from '../src/balance.js';

import { createState, reconcileState } from '../src/state.js';
import { Combat } from '../src/systems/combat.js';
import { buildEnemy, buildBoss, depthInfo, toDepth, enemyIdForDepth, terrainForDepth } from '../src/systems/stages.js';
import { combatStats, equippedItems, equippedBonuses, resolveItem, xpForStage } from '../src/systems/combatStats.js';
import { rollLoot, shardDrop, addToInventory, equip, scrap, forge, forgePrice, MAX_FORGE, INVENTORY_CAP, tierCeiling } from '../src/systems/loot.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { TERRAINS, terrainForStage, enemyPoolForStage, allTerrainEnemyIds } from '../src/data/terrains.js';
import { ENEMIES } from '../src/data/enemies.js';
import { GEAR, GEAR_BY_ID, SLOT_IDS, statsFor, gearScore } from '../src/data/gear.js';
import { MAX_TIER, RARITIES, budget } from '../src/data/rarities.js';
import { SKILLS, SKILLS_BY_ID, SKILL_SLOTS } from '../src/data/skills.js';
import { ELEMENTS, ELEMENT_IDS } from '../src/data/elements.js';
import { SHAPES } from '../src/render/shapes.js';
import { GEAR_SHAPES } from '../src/render/gearSprites.js';


function combatReady() {
  const s = createState();
  s.combat.unlocked = true;
  s.combat.autoBattle = true;
  return s;
}

// -------------------------------------------------------------- content

test('the promised RPG content counts are there', () => {
  assert.equal(TERRAINS.length, 18, 'terrains');
  assert.equal(GEAR.length, 42, 'gear pieces');
  assert.equal(SKILLS.length, 18, 'skills');
  assert.ok(Object.keys(ENEMIES).length >= 70, `expected 70+ enemies, found ${Object.keys(ENEMIES).length}`);
  assert.equal(Object.keys(SHAPES).length, 14, 'combatant shape templates');
});

test('every terrain references real enemies, a real boss, and a real element', () => {
  for (const t of TERRAINS) {
    assert.ok(ELEMENTS[t.element], `${t.id}: unknown element`);
    assert.ok(t.natives.length > 0, `${t.id}: no natives`);
    for (const id of t.natives) assert.ok(ENEMIES[id], `${t.id}: unknown native "${id}"`);
    assert.ok(ENEMIES[t.boss]?.boss, `${t.id}: "${t.boss}" is not a flagged boss`);
  }
  for (const id of allTerrainEnemyIds()) assert.ok(ENEMIES[id], `dangling terrain ref "${id}"`);
});

test('every enemy has a real shape, element and complete palette', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    const shape = SHAPES[e.shape];
    assert.ok(shape, `${id}: unknown shape "${e.shape}"`);
    assert.ok(ELEMENTS[e.element], `${id}: unknown element`);
    assert.ok(e.name && e.blurb, `${id}: missing copy`);
    for (const row of shape.rows) {
      for (const ch of row) assert.ok(ch in e.palette, `${id}: palette has no entry for "${ch}"`);
    }
  }
});

test('every gear piece has a real slot, rung, shape and complete palette', () => {
  const seen = new Set();
  for (const g of GEAR) {
    assert.ok(!seen.has(g.id), `duplicate gear id "${g.id}"`);
    seen.add(g.id);
    assert.ok(SLOT_IDS.includes(g.slot), `${g.id}: unknown slot`);
    assert.ok(g.tier >= 0 && g.tier <= MAX_TIER, `${g.id}: rung out of range`);
    assert.ok(GEAR_SHAPES[g.slot], `${g.id}: no shape for slot`);
    assert.ok(g.name && g.blurb, `${g.id}: missing copy`);
    assert.ok(Object.keys(g.stats).length > 0, `${g.id}: no stats`);
    // Every piece needs at least one stat that scales with the rung, or its
    // budget has nowhere to go and it stops improving as it climbs.
    const linear = ['atk', 'def', 'hp', 'spd', 'luck'].some((k) => g.stats[k]);
    assert.ok(linear, `${g.id}: nothing but rate stats — it would never scale`);
  }
});

test('every slot has gear spread across the ladder', () => {
  for (const slot of SLOT_IDS) {
    const pieces = GEAR.filter((g) => g.slot === slot);
    assert.ok(pieces.length >= 6, `${slot}: only ${pieces.length} pieces`);
    assert.ok(new Set(pieces.map((p) => p.tier)).size >= 4, `${slot}: too few rungs`);
  }
});

test('a piece is worth its rung, whichever piece it is', () => {
  // The whole point of the ladder: at a shared rung two pieces are worth the
  // same and differ in shape. A hand-authored stat block that happened to be
  // generous would otherwise quietly become the only viable piece at the top.
  for (const tier of [0, 7, 19]) {
    for (const g of GEAR) {
      const stats = statsFor(g, { tier, stars: 1, forge: 0 });
      const linear = gearScore({ ...stats, crit: 0, critDmg: 0 });
      assert.ok(
        Math.abs(linear - budget(tier)) < 1e-6,
        `${g.id} at rung ${tier}: worth ${linear.toFixed(1)}, the rung is ${budget(tier).toFixed(1)}`,
      );
    }
  }
});

test('skills declare what they do and unlock at reachable stages', () => {
  for (const s of SKILLS) {
    assert.ok(s.name && s.blurb, `${s.id}: missing copy`);
    assert.ok(['active', 'passive'].includes(s.kind), `${s.id}: bad kind`);
    if (s.kind === 'active') {
      assert.ok(s.cooldown > 0, `${s.id}: active skill with no cooldown`);
      assert.ok(s.effect?.type, `${s.id}: active skill with no effect`);
    } else {
      assert.ok(s.stats || s.bonus, `${s.id}: passive that does nothing`);
    }
    assert.ok(s.req.stage >= 0, `${s.id}: negative unlock stage`);
  }
});

test('the element chart is symmetric where it claims to be', () => {
  for (const id of ELEMENT_IDS) {
    const el = ELEMENTS[id];
    assert.ok(ELEMENTS[el.strong], `${id}: strong against unknown element`);
    if (el.weak) assert.ok(ELEMENTS[el.weak], `${id}: weak to unknown element`);
    assert.notEqual(el.strong, id, `${id}: strong against itself`);
  }
});

// ------------------------------------------------------------ progression

test('depth splits into a stage and a level', () => {
  assert.deepEqual(depthInfo(0), { depth: 0, stage: 0, level: 0, isBoss: false });
  assert.deepEqual(depthInfo(9), { depth: 9, stage: 0, level: 9, isBoss: true });
  assert.deepEqual(depthInfo(10), { depth: 10, stage: 1, level: 0, isBoss: false });
  assert.equal(toDepth(3, 4), 34);
});

test('the last level of every stage is a boss, and it is the terrain boss', () => {
  for (let stage = 0; stage < 25; stage++) {
    const bossDepth = toDepth(stage, 9);
    assert.equal(depthInfo(bossDepth).isBoss, true, `stage ${stage} level 10 should be a boss`);
    const terrain = terrainForStage(stage);
    assert.equal(enemyIdForDepth(bossDepth), terrain.boss);
    for (let level = 0; level < 9; level++) {
      assert.equal(depthInfo(toDepth(stage, level)).isBoss, false);
    }
  }
});

test('progression is gentle within a stage and hard between stages', () => {
  // The whole point of the redesign: the STAGE is the wall, not the level.
  // Clearing level 8 of a stage should feel like clearing level 1; arriving at
  // the next stage should not.
  const withinStage = B.enemyHp(3, 8, false) / B.enemyHp(3, 0, false);
  const acrossStages = B.enemyHp(4, 0, false) / B.enemyHp(3, 8, false);
  assert.ok(withinStage < 1.25, `within-stage ramp is ${withinStage.toFixed(2)}, expected under 1.25`);
  assert.ok(acrossStages > 1.8, `stage jump is ${acrossStages.toFixed(2)}, expected over 1.8`);
  assert.ok(
    acrossStages > withinStage * 1.5,
    `the boundary (${acrossStages.toFixed(2)}) must bite harder than a whole stage of levels (${withinStage.toFixed(2)})`,
  );
});

test('there is no last stage', () => {
  // v1 stopped at 120. Depth is unbounded now.
  for (const depth of [0, 500, 5000]) {
    const enemy = buildEnemy(depth);
    assert.ok(enemy.name, `depth ${depth} produced no enemy`);
    assert.ok(Number.isFinite(enemy.maxHp), `depth ${depth} produced non-finite HP`);
    assert.ok(enemy.maxHp > 0);
  }
  assert.ok(buildEnemy(400).maxHp > buildEnemy(300).maxHp);
});

test('terrains cycle with a tier suffix rather than running out', () => {
  assert.equal(terrainForStage(0).displayName, TERRAINS[0].name);
  assert.equal(terrainForStage(0).tier, 0);

  const wrapped = terrainForStage(TERRAINS.length);
  assert.equal(wrapped.id, TERRAINS[0].id, 'the table wraps to the first terrain');
  assert.equal(wrapped.tier, 1);
  assert.ok(wrapped.displayName.includes('II'), `expected a tier numeral, got "${wrapped.displayName}"`);

  // Deep stages still name a real place.
  assert.ok(terrainForStage(999).displayName.length > 0);
});

test('the enemy pool compounds as terrains stack', () => {
  const first = enemyPoolForStage(0).length;
  const middle = enemyPoolForStage(5).length;
  const last = enemyPoolForStage(TERRAINS.length - 1).length;
  assert.ok(middle > first, 'later terrains should add enemies, not swap them');
  assert.ok(last > middle);
});

test('a depth is a place — the same enemy every time', () => {
  for (const depth of [3, 17, 88, 431]) {
    assert.equal(enemyIdForDepth(depth), enemyIdForDepth(depth));
    assert.equal(buildEnemy(depth).id, buildEnemy(depth).id);
  }
});

test('enemies get harder every stage and bosses are a spike', () => {
  assert.ok(buildEnemy(toDepth(20, 0)).maxHp > buildEnemy(toDepth(0, 0)).maxHp * 100);
  const before = buildEnemy(toDepth(2, 8));
  const boss = buildBoss(2);
  assert.ok(boss.boss);
  assert.ok(boss.maxHp > before.maxHp * 4, 'a boss should be a real wall');
});

test('later cycles of a terrain are meaner than the first', () => {
  const first = buildEnemy(toDepth(0, 0));
  const second = buildEnemy(toDepth(TERRAINS.length, 0));
  assert.ok(second.maxHp > first.maxHp, 'Reedbank II must out-stat Reedbank');
  assert.ok(second.name !== first.name, 'and carry an epithet');
});

test('xp rewards grow and bosses pay more', () => {
  assert.ok(xpForStage(20, false) > xpForStage(0, false));
  assert.ok(xpForStage(20, true) > xpForStage(20, false));
});

// ----------------------------------------------------------------- stats

test('base stats rise with level', () => {
  const s = createState();
  const at1 = combatStats(s);
  s.combat.xp = 100000;
  const later = combatStats(s);
  assert.ok(later.level > at1.level);
  assert.ok(later.atk > at1.atk);
  assert.ok(later.hp > at1.hp);
});

test('equipping gear raises power, unequipping lowers it again', () => {
  const s = createState();
  const before = combatStats(s).power;

  const entry = addToInventory(s, 'sunDiadem');
  equip(s, entry.uid);
  const after = combatStats(s).power;
  assert.ok(after > before, 'equipping should raise power');

  delete s.combat.equipped.hat;
  assert.equal(combatStats(s).power, before);
});

test('forge level multiplies a piece\'s stats but not its bonus', () => {
  const s = createState();
  const entry = addToInventory(s, 'sunDiadem');
  equip(s, entry.uid);
  const plain = combatStats(s).atk;

  entry.forge = 10;
  const forged = combatStats(s).atk;
  assert.ok(forged > plain, 'enhancement should raise stats');

  // The idle-game bonus is a flat effect and must not scale with forge level.
  const bonuses = equippedBonuses(s);
  assert.equal(bonuses.length, 1);
  assert.equal(bonuses[0].value, GEAR_BY_ID.sunDiadem.bonus.value);
});

test('gear bonuses reach the idle-game stats', () => {
  const s = createState();
  s.buildings.lilypad = 100;
  const before = recomputeDerived(s).zps;

  const entry = addToInventory(s, 'endlessBath'); // +35% idle income
  equip(s, entry.uid);
  const after = recomputeDerived(s).zps;

  assert.ok(Math.abs(after - before * 1.35) < 1e-6, `${after} vs ${before * 1.35}`);
});

test('passive skills contribute stats and bonuses', () => {
  const s = createState();
  const before = combatStats(s);
  s.combat.skills = ['thickHide'];
  const after = combatStats(s);
  assert.ok(after.def > before.def);
  assert.ok(after.hp > before.hp);

  s.combat.skills = ['calmMind'];
  assert.equal(equippedBonuses(s).length, 1, 'calmMind carries an idle bonus');
});

test('equipping only ever fills that piece\'s own slot', () => {
  const s = createState();
  for (const id of ['strawHat', 'ragScarf', 'stickRod']) {
    equip(s, addToInventory(s, id).uid);
  }
  assert.deepEqual(Object.keys(s.combat.equipped).sort(), ['hat', 'rod', 'scarf']);
  assert.equal(equippedItems(s).length, 3);
});

// ------------------------------------------------------------------ loot

test('loot never exceeds the rung ceiling for its stage', () => {
  const rng = makeRng(7);
  for (const stage of [0, 5, 20, 40, 60, 90, 119]) {
    const ceiling = tierCeiling(stage);
    for (let i = 0; i < 300; i++) {
      const drop = rollLoot(stage, { isBoss: true, luck: 500, rng });
      if (!drop) continue;
      assert.ok(drop.tier <= ceiling, `stage ${stage} dropped rung ${drop.tier}, ceiling is ${ceiling}`);
      assert.ok(drop.def.tier <= drop.tier, `${drop.id} cannot appear on rung ${drop.tier}`);
      assert.ok(drop.stars >= 1 && drop.stars <= 5, `bad star roll ${drop.stars}`);
    }
  }
});

test('bosses drop far more often than ordinary enemies', () => {
  const rng = makeRng(11);
  let normal = 0;
  let boss = 0;
  for (let i = 0; i < 2000; i++) {
    if (rollLoot(30, { isBoss: false, rng })) normal++;
    if (rollLoot(30, { isBoss: true, rng })) boss++;
  }
  assert.ok(boss > normal * 3, `boss ${boss} vs normal ${normal}`);
});

test('shard drops scale with stage and spike on bosses', () => {
  const rng = makeRng(3);
  assert.ok(shardDrop(80, false, rng) > shardDrop(0, false, rng));
  const r2 = makeRng(5);
  const normal = shardDrop(20, false, r2);
  const r3 = makeRng(5);
  assert.ok(shardDrop(20, true, r3) > normal * 3);
});

test('a full bag drops its weakest spare rather than refusing new loot', () => {
  const s = createState();
  for (let i = 0; i < INVENTORY_CAP; i++) addToInventory(s, 'strawHat');
  assert.equal(s.combat.inventory.length, INVENTORY_CAP);

  const added = addToInventory(s, 'sunDiadem');
  assert.ok(added, 'a full bag must still accept a drop');
  assert.equal(s.combat.inventory.length, INVENTORY_CAP, 'bag stays at the cap');
  assert.ok(s.combat.inventory.some((i) => i.id === 'sunDiadem'));
});

test('a full bag never evicts something you are wearing', () => {
  const s = createState();
  const worn = addToInventory(s, 'strawHat');
  equip(s, worn.uid);
  for (let i = 0; i < INVENTORY_CAP; i++) addToInventory(s, 'strawHat');

  addToInventory(s, 'geodeCrown');
  assert.ok(
    s.combat.inventory.some((i) => i.uid === worn.uid),
    'the equipped piece was evicted',
  );
});

test('inventory uids are unique', () => {
  const s = createState();
  for (let i = 0; i < 200; i++) addToInventory(s, 'strawHat');
  const uids = new Set(s.combat.inventory.map((i) => i.uid));
  assert.equal(uids.size, s.combat.inventory.length);
});

// ----------------------------------------------------------------- forge

test('forging costs shards, raises the level, and stops at +15', () => {
  const s = createState();
  const entry = addToInventory(s, 'bambooRod');
  s.combat.shards = 1e9;

  const price = forgePrice(entry);
  const result = forge(s, entry.uid);
  assert.equal(result.ok, true);
  assert.equal(entry.forge, 1);
  assert.equal(s.combat.shards, 1e9 - price);

  for (let i = 1; i < MAX_FORGE; i++) forge(s, entry.uid);
  assert.equal(entry.forge, MAX_FORGE);
  assert.equal(forge(s, entry.uid).reason, 'maxed');
});

test('forging is refused without the shards, and costs nothing', () => {
  const s = createState();
  const entry = addToInventory(s, 'bambooRod');
  s.combat.shards = 0;
  assert.equal(forge(s, entry.uid).reason, 'shards');
  assert.equal(entry.forge, 0);
  assert.equal(s.combat.shards, 0);
});

test('forge prices climb with level and with rung', () => {
  assert.ok(forgePrice({ id: 'bambooRod', forge: 5 }) > forgePrice({ id: 'bambooRod', forge: 0 }));
  assert.ok(
    forgePrice({ id: 'bambooRod', forge: 0, tier: 12 }) > forgePrice({ id: 'bambooRod', forge: 0, tier: 2 }),
    'a piece high on the ladder should cost more to enhance',
  );
});

test('scrapping refunds shards and refuses equipped pieces', () => {
  const s = createState();
  const entry = addToInventory(s, 'geodeCrown');
  s.combat.shards = 1e9;
  forge(s, entry.uid);
  forge(s, entry.uid);

  equip(s, entry.uid);
  assert.equal(scrap(s, entry.uid).reason, 'equipped');

  delete s.combat.equipped.hat;
  const before = s.combat.shards;
  const result = scrap(s, entry.uid);
  assert.equal(result.ok, true);
  assert.ok(result.shards > 0, 'scrapping should refund something');
  assert.equal(s.combat.shards, before + result.shards);
  assert.equal(s.combat.inventory.length, 0);
  assert.equal(scrap(s, entry.uid).reason, 'missing');
});

// ---------------------------------------------------------------- combat

test('a fight resolves and clearing a stage advances you', () => {
  const s = combatReady();
  s.combat.xp = 1e7; // overwhelming, so the fight ends quickly
  const stats = combatStats(s);
  const combat = new Combat(s);

  let rewarded = null;
  for (let i = 0; i < 4000 && s.combat.depth === 0; i++) {
    combat.update(0.05, stats, (r) => { rewarded = r; });
  }

  assert.ok(rewarded, 'clearing a stage should pay out');
  assert.equal(s.combat.depth, 1);
  assert.equal(s.combat.clears, 1);
  // bestStage must cover the stage you are now standing on, not the one you
  // just cleared — reconcileState clamps stage to bestStage on load, so
  // lagging by one silently rolled the player back on every reload.
  assert.equal(s.combat.bestDepth, 1);
});

test('progress survives a save/load round trip without slipping back', () => {
  const s = combatReady();
  s.combat.xp = 1e7;
  const stats = combatStats(s);
  const combat = new Combat(s);

  for (let i = 0; i < 20000 && s.combat.depth < 6; i++) combat.update(0.05, stats, () => {});
  assert.ok(s.combat.depth >= 6, 'should have made progress to test against');

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.combat.depth, s.combat.depth, 'a reload lost a stage of progress');
  assert.equal(reloaded.combat.bestDepth, s.combat.bestDepth);
});

test('repeated defeats fall back a stage instead of parking on a wall', () => {
  const s = combatReady();
  s.combat.depth = 40;
  s.combat.bestDepth = 40;
  const stats = combatStats(s); // level 1 against stage 40: hopeless
  const combat = new Combat(s);

  for (let i = 0; i < 8000 && s.combat.depth === 40; i++) {
    combat.update(0.05, stats, () => {});
  }
  assert.ok(s.combat.depth < 40, 'should retreat after repeated wipes');
});

test('auto-battle off means nothing happens', () => {
  const s = combatReady();
  s.combat.autoBattle = false;
  const combat = new Combat(s);
  for (let i = 0; i < 200; i++) combat.update(0.05, combatStats(s), () => {});
  assert.equal(combat.phase, 'idle');
  assert.equal(s.combat.clears, 0);
});

test('travel is clamped to stages you have actually reached', () => {
  const s = combatReady();
  s.combat.bestDepth = 5;
  const combat = new Combat(s);

  combat.travelTo(99);
  assert.equal(s.combat.depth, 5, 'cannot skip ahead');
  combat.travelTo(-4);
  assert.equal(s.combat.depth, 0, 'cannot go before the start');
});

test('elemental stance changes how hard you hit', () => {
  // Read the damage off the emitted hit event rather than off the enemy's HP:
  // a one-shot would clamp the HP delta to the enemy's health pool and make
  // every stance look identical.
  const dealt = (element) => {
    const s = combatReady();
    s.combat.xp = 5000;
    s.combat.depth = 0; // Reedbank — leaf enemies
    s.combat.element = element;

    const combat = new Combat(s);
    combat.engage(combatStats(s));
    combat.drainEvents();
    combat.playerAttack({ ...combatStats(s), crit: 0 });
    return combat.drainEvents().find((e) => e.kind === 'hit').amount;
  };

  const strong = dealt('ember'); // ember beats leaf
  const weak = dealt('water'); // leaf beats water
  const neutral = dealt('moon'); // off the triangle

  assert.ok(strong > neutral, `ember ${strong} should beat neutral ${neutral} against leaf`);
  assert.ok(neutral > weak, `neutral ${neutral} should beat water ${weak} against leaf`);
  assert.ok(Math.abs(strong / weak - 2) < 1e-9, '1.5x versus 0.75x is exactly double');
});

test('active skills fire on cooldown and deal damage', () => {
  const s = combatReady();
  s.combat.xp = 20000;
  s.combat.skills = ['chomp'];
  const stats = { ...combatStats(s), crit: 0 };
  const combat = new Combat(s);
  combat.engage(stats);

  const before = combat.enemy.hp;
  for (let i = 0; i < 200 && combat.phase === 'fighting'; i++) combat.update(0.05, stats, () => {});
  assert.ok(combat.enemy.hp < before || combat.phase === 'won');

  const fired = combat.drainEvents().some((e) => e.kind === 'skill' && e.skill === 'Chomp');
  assert.ok(fired || s.combat.clears > 0, 'Chomp should have fired');
});

// ------------------------------------------------------------------ saves

test('a save with a broken combat block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 1,
    combat: {
      depth: 50,
      bestDepth: 3,
      inventory: 'not an array',
      equipped: ['also', 'wrong'],
      skills: { nope: true },
      xp: NaN,
      shards: -20,
    },
  });

  assert.deepEqual(s.combat.inventory, []);
  assert.deepEqual(s.combat.equipped, {});
  assert.deepEqual(s.combat.skills, []);
  assert.equal(s.combat.xp, 0);
  assert.equal(s.combat.shards, 0);
  assert.equal(s.combat.depth, 3, 'cannot stand past your best depth');
});

test('equip references to missing items are dropped on load', () => {
  const s = reconcileState({
    version: 1,
    combat: { inventory: [{ uid: 'a', id: 'strawHat', forge: 0 }], equipped: { hat: 'a', rod: 'ghost' } },
  });
  assert.equal(s.combat.equipped.hat, 'a');
  assert.equal(s.combat.equipped.rod, undefined);
});

test('resolveItem tolerates entries for gear that no longer exists', () => {
  assert.equal(resolveItem({ uid: 'x', id: 'removedInPatch7' }), null);
  assert.equal(resolveItem(null), null);
});

test('skill slots are capped', () => {
  assert.equal(SKILL_SLOTS, 3);
  assert.ok(SKILLS.every((s) => SKILLS_BY_ID[s.id] === s));
});
