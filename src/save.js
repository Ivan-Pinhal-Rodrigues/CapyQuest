// Persistence: localStorage read/write, forward-only migrations, and the
// export/import codes players use to move a save between devices.
//
// Migrations are forward-only and never destructive. A save written by any
// released build must boot on every later build.

import { SAVE_VERSION, createState, reconcileState } from './state.js';

export const SAVE_KEY = 'capyquest:save:v1';
const BACKUP_KEY = 'capyquest:save:backup';

/**
 * version N -> N+1. Add an entry whenever SAVE_VERSION goes up.
 * Each function receives the state and returns the upgraded state.
 */
const MIGRATIONS = {
  // 0: (s) => { ...s, version: 1 },  // example shape for the next one
};

export function migrate(raw) {
  let state = raw;
  let version = Number(state.version) || 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      // No migration defined — reconcileState backfills whatever is missing.
      break;
    }
    state = step(state);
    version = Number(state.version) || version + 1;
  }
  return state;
}

/** Read and repair the save. Returns null when there is nothing stored. */
export function loadState(storage = safeStorage(), now = Date.now()) {
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return reconcileState(migrate(JSON.parse(raw)), now);
  } catch (err) {
    console.warn('[capyquest] save was unreadable, keeping a backup copy', err);
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* storage full or blocked — the corrupt save is already lost, move on */
    }
    return null;
  }
}

export function saveState(state, storage = safeStorage(), now = Date.now()) {
  if (!storage) return false;
  try {
    const snapshot = { ...state, lastSeen: now };
    delete snapshot.derived;
    storage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    console.warn('[capyquest] could not write save', err);
    return false;
  }
}

export function clearSave(storage = safeStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* nothing useful to do if removal is blocked */
  }
}

// -------------------------------------------------------------- export codes

/** Save -> shareable text blob. Base64 of the JSON, with a version prefix. */
export function exportSave(state) {
  const snapshot = { ...state };
  delete snapshot.derived;
  const json = JSON.stringify(snapshot);
  return `CAPY1.${toBase64(json)}`;
}

/** Shareable text blob -> save. Throws with a readable message on bad input. */
export function importSave(code, now = Date.now()) {
  const trimmed = String(code || '').trim();
  if (!trimmed.startsWith('CAPY1.')) {
    throw new Error('That does not look like a CapyQuest save code.');
  }
  const json = fromBase64(trimmed.slice('CAPY1.'.length));
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || !parsed.buildings) {
    throw new Error('That save code is missing its game data.');
  }
  return reconcileState(migrate(parsed), now);
}

export function freshState(now = Date.now()) {
  return createState(now);
}

// ------------------------------------------------------------------ plumbing

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Private-mode Safari exposes localStorage but throws on write.
    const probe = '__capyquest_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

// btoa/atob only handle latin1, and the save contains em dashes and other
// non-ASCII flavour text, so round-trip through UTF-8 bytes explicitly.
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return base64Encode(binary);
}

function fromBase64(b64) {
  const binary = base64Decode(b64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64Encode(binary) {
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}

function base64Decode(b64) {
  if (typeof atob === 'function') return atob(b64);
  return Buffer.from(b64, 'base64').toString('binary');
}
