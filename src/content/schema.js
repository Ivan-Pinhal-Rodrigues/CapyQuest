// Validating a content pack.
//
// A pack is a file an admin edits by hand and commits. That makes it the one
// piece of input in the whole game that is neither code the tests cover nor a
// save the reconciler repairs — so it is also the one piece able to take the
// site down for everybody at once if a trailing comma or a mistyped field gets
// through.
//
// The rule here is therefore: **never throw, never take the game with you.**
// Anything malformed is dropped, a warning naming its path is collected, and
// what is left is applied. A pack that is entirely nonsense degrades to the
// built-in defaults, which is exactly what a player should see rather than a
// blank page.
//
// Keys beginning with `_` are ignored everywhere, so a pack can carry notes to
// whoever edits it next — JSON has no comments and an admin file that cannot
// explain itself gets edited wrongly.

import { COSMETIC_KIND_IDS, SOURCES, skinPaletteExists } from '../data/cosmetics.js';

/** Reward fields a pass level or an exchange row is allowed to pay. */
const REWARD_KEYS = ['leafs', 'tickets', 'shards', 'zen', 'zenMult', 'essence', 'lotus', 'cosmetic'];

/** The sections a pack may carry, and the key each section's entries are keyed by. */
const SECTIONS = {
  cosmetics: { key: cosmeticIdOf, validate: validateCosmetic },
  boosts: { key: (e) => e.id, validate: validateBoost },
  leafPacks: { key: (e) => e.id, validate: validateLeafPack },
  events: { key: (e) => e.id, validate: validateEvent },
};

/**
 * Validate and normalise a raw pack.
 *
 * Returns `{ pack, warnings }`. `pack` is always a usable object — in the worst
 * case an empty one — and `warnings` is a list of human-readable strings naming
 * what was dropped and why.
 */
export function validatePack(raw) {
  const warnings = [];
  const pack = {};

  if (!isObject(raw)) {
    if (raw !== undefined && raw !== null) warnings.push('pack: not an object, ignored');
    return { pack, warnings };
  }

  for (const [name, section] of Object.entries(SECTIONS)) {
    const value = raw[name];
    if (value === undefined) continue;
    if (!isObject(value)) {
      warnings.push(`${name}: not an object, ignored`);
      continue;
    }
    const out = normaliseSection(name, value, section, warnings);
    if (out) pack[name] = out;
  }

  if (raw.pass !== undefined) {
    const pass = validatePassOverrides(raw.pass, warnings);
    if (pass) pack.pass = pass;
  }

  if (raw.version !== undefined) {
    const version = Number(raw.version);
    if (Number.isFinite(version)) pack.version = version;
    else warnings.push('version: not a number, ignored');
  }

  return { pack, warnings };
}

// ------------------------------------------------------------------ sections

function normaliseSection(name, value, section, warnings) {
  const out = {};

  if (value.add !== undefined) {
    if (!Array.isArray(value.add)) {
      warnings.push(`${name}.add: not a list, ignored`);
    } else {
      const add = [];
      value.add.forEach((entry, i) => {
        const checked = section.validate(entry, `${name}.add[${i}]`, warnings, { full: true });
        if (checked) add.push(checked);
      });
      if (add.length) out.add = add;
    }
  }

  if (value.patch !== undefined) {
    if (!isObject(value.patch)) {
      warnings.push(`${name}.patch: not an object, ignored`);
    } else {
      const patch = {};
      for (const [id, entry] of Object.entries(value.patch)) {
        if (id.startsWith('_')) continue;
        const checked = section.validate(entry, `${name}.patch.${id}`, warnings, { full: false });
        if (checked) patch[id] = checked;
      }
      if (Object.keys(patch).length) out.patch = patch;
    }
  }

  if (value.remove !== undefined) {
    const remove = stringList(value.remove);
    if (!Array.isArray(value.remove)) warnings.push(`${name}.remove: not a list, ignored`);
    else if (remove.length) out.remove = remove;
  }

  return Object.keys(out).length ? out : null;
}

// --------------------------------------------------------------- entry kinds

/**
 * `full` distinguishes an addition from a patch. An addition has to stand on
 * its own — every required field present — while a patch only has to be
 * well-formed in the fields it actually mentions, because the rest comes from
 * the entry it is patching.
 */
