// The rebirth tree engine: what a node costs, whether it is open, and what the
// ranks you own add up to.
//
// One rule shapes all of it — the tree is the *only* thing that survives a
// rebirth unchanged, so it has to be the thing worth buying. Nodes cost Essence
// directly rather than points derived from character level, because a rebirth
// payout should visibly turn into something.

import { NODES_BY_ID, TREE_NODES, TIER_GATES, nodeCost } from '../data/rebirthTree.js';

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

/** A tier opens on ranks bought in its own branch, not on the tree as a whole. */
export function isNodeUnlocked(state, node) {
  return branchSpend(state, node.branch) >= TIER_GATES[node.tier];
}

export function canBuyNode(state, id) {
  const node = NODES_BY_ID[id];
  if (!node) return { ok: false, reason: 'unknown' };
  if (ranksOf(state, id) >= node.max) return { ok: false, reason: 'maxed' };
  if (!isNodeUnlocked(state, node)) return { ok: false, reason: 'locked' };

  const price = nextCost(state, id);
  if (state.essence < price) return { ok: false, reason: 'poor', price };
  return { ok: true, price, node };
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
  const refunded = essenceSpent(state);
  state.tree = {};
  state.essence += refunded;
  return { ok: true, refunded };
}

/** Every effect the owned ranks grant, expanded one entry per rank. */
export function treeEffects(state) {
  const out = [];
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    const node = NODES_BY_ID[id];
    if (!node || ranks <= 0) continue;
    for (let i = 0; i < ranks; i++) out.push(node.effect);
  }
  return out;
}

/** Headline numbers for the panel: how much of the tree is actually owned. */
export function treeSummary(state) {
  const maxRanks = TREE_NODES.reduce((a, n) => a + n.max, 0);
  const owned = totalRanks(state);
  return {
    nodes: TREE_NODES.length,
    nodesOwned: Object.values(state.tree || {}).filter((r) => r > 0).length,
    ranks: owned,
    maxRanks,
    spent: essenceSpent(state),
  };
}
