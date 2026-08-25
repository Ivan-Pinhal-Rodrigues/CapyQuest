// Timed boosts, bought with leafs.
//
// Each one speaks the effect vocabulary in systems/stats.js and rides the same
// `state.buffs` list as a Golden Capybara frenzy, so nothing new has to know
// about them. Buying one while it is already running extends it rather than
// wasting it — a boost you have to remember to spend at exactly the right
// moment is a chore, not a treat.

export const BOOSTS = [
  {
    id: 'coinRush',
    name: 'Coin Rush',
    cost: 60,
    hours: 1,
    icon: '💰',
    effects: [{ type: 'globalMult', value: 2 }],
    blurb: 'Double all income for an hour.',
  },
  {
    id: 'tapFrenzy',
    name: 'Tap Frenzy',
    cost: 45,
    hours: 0.5,
    icon: '👋',
    effects: [{ type: 'clickMult', value: 3 }],
    blurb: 'Triple tap power for half an hour.',
  },
  {
    id: 'foragersLuck',
    name: "Forager's Luck",
    cost: 80,
    hours: 1,
    icon: '🍀',
    effects: [{ type: 'combatLuck', value: 400 }],
    blurb: '+400 LUCK for an hour. Better drops, better rungs, more stars.',
  },
  {
    id: 'goldenHour',
    name: 'Golden Hour',
    cost: 70,
    hours: 1,
    icon: '✨',
    effects: [{ type: 'goldenChance', value: 2 }, { type: 'goldenDuration', value: 0.5 }],
    blurb: 'Golden capybaras three times as often, and they linger.',
  },
  {
    id: 'deepSleep',
    name: 'Deep Sleep',
    cost: 120,
    hours: 24,
    icon: '😴',
    effects: [{ type: 'offlineCapHours', value: 24 }, { type: 'offlineRate', value: 0.2 }],
    blurb: 'A full day of a much deeper nap. Buy it before you close the tab.',
  },
];

export const BOOSTS_BY_ID = Object.fromEntries(BOOSTS.map((b) => [b.id, b]));
