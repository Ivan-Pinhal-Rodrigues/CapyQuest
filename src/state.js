// The save schema and its defaults. Anything not in here is not persisted.
//
// Rule: `state.derived` is recomputed every frame and never written to disk.
// Everything else survives a reload, so adding a field means adding it here
// *and* bumping SAVE_VERSION with a migration in save.js.

import { BUILDINGS } from './data/buildings.js';

export const SAVE_VERSION = 2;

export function createState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,

    // --- currencies
    zen: 0,
    lifetimeZen: 0, // reset by rebirth
    totalZen: 0, // never reset — drives achievements
    lifetimeClicks: 0,
    essence: 0,
    lifetimeEssence: 0,
    // Leafs are the simulated premium currency. Nothing here takes real money;
    // see systems/store.js for the whole of what that means.
    leafs: 0,
    lifetimeLeafs: 0,
    rebirthCount: 0,
    // Sticky: set the first time the 30-second boss wall is detected, and never
    // cleared. Being walled once is knowledge, and knowledge does not expire.
    rebirthUnlocked: false,
    lotus: 0,
    lifetimeLotus: 0,
    ascendCount: 0,

    // --- owned things
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
    clickUpgrades: {}, // id -> true
    tierUpgrades: {}, // id -> true
    achievements: {}, // id -> unlock timestamp
    constellations: {}, // id -> ranks (survives ascension)
    tree: {}, // rebirth tree node id -> ranks (survives rebirth)

    gacha: {
      tickets: 0,
      bought: 0,
      pulls: 0,
      fiveStars: 0,
      pity: { five: 0, four: 0 },
      companions: {}, // id -> { level, shards }
      party: [], // up to PARTY_SIZE ids
    },

    // --- retention
    quests: {
      dayKey: null,
      weekKey: null,
      daily: [],
      weekly: [],
      dailyClaimed: {},
      weeklyClaimed: {},
      // Counter snapshots taken at rollover; quests measure the delta since.
      dailyBase: {},
      weeklyBase: {},
    },

    // Cases keep their own pity counters; cosmetics keep what is owned and what
    // is worn. Both survive every reset — a collection is never the price of a
    // button.
    cases: {}, // caseId -> { opened, since }
    cosmetics: { owned: [], skin: 'classic', pond: 'dusk', title: 'bather' },
    store: { leafDay: null, packs: {} },

    login: { lastDay: null, streak: 0, best: 0, total: 0, pendingDay: 0 },
    chest: { lastAt: now, opened: 0 },
    pass: { xp: 0, claimed: {} },
    codes: {}, // redeemed code key -> timestamp

    // --- transient-ish but worth persisting
    buffs: [], // { id, name, until, effects: [...] }

    stats: {
      crits: 0,
      goldens: 0,
      naps: 0,
      bestCombo: 0,
      bestZps: 0,
      handmadeZen: 0, // zen earned by tapping specifically
      playMs: 0,
      sessionMs: 0,
      bestIdleMs: 0,

      // combat / gear counters, tracked here because achievements read them
      bestLevel: 1,
      drops: 0,
      forges: 0,
      maxForges: 0,
      raritiesFound: [],
      stancesUsed: [],
      bestStars: 1,
      fuses: 0,
      refines: 0,

      // lifetime purchase counters, read by quests
      buildingsBought: 0,
      upgradesBought: 0,
      questsDone: 0,
      chestsOpened: 0,
      rebirths: 0,
      ascensions: 0,
    },

    settings: {
      sound: true,
      volume: 0.5,
      reducedMotion: false,
      theme: 'dusk',
      buyAmount: 1, // 1 | 10 | 100 | 'max'
      notation: 'short',
    },

    combat: {
      // Absolute level index — 0, 1, 2, … with no ceiling. systems/stages.js
      // splits it into a terrain stage and a level within that stage.
      depth: 0,
      bestDepth: 0,
      autoBattle: false, // unlocked by tapping into the first fight
      unlocked: false,
      // Leaf starts neutral against the first zone. Opening the game at a
      // disadvantage would teach the wrong lesson about a mechanic nobody has
      // met yet; discovering that Ember beats it is the reward.
      element: 'leaf',
      xp: 0,
      shards: 0,
      clears: 0,
      bossKills: 0,
      inventory: [], // [{ uid, id, forge }]
      equipped: {}, // slot -> uid
      skills: [], // up to SKILL_SLOTS ids
    },
  };
}

/**
 * Fill in anything a save is missing. Runs after migrations so a save written
 * by an older build — or hand-edited by a curious player — still boots.
 */
