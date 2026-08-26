// Seasons and the pass.
//
// The season itself is computed from the clock (see data/seasons.js). What the
// save holds is which season it last saw, so it knows when to roll over. That
// rollover is the delicate part, and it follows the same rule every reset in
// this game follows: it must never cost you a collection.
//
//   resets   pass xp, what you claimed, the premium unlock
//   keeps    every cosmetic the pass ever gave you, and the record of it
//
// A season ending taking back a skin you earned would be the single most
// resented thing the game could do, so it does not happen.

import { seasonAt } from '../data/seasons.js';
import {
  PASS_LEVELS, PASS_XP_PER_LEVEL, PASS_XP_PER_CLEAR, PASS_XP_PER_BOSS,
  PREMIUM_LEAFS, TRACKS,
} from '../data/pass.js';
// Levels come from the generator in data/pass.js unless a content pack names an
// override for that level, so a season can put a specific cosmetic at level 50
// without restating the other ninety-nine.
import { passRewardFor as passReward } from '../content/registry.js';
import { grant } from './cosmetics.js';

/** The live season, plus how the save stands against it. */
export function season(state, now = Date.now()) {
  const info = seasonAt(now);
  return { ...info, seen: state.pass?.season ?? info.index, isNew: (state.pass?.season ?? info.index) !== info.index };
}

/**
 * Roll the pass over if the clock has moved into a new season. Idempotent and
 * cheap, so it can be called wherever the game already ticks. Returns a summary
 * when something actually rolled, and null when nothing did.
 */
export function checkRollover(state, now = Date.now()) {
  const info = seasonAt(now);
  const seen = state.pass.season;

  if (seen === info.index) return null;

  // First run on a save written before seasons existed: adopt the current
  // season rather than treating it as a rollover the player did not live.
  if (seen === null || seen === undefined) {
    state.pass.season = info.index;
    return null;
  }

  const previous = {
    index: seen,
    level: passLevel(state.pass.xp),
    premium: !!state.pass.premium,
    claimed: countClaimed(state),
  };

  state.pass.history = [previous, ...(state.pass.history || [])].slice(0, 8);
  state.pass.bestLevel = Math.max(state.pass.bestLevel || 0, previous.level);
  state.pass.season = info.index;
  state.pass.xp = 0;
  state.pass.claimed = { free: {}, premium: {} };
  state.pass.premium = false;

  return { from: previous, to: info };
}

function countClaimed(state) {
  let n = 0;
  for (const track of TRACKS) n += Object.keys(state.pass.claimed?.[track] || {}).length;
  return n;
}

// --------------------------------------------------------------------- level

export function passLevel(xp) {
  return Math.min(PASS_LEVELS, Math.floor(Math.max(0, xp) / PASS_XP_PER_LEVEL) + 1);
}

export function passProgress(state) {
  const level = passLevel(state.pass.xp);
  const into = state.pass.xp % PASS_XP_PER_LEVEL;
  const maxed = level >= PASS_LEVELS;
  return {
    level,
    levels: PASS_LEVELS,
    into,
    needed: PASS_XP_PER_LEVEL,
    ratio: maxed ? 1 : into / PASS_XP_PER_LEVEL,
    maxed,
    premium: !!state.pass.premium,
  };
}

export function addPassXp(state, amount) {
  const before = passLevel(state.pass.xp);
  state.pass.xp += Math.max(0, amount);
  const after = passLevel(state.pass.xp);
  return { levelled: after > before, from: before, to: after };
}

/** Pass XP earned by clearing a level of the quest line. */
export function passXpForClear(isBoss) {
  return isBoss ? PASS_XP_PER_BOSS : PASS_XP_PER_CLEAR;
}

// -------------------------------------------------------------------- claims

export function isClaimed(state, level, track) {
  return !!state.pass.claimed?.[track]?.[level];
}

/**
 * Whether a level's reward on a track can be taken right now. Premium levels
 * stay visible while locked — seeing what you are not getting is the point of
 * a two-track pass, and hiding it would be worse, not kinder.
 */
export function canClaim(state, level, track) {
  if (level < 1 || level > PASS_LEVELS) return { ok: false, reason: 'unknown' };
  if (level > passLevel(state.pass.xp)) return { ok: false, reason: 'locked' };
  if (track === 'premium' && !state.pass.premium) return { ok: false, reason: 'premium' };
  if (isClaimed(state, level, track)) return { ok: false, reason: 'claimed' };
  return { ok: true, reward: passReward(level, track) };
}

/**
 * Mark a level claimed and hand back its reward for the caller to pay out.
 * A cosmetic reward is granted here rather than through rewards.js, because
 * owning a look is not a currency and does not belong in that bundle.
 */
export function claimPassLevel(state, level, track) {
  const check = canClaim(state, level, track);
  if (!check.ok) return check;

  state.pass.claimed[track] ??= {};
  state.pass.claimed[track][level] = true;

  if (check.reward.cosmetic) {
    const [kind, id] = check.reward.cosmetic.split(':');
    grant(state, kind, id);
  }

  return { ok: true, reward: check.reward, level, track };
}

/** Every level on both tracks, for the panel. */
export function passTrack(state) {
  const level = passLevel(state.pass.xp);
  return Array.from({ length: PASS_LEVELS }, (_, i) => {
    const lvl = i + 1;
    return {
      level: lvl,
      unlocked: lvl <= level,
      free: {
        reward: passReward(lvl, 'free'),
        claimed: isClaimed(state, lvl, 'free'),
        claimable: canClaim(state, lvl, 'free').ok,
      },
      premium: {
        reward: passReward(lvl, 'premium'),
        claimed: isClaimed(state, lvl, 'premium'),
        claimable: canClaim(state, lvl, 'premium').ok,
      },
    };
  });
}

/** How many rewards are sitting unclaimed — what the tab badge counts. */
export function unclaimedPassLevels(state) {
  let n = 0;
  for (const row of passTrack(state)) {
    if (row.free.claimable) n++;
    if (row.premium.claimable) n++;
  }
  return n;
}

// ------------------------------------------------------------------- premium

/**
 * Unlock the premium track with leafs. The store also offers it behind a price
 * tag; both routes land here, and neither takes real money — see
 * systems/store.js for the whole of what that means.
 */
export function unlockPremium(state, { leafs = true } = {}) {
  if (state.pass.premium) return { ok: false, reason: 'owned' };
  if (leafs) {
    if ((state.leafs || 0) < PREMIUM_LEAFS) return { ok: false, reason: 'leafs', price: PREMIUM_LEAFS };
    state.leafs -= PREMIUM_LEAFS;
  }
  state.pass.premium = true;
  return { ok: true, paidLeafs: leafs ? PREMIUM_LEAFS : 0 };
}

/** Everything the premium track would hand over right now, for the sales copy. */
export function premiumBacklog(state) {
  const level = passLevel(state.pass.xp);
  let levels = 0;
  let leafs = 0;
  let tickets = 0;
  for (let lvl = 1; lvl <= level; lvl++) {
    if (isClaimed(state, lvl, 'premium')) continue;
    const reward = passReward(lvl, 'premium');
    levels++;
    leafs += reward.leafs || 0;
    tickets += reward.tickets || 0;
  }
  return { levels, leafs, tickets };
}
