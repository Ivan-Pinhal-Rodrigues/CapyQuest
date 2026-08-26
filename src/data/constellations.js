// The 12 ascension constellations, bought with Lotus.
//
// This file used to also hold 22 prestige relics. Those were folded into the
// rebirth tree's Legacy branch (see data/rebirthTree.js) — same ids, same
// effects, one screen instead of two.

export const CONSTELLATIONS = [
  { id: 'theBather', name: 'The Bather', cost: 1, max: 3,
    effect: { type: 'globalMult', value: 2 }, blurb: 'Double all income per rank.' },
  { id: 'theFloater', name: 'The Floater', cost: 2, max: 3,
    effect: { type: 'zpsMult', value: 2.5 }, blurb: '×2.5 idle income per rank.' },
  { id: 'theTapper', name: 'The Tapper', cost: 2, max: 3,
    effect: { type: 'clickMult', value: 2.5 }, blurb: '×2.5 tap power per rank.' },
  { id: 'theHoarder', name: 'The Hoarder', cost: 3, max: 3,
    effect: { type: 'essenceGain', value: 1 }, blurb: 'Double essence from rebirthing per rank.' },
  { id: 'theDreamer', name: 'The Dreamer', cost: 4, max: 2,
    effect: { type: 'offlineCapHours', value: 24 }, blurb: '+24h offline cap per rank.' },
  { id: 'theWatcher', name: 'The Watcher', cost: 5, max: 3,
    effect: { type: 'goldenChance', value: 0.5 }, blurb: '+50% golden rate per rank.' },
  { id: 'theHunter', name: 'The Hunter', cost: 6, max: 3,
    effect: { type: 'combatAtk', value: 1 }, blurb: 'Double ATK per rank.' },
  { id: 'theWall', name: 'The Wall', cost: 6, max: 3,
    effect: { type: 'combatDef', value: 1 }, blurb: 'Double DEF per rank.' },
  { id: 'theGenerous', name: 'The Generous', cost: 8, max: 3,
    effect: { type: 'ticketRate', value: 3 }, blurb: '+3 summon tickets per boss, per rank.' },
  { id: 'theFrugal', name: 'The Frugal', cost: 10, max: 3,
    effect: { type: 'costDiscount', value: 0.1 }, blurb: '−10% generator prices per rank.' },
  { id: 'theEndless', name: 'The Endless', cost: 15, max: 5,
    effect: { type: 'globalMult', value: 5 }, blurb: '×5 all income per rank.' },
  { id: 'theStillPoint', name: 'The Still Point', cost: 40, max: 1,
    effect: { type: 'globalMult', value: 50 }, blurb: '×50 all income. The end of wanting.' },
];

export const CONSTELLATIONS_BY_ID = Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c]));

/** Cost of the Nth rank of a constellation. */
export function rankCost(def, ownedRanks) {
  return Math.ceil(def.cost * Math.pow(1.6, ownedRanks));
}

// ------------------------------------------------------------------- figures
//
// The twelve are grouped into four figures of three. Owning a rank in every
// star of a figure lights it, and a lit figure pays a bonus of its own.
//
// Each figure deliberately spans the price range — one cheap star, one middling
// and one dear. The first draft grouped them by cost instead, which produced
// four neat bands and no decision at all: you would light them in order simply
// by buying what you could afford, which is the queue this was meant to
// replace. A test now asserts no figure is the three cheapest stars.
//
// This is what turns twelve independent purchases into a board. On their own
// the stars are twelve prices in ascending order, and the only decision is
// which one you can afford next — which is not a decision, it is a queue. The
// figures cut across cost, so completing the cheap one early and the dear one
// late are both real plans, and a player short of Lotus has to choose between
// finishing a figure and taking the strongest single star they can reach.
//
// Every figure bonus is an ordinary effect in the shared vocabulary, for the
// same reason keystone drawbacks are: a bespoke rule is a thing that can
// silently stop being read.

export const FIGURES = [
  {
    id: 'theBath',
    name: 'The Bath',
    stars: ['theBather', 'theDreamer', 'theEndless'],
    line: 'Warmth, and the patience to sit in it.',
    effect: { type: 'globalMult', value: 3 },
    blurb: '×3 all income while lit.',
  },
  {
    id: 'theLongNight',
    name: 'The Long Night',
    stars: ['theFloater', 'theWatcher', 'theFrugal'],
    line: 'What the pond does while nobody is looking.',
    effect: { type: 'offlineRate', value: 0.35 },
    blurb: '+35% offline rate while lit.',
  },
  {
    id: 'theHunt',
    name: 'The Hunt',
    stars: ['theTapper', 'theHunter', 'theGenerous'],
    line: 'Downstream, and whatever is waiting there.',
    effect: { type: 'combatAtk', value: 1.5 },
    blurb: '+150% attack while lit.',
  },
  {
    id: 'theQuiet',
    name: 'The Quiet',
    stars: ['theHoarder', 'theWall', 'theStillPoint'],
    line: 'The figure you finish last, if you finish it at all.',
    effect: { type: 'essenceGain', value: 1.5 },
    blurb: '+150% essence from rebirthing while lit.',
  },
];

export const FIGURES_BY_ID = Object.fromEntries(FIGURES.map((f) => [f.id, f]));

/** The figure a star belongs to. */
export function figureOf(starId) {
  return FIGURES.find((f) => f.stars.includes(starId)) || null;
}

/** A figure is lit once every star in it has at least one rank. */
export function isFigureLit(state, figure) {
  return figure.stars.every((id) => (state.constellations?.[id] || 0) > 0);
}

/** Every lit figure, for the panel and for the effect accumulator. */
export function litFigures(state) {
  return FIGURES.filter((f) => isFigureLit(state, f));
}