export function reconcileState(state, now = Date.now()) {
  const base = createState(now);
  const out = { ...base, ...state };

  out.settings = { ...base.settings, ...(state.settings || {}) };
  out.stats = { ...base.stats, ...(state.stats || {}) };
  out.combat = { ...base.combat, ...(state.combat || {}) };

  // Combat collections must be the right shape even if a save was truncated or
  // hand-edited — the panels index into them every frame.
  out.combat.inventory = Array.isArray(out.combat.inventory)
    ? out.combat.inventory
        .filter((i) => i && typeof i.uid === 'string' && typeof i.id === 'string')
        .map((i) => normaliseItem(i))
    : [];
  out.combat.equipped = isPlainObject(out.combat.equipped) ? { ...out.combat.equipped } : {};
  out.combat.skills = Array.isArray(out.combat.skills) ? out.combat.skills.filter((s) => typeof s === 'string') : [];

  // Drop equip references to items that are no longer in the bag.
  const owned = new Set(out.combat.inventory.map((i) => i.uid));
  for (const [slot, uid] of Object.entries(out.combat.equipped)) {
    if (!owned.has(uid)) delete out.combat.equipped[slot];
  }

  // Generators added in a later version start at zero rather than undefined.
  out.buildings = { ...base.buildings };
  for (const [id, count] of Object.entries(state.buildings || {})) {
    if (id in out.buildings) out.buildings[id] = safeNumber(count);
  }

  out.clickUpgrades = { ...(state.clickUpgrades || {}) };
  out.tierUpgrades = { ...(state.tierUpgrades || {}) };
  out.achievements = { ...(state.achievements || {}) };
  out.constellations = countMap(state.constellations);

  // v1 kept two parallel permanent-upgrade bags: `relics` (bought with yuzu)
  // and `talents` (bought with level-derived points). v2 has one tree, and the
  // 49 v1 ids kept their names — which is exactly why this is a merge and not a
  // translation table. Ranks carry across one for one; a v2 save has neither of
  // the old keys, so this is a no-op on every load after the first.
  out.tree = countMap(state.tree);
  for (const legacy of [state.relics, state.talents]) {
    for (const [id, ranks] of Object.entries(countMap(legacy))) {
      out.tree[id] = (out.tree[id] || 0) + ranks;
    }
  }
  delete out.relics;
  delete out.talents;

  out.gacha = { ...base.gacha, ...(state.gacha || {}) };
  out.gacha.pity = {
    five: safeNumber(state.gacha?.pity?.five),
    four: safeNumber(state.gacha?.pity?.four),
  };
  out.gacha.companions = isPlainObject(state.gacha?.companions)
    ? Object.fromEntries(
        Object.entries(state.gacha.companions).map(([id, c]) => [
          id,
          { level: Math.max(1, safeNumber(c?.level) || 1), shards: safeNumber(c?.shards) },
        ]),
      )
    : {};
  out.gacha.party = Array.isArray(state.gacha?.party)
    ? state.gacha.party.filter((id) => typeof id === 'string' && id in out.gacha.companions)
    : [];
  for (const key of ['tickets', 'bought', 'pulls', 'fiveStars']) {
    out.gacha[key] = safeNumber(out.gacha[key]);
  }

  // --- retention blocks
  out.quests = { ...base.quests, ...(state.quests || {}) };
  out.quests.daily = stringList(out.quests.daily);
  out.quests.weekly = stringList(out.quests.weekly);
  out.quests.dailyClaimed = isPlainObject(out.quests.dailyClaimed) ? { ...out.quests.dailyClaimed } : {};
  out.quests.weeklyClaimed = isPlainObject(out.quests.weeklyClaimed) ? { ...out.quests.weeklyClaimed } : {};
  out.quests.dailyBase = numberMap(out.quests.dailyBase);
  out.quests.weeklyBase = numberMap(out.quests.weeklyBase);

  out.cases = isPlainObject(state.cases)
    ? Object.fromEntries(
        Object.entries(state.cases).map(([id, c]) => [
          id,
          { opened: Math.floor(safeNumber(c?.opened)), since: Math.floor(safeNumber(c?.since)) },
        ]),
      )
    : {};

  out.cosmetics = { ...base.cosmetics, ...(state.cosmetics || {}) };
  out.cosmetics.owned = stringList(out.cosmetics.owned);
  for (const kind of ['skin', 'pond', 'title']) {
    if (typeof out.cosmetics[kind] !== 'string') out.cosmetics[kind] = base.cosmetics[kind];
  }

  out.store = { ...base.store, ...(state.store || {}) };
  out.store.packs = numberMap(out.store.packs);
  if (typeof out.store.leafDay !== 'string') out.store.leafDay = null;

  out.login = { ...base.login, ...(state.login || {}) };
  for (const key of ['streak', 'best', 'total', 'pendingDay']) {
    out.login[key] = safeNumber(out.login[key]);
  }

  out.chest = { ...base.chest, ...(state.chest || {}) };
  // Deliberately normalises a zero or absent timer to now: epoch 0 in a save
  // would hand out a full stack of chests on load. A timer in the *future*
  // (a clock that jumped back) would stall collection forever, so clamp that
  // too. The runtime helpers in systems/quests.js treat 0 as a real timestamp;
  // this is the one place it is a corruption signal instead.
  out.chest.lastAt = safeNumber(out.chest.lastAt) || now;
  if (out.chest.lastAt > now) out.chest.lastAt = now;
  out.chest.opened = safeNumber(out.chest.opened);

  out.pass = { ...base.pass, ...(state.pass || {}) };
  out.pass.xp = safeNumber(out.pass.xp);
  out.pass.claimed = isPlainObject(out.pass.claimed) ? { ...out.pass.claimed } : {};

  out.codes = isPlainObject(state.codes) ? { ...state.codes } : {};
  out.buffs = Array.isArray(state.buffs) ? state.buffs.filter((b) => b && b.until > now) : [];

  // v1 called the rebirth currency `yuzu` and its counter `prestigeCount`. The
  // meaning is unchanged, so the migration is a rename — and it has to happen
  // before the scrub below, or a v1 save quietly loses everything it earned.
  if (state.essence === undefined && state.yuzu !== undefined) out.essence = state.yuzu;
  if (state.lifetimeEssence === undefined && state.lifetimeYuzu !== undefined) {
    out.lifetimeEssence = state.lifetimeYuzu;
  }
  if (state.rebirthCount === undefined && state.prestigeCount !== undefined) {
    out.rebirthCount = state.prestigeCount;
  }
  if (state.stats?.rebirths === undefined && state.stats?.prestiges !== undefined) {
    out.stats.rebirths = state.stats.prestiges;
  }
  delete out.stats.prestiges;
  delete out.yuzu;
  delete out.lifetimeYuzu;
  delete out.prestigeCount;

  // Anyone who prestiged in v1 has already met a wall of some kind, and making
  // them prove it again would read as the feature being broken.
  out.rebirthUnlocked = !!out.rebirthUnlocked || out.rebirthCount > 0;

  // Numeric fields get scrubbed — a single NaN in a save poisons every formula
  // downstream and the symptom shows up somewhere unrelated.
  for (const key of [
    'zen', 'lifetimeZen', 'totalZen', 'lifetimeClicks',
    'essence', 'lifetimeEssence', 'rebirthCount',
    'leafs', 'lifetimeLeafs',
    'lotus', 'lifetimeLotus', 'ascendCount',
  ]) {
    out[key] = safeNumber(out[key]);
  }
  // Not every stat is a number — the "have I ever seen one of these" sets are
  // arrays, and coercing them would wipe the achievements that read them.
  const STAT_SETS = ['raritiesFound', 'stancesUsed'];
  for (const key of Object.keys(out.stats)) {
    if (STAT_SETS.includes(key)) {
      out.stats[key] = Array.isArray(out.stats[key])
        ? [...new Set(out.stats[key].filter((v) => typeof v === 'string'))]
        : [];
      continue;
    }
    out.stats[key] = safeNumber(out.stats[key]);
  }
  // v1 called the absolute level index `stage`. The meaning is identical, so the
  // migration is a rename — but it has to happen before the numbers are scrubbed
  // or a v1 save silently restarts at depth 0.
  if (state.combat && state.combat.depth === undefined && state.combat.stage !== undefined) {
    out.combat.depth = state.combat.stage;
    out.combat.bestDepth = state.combat.bestStage ?? state.combat.stage;
  }
  delete out.combat.stage;
  delete out.combat.bestStage;

  for (const key of ['depth', 'bestDepth', 'xp', 'shards', 'clears', 'bossKills']) {
    out.combat[key] = safeNumber(out.combat[key]);
  }
  // You can only be standing somewhere you have actually reached.
  out.combat.depth = Math.min(out.combat.depth, out.combat.bestDepth);

  out.version = SAVE_VERSION;
  return out;
}

