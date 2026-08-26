// The save schema and its defaults. Anything not in here is not persisted.
//
// Rule: `state.derived` is recomputed every frame and never written to disk.
// Everything else survives a reload, so adding a field means adding it here
// *and* bumping SAVE_VERSION with a migration in save.js.

import { BUILDINGS } from './data/buildings.js';

export const SAVE_VERSION = 3;

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
    // Keystones taken, at most KEYSTONE_MAX of them. Survives a rebirth for
    // exactly the same reason the tree does: it is the thing the reset buys.
    keystones: [],

    gacha: {
      tickets: 0,
      bought: 0,
      pulls: 0,
      fiveStars: 0,
      pity: { five: 0, four: 0 },
      // id -> { level, shards, hat, gear: { charm, collar, trinket } }.
      // The hat is cosmetic and comes from the player's own wardrobe; the gear
      // uids point into state.companionGear.
      companions: {},
      party: [], // up to PARTY_SIZE ids
    },

    // --- retention
    quests: {
      dayKey: null,
      weekKey: null,
      // What the day put on the table, and what you took from it. `daily` is
      // empty until the player chooses — see systems/quests.js.
      dailyOffer: [],
      weeklyOffer: [],
      rerolls: 0,
      daily: [],
      weekly: [],
      dailyClaimed: {},
      weeklyClaimed: {},
      // Counter snapshots taken at rollover; quests measure the delta since.
      dailyBase: {},
      weeklyBase: {},
    },

    // The crew's gear. Its own bag rather than part of combat.inventory: the
    // slots are different, and mixing them would mean every "is this better"
    // comparison in the Kit panel had to filter first. Survives every reset,
    // like every other collection.
    companionGear: [], // [{ uid, id, tier, stars }]

    // Cases keep their own pity counters; cosmetics keep what is owned and what
    // is worn. Both survive every reset — a collection is never the price of a
    // button.
    cases: {}, // caseId -> { opened, since }
    cosmetics: {
      owned: [],
      skin: 'classic',
      pond: 'dusk',
      title: 'bather',
      // The three wearable slots. `none` is a real choice, not an absence —
      // taking a hat off has to be as available as putting one on.
      hat: 'none',
      outfit: 'none',
      accessory: 'none',
    },
    store: { leafDay: null, packs: {} },
    // Petals belong to one event occurrence. `key` names it; when the clock
    // moves past that event, systems/events.js zeroes the lot — see syncEvent.
    events: { key: null, petals: 0, claimed: {} },
    // Story beats fire once, ever. This survives every reset in the game —
    // being made to sit through the opening again after a rebirth would be
    // unbearable, and a season has no business touching it.
    story: { seen: {}, skip: false, onboarded: false, tutorial: {} },
    // No account, no server. A profile is a name you can change and two things
    // you chose to wear; `name` empty means "still using the generated one".
    profile: { name: '' },

    // The offline tank. Holds zen banked at the rate that was in force when it
    // accrued, so leaving it uncollected is a choice about *when*, never a way
    // to earn more — see systems/cache.js.
    cache: { zen: 0, ms: 0, lostMs: 0, since: 0 },

    // The weekly bracket. `best` is a placement, so 1 is the best there is and
    // 0 means you have never entered one.
    bracket: { weekKey: null, placement: 0, claimed: false, results: [], best: 0 },

    login: { lastDay: null, streak: 0, best: 0, total: 0, pendingDay: 0 },
    chest: { lastAt: now, opened: 0 },
    // The season pass. `season` is the index the save last saw — when the clock
    // moves past it, systems/season.js rolls the pass over and keeps the looks.
    pass: {
      season: null,
      xp: 0,
      premium: false,
      claimed: { free: {}, premium: {} },
      bestLevel: 0,
      history: [], // [{ index, level, premium, claimed }], newest first
    },
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
      metCapybara: 0, // a hostile capybara, which is a story beat as well as a fight

      // lifetime counters for things whose live value is deliberately not a
      // running total: petals expire with their event, boosts expire on a
      // timer, and the cache is emptied every time it is collected.
      petals: 0,
      boosts: 0,
      cacheZen: 0,
      bestCache: 0,

      // lifetime purchase counters, read by quests
      buildingsBought: 0,
      upgradesBought: 0,
      questsDone: 0,
      chestsOpened: 0,
      rebirths: 0,
      ascensions: 0,
      // Rebirths across every ascension. `rebirthCount` is wiped by ascending —
      // that is the price of it — so this is where the record lives.
      lifetimeRebirths: 0,

      // Depth across every run there has ever been. `combat.bestDepth` resets
      // with each rebirth, so without these there is no record of how far the
      // player has actually travelled — which is exactly what Ascension pays
      // for. Both survive every reset in the game.
      totalDepth: 0,
      deepestEver: 0,
    },

    settings: {
      sound: true,
      // Off until asked for. See the note in ui/panels.js.
      music: false,
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
      // Skills firing themselves. On by default: turning it off is opting in to
      // work, and must never be something the game does to you.
      autoCast: true,
      // Set when a boss runs the thirty-second clock out. While it is on, the
      // fight stops walking you forward on its own — climbing back up is a
      // press of Forward. Cleared by travelling anywhere on purpose.
      holding: false,
      unlocked: false,
      // Leaf starts neutral against the first zone. Opening the game at a
      // disadvantage would teach the wrong lesson about a mechanic nobody has
      // met yet; discovering that Ember beats it is the reward.
      element: 'leaf',
      xp: 0,
      shards: 0,
      clears: 0,
      bossKills: 0,
      bossTimeouts: 0,
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
  // A save from before manual casting existed has no flag, and must land on
  // auto — it was written by someone who never chose otherwise.
  out.combat.autoCast = state.combat?.autoCast !== false;

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

  // A save from before keystones existed simply has none.
  out.keystones = stringList(state.keystones).slice(0, 8);

  out.gacha = { ...base.gacha, ...(state.gacha || {}) };
  out.gacha.pity = {
    five: safeNumber(state.gacha?.pity?.five),
    four: safeNumber(state.gacha?.pity?.four),
  };
  out.gacha.companions = isPlainObject(state.gacha?.companions)
    ? Object.fromEntries(
        Object.entries(state.gacha.companions).map(([id, c]) => [
          id,
          {
            level: Math.max(1, safeNumber(c?.level) || 1),
            shards: safeNumber(c?.shards),
            // A save from before the crew existed has neither, and both have to
            // be the right shape: the scene reads the hat every frame and the
            // stat block walks the gear on every recompute.
            hat: typeof c?.hat === 'string' ? c.hat : 'none',
            gear: isPlainObject(c?.gear)
              ? Object.fromEntries(
                  Object.entries(c.gear).filter(([, uid]) => typeof uid === 'string'),
                )
              : {},
          },
        ]),
      )
    : {};

  // The crew's bag, repaired the same way the player's is.
  out.companionGear = Array.isArray(state.companionGear)
    ? state.companionGear
        .filter((i) => i && typeof i.uid === 'string' && typeof i.id === 'string')
        .map((i) => ({
          uid: i.uid,
          id: i.id,
          tier: clampInt(i.tier ?? 0, 0, 19),
          stars: clampInt(i.stars ?? 1, 1, 5),
        }))
    : [];

  // Drop equip references to pieces no longer in the bag — exactly the repair
  // out.combat.equipped gets above, for exactly the same reason.
  const crewOwned = new Set(out.companionGear.map((i) => i.uid));
  for (const owned of Object.values(out.gacha.companions)) {
    for (const [slot, uid] of Object.entries(owned.gear)) {
      if (!crewOwned.has(uid)) delete owned.gear[slot];
    }
  }
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
  out.quests.dailyOffer = stringList(out.quests.dailyOffer);
  out.quests.weeklyOffer = stringList(out.quests.weeklyOffer);
  out.quests.rerolls = safeNumber(out.quests.rerolls);
  // A save written before quests were a choice has picks but no offer. Those
  // picks were made for the player by the old build and stand for the day; the
  // offer being empty simply means there is nothing left to choose.
  if (!out.quests.dailyOffer.length && out.quests.daily.length) {
    out.quests.dailyOffer = [...out.quests.daily];
  }
  if (!out.quests.weeklyOffer.length && out.quests.weekly.length) {
    out.quests.weeklyOffer = [...out.quests.weekly];
  }
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
  // A save written before the wardrobe existed has no hat, outfit or accessory
  // key; the spread above fills all three from the defaults, and this repairs
  // anything hand-edited to a non-string.
  for (const kind of ['skin', 'pond', 'title', 'hat', 'outfit', 'accessory']) {
    if (typeof out.cosmetics[kind] !== 'string') out.cosmetics[kind] = base.cosmetics[kind];
  }

  out.events = { ...base.events, ...(state.events || {}) };
  out.events.key = typeof out.events.key === 'string' ? out.events.key : null;
  out.events.petals = Math.floor(safeNumber(out.events.petals));
  out.events.claimed = numberMap(out.events.claimed);

  out.profile = { ...base.profile, ...(state.profile || {}) };
  out.profile.name = typeof out.profile.name === 'string' ? out.profile.name.slice(0, 22) : '';

  out.story = { ...base.story, ...(state.story || {}) };
  out.story.seen = numberMap(out.story.seen);
  out.story.tutorial = numberMap(out.story.tutorial);
  out.story.skip = !!out.story.skip;
  out.story.onboarded = !!out.story.onboarded;

  out.store = { ...base.store, ...(state.store || {}) };
  out.store.packs = numberMap(out.store.packs);
  if (typeof out.store.leafDay !== 'string') out.store.leafDay = null;

  out.cache = { ...base.cache, ...(state.cache || {}) };
  for (const key of ['zen', 'ms', 'lostMs', 'since']) {
    out.cache[key] = safeNumber(out.cache[key]);
  }

  out.bracket = { ...base.bracket, ...(state.bracket || {}) };
  out.bracket.weekKey = typeof out.bracket.weekKey === 'string' ? out.bracket.weekKey : null;
  out.bracket.placement = Math.floor(safeNumber(out.bracket.placement));
  out.bracket.best = Math.floor(safeNumber(out.bracket.best));
  out.bracket.claimed = !!out.bracket.claimed;
  out.bracket.results = Array.isArray(out.bracket.results)
    ? out.bracket.results.filter(isPlainObject).slice(0, 8)
    : [];

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
  out.pass.premium = !!out.pass.premium;
  out.pass.bestLevel = Math.floor(safeNumber(out.pass.bestLevel));
  out.pass.season = Number.isInteger(out.pass.season) && out.pass.season >= 0 ? out.pass.season : null;
  out.pass.history = Array.isArray(out.pass.history)
    ? out.pass.history
        .filter(isPlainObject)
        .slice(0, 8)
        .map((h) => ({
          index: Math.floor(safeNumber(h.index)),
          level: Math.floor(safeNumber(h.level)),
          premium: !!h.premium,
          claimed: Math.floor(safeNumber(h.claimed)),
        }))
    : [];

  // The pass grew a second track. A one-track save has `claimed` as a flat
  // level->true map; those claims were all on the free track, so that is where
  // they go. Doing it here rather than in a migration step means a hand-edited
  // save with the old shape is repaired too.
  const claimed = isPlainObject(out.pass.claimed) ? out.pass.claimed : {};
  const flat = !isPlainObject(claimed.free) && !isPlainObject(claimed.premium);
  out.pass.claimed = {
    free: flat ? { ...claimed } : { ...(claimed.free || {}) },
    premium: flat ? {} : { ...(claimed.premium || {}) },
  };

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

  for (const key of ['depth', 'bestDepth', 'xp', 'shards', 'clears', 'bossKills', 'bossTimeouts']) {
    out.combat[key] = safeNumber(out.combat[key]);
  }
  out.combat.holding = !!out.combat.holding;
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
