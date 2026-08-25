// What makes a boss a fight rather than a bigger number.
//
// Every stage-9 boss carries one pattern, picked deterministically from its
// stage so the same boss always fights the same way and a player can learn it.
// Each pattern is one idea, readable in one fight:
//
//   shield   immune until you hit it with the element it fears
//   adds     a minion turns up and soaks your damage until it dies
//   enrage   it speeds up the longer you take
//
// The patterns are deliberately answerable by things the player already has —
// the stance selector, the skill buttons, the brace. Nothing here needs a new
// verb learned specially for bosses.
//
// Auto-battle must survive all three. A pattern may cost an inattentive player
// time; none of them may make a fight unwinnable without manual input, because
// idling is a supported way to play. `answerable` documents which existing
// control resolves it, and tests/combat.test.js asserts an auto-battler still
// wins every pattern given enough stats.

/** How long a shield stays up before it lapses on its own, in seconds. */
export const SHIELD_SECONDS = 8;

/** How much damage a shielded boss takes from the wrong element. */
export const SHIELD_LEAK = 0.15;

/** Multiplier applied to the add's HP, relative to the boss it escorts. */
export const ADD_HP_SHARE = 0.18;

/** Attack-speed ramp per second once a boss is enraged. */
export const ENRAGE_RAMP = 0.035;

/** Seconds of a boss fight before enrage starts. */
export const ENRAGE_AFTER = 20;

export const BOSS_PATTERNS = [
  {
    id: 'shield',
    name: 'Warded',
    tell: 'A ward comes up. It fears one element.',
    answerable: 'stance',
    blurb: 'Switch your stance to the element it fears, or wait the ward out.',
  },
  {
    id: 'adds',
    name: 'Escorted',
    tell: 'Something smaller steps in front.',
    answerable: 'damage',
    blurb: 'The escort soaks your hits until it falls. Burst it down.',
  },
  {
    id: 'enrage',
    name: 'Impatient',
    tell: 'It is getting faster.',
    answerable: 'speed',
    blurb: 'It speeds up the longer the fight runs. Finish it early.',
  },
];

export const PATTERNS_BY_ID = Object.fromEntries(BOSS_PATTERNS.map((p) => [p.id, p]));

/**
 * Which pattern this stage's boss uses. Deterministic, so a boss you failed is
 * the same boss when you come back and the thing you learned still applies.
 *
 * Stage 0's boss has no pattern at all: the first boss should teach that bosses
 * are big, not that they have rules.
 */
export function patternForStage(stage) {
  if (stage <= 0) return null;
  return BOSS_PATTERNS[(stage - 1) % BOSS_PATTERNS.length];
}

/**
 * The element a warded boss fears. Derived from the boss's own element through
 * the same strong/weak chart the stances use, so the answer is the one the
 * player already knows: hit it with what beats it.
 */
export function wardElement(bossElement, chart) {
  for (const [id, def] of Object.entries(chart)) {
    if (def.strong === bossElement) return id;
  }
  // Every element in the chart is countered by exactly one other, Moon and Sun
  // included — they counter each other. The fallback is for a chart that has
  // been edited into a gap, and a ward with no answer still lapses on its timer
  // rather than deadlocking the fight.
  return null;
}
