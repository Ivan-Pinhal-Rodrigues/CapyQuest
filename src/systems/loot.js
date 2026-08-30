// Drops and the forge.
//
// Three things can raise a piece now, and they are deliberately different kinds
// of decision:
//
//   enhance  +0 → +15, shards, always succeeds — the steady grind
//   refine   +1 star, a stated roll with pity — the gamble
//   fuse     +1 rung, eats three matching pieces — the sacrifice
//
// Loot is gated by depth so a stage-3 enemy cannot hand you a Capybaric, and
// weighted so drops cluster just under the ceiling your depth has earned. LUCK
// shifts the weights rather than adding a separate roll — one number the player
// can watch.

import * as B from '../balance.js';
import { GEAR, GEAR_BY_ID } from '../data/gear.js';
import * as R from '../data/rarities.js';
import { resolveItem } from './equipment.js';

const INVENTORY_CAP = 120;

/** The highest rung a world drop can reach at a stage. */
export function tierCeiling(stage) {
  return Math.min(R.MAX_TIER, Math.max(0, Math.floor(stage / 2)));
}

/** How many rungs below the ceiling a drop can still land on. */
const TIER_WINDOW = 5;

/** Chance that clearing a stage drops a piece at all. */
export function dropChance(isBoss, luck) {
  const base = isBoss ? 0.85 : 0.14;
  return Math.min(0.95, base + luck * 0.0012);
}

/**
 * Weights for the rungs a drop can land on. The ceiling is the likeliest and
 * each rung below it is halved, so what you find tracks how deep you are
 * instead of burying you in Worn pieces forever. Luck flattens the falloff.
 */
function tierWeights(ceiling, luck) {
  const falloff = 0.5 + Math.min(0.35, luck * 0.0008);
  const floor = Math.max(0, ceiling - TIER_WINDOW);
  const out = [];
  for (let tier = floor; tier <= ceiling; tier++) {
    out.push({ tier, weight: Math.pow(falloff, ceiling - tier) });
  }
  return out;
}

/** Stars on a fresh drop. Two stars is a good day; five is a story. */
export function rollStars(rng = Math.random, luck = 0) {
  let stars = 1;
  const boost = 1 + Math.min(1.5, luck * 0.002);
  for (let next = 2; next <= R.MAX_STARS; next++) {
    const chance = 0.1 * Math.pow(0.45, next - 2) * boost;
    if (rng() >= chance) break;
    stars = next;
  }
  return stars;
}

/**
 * Roll one drop, or null. Returns the instance to create — definition, rung and
 * stars — rather than just a definition, because the rung is now the interesting
 * half of the reward. Deterministic given `rng`, so the loot tests can pin
 * outcomes instead of running ten thousand trials.
 */
export function rollLoot(stage, { isBoss = false, luck = 0, rng = Math.random } = {}) {
  if (rng() > dropChance(isBoss, luck)) return null;

  const ceiling = tierCeiling(stage);
  const rolledTier = B.weightedPick(tierWeights(ceiling, luck), rng())?.tier ?? 0;

  // Any piece whose usual rung is at or below the roll can turn up on it. The
  // pool therefore widens as you descend rather than swapping wholesale.
  const pool = GEAR.filter((g) => g.tier <= rolledTier);
  if (!pool.length) return null;

  const def = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { def, id: def.id, tier: rolledTier, stars: rollStars(rng, luck) };
}

/**
 * Leafs dropped by a boss. Deliberately a trickle — leafs are the simulated
 * premium currency, and a game that hands them out freely has nothing to sell
 * you, while one that never does makes refining unreachable for anyone who does
 * not spend. A boss every ten levels at 1–3 leafs funds a refine every so often.
 */
export function leafDrop(stage, isBoss, rng = Math.random) {
  if (!isBoss) return 0;
  return 1 + Math.floor(rng() * 3);
}

/** Forge shards dropped by a cleared stage. */
export function shardDrop(stage, isBoss, rng = Math.random) {
  const base = 1 + Math.floor(stage / 8);
  const roll = 1 + Math.floor(rng() * 3);
  return (base + roll) * (isBoss ? 6 : 1);
}

let uidCounter = 0;

/** Add a piece to the inventory. Returns the created entry, or null if full. */
export function addToInventory(state, itemId, { tier, stars = 1, now = Date.now() } = {}) {
  const def = GEAR_BY_ID[itemId];
  if (!def) return null;

  const inv = state.combat.inventory;
  if (inv.length >= INVENTORY_CAP) {
    // Full bag: drop the weakest unequipped piece rather than refusing the
    // drop, so a long session never silently stops rewarding you.
    const victim = weakestUnequipped(state);
    if (!victim) return null;
    inv.splice(inv.indexOf(victim), 1);
  }

  const entry = {
    uid: `g${now.toString(36)}${(uidCounter++).toString(36)}`,
    id: itemId,
    forge: 0,
    tier: R.clampTier(tier === undefined ? def.tier : tier),
    stars: R.clampStars(stars),
    refineFails: 0,
  };
  inv.push(entry);
  return entry;
}

