// The Golden Capybara: a rare, timed, clickable bonus.
//
// This is the single strongest retention hook in a clicker — an unpredictable
// reward that only pays if you happen to be watching. Spawn timing is
// deliberately random inside a window rather than on a fixed cadence.

const MIN_GAP_MS = 75e3;
const MAX_GAP_MS = 205e3;
const VISIBLE_MS = 12e3;

export const GOLDEN_BUFFS = [
  {
    id: 'frenzy',
    name: 'Frenzy',
    weight: 46,
    durationMs: 15e3,
    blurb: '×7 to everything. Tap like you mean it.',
    effects: [{ type: 'buffMult', value: 7 }],
  },
  {
    id: 'luckyPaw',
    name: 'Lucky Paw',
    weight: 26,
    durationMs: 22e3,
    blurb: 'Crits everywhere for a while.',
    effects: [
      { type: 'critChance', value: 0.4 },
      { type: 'critDamage', value: 1.5 },
    ],
  },
  {
    id: 'steamRush',
    name: 'Steam Rush',
    weight: 20,
    durationMs: 25e3,
    blurb: '×4 idle income while the water is hot.',
    effects: [{ type: 'zpsMult', value: 4 }],
  },
  {
    id: 'windfall',
    name: 'Windfall',
    weight: 8,
    durationMs: 0, // instant payout instead of a timed buff
    blurb: 'A sudden pile of zen.',
    instant: true,
  },
];

export class GoldenSpawner {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.nextAt = 0;
    this.active = false;
    this.scheduled = false;
  }

  /** Schedule the first spawn a little way in, so it is not the first thing seen. */
  start(now, chanceMult = 1) {
    this.schedule(now + 20e3, chanceMult);
  }

  schedule(from, chanceMult = 1) {
    const span = MAX_GAP_MS - MIN_GAP_MS;
    // A higher chance multiplier shortens the window rather than adding rolls,
    // which keeps the "how often" intuition simple for the player.
    const gap = (MIN_GAP_MS + this.rng() * span) / Math.max(0.2, chanceMult);
    this.nextAt = from + gap;
    this.scheduled = true;
    this.active = false;
  }

  /** Returns true on the frame a golden should appear. */
  shouldSpawn(now) {
    return this.scheduled && !this.active && now >= this.nextAt;
  }

  markSpawned() {
    this.active = true;
    this.scheduled = false;
  }

  visibleMs(durationMult = 1) {
    return VISIBLE_MS * durationMult;
  }

  /** Pick which buff this golden grants. */
  rollBuff() {
    const total = GOLDEN_BUFFS.reduce((s, b) => s + b.weight, 0);
    let roll = this.rng() * total;
    for (const buff of GOLDEN_BUFFS) {
      roll -= buff.weight;
      if (roll < 0) return buff;
    }
    return GOLDEN_BUFFS[0];
  }
}

/**
 * Windfall payout: a chunk of income scaled to what the player currently makes,
 * so it stays meaningful at every stage instead of being huge early and
 * irrelevant later.
 */
export function windfallAmount(zps, clickValue) {
  return Math.max(clickValue * 40, zps * 240);
}
