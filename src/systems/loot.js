// Drops and the forge.
//
// Loot is gated by stage so a stage-3 enemy cannot hand you a mythic, and
// weighted by rarity so the good stuff stays worth wanting. LUCK shifts the
// weights rather than adding a separate roll — one number the player can watch.

import * as B from '../balance.js';
import { GEAR, GEAR_BY_ID, RARITY_ORDER, rarityRank } from '../data/gear.js';

const INVENTORY_CAP = 120;

/** Base drop weight per rarity, before luck and stage gating. */
const RARITY_WEIGHT = {
  common: 1000,
  uncommon: 420,
  rare: 150,
  epic: 42,
  legendary: 9,
  mythic: 1.6,
  capybaric: 0.25,
};

/** The highest rarity that can drop at a given stage. */
export function rarityCeiling(stage) {
  if (stage >= 100) return 'capybaric';
  if (stage >= 78) return 'mythic';
  if (stage >= 55) return 'legendary';
  if (stage >= 34) return 'epic';
  if (stage >= 18) return 'rare';
  if (stage >= 6) return 'uncommon';
  return 'common';
}

/** Chance that clearing a stage drops a piece at all. */
export function dropChance(isBoss, luck) {
  const base = isBoss ? 0.85 : 0.14;
  return Math.min(0.95, base + luck * 0.0012);
}

/**
 * Roll one piece of gear, or null. Deterministic given `rng`, so the loot tests
 * can pin outcomes instead of running ten thousand trials.
 */
export function rollLoot(stage, { isBoss = false, luck = 0, rng = Math.random } = {}) {
  if (rng() > dropChance(isBoss, luck)) return null;

  const ceiling = rarityRank(rarityCeiling(stage));
  // Luck tilts the curve toward the top end without ever unlocking a rarity the
  // stage has not earned.
  const luckTilt = 1 + luck * 0.004;

  const pool = GEAR.filter((g) => rarityRank(g.rarity) <= ceiling).map((g) => {
    const rank = rarityRank(g.rarity);
    return { item: g, weight: RARITY_WEIGHT[g.rarity] * Math.pow(luckTilt, rank) };
  });
  if (!pool.length) return null;

  const picked = B.weightedPick(pool, rng());
  return picked ? picked.item : null;
}

/** Forge shards dropped by a cleared stage. */
export function shardDrop(stage, isBoss, rng = Math.random) {
  const base = 1 + Math.floor(stage / 8);
  const roll = 1 + Math.floor(rng() * 3);
  return (base + roll) * (isBoss ? 6 : 1);
}

let uidCounter = 0;

/** Add a piece to the inventory. Returns the created entry, or null if full. */
export function addToInventory(state, itemId, now = Date.now()) {
  if (!GEAR_BY_ID[itemId]) return null;
  const inv = state.combat.inventory;
  if (inv.length >= INVENTORY_CAP) {
    // Full bag: drop the weakest unequipped piece rather than refusing the
    // drop, so a long session never silently stops rewarding you.
    const victim = weakestUnequipped(state);
    if (!victim) return null;
    inv.splice(inv.indexOf(victim), 1);
  }
  const entry = { uid: `g${now.toString(36)}${(uidCounter++).toString(36)}`, id: itemId, forge: 0 };
  inv.push(entry);
  return entry;
}

function weakestUnequipped(state) {
  const equipped = new Set(Object.values(state.combat.equipped || {}));
  let worst = null;
  let worstRank = Infinity;
  for (const entry of state.combat.inventory) {
    if (equipped.has(entry.uid)) continue;
    const rank = rarityRank(GEAR_BY_ID[entry.id]?.rarity) * 100 + (entry.forge || 0);
    if (rank < worstRank) {
      worstRank = rank;
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
  const rank = rarityRank(GEAR_BY_ID[entry.id].rarity);
  // Scrapping refunds the forge investment so upgrading a piece is never a trap.
  let refund = Math.ceil(4 * Math.pow(2.1, rank));
  for (let i = 0; i < (entry.forge || 0); i++) refund += Math.ceil(B.forgeCost(i, 1 + rank * 0.35) * 0.6);

  state.combat.inventory.splice(index, 1);
  state.combat.shards += refund;
  return { ok: true, shards: refund };
}

export const MAX_FORGE = 15;

/** Shard price of the next enhancement on a piece. */
export function forgePrice(entry) {
  const def = GEAR_BY_ID[entry.id];
  if (!def) return Infinity;
  return B.forgeCost(entry.forge || 0, 1 + rarityRank(def.rarity) * 0.35);
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

export { INVENTORY_CAP, RARITY_ORDER };
