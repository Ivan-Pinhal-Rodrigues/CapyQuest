// Getting a content pack from the outside world into the registry.
//
// Separate from registry.js on purpose: this is the half that touches fetch and
// localStorage, and keeping it out of the registry is what lets the merge rules
// be tested under `node --test` without a DOM.
//
// Two sources, in order:
//
//   content/pack.json   committed by an admin, seen by everybody
//   the local draft     an admin's unsaved edits, seen only by that browser
//
// The draft wins, because the whole point of the admin panel is trying a change
// before committing it. A player who has never opened the panel has no draft
// and gets exactly what is in the file.
//
// Nothing here is allowed to stop the game booting. A missing file, a 404, a
// server returning HTML, a syntax error, a browser with storage blocked — all
// of them end the same way: no pack, built-in defaults, a warning in the
// console, and a playable game.

import { applyPack, resetContent } from './registry.js';

export const PACK_URL = 'content/pack.json';
export const DRAFT_KEY = 'capyquest:content:draft';

/**
 * The instructions that live inside the pack itself.
 *
 * JSON has no comments, and a file an admin edits by hand needs to be able to
 * explain itself — the first person to open it will not have read the docs.
 * The validator ignores every key beginning with `_`, and the admin panel puts
 * this block back on every export, so committing an exported pack can never
 * silently strip the guidance out of the file. `tests/pack.test.js` asserts the
 * shipped file and this constant say the same thing.
 */
export const PACK_README = [
  "CapyQuest's content pack. Editing it changes what the game offers without",
  'touching a line of code — commit it and every player sees the change on their',
  'next load.',
  '',
  'It is a PATCH over the built-in tables, not a replacement: anything you do not',
  'mention keeps its shipped value. Four catalogues take add / patch / remove —',
  'cosmetics, boosts, leafPacks, events — plus `pass`, which overrides one level',
  'of one track at a time.',
  '',
  'Prefer "hidden": true over remove. Hiding takes something off the shelf and',
  'leaves it wearable by everyone who already owns it; nothing here can ever take',
  'a look out of a save.',
  '',
  'An event given startsAt and endsAt runs on the wall clock between exactly those',
  'two moments instead of taking part in the season rotation. Both or neither.',
  '',
  'Anything malformed is dropped with a console warning and the game boots on the',
  'defaults, so a mistake here cannot take the site down. Open the game with',
  '?admin=1 to edit all of this visually and have it write this file for you.',
  '',
  'Full format: docs/CONTENT.md. Keys starting with _ are ignored.',
];

/**
 * Load the committed pack and the local draft, merge the draft over it, and
 * apply the result.
 *
 * Returns `{ applied, warnings, source }` — `source` being 'draft', 'file',
 * 'both' or 'defaults', which is what the admin panel puts in its header so an
 * admin can see at a glance whether they are looking at their own edits.
 */
export async function loadContent({ url = PACK_URL, fetcher = globalThis.fetch } = {}) {
  const file = await fetchPack(url, fetcher);
  const draft = readDraft();

  if (!file && !draft) {
    resetContent();
    return { applied: {}, warnings: [], source: 'defaults' };
  }

  const merged = mergePacks(file, draft);
  const { pack, warnings } = applyPack(merged);
  for (const warning of warnings) console.warn(`[capyquest] content pack — ${warning}`);

  return {
    applied: pack,
    warnings,
    source: file && draft ? 'both' : draft ? 'draft' : 'file',
  };
}

async function fetchPack(url, fetcher) {
  if (typeof fetcher !== 'function') return null;
  try {
    const res = await fetcher(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    // A misconfigured host answers 200 with an index page for a missing file,
    // and `JSON.parse('<!doctype html>')` is a much less helpful error than
    // saying so here.
    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      console.warn(`[capyquest] ${url} did not contain a JSON object — ignoring it`);
      return null;
    }
    return JSON.parse(text);
  } catch (err) {
    // Offline, blocked, or malformed. None of it is worth a broken game.
    console.warn('[capyquest] could not read the content pack, using defaults', err);
    return null;
  }
}

// --------------------------------------------------------------- local draft

export function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft(pack) {
  try {
    if (!pack || !Object.keys(pack).length) {
      localStorage.removeItem(DRAFT_KEY);
      return true;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge two packs, later winning.
 *
 * One level of structure is merged rather than replaced — `cosmetics.add` from
 * the file and `cosmetics.patch` from the draft both survive — because a draft
 * that only reprices one thing should not silently discard everything the
 * committed file adds.
 */
export function mergePacks(base, over) {
  if (!base) return over || {};
  if (!over) return base;

  const out = { ...base };
  for (const [section, value] of Object.entries(over)) {
    const existing = out[section];
    if (isObject(existing) && isObject(value)) {
      const merged = { ...existing };
      for (const [key, inner] of Object.entries(value)) {
        const prior = merged[key];
        if (Array.isArray(prior) && Array.isArray(inner)) merged[key] = [...prior, ...inner];
        else if (isObject(prior) && isObject(inner)) merged[key] = { ...prior, ...inner };
        else merged[key] = inner;
      }
      out[section] = merged;
    } else {
      out[section] = value;
    }
  }
  return out;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
