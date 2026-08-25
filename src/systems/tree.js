// The rebirth tree engine: what a node costs, whether it is open, and what the
// ranks you own add up to.
//
// One rule shapes all of it — the tree is the *only* thing that survives a
// rebirth unchanged, so it has to be the thing worth buying. Nodes cost Essence
// directly rather than points derived from character level, because a rebirth
// payout should visibly turn into something.

import { NODES_BY_ID, TREE_NODES, TIER_GATES, TREE_BRANCHES, nodeCost } from '../data/rebirthTree.js';
import {
  KEYSTONES_BY_ID,
  KEYSTONE_COST,
  KEYSTONE_GATE,
  KEYSTONE_MAX,
  keystoneEffects,
} from '../data/keystones.js';
import { NODE_CONDITIONS, conditionMultiplier } from '../data/conditions.js';

/**
 * How many branches a single rebirth may take past tier 4.
 *
 * Without this the tree has no shape: Essence keeps arriving, respec is free,
 * and every branch eventually reaches the bottom, so "which branch" was never
 * a question anyone had to answer. Three is enough room to combine ideas and
 * few enough that the other four are a real thing given up.
 */
export const DEEP_BRANCH_MAX = 3;

/** The tier at which a branch starts counting as one of your deep ones. */
export const DEEP_TIER = 5;

/** Ranks the player owns of one node. */
export function ranksOf(state, id) {
  return state.tree?.[id] || 0;
}

/** Total ranks bought across the whole tree. */
export function totalRanks(state) {
  return Object.values(state.tree || {}).reduce((a, b) => a + b, 0);
}

/** Ranks bought inside one branch — what the tier gates measure. */
export function branchSpend(state, branch) {
  let sum = 0;
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    if (NODES_BY_ID[id]?.branch === branch) sum += ranks;
  }
  return sum;
}

/** Essence the next rank of a node would cost. Null once it is maxed. */
export function nextCost(state, id) {
  const node = NODES_BY_ID[id];
  if (!node) return null;
  const owned = ranksOf(state, id);
  return owned >= node.max ? null : nodeCost(node.tier, owned);
}

/** Essence already sunk into a node, across every rank of it. */
export function essenceInNode(node, ranks) {
  let sum = 0;
  for (let r = 0; r < ranks; r++) sum += nodeCost(node.tier, r);
  return sum;
}

/** Essence sunk into the whole tree — exactly what a respec gives back. */
export function essenceSpent(state) {
  let sum = 0;
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    const node = NODES_BY_ID[id];
    if (node) sum += essenceInNode(node, ranks);
  }
  return sum;
}

/** Branches you have already taken past tier 4 — your committed specialisms. */
export function deepBranches(state) {
  const out = new Set();
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    const node = NODES_BY_ID[id];
    if (node && ranks > 0 && node.tier >= DEEP_TIER) out.add(node.branch);
  }
  return out;
}

/**
 * Whether this branch may be taken deep. A branch you are already deep in is
 * always allowed — the limit is on how many you pick, never on continuing one.
 */
export function canGoDeep(state, branch) {
  const deep = deepBranches(state);
  return deep.has(branch) || deep.size < DEEP_BRANCH_MAX;
}

/** A tier opens on ranks bought in its own branch, not on the tree as a whole. */
export function isNodeUnlocked(state, node) {
  if (branchSpend(state, node.branch) < TIER_GATES[node.tier]) return false;
  if (node.tier >= DEEP_TIER && !canGoDeep(state, node.branch)) return false;
  return true;
}

export function canBuyNode(state, id) {
  const node = NODES_BY_ID[id];
  if (!node) return { ok: false, reason: 'unknown' };
  if (ranksOf(state, id) >= node.max) return { ok: false, reason: 'maxed' };
  if (branchSpend(state, node.branch) < TIER_GATES[node.tier]) {
    return { ok: false, reason: 'locked' };
  }
  // Distinguished from 'locked' so the panel can say *why*: this one is not a
  // matter of spending more, it is a choice you already made elsewhere.
  if (node.tier >= DEEP_TIER && !canGoDeep(state, node.branch)) {
    return { ok: false, reason: 'shallow', deep: [...deepBranches(state)] };
  }

  const price = nextCost(state, id);
  if (state.essence < price) return { ok: false, reason: 'poor', price };
  return { ok: true, price, node };
}

// ------------------------------------------------------------------ keystones

/** Keystones currently taken. */
export function ownedKeystones(state) {
  return (state.keystones || []).filter((id) => KEYSTONES_BY_ID[id]);
}

export function hasKeystone(state, id) {
  return ownedKeystones(state).includes(id);
}

