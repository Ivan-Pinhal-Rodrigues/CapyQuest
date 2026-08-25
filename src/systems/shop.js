// Buying things. Every purchase path funnels through here so cost, affordability
// and the actual spend can never disagree with each other.

import * as B from '../balance.js';
import { BUILDINGS_BY_ID, BUILDINGS, isBuildingVisible } from '../data/buildings.js';
import { CLICK_UPGRADES, CLICK_UPGRADES_BY_ID } from '../data/clickUpgrades.js';
import { TIER_UPGRADES, TIER_UPGRADES_BY_ID } from '../data/tierUpgrades.js';
import { meetsRequirement } from '../data/requirements.js';

/** How many units a given buy-amount setting resolves to right now. */
export function resolveBuyCount(state, building, amount, discount) {
  const owned = state.buildings[building.id] || 0;
  if (amount === 'max') {
    return B.buildingMaxAffordable(building.cost, owned, state.zen, discount);
  }
  return amount;
}

/** Price of the currently selected buy amount, and whether it is affordable. */
export function quoteBuilding(state, building, amount, discount = 1) {
  const owned = state.buildings[building.id] || 0;
  const count = Math.max(0, resolveBuyCount(state, building, amount, discount));
  const cost = B.buildingBulkCost(building.cost, owned, count, discount);
  const nextCost = B.buildingCost(building.cost, owned, discount);
  return {
    count,
    cost,
    nextCost,
    affordable: count > 0 && state.zen >= cost,
  };
}

/** Buy generators. Returns { ok, count, spent }. */
export function buyBuilding(state, id, amount = 1, discount = 1) {
  const building = BUILDINGS_BY_ID[id];
  if (!building) return { ok: false, count: 0, spent: 0 };

  const quote = quoteBuilding(state, building, amount, discount);
  if (!quote.affordable) return { ok: false, count: 0, spent: 0 };

  state.zen -= quote.cost;
  state.buildings[id] = (state.buildings[id] || 0) + quote.count;
  return { ok: true, count: quote.count, spent: quote.cost };
}

/** Buy a one-time upgrade from either table. Returns { ok, spent, upgrade }. */
export function buyUpgrade(state, id) {
  const click = CLICK_UPGRADES_BY_ID[id];
  const tier = TIER_UPGRADES_BY_ID[id];
  const upgrade = click || tier;
  if (!upgrade) return { ok: false, spent: 0 };

  const bag = click ? state.clickUpgrades : state.tierUpgrades;
  if (bag[id]) return { ok: false, spent: 0, reason: 'owned' };
  if (!meetsRequirement(upgrade.req, state)) return { ok: false, spent: 0, reason: 'locked' };
  if (state.zen < upgrade.cost) return { ok: false, spent: 0, reason: 'poor' };

  state.zen -= upgrade.cost;
  bag[id] = true;
  return { ok: true, spent: upgrade.cost, upgrade };
}

/**
 * Upgrades the player can see right now: unlocked and unowned, cheapest first.
 * Locked-but-close entries are included with `locked: true` so the shop can
 * tease them — knowing what is coming is half of what keeps people buying.
 */
export function availableUpgrades(state) {
  const out = [];

  for (const u of CLICK_UPGRADES) {
    if (state.clickUpgrades[u.id]) continue;
    const unlocked = meetsRequirement(u.req, state);
    if (unlocked || state.lifetimeZen >= u.cost * 0.25) {
      out.push({ ...u, kind: 'click', locked: !unlocked });
    }
  }

  for (const u of TIER_UPGRADES) {
    if (state.tierUpgrades[u.id]) continue;
    const unlocked = meetsRequirement(u.req, state);
    const owned = state.buildings[u.buildingId] || 0;
    // Tier upgrades only tease once you actually own some of that generator.
    if (unlocked || owned >= u.req.building.count * 0.5) {
      out.push({ ...u, kind: 'tier', locked: !unlocked });
    }
  }

  out.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    return a.cost - b.cost;
  });
  return out;
}

/** Generators worth rendering in the shop right now. */
export function visibleBuildings(state) {
  return BUILDINGS.filter((b) => isBuildingVisible(b, state));
}

/** Total generators owned — used by achievements and the stats panel. */
export function totalBuildings(state) {
  return Object.values(state.buildings).reduce((a, b) => a + b, 0);
}
