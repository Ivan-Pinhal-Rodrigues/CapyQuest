// Secret codes. Typed into Settings; each redeems once per save.
//
// These are a wink, not a currency — the payouts scale off what the player
// already earns, so a code found on day one is not a shortcut past the game.

export const CODES = {
  capybara: { tickets: 3, shards: 200, text: 'The password was always just its name.' },
  yuzu: { zenMult: 900, text: 'Citrus, obtained.' },
  onsen: { zenMult: 1800, shards: 300, text: 'The water is exactly right.' },
  chonk: { tickets: 2, shards: 400, text: 'Respect for the mass.' },
  stillpoint: { tickets: 5, shards: 1200, text: 'You found the quiet bit.' },
  bikkuri: { zenMult: 3600, tickets: 1, text: 'びっくり!' },
  nap: { zenMult: 600, text: 'Well earned.' },
  worldslargestrodent: { tickets: 4, shards: 800, text: 'Technically accurate.' },
};

/** Codes are matched case- and space-insensitively. */
export function normaliseCode(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function lookupCode(input) {
  const key = normaliseCode(input);
  return CODES[key] ? { key, ...CODES[key] } : null;
}