export function canTakeKeystone(state, id) {
  const keystone = KEYSTONES_BY_ID[id];
  if (!keystone) return { ok: false, reason: 'unknown' };
  if (hasKeystone(state, id)) return { ok: false, reason: 'owned' };
  if (ownedKeystones(state).length >= KEYSTONE_MAX) {
    return { ok: false, reason: 'full', max: KEYSTONE_MAX };
  }
  if (branchSpend(state, keystone.branch) < KEYSTONE_GATE) {
    return { ok: false, reason: 'locked', need: KEYSTONE_GATE };
  }
  if (state.essence < KEYSTONE_COST) return { ok: false, reason: 'poor', price: KEYSTONE_COST };
  return { ok: true, price: KEYSTONE_COST, keystone };
}

export function takeKeystone(state, id) {
  const check = canTakeKeystone(state, id);
  if (!check.ok) return check;

  state.essence -= check.price;
  state.keystones = [...ownedKeystones(state), id];
  return { ok: true, price: check.price, keystone: check.keystone };
}

/**
 * Drop a keystone and get the Essence back.
 *
 * Refunded in full, for the same reason respec is free: a commitment you cannot
 * walk back is not a build, it is a mistake you have to live in. The cost of a
 * keystone is the slot it occupies and the drawback it carries, not the risk of
 * having picked wrong.
 */
export function dropKeystone(state, id) {
  if (!hasKeystone(state, id)) return { ok: false, reason: 'notOwned' };
  state.keystones = ownedKeystones(state).filter((k) => k !== id);
  state.essence += KEYSTONE_COST;
  return { ok: true, refunded: KEYSTONE_COST };
}

export function buyNode(state, id) {
  const check = canBuyNode(state, id);
  if (!check.ok) return check;

  state.essence -= check.price;
  state.tree[id] = ranksOf(state, id) + 1;
  return { ok: true, price: check.price, ranks: state.tree[id] };
}

/**
 * Free, always. A tree you are afraid to touch is not a choice, it is a trap —
 * and charging for a respec mostly punishes the players still learning it.
 * Every point of Essence comes back, down to the last one.
 */
export function respec(state) {
  const keystones = ownedKeystones(state);
  const refunded = essenceSpent(state) + keystones.length * KEYSTONE_COST;
  state.tree = {};
  state.keystones = [];
  state.essence += refunded;
  return { ok: true, refunded, keystones: keystones.length };
}

/**
 * Every effect the owned ranks and keystones grant, one entry per rank.
 *
 * Conditional nodes are folded in here rather than filtered out, because a
 * condition can scale — "for each empty equipment slot" is a multiplier of 0
 * through 6, not a yes or no. A multiplicative effect (a value around 1) has to
 * be interpolated towards 1 rather than scaled, or a condition of 0 would
 * silently zero the player's income instead of contributing nothing.
 */
export function treeEffects(state) {
  const out = [];
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    const node = NODES_BY_ID[id];
    if (!node || ranks <= 0) continue;

    const condition = NODE_CONDITIONS[id];
    const scale = condition ? conditionMultiplier(condition, state) : 1;
    if (scale === 0) continue;

    const effect = scale === 1 ? node.effect : scaleEffect(node.effect, scale);
    for (let i = 0; i < ranks; i++) out.push(effect);
  }
  for (const id of ownedKeystones(state)) {
    out.push(...keystoneEffects(KEYSTONES_BY_ID[id]));
  }
  return out;
}

/** Effect types whose value sits around 1 and is multiplied in. */
const MULTIPLICATIVE = new Set([
  'clickMult', 'zpsMult', 'globalMult', 'buildingMult', 'allBuildingMult', 'buffMult',
]);

/**
 * Scale one effect by a condition multiplier.
 *
 * The two families need opposite arithmetic. An additive effect (+6% ATK) is
 * scaled directly. A multiplicative one (×1.24 income) has its *distance from
 * one* scaled, so a condition of 0 leaves ×1.0 — the identity — rather than
 * ×0, which would wipe out the player's entire income for the crime of wearing
 * a hat.
 */
function scaleEffect(effect, scale) {
  if (!MULTIPLICATIVE.has(effect.type)) {
    return { ...effect, value: effect.value * scale };
  }
  return { ...effect, value: 1 + (effect.value - 1) * scale };
}

/** Headline numbers for the panel: how much of the tree is actually owned. */
export function treeSummary(state) {
  const maxRanks = TREE_NODES.reduce((a, n) => a + n.max, 0);
  const owned = totalRanks(state);
  const deep = deepBranches(state);
  return {
    nodes: TREE_NODES.length,
    nodesOwned: Object.values(state.tree || {}).filter((r) => r > 0).length,
    ranks: owned,
    maxRanks,
    spent: essenceSpent(state),
    keystones: ownedKeystones(state),
    keystoneMax: KEYSTONE_MAX,
    deep: [...deep],
    deepMax: DEEP_BRANCH_MAX,
    branches: TREE_BRANCHES.length,
  };
}
