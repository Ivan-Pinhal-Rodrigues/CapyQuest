// Owning and wearing cosmetics.
//
// Two ways in: meet the condition, or pay leafs. Either way the entry lands in
// the same owned set, so a bought skin and an earned one are the same kind of
// thing once you have it — nothing in the UI has to remember which is which.
//
// Earned cosmetics unlock themselves. checkUnlocks() is called wherever the
// game already recomputes, and returns what newly opened so the caller can say
// so; it is idempotent, so calling it on every tick costs nothing but a walk of
// a short table.

import {
  COSMETIC_KINDS, COSMETICS, COSMETICS_BY_ID, cosmeticKey, cosmeticsOfKind,
} from '../data/cosmetics.js';

/** The counters a cosmetic's `need` can read, gathered in one place. */
export function progressFor(state) {
  return {
    goldens: state.stats?.goldens || 0,
    rebirths: state.rebirthCount || 0,
    bossKills: state.combat?.bossKills || 0,
    logins: state.login?.total || 0,
    drops: state.stats?.drops || 0,
    bestStars: state.stats?.bestStars || 1,
    bestDepth: state.combat?.bestDepth || 0,
  };
}

export function meetsNeed(state, need) {
  if (!need) return false;
  const have = progressFor(state);
  return Object.entries(need).every(([key, want]) => (have[key] || 0) >= want);
}

export function owns(state, kind, id) {
  const def = COSMETICS_BY_ID[cosmeticKey(kind, id)];
  if (!def) return false;
  if (def.source === 'start') return true;
  return (state.cosmetics?.owned || []).includes(cosmeticKey(kind, id));
}

/** Grant a cosmetic outright. Returns false if it was already owned. */
export function grant(state, kind, id) {
  const key = cosmeticKey(kind, id);
  if (!COSMETICS_BY_ID[key]) return false;
  if (owns(state, kind, id)) return false;
  state.cosmetics.owned.push(key);
  return true;
}

/**
 * Unlock everything whose condition is now met. Returns the definitions that
 * newly opened, so the caller can announce them.
 */
export function checkUnlocks(state) {
  const opened = [];
  for (const def of COSMETICS) {
    if (def.source !== 'play') continue;
    if (owns(state, def.kind, def.id)) continue;
    if (!meetsNeed(state, def.need)) continue;
    grant(state, def.kind, def.id);
    opened.push(def);
  }
  return opened;
}

/** Buy a store cosmetic with leafs. */
export function buyCosmetic(state, kind, id) {
  const def = COSMETICS_BY_ID[cosmeticKey(kind, id)];
  if (!def) return { ok: false, reason: 'unknown' };
  if (def.source !== 'store') return { ok: false, reason: 'notForSale' };
  if (owns(state, kind, id)) return { ok: false, reason: 'owned' };
  if (state.leafs < def.cost) return { ok: false, reason: 'leafs', price: def.cost };

  state.leafs -= def.cost;
  grant(state, kind, id);
  return { ok: true, price: def.cost, def };
}

/** Wear something you own. Refuses anything you do not. */
export function equipCosmetic(state, kind, id) {
  if (!COSMETIC_KINDS.some((k) => k.id === kind)) return { ok: false, reason: 'unknown' };
  if (!owns(state, kind, id)) return { ok: false, reason: 'locked' };
  state.cosmetics[kind] = id;
  return { ok: true };
}

/** What is currently worn in a slot, falling back to the free default. */
export function equipped(state, kind) {
  const table = COSMETIC_KINDS.find((k) => k.id === kind);
  if (!table) return null;
  const chosen = state.cosmetics?.[kind];
  return chosen && owns(state, kind, chosen) ? chosen : table.defaultId;
}

/** Owned / total, for the panel header. */
export function collection(state, kind) {
  const items = cosmeticsOfKind(kind);
  return {
    owned: items.filter((i) => owns(state, kind, i.id)).length,
    total: items.length,
  };
}
