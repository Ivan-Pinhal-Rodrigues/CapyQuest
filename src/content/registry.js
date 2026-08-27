// The live catalogue.
//
// Until now every cosmetic, boost, leaf pack and event was a constant in a data
// module, which meant that changing a price — or pulling something from the
// shop, or running an event over a particular weekend — was a code change, a
// review and a deploy. That is the wrong shape for the half of the game that is
// *content* rather than *mechanism*.
//
// So the data modules keep their tables, and those tables are now the
// **defaults**. This module holds what the game actually offers: defaults with a
// content pack merged over the top. Systems ask here; nothing outside reads the
// editable tables directly any more.
//
//   built-in defaults  →  content/pack.json  →  an admin's local draft
//
// Three deliberate properties:
//
//   NOTHING HERE TOUCHES A SAVE. A pack can remove a cosmetic from the shop; it
//   cannot take one out of a player's wardrobe. `owns()` keeps returning true
//   for a key that has left the catalogue, and `equipped()` already falls back
//   when a worn look cannot be resolved.
//
//   HIDDEN AND REMOVED ARE DIFFERENT. `hidden` pulls something from the shelf
//   and leaves it wearable. `remove` takes it out of the catalogue entirely.
//   Hiding is what you almost always want.
//
//   IT IS PURE. No fetch, no localStorage, no window — that is content/load.js.
//   This module runs identically under `node --test`, which is what lets the
//   merge rules actually be tested.

import {
  COSMETIC_KINDS as DEFAULT_COSMETIC_KINDS,
  cosmeticKey,
} from '../data/cosmetics.js';
import { BOOSTS as DEFAULT_BOOSTS } from '../data/boosts.js';
import { LEAF_PACKS as DEFAULT_LEAF_PACKS } from '../data/leafPacks.js';
import { EVENTS as DEFAULT_EVENTS } from '../data/events.js';
import { freeReward, premiumReward } from '../data/pass.js';
import { validatePack, cosmeticIdOf } from './schema.js';

/** The pack currently applied, already validated. Empty means "defaults only". */
let pack = {};
/** Warnings from the last applyPack, kept so the admin panel can show them. */
let lastWarnings = [];
/** Rebuilt on every applyPack rather than on every read. */
let cache = null;

// ------------------------------------------------------------------ applying

/**
 * Merge a pack over the defaults. Invalid pieces are dropped rather than
 * thrown; the warnings are returned and also kept for `packWarnings()`.
 */
export function applyPack(raw) {
  const { pack: checked, warnings } = validatePack(raw);
  pack = checked;
  lastWarnings = warnings;
  cache = null;
  return { pack: checked, warnings };
}

/** Back to the built-in tables. */
export function resetContent() {
  pack = {};
  lastWarnings = [];
  cache = null;
}

/** The pack as applied — this is what the admin panel exports. */
export function currentPack() {
  return structuredCopy(pack);
}

export function packWarnings() {
  return [...lastWarnings];
}

// ------------------------------------------------------------------- reading

function catalogue() {
  if (cache) return cache;

  const cosmetics = mergeList(
    DEFAULT_COSMETIC_KINDS.flatMap((kind) => kind.items.map((item) => ({ ...item, kind: kind.id }))),
    pack.cosmetics,
    cosmeticIdOf,
  );

  const kinds = DEFAULT_COSMETIC_KINDS.map((kind) => ({
    ...kind,
    items: cosmetics.filter((c) => c.kind === kind.id),
  }));

  const events = mergeList(DEFAULT_EVENTS, pack.events, (e) => e.id);

  cache = {
    cosmetics,
    cosmeticKinds: kinds,
    cosmeticsById: byKey(cosmetics, cosmeticIdOf),
    boosts: mergeList(DEFAULT_BOOSTS, pack.boosts, (b) => b.id),
    leafPacks: mergeList(DEFAULT_LEAF_PACKS, pack.leafPacks, (p) => p.id),
    events,
    eventsById: byKey(events, (e) => e.id),
  };
  return cache;
}

