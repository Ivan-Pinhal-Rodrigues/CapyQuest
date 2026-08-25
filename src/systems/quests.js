// Daily/weekly quests, the login streak, timed chests, the Zen Pass and codes.
//
// Everything here keys off *local* calendar days, not elapsed milliseconds, so
// "tomorrow" means what the player's clock says it means. All the date maths
// takes an explicit `now` so tests can move time without touching the system
// clock.

import {
  DAILY_POOL, WEEKLY_POOL, DAILY_COUNT, WEEKLY_COUNT,
  LOGIN_REWARDS, CHEST_FILL_MS, CHEST_MAX_STORED,
} from '../data/quests.js';
import { lookupCode } from '../data/codes.js';
import { makeRng } from '../balance.js';

// ------------------------------------------------------------------- dates

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** ISO-ish week key, so weeklies roll over on Monday. */
export function weekKey(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // Shift so Monday is day 0, then step back to that Monday.
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dayKey(d.getTime());
}

/** Whole calendar days between two timestamps, ignoring time of day. */
export function daysBetween(a, b) {
  const start = new Date(a);
  start.setHours(0, 0, 0, 0);
  const end = new Date(b);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

/** Milliseconds until local midnight — the daily reset countdown. */
export function msUntilTomorrow(now = Date.now()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now;
}

// ------------------------------------------------------------------ quests

/**
 * The counters quests read. Snapshotting these at rollover and diffing against
 * live totals means a quest measures *this period's* progress without needing
 * its own bookkeeping on every action.
 */
export function counters(state) {
  return {
    clicks: state.lifetimeClicks,
    crits: state.stats.crits,
    goldens: state.stats.goldens,
    bestCombo: state.stats.bestCombo,
    buildingsBought: state.stats.buildingsBought || 0,
    upgradesBought: state.stats.upgradesBought || 0,
    clears: state.combat.clears || 0,
    bossKills: state.combat.bossKills || 0,
    forges: state.stats.forges || 0,
    drops: state.stats.drops || 0,
    pulls: state.gacha.pulls || 0,
  };
}

/** Deterministic pick of N quests for a period, seeded by its key. */
function pickQuests(pool, count, key) {
  const seed = [...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rng = makeRng(seed);
  const remaining = pool.slice();
  const out = [];
  while (out.length < count && remaining.length) {
    out.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0].id);
  }
  return out;
}

/**
 * Roll quests over if the day or week has turned. Returns which periods reset,
 * so the caller can tell the player rather than silently wiping their progress.
 */
export function rollQuests(state, now = Date.now()) {
  const q = state.quests;
  const today = dayKey(now);
  const thisWeek = weekKey(now);
  const rolled = { daily: false, weekly: false };

  if (q.dayKey !== today) {
    q.dayKey = today;
    q.daily = pickQuests(DAILY_POOL, DAILY_COUNT, today);
    q.dailyClaimed = {};
    // `bestCombo` is a high-water mark rather than a running total, so it has
    // to reset to zero at rollover instead of being diffed from a baseline.
    q.dailyBase = { ...counters(state), bestCombo: 0 };
    state.stats.bestCombo = 0;
    rolled.daily = true;
  }

  if (q.weekKey !== thisWeek) {
    q.weekKey = thisWeek;
    q.weekly = pickQuests(WEEKLY_POOL, WEEKLY_COUNT, thisWeek);
    q.weeklyClaimed = {};
    q.weeklyBase = { ...counters(state), bestCombo: 0 };
    rolled.weekly = true;
  }

  return rolled;
}

function progressFor(quest, live, base) {
  const value = (live[quest.track] || 0) - (base[quest.track] || 0);
  return Math.max(0, Math.min(quest.goal, value));
}

/** Resolved quests for the UI: definition + progress + claim state. */
export function activeQuests(state) {
  const live = counters(state);
  const q = state.quests;

  const build = (ids, pool, base, claimed, kind) =>
    ids
      .map((id) => pool.find((p) => p.id === id))
      .filter(Boolean)
      .map((quest) => {
        const progress = progressFor(quest, live, base);
        return {
          ...quest,
          kind,
          progress,
          done: progress >= quest.goal,
          claimed: !!claimed[quest.id],
        };
      });

  return [
    ...build(q.daily, DAILY_POOL, q.dailyBase, q.dailyClaimed, 'daily'),
    ...build(q.weekly, WEEKLY_POOL, q.weeklyBase, q.weeklyClaimed, 'weekly'),
  ];
}