/**
 * An inventory entry, repaired. A save written before the rarity ladder existed
 * has no tier or stars, and leaving those undefined would let a piece resolve
 * differently depending on which code path read it — so they are filled in here,
 * once, at the boundary. GEAR_BY_ID is not consulted: an entry for an item that
 * no longer exists keeps its numbers and is simply ignored downstream, rather
 * than being silently deleted.
 */
function normaliseItem(entry) {
  const out = { uid: entry.uid, id: entry.id, forge: safeNumber(entry.forge) };
  out.forge = Math.min(15, Math.floor(out.forge));
  if (entry.tier !== undefined) out.tier = clampInt(entry.tier, 0, 19);
  out.stars = entry.stars === undefined ? 1 : clampInt(entry.stars, 1, 5);
  out.refineFails = Math.floor(safeNumber(entry.refineFails));
  return out;
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

/** key -> number, used for the quest counter snapshots. */
function numberMap(source) {
  if (!isPlainObject(source)) return {};
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, safeNumber(v)]));
}

/** id -> positive integer rank count, with anything malformed dropped. */
function countMap(source) {
  if (!isPlainObject(source)) return {};
  const out = {};
  for (const [id, value] of Object.entries(source)) {
    const n = Math.floor(safeNumber(value));
    if (n > 0) out[id] = n;
  }
  return out;
}
