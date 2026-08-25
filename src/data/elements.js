// The elemental triangle (plus two off-cycle elements that counter each other).
//
// Deliberately small: five elements a player can hold in their head beats
// twelve they have to look up. Strong deals 1.5×, weak deals 0.75×.

export const ELEMENTS = {
  water: { name: 'Water', color: '#63b8d1', icon: '💧', strong: 'ember', weak: 'leaf' },
  leaf: { name: 'Leaf', color: '#7cc255', icon: '🌿', strong: 'water', weak: 'ember' },
  ember: { name: 'Ember', color: '#e8734a', icon: '🔥', strong: 'leaf', weak: 'water' },
  // Moon and Sun sit off the triangle and are strong against each other —
  // that matchup is a damage race both ways, which is the point of it.
  moon: { name: 'Moon', color: '#8f6bc2', icon: '🌙', strong: 'sun', weak: null },
  sun: { name: 'Sun', color: '#f0a63d', icon: '☀️', strong: 'moon', weak: null },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

/** Chart shaped for balance.elementModifier. */
export const ELEMENT_CHART = ELEMENTS;