/** Claim a finished quest. Returns the reward, or null if not claimable. */
export function claimQuest(state, id) {
  const quest = activeQuests(state).find((x) => x.id === id);
  if (!quest || !quest.done || quest.claimed) return null;

  const bag = quest.kind === 'daily' ? state.quests.dailyClaimed : state.quests.weeklyClaimed;
  bag[id] = true;
  return quest.reward;
}

export function questSummary(state) {
  const all = activeQuests(state);
  return {
    ready: all.filter((q) => q.done && !q.claimed).length,
    done: all.filter((q) => q.claimed).length,
    total: all.length,
  };
}

// ------------------------------------------------------------ login streak

/**
 * Advance the login streak. Same day: nothing. Next day: streak continues.
 * A gap: the streak restarts at one. Returns the reward owed, or null.
 */
export function checkLogin(state, now = Date.now()) {
  const l = state.login;
  const today = dayKey(now);
  if (l.lastDay === today) return null;

  const gap = l.lastDay ? daysBetween(new Date(`${l.lastDay}T00:00:00`).getTime(), now) : Infinity;
  l.streak = gap === 1 ? l.streak + 1 : 1;
  l.best = Math.max(l.best || 0, l.streak);
  l.lastDay = today;
  l.total = (l.total || 0) + 1;

  // The calendar is a repeating seven-day cycle.
  const index = ((l.streak - 1) % LOGIN_REWARDS.length);
  l.pendingDay = index + 1;
  return { ...LOGIN_REWARDS[index], streak: l.streak, cycleDay: index + 1 };
}

export function loginCalendar(state) {
  const cyclePos = ((state.login.streak - 1) % LOGIN_REWARDS.length) + 1;
  return LOGIN_REWARDS.map((reward) => ({
    ...reward,
    claimed: state.login.streak > 0 && reward.day < cyclePos,
    current: state.login.streak > 0 && reward.day === cyclePos && !state.login.pendingDay,
    pending: state.login.pendingDay === reward.day,
  }));
}

// ------------------------------------------------------------------ chests

/**
 * The chest timer's origin. Epoch 0 is a legitimate timestamp, so this checks
 * for a missing value rather than a falsy one — `lastAt || now` would treat a
 * lastAt of 0 as "no timer yet" and silently reset the clock.
 */
function chestOrigin(state, now) {
  const at = state.chest?.lastAt;
  return Number.isFinite(at) ? at : now;
}

/** How many chests have filled since the last collection. */
export function chestsReady(state, now = Date.now()) {
  const since = now - chestOrigin(state, now);
  if (since <= 0) return 0;
  return Math.min(CHEST_MAX_STORED, Math.floor(since / CHEST_FILL_MS));
}

/** Progress toward the next chest, 0..1. */
export function chestProgress(state, now = Date.now()) {
  if (chestsReady(state, now) >= CHEST_MAX_STORED) return 1;
  const since = Math.max(0, now - chestOrigin(state, now));
  return (since % CHEST_FILL_MS) / CHEST_FILL_MS;
}

export function msUntilNextChest(state, now = Date.now()) {
  if (chestsReady(state, now) >= CHEST_MAX_STORED) return 0;
  const since = Math.max(0, now - chestOrigin(state, now));
  return CHEST_FILL_MS - (since % CHEST_FILL_MS);
}

/**
 * Collect every filled chest. Advances the timer by exactly the chests taken,
 * so partial progress toward the next one is never thrown away.
 */
export function collectChests(state, now = Date.now()) {
  const count = chestsReady(state, now);
  if (count <= 0) return null;
  state.chest.lastAt = chestOrigin(state, now) + count * CHEST_FILL_MS;
  state.chest.opened = (state.chest.opened || 0) + count;
  return { count };
}

// ------------------------------------------------------------------- codes

/** Redeem a secret code. Each works once per save. */
export function redeemCode(state, input) {
  const code = lookupCode(input);
  if (!code) return { ok: false, reason: 'unknown' };
  if (state.codes[code.key]) return { ok: false, reason: 'used' };
  state.codes[code.key] = Date.now();
  return { ok: true, reward: code, key: code.key };
}

export { CHEST_FILL_MS, CHEST_MAX_STORED };
