// Quests, login streak, chests, the Zen Pass and codes.
//
// All the date maths takes an explicit `now`, so these move time without
// touching the system clock. The cases that matter most are the ugly ones:
// a day skipped, a week boundary, a clock that went backwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { rebirth } from '../src/systems/rebirth.js';
import { ascend } from '../src/systems/ascension.js';
import {
  dayKey, weekKey, daysBetween, msUntilTomorrow,
  rollQuests, activeQuests, claimQuest, questSummary, counters,
  checkLogin, loginCalendar,
  chestsReady, chestProgress, msUntilNextChest, collectChests,
  passLevel, passProgress, addPassXp, passTrack, claimPassLevel, unclaimedPassLevels,
  redeemCode,
  CHEST_FILL_MS, CHEST_MAX_STORED, PASS_LEVELS,
} from '../src/systems/quests.js';
import { grantReward, describeGrant, rewardBase } from '../src/systems/rewards.js';
import { DAILY_POOL, WEEKLY_POOL, DAILY_COUNT, WEEKLY_COUNT, LOGIN_REWARDS, passReward } from '../src/data/quests.js';
import { CODES, normaliseCode, lookupCode } from '../src/data/codes.js';

/** Midday on a given date, to keep away from midnight boundaries. */
function at(y, m, d, h = 12) {
  return new Date(y, m - 1, d, h, 0, 0, 0).getTime();
}

const MONDAY = at(2026, 8, 24);
const TUESDAY = at(2026, 8, 25);
const WEDNESDAY = at(2026, 8, 26);
const NEXT_MONDAY = at(2026, 8, 31);

// -------------------------------------------------------------------- dates

test('day keys are local calendar days', () => {
  assert.equal(dayKey(at(2026, 8, 25, 0)), '2026-08-25');
  assert.equal(dayKey(at(2026, 8, 25, 23)), '2026-08-25');
  assert.notEqual(dayKey(TUESDAY), dayKey(WEDNESDAY));
});

test('week keys roll over on Monday', () => {
  assert.equal(weekKey(MONDAY), weekKey(WEDNESDAY), 'same week');
  assert.notEqual(weekKey(WEDNESDAY), weekKey(NEXT_MONDAY), 'new week on Monday');
  // A Sunday belongs to the week that started the Monday before it.
  assert.equal(weekKey(at(2026, 8, 30)), weekKey(MONDAY));
});

test('daysBetween ignores the time of day', () => {
  assert.equal(daysBetween(at(2026, 8, 24, 23), at(2026, 8, 25, 1)), 1);
  assert.equal(daysBetween(at(2026, 8, 24, 1), at(2026, 8, 24, 23)), 0);
  assert.equal(daysBetween(MONDAY, NEXT_MONDAY), 7);
});

test('the daily countdown never exceeds a day', () => {
  const ms = msUntilTomorrow(at(2026, 8, 25, 23));
  assert.ok(ms > 0 && ms <= 86400000);
});

// ------------------------------------------------------------------ quests

test('rolling quests picks the promised number of each kind', () => {
  const s = createState();
  const rolled = rollQuests(s, TUESDAY);

  assert.equal(rolled.daily, true);
  assert.equal(rolled.weekly, true);
  assert.equal(s.quests.daily.length, DAILY_COUNT);
  assert.equal(s.quests.weekly.length, WEEKLY_COUNT);
  assert.equal(activeQuests(s).length, DAILY_COUNT + WEEKLY_COUNT);
});

test('quest selection is stable within a day and changes the next', () => {
  const a = createState();
  const b = createState();
  rollQuests(a, TUESDAY);
  rollQuests(b, at(2026, 8, 25, 20)); // same day, different hour
  assert.deepEqual(a.quests.daily, b.quests.daily, 'the same day must offer the same quests');

  const c = createState();
  rollQuests(c, WEDNESDAY);
  assert.notDeepEqual(a.quests.daily, c.quests.daily, 'a new day should offer different quests');
});

test('quests never duplicate within a period', () => {
  for (const day of [TUESDAY, WEDNESDAY, NEXT_MONDAY]) {
    const s = createState();
    rollQuests(s, day);
    assert.equal(new Set(s.quests.daily).size, s.quests.daily.length);
    assert.equal(new Set(s.quests.weekly).size, s.quests.weekly.length);
  }
});