function validateCosmetic(entry, path, warnings, { full }) {
  if (!isObject(entry)) return drop(warnings, path, 'not an object');
  const out = copyKnown(entry, ['kind', 'id', 'name', 'source', 'cost', 'blurb', 'need', 'band', 'hidden']);

  if (full) {
    if (!isNonEmptyString(out.kind)) return drop(warnings, path, 'missing a kind');
    if (!COSMETIC_KIND_IDS.includes(out.kind)) return drop(warnings, path, `unknown kind "${out.kind}"`);
    if (!isNonEmptyString(out.id)) return drop(warnings, path, 'missing an id');
    if (!isNonEmptyString(out.name)) return drop(warnings, path, 'missing a name');
    // A skin names a palette. One the renderer does not have would draw as the
    // default with no hint as to why, so it is refused here where it can say so.
    if (out.kind === 'skin' && !skinPaletteExists(out.id)) {
      return drop(warnings, path, `no palette named "${out.id}" — add it to render/palettes.js first`);
    }
    if (out.source === undefined) out.source = 'store';
  }

  if (out.source !== undefined && !(out.source in SOURCES)) {
    return drop(warnings, path, `unknown source "${out.source}"`);
  }
  if (out.source === 'store' || out.cost !== undefined) {
    const cost = Number(out.cost);
    if (!Number.isFinite(cost) || cost < 0) return drop(warnings, path, 'a store cosmetic needs a cost');
    out.cost = cost;
  }
  if (out.need !== undefined && !isObject(out.need)) return drop(warnings, path, 'need is not an object');
  if (out.hidden !== undefined) out.hidden = !!out.hidden;

  return out;
}

function validateBoost(entry, path, warnings, { full }) {
  if (!isObject(entry)) return drop(warnings, path, 'not an object');
  const out = copyKnown(entry, ['id', 'name', 'icon', 'cost', 'hours', 'blurb', 'effects', 'hidden']);

  if (full) {
    if (!isNonEmptyString(out.id)) return drop(warnings, path, 'missing an id');
    if (!isNonEmptyString(out.name)) return drop(warnings, path, 'missing a name');
    if (!Array.isArray(out.effects) || !out.effects.length) {
      return drop(warnings, path, 'a boost with no effects would do nothing');
    }
  }
  if (out.effects !== undefined && !Array.isArray(out.effects)) {
    return drop(warnings, path, 'effects is not a list');
  }
  if (!positiveInto(out, 'cost', path, warnings, { allowZero: true, required: full })) return null;
  if (!positiveInto(out, 'hours', path, warnings, { required: full })) return null;
  if (out.hidden !== undefined) out.hidden = !!out.hidden;

  return out;
}

function validateLeafPack(entry, path, warnings, { full }) {
  if (!isObject(entry)) return drop(warnings, path, 'not an object');
  const out = copyKnown(entry, ['id', 'name', 'leafs', 'price', 'bonus', 'best', 'hidden']);

  if (full) {
    if (!isNonEmptyString(out.id)) return drop(warnings, path, 'missing an id');
    if (!isNonEmptyString(out.name)) return drop(warnings, path, 'missing a name');
    if (!isNonEmptyString(out.price)) return drop(warnings, path, 'missing a price tag');
  }
  if (!positiveInto(out, 'leafs', path, warnings, { required: full })) return null;
  if (out.best !== undefined) out.best = !!out.best;
  if (out.hidden !== undefined) out.hidden = !!out.hidden;

  return out;
}

function validateEvent(entry, path, warnings, { full }) {
  if (!isObject(entry)) return drop(warnings, path, 'not an object');
  const out = copyKnown(entry, [
    'id', 'name', 'live', 'color', 'icon', 'blurb', 'hook', 'exchange',
    'clearBonus', 'background', 'startsAt', 'endsAt',
  ]);

  if (full) {
    if (!isNonEmptyString(out.id)) return drop(warnings, path, 'missing an id');
    if (!isNonEmptyString(out.name)) return drop(warnings, path, 'missing a name');
  }
  if (out.live !== undefined) out.live = !!out.live;

  // An event may be scheduled by the wall clock instead of by the season's
  // rotating windows. Both ends are required together: an event that starts and
  // never stops is the one mistake this file exists to catch.
  const hasStart = out.startsAt !== undefined;
  const hasEnd = out.endsAt !== undefined;
  if (hasStart !== hasEnd) {
    return drop(warnings, path, 'startsAt and endsAt must be given together');
  }
  if (hasStart) {
    const startsAt = toMillis(out.startsAt);
    const endsAt = toMillis(out.endsAt);
    if (startsAt === null) return drop(warnings, path, `startsAt "${out.startsAt}" is not a date`);
    if (endsAt === null) return drop(warnings, path, `endsAt "${out.endsAt}" is not a date`);
    if (endsAt <= startsAt) return drop(warnings, path, 'endsAt is not after startsAt');
    out.startsAt = startsAt;
    out.endsAt = endsAt;
  }

  if (out.exchange !== undefined) {
    if (!Array.isArray(out.exchange)) return drop(warnings, path, 'exchange is not a list');
    const rows = [];
    out.exchange.forEach((row, i) => {
      const checked = validateExchangeRow(row, `${path}.exchange[${i}]`, warnings);
      if (checked) rows.push(checked);
    });
    out.exchange = rows;
  } else if (full) {
    out.exchange = [];
  }

  if (out.clearBonus !== undefined) {
    const bonus = Number(out.clearBonus);
    if (!Number.isFinite(bonus) || bonus <= 0) return drop(warnings, path, 'clearBonus must be above zero');
    out.clearBonus = bonus;
  }

  return out;
}

