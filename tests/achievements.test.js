import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  COUNTER_KEYS,
  PREDICATE_KEYS,
  achievementMet,
  counters,
} from '../src/data/achievements.js';
import { checkAchievements, achievementProgress, describeReward } from '../src/systems/achievements.js';
import { createState } from '../src/state.js';
import { TREE_BRANCHES } from '../src/data/rebirthTree.js';

test('the table is the promised size and every id is unique', () => {
  assert.ok(ACHIEVEMENTS.length >= 200, `only ${ACHIEVEMENTS.length}`);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});

test('every requirement names a counter or a predicate that exists', () => {
  // The whole reason counters() is a flat map: a typo here used to produce an
  // achievement that silently could never be earned. Now it fails the suite.
  for (const ach of ACHIEVEMENTS) {
    assert.ok(Object.keys(ach.req).length > 0, `${ach.id}: empty requirement`);
    for (const key of Object.keys(ach.req)) {
      assert.ok(
        COUNTER_KEYS.has(key) || PREDICATE_KEYS.has(key),
        `${ach.id}: requirement "${key}" is neither a counter nor a predicate`,
      );
    }
  }
});

test('every achievement pays, and the payout can be described', () => {
  for (const ach of ACHIEVEMENTS) {
    assert.ok(ach.reward, `${ach.id}: no reward — achievements must pay`);
    assert.ok(describeReward(ach.reward), `${ach.id}: reward has no description`);
  }
});

test('counters read a fresh save without throwing, and every value is a number', () => {
  const have = counters(createState());
  for (const [key, value] of Object.entries(have)) {
    assert.equal(typeof value, 'number', `${key} is ${typeof value}`);
    assert.ok(Number.isFinite(value), `${key} is not finite`);
  }
});

test('counters survive a state stripped to nothing', () => {
  // The reconciler should never hand us one of these, but counters() is called
  // every slow tick and a thrown error there takes the whole loop down.
  assert.doesNotThrow(() => counters({}));
  assert.equal(COUNTER_KEYS.size, Object.keys(counters({})).length);
});

test('a fresh save has earned nothing', () => {
  const s = createState();
  assert.deepEqual(checkAchievements(s), []);
  assert.equal(achievementProgress(s).done, 0);
  assert.equal(achievementProgress(s).total, ACHIEVEMENTS.length);
});

test('a full clear is worth about x68 income, not x8,000,000', () => {
  // This is the test the balance pass exists for. Two hundred entries each
  // paying "just a few percent" compound into a number that makes every other
  // system in the game irrelevant; the band scale in data/achievements.js keeps
  // the total somewhere a human chose. If a new entry pushes past this, the
  // fix is a smaller band, not a bigger ceiling.
  let global = 1;
  for (const ach of ACHIEVEMENTS) {
    if (ach.reward?.type === 'globalMult') global *= ach.reward.value;
  }
  assert.ok(global > 50, `full clear pays only x${global.toFixed(1)}`);
  assert.ok(global < 100, `full clear pays x${global.toFixed(1)} — too much`);
});

test('no single achievement is worth more than a rebirth', () => {
  for (const ach of ACHIEVEMENTS) {
    if (ach.reward?.type?.endsWith('Mult')) {
      assert.ok(ach.reward.value <= 2, `${ach.id} pays x${ach.reward.value}`);
    }
  }
});

