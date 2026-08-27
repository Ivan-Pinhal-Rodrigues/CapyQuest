// The client half of the optional backend. See server/worker.js.
//
// ONE RULE, AND EVERYTHING HERE FOLLOWS FROM IT: **nothing in the game may ever
// wait on this file.** Not the boot sequence, not a save, not opening a panel.
// CapyQuest is a static site that works offline and that is not being traded
// away for a leaderboard.
//
// So every call:
//   - is `async` and returns a result object rather than throwing,
//   - carries its own AbortController timeout, because a request that never
//     resolves is worse than one that fails,
//   - resolves to `{ ok: false }` for every kind of failure — no endpoint, no
//     network, a 500, a timeout, garbage JSON — because the caller does the
//     same thing in all of them.
//
// IDENTITY. A device makes up a random id and a random secret the first time
// cloud save is switched on, and keeps them in localStorage. No email, no
// account, no password. Lose both and you lose the cloud copy, which is the
// same failure as losing the browser profile — and the save code the game has
// always had is the answer to both.

import { exportSave } from '../save.js';

const IDENTITY_KEY = 'capyquest:cloud:id';

/** Long enough for a cold Worker, short enough not to be noticed. */
const TIMEOUT_MS = 6000;

/**
 * Where the server lives, or null.
 *
 * It comes from the content pack rather than a constant in the source, for the
 * same reason shop prices do: it is deployment configuration, and changing it
 * should not need a code change. No pack, no `cloud` section, or an empty
 * endpoint and this whole module stays dormant — `configured()` is false and
 * nothing ever makes a request.
 */
let endpoint = null;

export function setEndpoint(url) {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  // https only, and never a bare path: the game may be served from a custom
  // domain or an itch.io iframe, so a relative endpoint would resolve
  // somewhere nobody intended.
  endpoint = /^https:\/\/[^\s]+$/.test(trimmed) ? trimmed : null;
  return endpoint;
}

export function configured() {
  return Boolean(endpoint);
}

// ------------------------------------------------------------------ identity

/**
 * This device's id and secret, made on first use.
 *
 * `crypto.getRandomValues` where it exists, `Math.random` where it does not.
 * The fallback is genuinely weaker and it guards one player's own save slot in
 * a single-player game — worth saying out loud rather than pretending the two
 * are equivalent.
 */
export function identity(storage = safeStorage()) {
  if (!storage) return null;
  try {
    const saved = storage.getItem(IDENTITY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id && parsed?.secret) return parsed;
    }
  } catch {
    // Unreadable — fall through and make a new one rather than dying here.
  }

  const made = { id: randomToken(24), secret: randomToken(40) };
  try {
    storage.setItem(IDENTITY_KEY, JSON.stringify(made));
  } catch {
    // Storage is blocked. The identity still works for this session; it simply
    // will not be the same one next time, which is a degradation rather than a
    // failure — and Game.save() is already warning about storage separately.
  }
  return made;
}

/** Forget this device's cloud identity. Used when the player turns it off. */
export function forgetIdentity(storage = safeStorage()) {
  try {
    storage?.removeItem(IDENTITY_KEY);
  } catch {
    /* nothing useful to do */
  }
}

// ---------------------------------------------------------------- cloud save

/** Push the current save up. Resolves to { ok } and never throws. */
export async function pushSave(state, now = Date.now()) {
  const who = identity();
  if (!configured() || !who) return { ok: false, reason: 'off' };

  return post('/v1/save', {
    id: who.id,
    secret: who.secret,
    code: exportSave(state),
    updatedAt: now,
  });
}

/**
 * Fetch the stored save.
 *
 * Returns the raw CAPY1 blob rather than a state object. Whether to APPLY it is
 * emphatically not this module's decision — overwriting somebody's local
 * progress with a copy from another device is the one genuinely destructive
 * thing here, and it belongs behind a dialog in main.js that says what it will
 * cost.
 */
export async function pullSave() {
  const who = identity();
  if (!configured() || !who) return { ok: false, reason: 'off' };

  const params = new URLSearchParams({ id: who.id, secret: who.secret });
  return get(`/v1/save?${params}`);
}

// ---------------------------------------------------------------- the board

/**
 * Report where this player has got to, and get the real board back.
 *
 * Sends only what the board displays: a name, a depth, a rebirth count, a pass
 * level. Not the save, not the gear, not anything the player has not already
 * chosen to put on a leaderboard.
 */
export async function pushScore({ season, name, depth, rebirths, passLevel }) {
  const who = identity();
  if (!configured() || !who) return { ok: false, reason: 'off' };

  return post('/v1/board', {
    id: who.id, secret: who.secret, season, name, depth, rebirths, passLevel,
  });
}

export async function fetchBoard(season) {
  if (!configured()) return { ok: false, reason: 'off' };
  return get(`/v1/board?season=${encodeURIComponent(season)}`);
}

// ------------------------------------------------------------------ plumbing

async function get(path) {
  return request(path, { method: 'GET' });
}

async function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * One request, one timeout, and never an exception.
 *
 * Every failure mode collapses to `{ ok: false }` because every caller treats
 * them identically: the game carries on exactly as it would with no server at
 * all. The reason is carried for the console and for tests, not for the player
 * — "the leaderboard is briefly unavailable" is not news anybody needs.
 */
async function request(path, options) {
  if (!configured()) return { ok: false, reason: 'off' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint + path, { ...options, signal: controller.signal });
    if (!res.ok) return { ok: false, reason: `http ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    // In `finally` so a throw between the fetch and the return cannot leave a
    // timer running that aborts some later request.
    clearTimeout(timer);
  }
}

function randomToken(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const out = [];
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out.push(alphabet[b % alphabet.length]);
  } else {
    for (let i = 0; i < length; i++) {
      out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
  }
  return out.join('');
}

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__capyquest_cloud_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