function validateExchangeRow(row, path, warnings) {
  if (!isObject(row)) return drop(warnings, path, 'not an object');
  const out = copyKnown(row, ['id', 'petals', 'reward', 'text', 'once']);

  if (!isNonEmptyString(out.id)) return drop(warnings, path, 'missing an id');
  if (!positiveInto(out, 'petals', path, warnings, { required: true })) return null;
  const reward = validateReward(out.reward, path, warnings);
  if (!reward) return null;
  out.reward = reward;
  if (!isNonEmptyString(out.text)) out.text = describeRewardRoughly(reward);
  if (out.once !== undefined) out.once = !!out.once;

  return out;
}

// ---------------------------------------------------------------------- pass

function validatePassOverrides(raw, warnings) {
  if (!isObject(raw)) {
    warnings.push('pass: not an object, ignored');
    return null;
  }
  const out = {};
  for (const track of ['free', 'premium']) {
    const table = raw[track];
    if (table === undefined) continue;
    if (!isObject(table)) {
      warnings.push(`pass.${track}: not an object, ignored`);
      continue;
    }
    const levels = {};
    for (const [key, entry] of Object.entries(table)) {
      if (key.startsWith('_')) continue;
      const level = Number(key);
      if (!Number.isInteger(level) || level < 1) {
        warnings.push(`pass.${track}.${key}: not a level number, ignored`);
        continue;
      }
      const reward = validateReward(entry, `pass.${track}.${key}`, warnings);
      if (!reward) continue;
      if (!isNonEmptyString(entry.text)) reward.text = describeRewardRoughly(reward);
      else reward.text = entry.text;
      levels[level] = reward;
    }
    if (Object.keys(levels).length) out[track] = levels;
  }
  return Object.keys(out).length ? out : null;
}

function validateReward(reward, path, warnings) {
  if (!isObject(reward)) return drop(warnings, path, 'reward is not an object');
  const out = {};
  for (const key of REWARD_KEYS) {
    if (reward[key] === undefined) continue;
    if (key === 'cosmetic') {
      if (!isNonEmptyString(reward.cosmetic) || !reward.cosmetic.includes(':')) {
        return drop(warnings, path, 'cosmetic must read "kind:id"');
      }
      out.cosmetic = reward.cosmetic;
      continue;
    }
    const value = Number(reward[key]);
    if (!Number.isFinite(value) || value <= 0) {
      return drop(warnings, path, `${key} must be a number above zero`);
    }
    out[key] = value;
  }
  if (!Object.keys(out).length) return drop(warnings, path, 'reward pays nothing');
  return out;
}

/** A last-resort label, so a reward is never described as `undefined`. */
function describeRewardRoughly(reward) {
  const parts = [];
  if (reward.cosmetic) parts.push(reward.cosmetic.replace(':', ': '));
  for (const key of REWARD_KEYS) {
    if (key === 'cosmetic' || reward[key] === undefined) continue;
    parts.push(`${reward[key]} ${key}`);
  }
  return parts.join(' · ');
}

// ------------------------------------------------------------------ plumbing

export function cosmeticIdOf(entry) {
  return `${entry.kind}:${entry.id}`;
}

/**
 * Accepts an ISO string or a millisecond number. Returns null for anything a
 * Date cannot make sense of — including the empty string, which `new Date('')`
 * turns into an Invalid Date rather than an error.
 */
export function toMillis(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!isNonEmptyString(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function drop(warnings, path, why) {
  warnings.push(`${path}: ${why}`);
  return null;
}

/** Copy only the fields we know about, so a pack cannot smuggle in a field. */
function copyKnown(entry, keys) {
  const out = {};
  for (const key of keys) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

function positiveInto(out, key, path, warnings, { required = false, allowZero = false } = {}) {
  if (out[key] === undefined) {
    if (required) {
      drop(warnings, path, `missing ${key}`);
      return false;
    }
    return true;
  }
  const value = Number(out[key]);
  const floor = allowZero ? 0 : Number.MIN_VALUE;
  if (!Number.isFinite(value) || value < floor) {
    drop(warnings, path, `${key} must be a number${allowZero ? ' of zero or more' : ' above zero'}`);
    return false;
  }
  out[key] = value;
  return true;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringList(value) {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}