test('re-rolling on the same day is a no-op', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  const first = [...s.quests.daily];
  s.lifetimeClicks = 500;

  const rolled = rollQuests(s, at(2026, 8, 25, 18));
  assert.equal(rolled.daily, false);
  assert.deepEqual(s.quests.daily, first);
});

test('quest progress measures only this period', () => {
  const s = createState();
  s.lifetimeClicks = 10000; // a long history before today
  rollQuests(s, TUESDAY);

  s.quests.daily = ['d_tap']; // 250 taps
  assert.equal(activeQuests(s)[0].progress, 0, 'yesterday should not count toward today');

  s.lifetimeClicks += 100;
  assert.equal(activeQuests(s)[0].progress, 100);
  assert.equal(activeQuests(s)[0].done, false);

  s.lifetimeClicks += 200;
  const quest = activeQuests(s)[0];
  assert.equal(quest.progress, 250, 'progress is capped at the goal');
  assert.equal(quest.done, true);
});

test('claiming pays once and only when finished', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  s.quests.daily = ['d_tap'];

  assert.equal(claimQuest(s, 'd_tap'), null, 'cannot claim an unfinished quest');

  s.lifetimeClicks += 250;
  const reward = claimQuest(s, 'd_tap');
  assert.ok(reward, 'a finished quest should pay');
  assert.equal(claimQuest(s, 'd_tap'), null, 'cannot claim twice');
  assert.equal(activeQuests(s)[0].claimed, true);
});

test('claiming an unknown quest is refused', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  assert.equal(claimQuest(s, 'nonsense'), null);
});

test('a new day resets dailies but leaves weeklies alone', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  s.quests.daily = ['d_tap'];
  const weeklyBefore = [...s.quests.weekly];
  s.lifetimeClicks += 250;
  claimQuest(s, 'd_tap');

  const rolled = rollQuests(s, WEDNESDAY);
  assert.equal(rolled.daily, true);
  assert.equal(rolled.weekly, false, 'the week has not turned');
  assert.deepEqual(s.quests.weekly, weeklyBefore);
  assert.deepEqual(s.quests.dailyClaimed, {}, 'claims reset with the day');
});

test('a new week resets weeklies', () => {
  const s = createState();
  rollQuests(s, WEDNESDAY);
  const before = [...s.quests.weekly];
  const rolled = rollQuests(s, NEXT_MONDAY);
  assert.equal(rolled.weekly, true);
  assert.notDeepEqual(s.quests.weekly, before);
});

test('the combo quest resets its high-water mark at rollover', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  s.stats.bestCombo = 40;
  s.quests.daily = ['d_combo']; // reach a 20x combo

  // A combo set yesterday must not complete today's quest.
  rollQuests(s, WEDNESDAY);
  s.quests.daily = ['d_combo'];
  assert.equal(s.stats.bestCombo, 0, 'the high-water mark resets with the day');
  assert.equal(activeQuests(s)[0].progress, 0);

  s.stats.bestCombo = 25;
  assert.equal(activeQuests(s)[0].done, true);
});

test('every quest in both pools reads a real counter', () => {
  const s = createState();
  const known = new Set(Object.keys(counters(s)));
  for (const quest of [...DAILY_POOL, ...WEEKLY_POOL]) {
    assert.ok(known.has(quest.track), `${quest.id}: unknown counter "${quest.track}"`);
    assert.ok(quest.goal > 0, `${quest.id}: non-positive goal`);
    assert.ok(quest.text, `${quest.id}: missing text`);
    assert.ok(quest.reward && Object.keys(quest.reward).length, `${quest.id}: no reward`);
  }
});

test('weekly goals are heavier than their daily counterparts', () => {
  for (const weekly of WEEKLY_POOL) {
    const daily = DAILY_POOL.filter((d) => d.track === weekly.track);
    if (!daily.length) continue;
    const hardestDaily = Math.max(...daily.map((d) => d.goal));
    assert.ok(weekly.goal > hardestDaily, `${weekly.id} is no harder than a daily`);
  }
});

test('quest summary counts what is claimable', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  s.quests.daily = ['d_tap'];
  s.quests.weekly = [];
  assert.equal(questSummary(s).ready, 0);

  s.lifetimeClicks += 250;
  assert.equal(questSummary(s).ready, 1);

  claimQuest(s, 'd_tap');
  assert.equal(questSummary(s).ready, 0);
  assert.equal(questSummary(s).done, 1);
});