function weakestUnequipped(state) {
  const equipped = new Set(Object.values(state.combat.equipped || {}));
  let worst = null;
  let worstScore = Infinity;
  for (const entry of state.combat.inventory) {
    if (equipped.has(entry.uid)) continue;
    const item = resolveItem(entry);
    if (!item) continue;
    if (item.score < worstScore) {
      worstScore = item.score;
      worst = entry;
    }
  }
  return worst;
}

export function equip(state, uid) {
  const entry = state.combat.inventory.find((i) => i.uid === uid);
  if (!entry) return false;
  const def = GEAR_BY_ID[entry.id];
  if (!def) return false;
  state.combat.equipped[def.slot] = uid;
  return true;
}

export function unequip(state, slot) {
  delete state.combat.equipped[slot];
}

/** Scrap a piece for shards. Refuses to scrap what you are wearing. */
export function scrap(state, uid) {
  const equipped = new Set(Object.values(state.combat.equipped || {}));
  if (equipped.has(uid)) return { ok: false, reason: 'equipped' };

  const index = state.combat.inventory.findIndex((i) => i.uid === uid);
  if (index < 0) return { ok: false, reason: 'missing' };

  const entry = state.combat.inventory[index];
  const item = resolveItem(entry);
  // Scrapping refunds the forge investment so upgrading a piece is never a trap,
  // and pays for the rung and the stars so a good piece is worth something even
  // when it is the wrong slot.
  let refund = Math.ceil(4 * Math.pow(1.8, item.tier) * R.starMult(item.stars));
  for (let i = 0; i < item.forge; i++) refund += Math.ceil(B.forgeCost(i, forgeRarityMult(item.tier)) * 0.6);

  state.combat.inventory.splice(index, 1);
  state.combat.shards += refund;
  return { ok: true, shards: refund };
}

export const MAX_FORGE = 15;

function forgeRarityMult(tier) {
  return 1 + tier * 0.22;
}

/** Shard price of the next enhancement on a piece. */
export function forgePrice(entry) {
  const item = resolveItem(entry);
  if (!item) return Infinity;
  return B.forgeCost(item.forge, forgeRarityMult(item.tier));
}

export function forge(state, uid) {
  const entry = state.combat.inventory.find((i) => i.uid === uid);
  if (!entry) return { ok: false, reason: 'missing' };
  if ((entry.forge || 0) >= MAX_FORGE) return { ok: false, reason: 'maxed' };

  const price = forgePrice(entry);
  if (state.combat.shards < price) return { ok: false, reason: 'shards' };

  state.combat.shards -= price;
  entry.forge = (entry.forge || 0) + 1;
  return { ok: true, spent: price, level: entry.forge };
}

// ------------------------------------------------------------------- refine

/**
 * Refining is the only roll in the whole gear system, so it states its odds on
 * the button and it has a pity counter. Four failures on one piece and the
 * fifth attempt is free of chance — you can always finish what you started.
 */
export function refinePrice(entry) {
  const item = resolveItem(entry);
  if (!item) return null;
  return {
    shards: Math.ceil(120 * Math.pow(2.4, item.stars - 1) * (1 + item.tier * 0.3)),
    leafs: 4 * item.stars,
  };
}

export function canRefine(state, uid) {
  const entry = state.combat.inventory.find((i) => i.uid === uid);
  if (!entry) return { ok: false, reason: 'missing' };

  const item = resolveItem(entry);
  if (item.stars >= R.MAX_STARS) return { ok: false, reason: 'maxed' };
  // A star is the reward for having finished the enhancement grind on a piece,
  // not something you sprinkle on a fresh drop.
  if (item.forge < MAX_FORGE) return { ok: false, reason: 'enhance' };

  const price = refinePrice(entry);
  if (state.combat.shards < price.shards) return { ok: false, reason: 'shards', price };
  if ((state.leafs || 0) < price.leafs) return { ok: false, reason: 'leafs', price };
  return { ok: true, price, entry, item };
}

