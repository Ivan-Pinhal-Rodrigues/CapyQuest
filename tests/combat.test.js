// Combat, gear, loot and the forge.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { Combat, buildEnemy, enemyForStage } from '../src/systems/combat.js';
import { combatStats, equippedItems, equippedBonuses, resolveItem, xpForStage } from '../src/systems/combatStats.js';
import { rollLoot, shardDrop, addToInventory, equip, scrap, forge, forgePrice, MAX_FORGE, INVENTORY_CAP, rarityCeiling } from '../src/systems/loot.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { ZONES, STAGES_PER_ZONE, MAX_STAGE, zoneForStage, stageInZone, isBossStage } from '../src/data/zones.js';
import { ENEMIES } from '../src/data/enemies.js';
import { GEAR, GEAR_BY_ID, SLOT_IDS, rarityRank, RARITY_ORDER } from '../src/data/gear.js';
import { SKILLS, SKILLS_BY_ID, SKILL_SLOTS } from '../src/data/skills.js';
import { ELEMENTS, ELEMENT_IDS } from '../src/data/elements.js';
import { ENEMY_SHAPES } from '../src/render/enemySprites.js';
import { GEAR_SHAPES } from '../src/render/gearSprites.js';
import { makeRng } from '../src/balance.js';

function combatReady() {
  const s = createState();
  s.combat.unlocked = true;
  s.combat.autoBattle = true;
  return s;
}

// -------------------------------------------------------------- content

test('the promised RPG content counts are there', () => {
  assert.equal(ZONES.length, 12, 'zones');
  assert.equal(MAX_STAGE + 1, 120, 'stages');
  assert.equal(GEAR.length, 42, 'gear pieces');
  assert.equal(SKILLS.length, 18, 'skills');
  assert.equal(Object.keys(ENEMIES).length, 25, 'enemies + bosses');
  assert.equal(Object.keys(ENEMY_SHAPES).length, 8, 'enemy shape templates');
});

test('every zone references real enemies, a real boss, and a real element', () => {
  for (const zone of ZONES) {
    assert.ok(ELEMENTS[zone.element], `${zone.id}: unknown element`);
    assert.ok(zone.enemies.length > 0, `${zone.id}: no enemies`);
    for (const id of zone.enemies) assert.ok(ENEMIES[id], `${zone.id}: unknown enemy "${id}"`);
    assert.ok(ENEMIES[zone.boss], `${zone.id}: unknown boss "${zone.boss}"`);
    assert.ok(ENEMIES[zone.boss].boss, `${zone.id}: "${zone.boss}" is not marked as a boss`);
  }
});

test('every enemy has a real shape, a real element and a full palette', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    const shape = ENEMY_SHAPES[e.shape];
    assert.ok(shape, `${id}: unknown shape "${e.shape}"`);
    assert.ok(ELEMENTS[e.element], `${id}: unknown element`);
    assert.ok(e.name && e.blurb, `${id}: missing copy`);
    for (const row of shape.rows) {
      for (const ch of row) assert.ok(ch in e.palette, `${id}: palette has no entry for "${ch}"`);
    }
  }
});

test('every gear piece has a real slot, rarity, shape and complete palette', () => {
  const seen = new Set();
  for (const g of GEAR) {
    assert.ok(!seen.has(g.id), `duplicate gear id "${g.id}"`);
    seen.add(g.id);
    assert.ok(SLOT_IDS.includes(g.slot), `${g.id}: unknown slot`);
    assert.ok(RARITY_ORDER.includes(g.rarity), `${g.id}: unknown rarity`);
    assert.ok(GEAR_SHAPES[g.slot], `${g.id}: no shape for slot`);
    assert.ok(g.name && g.blurb, `${g.id}: missing copy`);
    assert.ok(Object.keys(g.stats).length > 0, `${g.id}: no stats`);
  }
});

test('every slot has gear across a spread of rarities', () => {
  for (const slot of SLOT_IDS) {
    const pieces = GEAR.filter((g) => g.slot === slot);
    assert.ok(pieces.length >= 6, `${slot}: only ${pieces.length} pieces`);
    const rarities = new Set(pieces.map((p) => p.rarity));
    assert.ok(rarities.size >= 4, `${slot}: only ${rarities.size} distinct rarities`);
  }
});

test('rarer gear is stronger within a slot', () => {
  for (const slot of SLOT_IDS) {
    const pieces = GEAR.filter((g) => g.slot === slot)
      .slice()
      .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
    const total = (p) => Object.values(p.stats).reduce((a, b) => a + b, 0);
    assert.ok(total(pieces.at(-1)) > total(pieces[0]), `${slot}: top rarity is not stronger than the bottom`);
  }
});