test('the milestone ladders are monotonic', () => {
  // Within a family, a later entry must ask for more and pay at least as much.
  const families = [
    ['firstTap', 'tap100', 'tap1k', 'tap10k', 'tap100k', 'tap1m', 'tap10m'],
    ['zen1k', 'zen1m', 'zen1b', 'zen1t', 'zen1qa', 'zen1qi', 'zen1sx', 'zen1sp', 'zen1e30', 'zen1e45'],
    ['zps1m', 'zps1b', 'zps1t', 'zps1e18'],
    ['handmade1m', 'handmade1b', 'handmade1t'],
    ['firstBuild', 'build25', 'build100', 'build250', 'build500', 'build1000', 'build2500', 'build5000'],
    ['everyTen', 'everyFifty', 'everyHundred'],
    ['upgrade10', 'upgrade40', 'upgrade100'],
    ['firstFight', 'clear50', 'clear500', 'clear2500', 'clear10k', 'clear50k'],
    ['firstBoss', 'boss5', 'boss12', 'boss50', 'boss250', 'boss1000'],
    ['stage25', 'stage60', 'stage100', 'stage150', 'stage250', 'stage500'],
    ['level10', 'level30', 'level60', 'level100', 'level200'],
    ['firstDrop', 'drop100', 'drop1k', 'drop10k'],
    ['firstForge', 'forge100', 'forge1k'],
    ['twoStar', 'threeStar', 'fourStar', 'fiveStar'],
    ['firstFuse', 'fuse25', 'fuse100'],
    ['firstRebirth', 'rebirth5', 'rebirth10', 'rebirth25', 'rebirth50', 'rebirth100'],
    ['essence1k', 'essence100k', 'essence10m'],
    ['tree10', 'tree50', 'tree120', 'tree210'],
    ['firstAscend', 'ascend5', 'ascend20'],
    ['firstLeaf', 'leaf1k', 'leaf10k', 'leaf50k'],
    ['reed10', 'reed100'],
    ['onsen10', 'onsenCase50'],
    ['astral10', 'astral50'],
    ['firstLook', 'looks10', 'looks24'],
    ['pass10', 'pass50', 'pass100'],
    ['season2', 'season5', 'season8'],
    ['firstPetal', 'petal1k', 'petal10k'],
    ['streak3', 'streak7', 'streak30'],
    ['quest10', 'quest100', 'quest500'],
    ['chest10', 'chest100'],
    ['firstPull', 'pull100', 'pull500'],
    ['friends12', 'friends24'],
    ['firstBeat', 'actOne', 'actTwo', 'storyDone'],
    ['rarity10', 'rarity20'],
    ['patient', 'marathon'],
    ['idleHands', 'trulyIdle'],
  ];
  for (const family of families) {
    let lastReq = -Infinity;
    let lastPay = 0;
    for (const id of family) {
      const ach = ACHIEVEMENTS_BY_ID[id];
      assert.ok(ach, `${id} is missing`);
      // Requirements are usually a number; the keyed ones ({ id, count })
      // carry theirs in `count`.
      const raw = Object.values(ach.req)[0];
      const req = typeof raw === 'object' ? raw.count : raw;
      assert.ok(req > lastReq, `${id} asks for no more than the one before it`);
      assert.ok(ach.reward.value >= lastPay, `${id} pays less than the one before it`);
      lastReq = req;
      lastPay = ach.reward.value;
    }
  }
});

test('a threshold requirement unlocks exactly at the threshold', () => {
  const s = createState();
  s.lifetimeClicks = 99;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.tap100, s), false);
  s.lifetimeClicks = 100;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.tap100, s), true);
});

test('an achievement fires once and stays fired', () => {
  const s = createState();
  s.lifetimeClicks = 1;
  const first = checkAchievements(s, 1000);
  assert.ok(first.some((a) => a.id === 'firstTap'));
  assert.deepEqual(checkAchievements(s, 2000), []);
  assert.equal(s.achievements.firstTap, 1000, 'the unlock time is not overwritten');
});

test('a multi-key requirement needs every key', () => {
  const ach = { id: 'test', req: { clicks: 10, crits: 5 }, reward: {} };
  const s = createState();
  s.lifetimeClicks = 10;
  assert.equal(achievementMet(ach, s), false);
  s.stats.crits = 5;
  assert.equal(achievementMet(ach, s), true);
});

// ---------------------------------------------------------------- predicates

test('everyBuilding wants the minimum, not the total', () => {
  const s = createState();
  const ids = Object.keys(s.buildings);
  for (const id of ids) s.buildings[id] = 100;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.everyTen, s), true);
  // One line left behind is enough to fail it, however big the pile is.
  s.buildings[ids[0]] = 9;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.everyTen, s), false);
});