// ------------------------------------------------------------ login streak

test('the first login starts a streak of one', () => {
  const s = createState();
  const reward = checkLogin(s, TUESDAY);
  assert.ok(reward);
  assert.equal(s.login.streak, 1);
  assert.equal(reward.streak, 1);
  assert.equal(reward.cycleDay, 1);
});

test('logging in twice in a day pays once', () => {
  const s = createState();
  checkLogin(s, TUESDAY);
  assert.equal(checkLogin(s, at(2026, 8, 25, 20)), null);
  assert.equal(s.login.streak, 1);
});

test('consecutive days build the streak', () => {
  const s = createState();
  checkLogin(s, MONDAY);
  checkLogin(s, TUESDAY);
  const third = checkLogin(s, WEDNESDAY);
  assert.equal(s.login.streak, 3);
  assert.equal(third.cycleDay, 3);
  assert.equal(s.login.total, 3);
});

test('missing a day restarts the streak but keeps the best', () => {
  const s = createState();
  checkLogin(s, MONDAY);
  checkLogin(s, TUESDAY);
  checkLogin(s, WEDNESDAY);
  assert.equal(s.login.best, 3);

  const afterGap = checkLogin(s, at(2026, 8, 29)); // skipped two days
  assert.equal(s.login.streak, 1, 'the streak restarts');
  assert.equal(s.login.best, 3, 'the best is remembered');
  assert.equal(afterGap.cycleDay, 1);
});

test('the calendar cycles every seven days', () => {
  const s = createState();
  let reward = null;
  for (let i = 0; i < 8; i++) reward = checkLogin(s, at(2026, 8, 24 + i));
  assert.equal(s.login.streak, 8);
  assert.equal(reward.cycleDay, 1, 'day 8 wraps back to the start of the cycle');
});

test('the seventh day is the best day', () => {
  const seventh = LOGIN_REWARDS[6];
  const first = LOGIN_REWARDS[0];
  assert.ok(seventh.zenMult > first.zenMult);
  assert.ok((seventh.tickets || 0) > (first.tickets || 0));
  assert.equal(LOGIN_REWARDS.length, 7);
});

test('the calendar marks past, present and pending days', () => {
  const s = createState();
  checkLogin(s, MONDAY);
  checkLogin(s, TUESDAY);
  checkLogin(s, WEDNESDAY);
  const cal = loginCalendar(s);
  assert.equal(cal.length, 7);
  assert.equal(cal[0].claimed, true);
  assert.equal(cal[1].claimed, true);
  assert.equal(cal[2].pending, true, 'day 3 is the one just earned');
});

// ------------------------------------------------------------------ chests

test('chests fill on a timer and cap out', () => {
  const s = createState();
  s.chest.lastAt = 0;

  assert.equal(chestsReady(s, CHEST_FILL_MS - 1), 0);
  assert.equal(chestsReady(s, CHEST_FILL_MS), 1);
  assert.equal(chestsReady(s, CHEST_FILL_MS * 3), 3);
  assert.equal(chestsReady(s, CHEST_FILL_MS * 99), CHEST_MAX_STORED, 'accrual stops at the cap');
});

test('collecting keeps partial progress toward the next chest', () => {
  const s = createState();
  s.chest.lastAt = 0;
  // Two full chests plus half of a third.
  const now = CHEST_FILL_MS * 2.5;

  const result = collectChests(s, now);
  assert.equal(result.count, 2);
  assert.equal(chestsReady(s, now), 0, 'both chests were taken');
  assert.ok(Math.abs(chestProgress(s, now) - 0.5) < 1e-9, 'the half-filled third survives');
});

test('collecting nothing is refused', () => {
  const s = createState();
  s.chest.lastAt = Date.now();
  assert.equal(collectChests(s, Date.now()), null);
});

test('the next-chest countdown is sane', () => {
  const s = createState();
  s.chest.lastAt = 0;
  assert.equal(msUntilNextChest(s, 0), CHEST_FILL_MS);
  assert.ok(Math.abs(msUntilNextChest(s, CHEST_FILL_MS * 0.25) - CHEST_FILL_MS * 0.75) < 1e-9);
  assert.equal(msUntilNextChest(s, CHEST_FILL_MS * 99), 0, 'no countdown when full');
});