export function refine(state, uid, rng = Math.random) {
  const check = canRefine(state, uid);
  if (!check.ok) return check;

  const { entry, item, price } = check;
  state.combat.shards -= price.shards;
  state.leafs -= price.leafs;

  const pitied = (entry.refineFails || 0) >= R.REFINE_PITY;
  const success = pitied || rng() < R.refineChance(item.stars);

  if (!success) {
    entry.refineFails = (entry.refineFails || 0) + 1;
    return { ok: true, success: false, fails: entry.refineFails, spent: price };
  }

  entry.stars = R.clampStars(item.stars + 1);
  entry.refineFails = 0;
  return { ok: true, success: true, pitied, stars: entry.stars, spent: price };
}

// --------------------------------------------------------------------- fuse

/**
 * Unequipped pieces that could be fed to a fuse of this one.
 *
 * `matchStars` narrows the match to fodder that also shares the target's star
 * rating. Off by default because that has always been the rule — same slot,
 * same rung, stars ignored — and every existing call site should keep working
 * unchanged. On, it is the guard a player asked for: without it a stray 5★
 * duplicate is just as valid a fodder piece as a 1★ one, and can get quietly
 * burned promoting something far less invested in.
 */
export function fuseFodder(state, uid, { matchStars = false } = {}) {
  const target = state.combat.inventory.find((i) => i.uid === uid);
  if (!target) return [];
  const item = resolveItem(target);
  if (!item) return [];

  const equipped = new Set(Object.values(state.combat.equipped || {}));
  return state.combat.inventory.filter((entry) => {
    if (entry.uid === uid || equipped.has(entry.uid)) return false;
    const other = resolveItem(entry);
    if (!other || other.slot !== item.slot || other.tier !== item.tier) return false;
    return !matchStars || other.stars === item.stars;
  });
}

export function canFuse(state, uid, options = {}) {
  const entry = state.combat.inventory.find((i) => i.uid === uid);
  if (!entry) return { ok: false, reason: 'missing' };

  const item = resolveItem(entry);
  if (item.tier >= R.MAX_TIER) return { ok: false, reason: 'maxed' };

  const fodder = fuseFodder(state, uid, options);
  if (fodder.length < R.FUSE_COST) return { ok: false, reason: 'fodder', have: fodder.length };
  return { ok: true, entry, item, fodder };
}

/**
 * Promote a piece one rung by consuming three unequipped pieces of the same slot
 * on the same rung. Stars and enhancement are kept: fusing is how a piece you
 * have already invested in stays the piece you invested in.
 */
export function fuse(state, uid, options = {}) {
  const check = canFuse(state, uid, options);
  if (!check.ok) return check;

  const eaten = check.fodder.slice(0, R.FUSE_COST);
  const eatenIds = new Set(eaten.map((e) => e.uid));
  state.combat.inventory = state.combat.inventory.filter((e) => !eatenIds.has(e.uid));

  check.entry.tier = R.clampTier(check.item.tier + 1);
  return { ok: true, tier: check.entry.tier, consumed: eaten.length };
}

// The ceiling a bulk fuse can iterate before it gives up. INVENTORY_CAP is
// 120 and every fuse strictly shrinks the bag by two (three fodder consumed,
// one target promoted in place), so this should never be reachable outside a
// deliberately pathological test fixture — it exists so a logic error turns
// into a stopped loop with a number attached, not a hung tab.
const FUSE_ALL_ITERATION_CAP = 500;

/**
 * Fuse everything eligible, not one piece at a time.
 *
 * A single fuse can leave its target with three new same-rung duplicates
 * already sitting in the bag from separate drops, so this keeps going until a
 * full pass finds nothing left to do rather than stopping after one — "fuse
 * everything together" means fully resolved, not one round.
 */
export function fuseAll(state, options = {}) {
  let fused = 0;
  let consumed = 0;
  const byTier = {};

  for (let i = 0; i < FUSE_ALL_ITERATION_CAP; i++) {
    const equipped = new Set(Object.values(state.combat.equipped || {}));
    const candidate = state.combat.inventory.find(
      (entry) => !equipped.has(entry.uid) && canFuse(state, entry.uid, options).ok,
    );
    if (!candidate) break;

    const before = resolveItem(candidate).tier;
    const result = fuse(state, candidate.uid, options);
    if (!result.ok) break; // canFuse just said yes; this is a belt-and-braces stop, not expected

    fused++;
    consumed += result.consumed;
    byTier[before] = (byTier[before] || 0) + 1;
  }

  return { fused, consumed, byTier };
}

/** What `fuseAll` would do, without doing it — for a confirmation dialog. */
export function previewFuseAll(state, options = {}) {
  const scratch = { combat: { inventory: state.combat.inventory.map((e) => ({ ...e })), equipped: state.combat.equipped } };
  return fuseAll(scratch, options);
}

export { INVENTORY_CAP };
