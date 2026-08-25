// Daily and weekly quests.
//
// Every quest is a thing you were going to do anyway, with a number attached.
// Nothing here asks the player to log in at a particular hour or to break their
// own routine — the goal is to give the session a shape, not to run their day.
//
// track  which counter it reads (see systems/quests.js COUNTERS)
// goal   how much of it
// reward what completing it pays

export const DAILY_POOL = [
  { id: 'd_tap', track: 'clicks', goal: 250, reward: { pass: 10, tickets: 0 }, text: 'Tap the capybara 250 times' },
  { id: 'd_tapBig', track: 'clicks', goal: 1000, reward: { pass: 20 }, text: 'Tap the capybara 1,000 times' },
  { id: 'd_crit', track: 'crits', goal: 40, reward: { pass: 15 }, text: 'Land 40 critical taps' },
  { id: 'd_combo', track: 'bestCombo', goal: 20, reward: { pass: 10 }, text: 'Reach a 20× combo' },
  { id: 'd_buy', track: 'buildingsBought', goal: 15, reward: { pass: 10 }, text: 'Buy 15 generators' },
  { id: 'd_upgrade', track: 'upgradesBought', goal: 2, reward: { pass: 15 }, text: 'Buy 2 upgrades' },
  { id: 'd_golden', track: 'goldens', goal: 1, reward: { pass: 20 }, text: 'Catch a Golden Capybara' },
  { id: 'd_stages', track: 'clears', goal: 20, reward: { pass: 15 }, text: 'Clear 20 stages' },
  { id: 'd_boss', track: 'bossKills', goal: 1, reward: { pass: 25, tickets: 1 }, text: 'Beat a boss' },
  { id: 'd_forge', track: 'forges', goal: 3, reward: { pass: 15 }, text: 'Enhance gear 3 times' },
  { id: 'd_loot', track: 'drops', goal: 5, reward: { pass: 15 }, text: 'Find 5 pieces of gear' },
  { id: 'd_summon', track: 'pulls', goal: 1, reward: { pass: 20 }, text: 'Summon a capybara' },
];

export const WEEKLY_POOL = [
  { id: 'w_tap', track: 'clicks', goal: 5000, reward: { pass: 60, tickets: 1 }, text: 'Tap the capybara 5,000 times' },
  { id: 'w_stages', track: 'clears', goal: 200, reward: { pass: 70, tickets: 1 }, text: 'Clear 200 stages' },
  { id: 'w_boss', track: 'bossKills', goal: 8, reward: { pass: 90, tickets: 2 }, text: 'Beat 8 bosses' },
  { id: 'w_golden', track: 'goldens', goal: 8, reward: { pass: 70 }, text: 'Catch 8 Golden Capybaras' },
  { id: 'w_forge', track: 'forges', goal: 25, reward: { pass: 60 }, text: 'Enhance gear 25 times' },
  { id: 'w_summon', track: 'pulls', goal: 10, reward: { pass: 80, tickets: 1 }, text: 'Summon 10 times' },
  { id: 'w_upgrade', track: 'upgradesBought', goal: 12, reward: { pass: 60 }, text: 'Buy 12 upgrades' },
];

export const DAILY_COUNT = 4;
export const WEEKLY_COUNT = 3;

// ------------------------------------------------------------- login streak

/**
 * A seven-day cycle that repeats. Missing a day costs the streak but never the
 * rewards already taken — the calendar restarts, it does not punish.
 */
export const LOGIN_REWARDS = [
  { day: 1, text: 'A warm welcome', zenMult: 60, tickets: 0 },
  { day: 2, text: 'Shards for the forge', zenMult: 90, shards: 40 },
  { day: 3, text: 'A summon ticket', zenMult: 120, tickets: 1 },
  { day: 4, text: 'A bigger handful', zenMult: 200, shards: 90 },
  { day: 5, text: 'Two tickets', zenMult: 260, tickets: 2 },
  { day: 6, text: 'A very good day', zenMult: 380, shards: 200 },
  { day: 7, text: 'The full week', zenMult: 600, tickets: 3, shards: 300 },
];

// ------------------------------------------------------------------ chests

/** Fills over 15 minutes; collecting resets the timer. */
export const CHEST_FILL_MS = 15 * 60 * 1000;
export const CHEST_MAX_STORED = 4; // stop accruing past four, so it is worth checking in

// ---------------------------------------------------------------- zen pass

export const PASS_LEVELS = 40;
export const PASS_XP_PER_LEVEL = 100;

/**
 * The Zen Pass is a free track only. There is no paid tier and nothing to buy —
 * it is a progress bar over the season, not a storefront.
 */
export function passReward(level) {
  if (level % 10 === 0) return { tickets: 3, shards: 500, text: '3 tickets · 500 shards' };
  if (level % 5 === 0) return { tickets: 1, shards: 200, text: '1 ticket · 200 shards' };
  if (level % 2 === 0) return { shards: 120, text: '120 shards' };
  return { zenMult: 300, text: 'A pile of zen' };
}
