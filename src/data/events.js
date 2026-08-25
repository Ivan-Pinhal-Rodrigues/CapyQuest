// Events: windows inside a season, and the currency that expires with them.
//
// Ten are designed (docs/EVENTS.md has all of them in full); three are live.
// The seven that are not carry `live: false` and are listed in the panel as
// what is coming rather than quietly omitted — a roadmap you can read beats a
// roadmap you have to infer.
//
// The currency is **Petals**. It is earned only while an event is running and it
// is gone when the event closes. That is the whole point of it: a currency you
// can bank forever is just a slower coin, and the thing that makes an event feel
// like an event is that the window closes.

/** Three windows per season, on fixed days, so players can plan around them. */
export const WINDOWS = [
  { startDay: 1, endDay: 10 },
  { startDay: 16, endDay: 25 },
  { startDay: 31, endDay: 40 },
];

/**
 * Petals earned per clear while an event runs. Bosses pay properly, because the
 * alternative is an event that rewards tapping through the shallowest level you
 * can reach rather than playing the game.
 */
export const PETALS_PER_CLEAR = 2;
export const PETALS_PER_BOSS = 25;

export const EVENTS = [
  {
    id: 'yuzuHarvest',
    name: 'Yuzu Harvest',
    live: true,
    color: '#f7c948',
    icon: '🍋',
    blurb: 'The trees came in all at once. Everything downstream is dropping petals.',
    hook: 'Collect petals from everything you beat, then spend them at the exchange before the trees are bare.',
    exchange: [
      { id: 'leafs', petals: 120, reward: { leafs: 90 }, text: '90 leafs' },
      { id: 'shards', petals: 60, reward: { shards: 2400 }, text: '2,400 shards' },
      { id: 'tickets', petals: 200, reward: { tickets: 6 }, text: '6 summon tickets' },
      { id: 'skin', petals: 900, reward: { cosmetic: 'skin:harvest' }, text: 'Skin: Harvest', once: true },
    ],
  },
  {
    id: 'moonlitBathhouse',
    name: 'Moonlit Bathhouse',
    live: true,
    color: '#a9c6f5',
    icon: '🌙',
    blurb: 'The bathhouse opens at night for a fortnight and something in the water glows.',
    hook: 'Every terrain runs its night shift. Petals here buy the lunar exchange.',
    exchange: [
      { id: 'leafs', petals: 120, reward: { leafs: 90 }, text: '90 leafs' },
      { id: 'shards', petals: 60, reward: { shards: 2400 }, text: '2,400 shards' },
      { id: 'tickets', petals: 200, reward: { tickets: 6 }, text: '6 summon tickets' },
      { id: 'pond', petals: 900, reward: { cosmetic: 'pond:bathhouse' }, text: 'Pond: Bathhouse', once: true },
    ],
  },
  {
    id: 'reedRush',
    name: 'Reed Rush',
    live: true,
    color: '#7cc255',
    icon: '🏃',
    blurb: 'Somebody started counting. Now everyone is running.',
    hook: 'Clears pay double petals. Depth pays more than patience for ten days.',
    exchange: [
      { id: 'leafs', petals: 120, reward: { leafs: 90 }, text: '90 leafs' },
      { id: 'shards', petals: 60, reward: { shards: 2400 }, text: '2,400 shards' },
      { id: 'tickets', petals: 200, reward: { tickets: 6 }, text: '6 summon tickets' },
      { id: 'title', petals: 900, reward: { cosmetic: 'title:swift' }, text: 'Title: Swift', once: true },
    ],
    clearBonus: 2, // the "rush" — clears pay double
  },

  // ------------------------------------------------ designed, not yet built
  { id: 'greatNap', name: 'The Great Nap', live: false, color: '#c79ae8', icon: '😴',
    blurb: 'Offline income doubled for a week, and sleep cosmetics to match.', exchange: [] },
  { id: 'steamFestival', name: 'Steam Festival', live: false, color: '#e0653f', icon: '🔥',
    blurb: 'Ember enemies everywhere, and fire skins to take off them.', exchange: [] },
  { id: 'crystalTide', name: 'Crystal Tide', live: false, color: '#7fd0e6', icon: '💠',
    blurb: 'A flood of shards. The forge runs hot and refines get cheaper.', exchange: [] },
  { id: 'capybaraCup', name: 'Capybara Cup', live: false, color: '#f0a63d', icon: '🏆',
    blurb: 'A bracket against the rivals on the board, run over three days.', exchange: [] },
  { id: 'longWinter', name: 'The Long Winter', live: false, color: '#c9e2ed', icon: '❄️',
    blurb: 'A survival ladder with no healing between floors.', exchange: [] },
  { id: 'foundersWeek', name: "Founders' Week", live: false, color: '#e8556d', icon: '🎂',
    blurb: 'The anniversary. Retro cosmetics and the original pond.', exchange: [] },
  { id: 'stillPointRift', name: 'The Still Point Rift', live: false, color: '#4de0c0', icon: '🌀',
    blurb: 'The endgame event, and the one that finally opens Ascension properly.', exchange: [] },
];

export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export const LIVE_EVENTS = EVENTS.filter((e) => e.live);