test('a chest timer from the future is repaired on load', () => {
  // A clock that jumped backwards would otherwise stall chests forever.
  const now = Date.now();
  const s = reconcileState({ version: 1, chest: { lastAt: now + 86400000 } }, now);
  assert.ok(s.chest.lastAt <= now);
});

// ---------------------------------------------------------------- zen pass

test('pass levels advance with xp and stop at the cap', () => {
  assert.equal(passLevel(0), 1);
  assert.equal(passLevel(99), 1);
  assert.equal(passLevel(100), 2);
  assert.equal(passLevel(1e9), PASS_LEVELS);
});

test('adding xp reports a level-up exactly when one happens', () => {
  const s = createState();
  assert.equal(addPassXp(s, 50).levelled, false);
  const up = addPassXp(s, 50);
  assert.equal(up.levelled, true);
  assert.equal(up.from, 1);
  assert.equal(up.to, 2);
});

test('pass progress reports the fraction into the level', () => {
  const s = createState();
  s.pass.xp = 250;
  const p = passProgress(s);
  assert.equal(p.level, 3);
  assert.equal(p.into, 50);
  assert.ok(Math.abs(p.ratio - 0.5) < 1e-9);
  assert.equal(p.maxed, false);
});

test('pass levels claim once, and only once unlocked', () => {
  const s = createState();
  assert.equal(claimPassLevel(s, 5), null, 'cannot claim a level you have not reached');

  s.pass.xp = 1000; // level 11
  assert.ok(claimPassLevel(s, 5));
  assert.equal(claimPassLevel(s, 5), null, 'cannot claim twice');
  assert.equal(passTrack(s).find((t) => t.level === 5).claimed, true);
});

test('unclaimed pass levels drive the badge', () => {
  const s = createState();
  assert.equal(unclaimedPassLevels(s), 1, 'level 1 is available immediately');
  s.pass.xp = 400; // level 5
  assert.equal(unclaimedPassLevels(s), 5);
  claimPassLevel(s, 1);
  assert.equal(unclaimedPassLevels(s), 4);
});

test('every pass level describes a real reward, and milestones are better', () => {
  for (let lvl = 1; lvl <= PASS_LEVELS; lvl++) {
    const reward = passReward(lvl);
    assert.ok(reward.text, `level ${lvl}: no description`);
    assert.ok(Object.keys(reward).length > 1, `level ${lvl}: nothing but text`);
  }
  assert.ok((passReward(10).tickets || 0) > (passReward(5).tickets || 0));
  assert.ok((passReward(5).tickets || 0) > (passReward(4).tickets || 0));
});

// ------------------------------------------------------------------- codes

test('codes are matched loosely and redeem once', () => {
  const s = createState();
  assert.equal(normaliseCode('  CAPY BARA  '), 'capybara');
  assert.ok(lookupCode('CapyBara'));

  const first = redeemCode(s, ' Capy-Bara ');
  assert.equal(first.ok, true);
  assert.ok(first.reward.tickets > 0);

  assert.equal(redeemCode(s, 'capybara').reason, 'used');
  assert.equal(redeemCode(s, 'notacode').reason, 'unknown');
});

test('every code pays something and describes itself', () => {
  for (const [key, code] of Object.entries(CODES)) {
    assert.equal(normaliseCode(key), key, `"${key}" is not in normalised form`);
    assert.ok(code.text, `${key}: no message`);
    const pays = (code.tickets || 0) + (code.shards || 0) + (code.zenMult || 0) + (code.zen || 0);
    assert.ok(pays > 0, `${key}: pays nothing`);
  }
});

// ----------------------------------------------------------------- rewards

test('reward bundles pay into the right currencies', () => {
  const s = createState();
  const derived = recomputeDerived(s);

  const grant = grantReward(s, { zenMult: 100, tickets: 2, shards: 50, pass: 30 }, derived);

  assert.ok(grant.zen > 0);
  assert.equal(s.zen, grant.zen);
  assert.equal(s.lifetimeZen, grant.zen, 'reward zen counts toward the run total');
  assert.equal(s.totalZen, grant.zen);
  assert.equal(s.gacha.tickets, 2);
  assert.equal(s.combat.shards, 50);
  assert.equal(s.pass.xp, 30);
});

