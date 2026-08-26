// Leaf packs — the simulated purchase shelf.
//
// These lived in systems/store.js until the content registry existed. They are
// a table, not behaviour, so they belong in data/ alongside every other table —
// and having them here is what lets registry.js read them without importing the
// system that also reads the registry.
//
// NOTHING HERE TAKES REAL MONEY. The prices are the genre's own psychology,
// quoted rather than charged; systems/store.js holds the whole of what that
// means and refuses to pretend otherwise.

/**
 * The middle pack is always the one with the best rate per leaf and the badge
 * that says so, because that is the shape the genre uses and this is a study
 * of it.
 */
export const LEAF_PACKS = [
  { id: 'handful', name: 'A Handful', leafs: 100, price: '£0.99' },
  { id: 'basket', name: 'A Basket', leafs: 550, price: '£4.99', bonus: '+10%' },
  { id: 'armful', name: 'An Armful', leafs: 1200, price: '£8.99', bonus: '+33%', best: true },
  { id: 'cartload', name: 'A Cartload', leafs: 2600, price: '£17.99', bonus: '+44%' },
  { id: 'pondful', name: 'The Whole Pond', leafs: 7000, price: '£44.99', bonus: '+55%' },
];

export const LEAF_PACKS_BY_ID = Object.fromEntries(LEAF_PACKS.map((p) => [p.id, p]));