test('branch requirements count ranks in that branch alone', () => {
  const s = createState();
  // Ranks in every other branch must not pay for Might.
  for (const branch of TREE_BRANCHES) {
    if (branch.id === 'might') continue;
    s.tree[`${branch.id}1`] = 200;
  }
  assert.equal(counters(s).deepestBranch >= 200, true);
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.branchMight, s), false);
});

test('the pacifist is undone by a single win', () => {
  const s = createState();
  s.totalZen = 1e6;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.pacifist, s), true);
  s.combat.clears = 1;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.pacifist, s), false);
});

test('the unarmed run is undone by equipping anything', () => {
  const s = createState();
  s.combat.bestDepth = 100;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.unarmed, s), true);
  s.combat.equipped = { head: 'abc' };
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.unarmed, s), false);
});

test('the free rider is undone by a premium track in any season', () => {
  const s = createState();
  s.pass.bestLevel = 60;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.loyalist, s), true);
  s.pass.history = [{ index: 0, level: 40, premium: true, claimed: 3 }];
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.loyalist, s), false, 'a past season still counts');
});

test('the listener is undone by having turned the skip toggle on', () => {
  const s = createState();
  for (let i = 0; i < 20; i++) s.story.seen[`beat${i}`] = 1;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.listener, s), true);
  s.story.skip = true;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.listener, s), false);
});

test('leafsSpent is derived and never goes negative', () => {
  const s = createState();
  s.lifetimeLeafs = 500;
  s.leafs = 500;
  assert.equal(counters(s).leafsSpent, 0);
  s.leafs = 200;
  assert.equal(counters(s).leafsSpent, 300);
  // A save whose live balance somehow exceeds its lifetime total must not
  // produce a negative that then satisfies every "spent at least" requirement.
  s.leafs = 900;
  assert.equal(counters(s).leafsSpent, 0);
});

test('the cache achievements read the lifetime counter, not the live tank', () => {
  const s = createState();
  s.cache.zen = 1e12;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.cache1, s), false, 'sitting on it is not collecting it');
  s.stats.cacheZen = 1;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.cache1, s), true);
});

test('the spill achievement fires on the cache having overflowed', () => {
  const s = createState();
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.overflowed, s), false);
  s.cache.lostMs = 1;
  assert.equal(achievementMet(ACHIEVEMENTS_BY_ID.overflowed, s), true);
});

test('every system in the game has at least one achievement pointing at it', () => {
  // The point of going to 232 was coverage, so the coverage is asserted rather
  // than assumed. Each key below must be reachable by at least one entry.
  const wanted = [
    'clicks', 'lifetimeZen', 'buildings', 'clears', 'bossKills', 'stage', 'drops',
    'forges', 'stars', 'fuses', 'rebirths', 'treeNodes', 'ascensions', 'constellations',
    'lifetimeLeafs', 'cases', 'cosmetics', 'boosts', 'passLevel', 'petals', 'streak',
    'quests', 'chests', 'codes', 'beats', 'cacheZen', 'pulls', 'companions',
  ];
  const used = new Set(ACHIEVEMENTS.flatMap((a) => Object.keys(a.req)));
  for (const key of wanted) assert.ok(used.has(key), `nothing tests ${key}`);
});

test('secret achievements exist and are a minority', () => {
  const secret = ACHIEVEMENTS.filter((a) => a.secret);
  assert.ok(secret.length >= 8);
  assert.ok(secret.length < ACHIEVEMENTS.length / 10, 'too much of the list is hidden');
});

test('no reward ever describes itself as paying nothing', () => {
  // The SMALL band is +0.5%, and rounding that to a whole number prints
  // "+0% all income" under a list whose whole premise is that every one pays.
  for (const ach of ACHIEVEMENTS) {
    const text = describeReward(ach.reward);
    // A zero not preceded by a digit or a decimal point — "+0%" and "+0.0%"
    // are the failure, "+1.0% per combo" is not.
    assert.ok(!/(?:^|[^\d.])0(?:\.0+)?%/.test(text), `${ach.id} describes itself as "${text}"`);
  }
});