test('zen rewards scale with what the player currently earns', () => {
  const poor = createState();
  const rich = createState();
  rich.buildings.capySingularity = 500;

  const poorGrant = grantReward(poor, { zenMult: 100 }, recomputeDerived(poor));
  const richGrant = grantReward(rich, { zenMult: 100 }, recomputeDerived(rich));

  assert.ok(richGrant.zen > poorGrant.zen * 1000, 'a late-game reward should stay meaningful');
  assert.ok(rewardBase(recomputeDerived(poor)) >= 10, 'there is always a floor');
});

test('an empty or missing reward is harmless', () => {
  const s = createState();
  assert.deepEqual(grantReward(s, null, recomputeDerived(s)).zen, 0);
  assert.equal(s.zen, 0);
  assert.equal(describeGrant({ zen: 0, tickets: 0, shards: 0, pass: 0 }, String), '');
});

test('a pass level-up during a grant is reported', () => {
  const s = createState();
  const grant = grantReward(s, { pass: 150 }, recomputeDerived(s));
  assert.ok(grant.passLevels);
  assert.equal(grant.passLevels.to, 2);
});

// ------------------------------------------------------- resets and saves

test('rebirth keeps the streak, quests, chest and pass', () => {
  const s = createState();
  s.lifetimeZen = 5e12;
  s.zen = 5e12;
  s.combat.depth = 95;
  s.combat.bestDepth = 95;
  s.rebirthUnlocked = true;
  rollQuests(s, TUESDAY);
  checkLogin(s, TUESDAY);
  s.pass.xp = 640;
  s.pass.claimed[3] = true;
  s.codes.capybara = 1;
  s.chest.lastAt = 12345;
  const dailyBefore = [...s.quests.daily];

  assert.equal(rebirth(s).ok, true);

  // Retention is keyed to the calendar, not to progression — resetting the
  // pond must not cost the player a streak they earned by showing up.
  assert.equal(s.login.streak, 1);
  assert.deepEqual(s.quests.daily, dailyBefore);
  assert.equal(s.pass.xp, 640);
  assert.equal(s.pass.claimed[3], true);
  assert.equal(s.codes.capybara, 1);
  assert.equal(s.chest.lastAt, 12345);
});

test('ascension keeps them too', () => {
  const s = createState();
  s.lifetimeEssence = 500000;
  checkLogin(s, TUESDAY);
  s.pass.xp = 900;
  s.codes.yuzu = 1;

  assert.equal(ascend(s).ok, true);
  assert.equal(s.login.streak, 1);
  assert.equal(s.pass.xp, 900);
  assert.equal(s.codes.yuzu, 1);
});

test('a mangled retention block is repaired, not fatal', () => {
  const now = Date.now();
  const s = reconcileState({
    version: 1,
    quests: { daily: 'nope', weekly: [1, 'd_tap', null], dailyClaimed: 5, dailyBase: { clicks: 'x' } },
    login: { streak: NaN, best: -3, lastDay: '2026-08-25' },
    pass: { xp: 'lots', claimed: null },
    codes: 'not an object',
    chest: { lastAt: 'soon' },
  }, now);

  assert.deepEqual(s.quests.daily, []);
  assert.deepEqual(s.quests.weekly, ['d_tap'], 'non-string ids dropped');
  assert.deepEqual(s.quests.dailyClaimed, {});
  assert.equal(s.quests.dailyBase.clicks, 0);
  assert.equal(s.login.streak, 0);
  assert.equal(s.login.best, 0);
  assert.equal(s.login.lastDay, '2026-08-25', 'a valid day key survives');
  assert.equal(s.pass.xp, 0);
  assert.deepEqual(s.pass.claimed, {});
  assert.deepEqual(s.codes, {});
  assert.equal(s.chest.lastAt, now);
});

test('retention state round-trips through a save', () => {
  const s = createState();
  rollQuests(s, TUESDAY);
  checkLogin(s, TUESDAY);
  s.pass.xp = 350;
  s.pass.claimed[2] = true;
  s.codes.onsen = 999;

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.quests.daily, s.quests.daily);
  assert.deepEqual(reloaded.quests.dailyBase, s.quests.dailyBase);
  assert.equal(reloaded.login.streak, 1);
  assert.equal(reloaded.pass.xp, 350);
  assert.equal(reloaded.pass.claimed[2], true);
  assert.equal(reloaded.codes.onsen, 999);
});