// --- cosmetics

export function liveCosmetics() {
  return catalogue().cosmetics;
}

export function liveCosmeticKinds() {
  return catalogue().cosmeticKinds;
}

export function cosmeticById(kind, id) {
  return catalogue().cosmeticsById[cosmeticKey(kind, id)] || null;
}

export function liveCosmeticsOfKind(kind) {
  return catalogue().cosmeticKinds.find((k) => k.id === kind)?.items ?? [];
}

/** What the store will actually sell: bought with leafs, and not hidden. */
export function shopCosmetics() {
  return catalogue().cosmetics.filter((c) => c.source === 'store' && !c.hidden);
}

// --- store shelves

export function liveBoosts() {
  return catalogue().boosts.filter((b) => !b.hidden);
}

export function boostById(id) {
  return catalogue().boosts.find((b) => b.id === id) || null;
}

export function liveLeafPacks() {
  return catalogue().leafPacks.filter((p) => !p.hidden);
}

export function leafPackById(id) {
  return catalogue().leafPacks.find((p) => p.id === id) || null;
}

// --- events

export function liveEventDefs() {
  return catalogue().events;
}

export function eventById(id) {
  return catalogue().eventsById[id] || null;
}

/** Events running on the wall clock rather than the season's rotating windows. */
export function scheduledEvents() {
  return catalogue().events.filter((e) => e.live && e.startsAt != null && e.endsAt != null);
}

/** Events that take part in the season rotation. */
export function rotatingEvents() {
  return catalogue().events.filter((e) => e.live && e.startsAt == null);
}

// --- pass

/**
 * A pass level's reward: the generated one unless the pack names an override.
 *
 * Overrides are per level per track, so a pack can make level 50 a specific
 * cosmetic for one season without restating the other ninety-nine.
 */
export function passRewardFor(level, track = 'free') {
  const override = pack.pass?.[track]?.[level];
  if (override) return { ...override };
  return track === 'premium' ? premiumReward(level) : freeReward(level);
}

/** Levels the pack has overridden, for the admin panel's list. */
export function passOverrides() {
  return structuredCopy(pack.pass || {});
}

// ------------------------------------------------------------------ plumbing

/**
 * defaults + add + patch − remove, order preserved.
 *
 * Additions land at the end so the shipped ordering of the shelf is stable, and
 * an add whose id already exists is treated as a patch rather than a duplicate —
 * two entries with one id is the kind of thing that shows up much later as a
 * baffling UI bug.
 */
function mergeList(defaults, section, keyOf) {
  if (!section) return defaults.map((entry) => ({ ...entry }));

  const out = defaults.map((entry) => ({ ...entry }));
  const index = new Map(out.map((entry, i) => [keyOf(entry), i]));

  for (const entry of section.add || []) {
    const key = keyOf(entry);
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push({ ...entry });
    } else {
      out[at] = { ...out[at], ...entry };
    }
  }

  for (const [key, patch] of Object.entries(section.patch || {})) {
    const at = index.get(key);
    if (at === undefined) continue; // patching something that is not there is a no-op
    out[at] = { ...out[at], ...patch };
  }

  const removed = new Set(section.remove || []);
  return removed.size ? out.filter((entry) => !removed.has(keyOf(entry))) : out;
}

function byKey(list, keyOf) {
  return Object.fromEntries(list.map((entry) => [keyOf(entry), entry]));
}

/** A deep-enough copy for the plain data a pack holds. */
function structuredCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export { cosmeticKey };

/**
 * Where the optional backend lives, per the pack. Null when there is none.
 *
 * The registry is pure — no fetch, no storage — so it reports the endpoint
 * rather than configuring anything with it. systems/cloud.js is told by
 * content/load.js, which is the half that already touches the browser.
 */
export function cloudEndpoint() {
  return pack.cloud?.endpoint || null;
}
