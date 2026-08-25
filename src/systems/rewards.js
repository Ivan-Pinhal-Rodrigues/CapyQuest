// One place that pays out a reward bundle.
//
// Quests, login days, chests, pass levels and codes all describe what they give
// in the same shape, so the game only has one place that can get "grant a
// ticket" wrong.
//
// Shape: { zenMult, zen, tickets, shards, leafs, pass }
//   zenMult  multiplied by current income, so a reward stays meaningful at
//            every stage instead of being huge early and irrelevant later
//   zen      a flat amount, used only where the payout should not scale
//   tickets  summon tickets
//   shards   forge shards
//   leafs    the simulated premium currency — paid sparingly, on purpose
//   pass     season pass xp

import { addPassXp } from './season.js';

/**
 * Income-scaled base: whichever of "a few seconds of idle" and "a few taps" is
 * larger, so the multiplier means something whether the player idles or taps.
 */
export function rewardBase(derived) {
  return Math.max(derived.clickValue * 12, derived.zps * 30, 10);
}

/**
 * Pay a reward bundle into the state. Returns a summary the UI can show.
 * `derived` is needed only for zenMult rewards.
 */
export function grantReward(state, reward, derived) {
  const out = { zen: 0, tickets: 0, shards: 0, leafs: 0, pass: 0, passLevels: null };
  if (!reward) return out;

  if (reward.zenMult && derived) {
    out.zen += rewardBase(derived) * reward.zenMult;
  }
  if (reward.zen) out.zen += reward.zen;

  if (out.zen > 0) {
    state.zen += out.zen;
    state.lifetimeZen += out.zen;
    state.totalZen += out.zen;
  }

  if (reward.tickets) {
    state.gacha.tickets += reward.tickets;
    out.tickets = reward.tickets;
  }

  if (reward.shards) {
    state.combat.shards += reward.shards;
    out.shards = reward.shards;
  }

  if (reward.leafs) {
    state.leafs += reward.leafs;
    state.lifetimeLeafs += reward.leafs;
    out.leafs = reward.leafs;
  }

  if (reward.pass) {
    out.pass = reward.pass;
    const result = addPassXp(state, reward.pass);
    if (result.levelled) out.passLevels = result;
  }

  return out;
}

/** Human-readable one-liner for a granted bundle. */
export function describeGrant(grant, fmt) {
  const parts = [];
  if (grant.zen > 0) parts.push(`${fmt(grant.zen)} zen`);
  if (grant.tickets) parts.push(`${grant.tickets} ticket${grant.tickets === 1 ? '' : 's'}`);
  if (grant.shards) parts.push(`${grant.shards} shards`);
  if (grant.leafs) parts.push(`${grant.leafs} leafs`);
  if (grant.pass) parts.push(`${grant.pass} pass XP`);
  return parts.join(' · ');
}