test('skills unlock in order and declare what they do', () => {
  for (const s of SKILLS) {
    assert.ok(s.name && s.blurb, `${s.id}: missing copy`);
    assert.ok(['active', 'passive'].includes(s.kind), `${s.id}: bad kind`);
    if (s.kind === 'active') {
      assert.ok(s.cooldown > 0, `${s.id}: active skill with no cooldown`);
      assert.ok(s.effect?.type, `${s.id}: active skill with no effect`);
    } else {
      assert.ok(s.stats || s.bonus, `${s.id}: passive that does nothing`);
    }
    assert.ok(s.req.stage <= MAX_STAGE, `${s.id}: unlocks past the last stage`);
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

test('stage maths maps onto zones correctly', () => {
  assert.equal(zoneForStage(0).id, ZONES[0].id);
  assert.equal(zoneForStage(STAGES_PER_ZONE).id, ZONES[1].id);
  assert.equal(stageInZone(0), 1);
  assert.equal(stageInZone(STAGES_PER_ZONE - 1), STAGES_PER_ZONE);
  assert.equal(isBossStage(STAGES_PER_ZONE - 1), true);
  assert.equal(isBossStage(0), false);
  // Past the last zone we clamp rather than reading off the end.
  assert.equal(zoneForStage(9999).id, ZONES.at(-1).id);
});

test('boss stages hold the zone boss, ordinary stages do not', () => {
  for (let z = 0; z < ZONES.length; z++) {
    const bossStage = z * STAGES_PER_ZONE + (STAGES_PER_ZONE - 1);
    assert.equal(enemyForStage(bossStage).id, ZONES[z].boss);
    const normal = enemyForStage(z * STAGES_PER_ZONE);
    assert.ok(!normal.boss, `stage ${z * STAGES_PER_ZONE} should not be a boss`);
  }
});

test('enemies get harder every stage and bosses are a spike', () => {
  const early = buildEnemy(0);
  const late = buildEnemy(60);
  assert.ok(late.maxHp > early.maxHp * 100);
  assert.ok(late.atk > early.atk);

  const before = buildEnemy(STAGES_PER_ZONE - 2);
  const boss = buildEnemy(STAGES_PER_ZONE - 1);
  assert.ok(boss.boss);
  assert.ok(boss.maxHp > before.maxHp * 4, 'a boss should be a real wall');
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

test('loot never exceeds the rarity ceiling for its stage', () => {
  const rng = makeRng(7);
  for (const stage of [0, 5, 20, 40, 60, 90, 119]) {
    const ceiling = rarityRank(rarityCeiling(stage));
    for (let i = 0; i < 300; i++) {
      const drop = rollLoot(stage, { isBoss: true, luck: 500, rng });
      if (!drop) continue;
      assert.ok(
        rarityRank(drop.rarity) <= ceiling,
        `stage ${stage} dropped ${drop.rarity}, ceiling is ${rarityCeiling(stage)}`,
      );
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

test('forge prices climb with level and with rarity', () => {
  assert.ok(forgePrice({ id: 'bambooRod', forge: 5 }) > forgePrice({ id: 'bambooRod', forge: 0 }));
  assert.ok(
    forgePrice({ id: 'theLongNap', forge: 0 }) > forgePrice({ id: 'stickRod', forge: 0 }),
    'a capybaric piece should cost more to enhance than a common one',
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
  for (let i = 0; i < 4000 && s.combat.stage === 0; i++) {
    combat.update(0.05, stats, (r) => { rewarded = r; });
  }

  assert.ok(rewarded, 'clearing a stage should pay out');
  assert.equal(s.combat.stage, 1);
  assert.equal(s.combat.clears, 1);
  // bestStage must cover the stage you are now standing on, not the one you
  // just cleared — reconcileState clamps stage to bestStage on load, so
  // lagging by one silently rolled the player back on every reload.
  assert.equal(s.combat.bestStage, 1);
});

test('progress survives a save/load round trip without slipping back', () => {
  const s = combatReady();
  s.combat.xp = 1e7;
  const stats = combatStats(s);
  const combat = new Combat(s);

  for (let i = 0; i < 20000 && s.combat.stage < 6; i++) combat.update(0.05, stats, () => {});
  assert.ok(s.combat.stage >= 6, 'should have made progress to test against');

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.combat.stage, s.combat.stage, 'a reload lost a stage of progress');
  assert.equal(reloaded.combat.bestStage, s.combat.bestStage);
});

test('repeated defeats fall back a stage instead of parking on a wall', () => {
  const s = combatReady();
  s.combat.stage = 40;
  s.combat.bestStage = 40;
  const stats = combatStats(s); // level 1 against stage 40: hopeless
  const combat = new Combat(s);

  for (let i = 0; i < 8000 && s.combat.stage === 40; i++) {
    combat.update(0.05, stats, () => {});
  }
  assert.ok(s.combat.stage < 40, 'should retreat after repeated wipes');
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
  s.combat.bestStage = 5;
  const combat = new Combat(s);

  combat.travelTo(99);
  assert.equal(s.combat.stage, 5, 'cannot skip ahead');
  combat.travelTo(-4);
  assert.equal(s.combat.stage, 0, 'cannot go before the start');
});

test('elemental stance changes how hard you hit', () => {
  // Read the damage off the emitted hit event rather than off the enemy's HP:
  // a one-shot would clamp the HP delta to the enemy's health pool and make
  // every stance look identical.
  const dealt = (element) => {
    const s = combatReady();
    s.combat.xp = 5000;
    s.combat.stage = 0; // Reedbank — leaf enemies
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
      stage: 50,
      bestStage: 3,
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
  assert.equal(s.combat.stage, 3, 'cannot stand past your best stage');
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
