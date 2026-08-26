// Who you are, locally.
//
// There is no account and no server, so a profile is exactly three things: a
// name you can change, an avatar from the skins you own, and a title from the
// titles you own. Everything else the panel shows is derived from the save.
//
// You start as a guest with a generated name rather than an empty field. A game
// that opens with "choose a display name" before it has shown you anything is
// asking for a commitment it has not earned; a name you can change later costs
// nothing and gets you into the water.

import * as B from '../balance.js';
import { cosmeticById, liveCosmeticsOfKind } from '../content/registry.js';
import { equipped, owns } from './cosmetics.js';

const ADJECTIVES = [
  'Damp', 'Unbothered', 'Warm', 'Patient', 'Sizeable', 'Quiet', 'Steady', 'Round',
  'Sleepy', 'Reasonable', 'Soaked', 'Content', 'Broad', 'Placid', 'Steaming',
];

const NOUNS = [
  'Capybara', 'Bather', 'Neighbour', 'Guest', 'Local', 'Regular', 'Soaker',
  'Resident', 'Paddler', 'Lodger',
];

export const NAME_MAX = 22;

/** A guest name, seeded so the same save keeps the same one. */
export function generateName(seed = Date.now()) {
  const rng = B.makeRng(Math.floor(seed) || 1);
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Trim a name to something displayable. Empty falls back to the generated one
 * rather than to a blank card — a nameless profile looks like a bug.
 */
export function cleanName(input, fallback) {
  const trimmed = String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return trimmed || fallback;
}

export function displayName(state) {
  return cleanName(state.profile?.name, generateName(state.createdAt));
}

export function setName(state, input) {
  const name = cleanName(input, generateName(state.createdAt));
  state.profile.name = name;
  return { ok: true, name };
}

/** The title currently worn, resolved to its definition. */
export function currentTitle(state) {
  const id = equipped(state, 'title');
  return cosmeticById('title', id);
}

/** The skin currently worn, used as the profile avatar. */
export function currentAvatar(state) {
  return equipped(state, 'skin');
}

/** Everything the profile card shows, in one read. */
export function profile(state) {
  const title = currentTitle(state);
  return {
    name: displayName(state),
    generated: !state.profile?.name,
    avatar: currentAvatar(state),
    title: title?.name || null,
    guest: true, // there is no other kind; the panel says so
    createdAt: state.createdAt,
    rebirths: state.rebirthCount || 0,
    bestDepth: state.combat?.bestDepth || 0,
    bestStage: B.splitLevel(state.combat?.bestDepth || 0).stage,
    bestPassLevel: state.pass?.bestLevel || 0,
  };
}

/** Owned skins and titles, for the two pickers on the card. */
export function avatarChoices(state) {
  return liveCosmeticsOfKind('skin')
    .filter((c) => owns(state, 'skin', c.id))
    .map((c) => ({ ...c, kind: 'skin', worn: equipped(state, 'skin') === c.id }));
}

export function titleChoices(state) {
  return liveCosmeticsOfKind('title')
    .filter((c) => owns(state, 'title', c.id))
    .map((c) => ({ ...c, kind: 'title', worn: equipped(state, 'title') === c.id }));
}
