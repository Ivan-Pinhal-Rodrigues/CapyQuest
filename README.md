# CapyQuest

A pixel-art idle clicker RPG about a very relaxed capybara, an endless hot spring, and far too
many upgrades.

Play it at **[ivan-pinhal-rodrigues.github.io/CapyQuest](https://ivan-pinhal-rodrigues.github.io/CapyQuest/)**.

> **v2 in progress.** This repo is the expanded game — infinite stages, rebirth, a 210-node skill
> tree, a 20-tier rarity ladder, seasons and events. The original finite version lives at
> [ivan-pinhal-rodrigues.github.io](https://ivan-pinhal-rodrigues.github.io/).
>
> Everything in the shop is **simulated**. Leafs are a fake currency, the price tags are
> decorative, and nothing anywhere takes real money.

## What it is

Tap the capybara to earn zen. Spend zen on generators that earn zen while you are not tapping.
Spend more zen on upgrades that multiply both. Then keep going, because there is a whole RPG
underneath: stats, gear, auto-battle, gacha companions, a talent tree, and two layers of prestige.

At 5,000 zen the Quest line opens: twelve zones, 120 stages, a boss every tenth, and 42 pieces of
gear to find and enhance. Combat runs itself — what you choose is the kit, the three skills, and
the elemental stance.

Bosses drop summon tickets. Twenty-four capybaras can be summoned, three of them fight alongside
you, and the pity counter is on screen the whole time. At a trillion zen the Yuzu Bath opens and
the whole thing starts again, larger — 22 relics, a 27-node talent tree, and a second reset layer
beyond that.

## Running it

There is no build step and there are no dependencies. Serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Because it is plain static files, pushing to the Pages branch is the whole deploy.

## Tests

```sh
npm test    # node --test "tests/*.test.js"
```

Node's built-in runner, no test framework installed. The suite covers the balance formulas, the
save/migration path, purchase logic, and the integrity of the content tables — including a check
that every hand-drawn sprite grid is rectangular and that every character it uses has a colour in
the palette it gets drawn with.

## How it is put together

```
index.html          the game; the site root
styles/             tokens, layout, components, motion
src/
  balance.js        every formula, pure and unit-tested
  state.js          save schema and defaults
  save.js           localStorage, migrations, export/import codes
  data/             the content tables — generators, upgrades, achievements
  systems/          game logic: clicking, income, shop, goldens, audio
  render/           sprites, palettes, canvas rasteriser, particles, scene
  ui/               HUD, shop panels, modals, toasts, tabs
tests/
```

### The art is text

There are no image files in this repository. Sprites are character grids with a palette map:

```js
export const YUZU = sprite([
  '....g...',
  '..ooog..',
  '.oyyyyo.',
  'oyywyyyo',
  /* ... */
]);
```

They rasterise to an offscreen canvas once and blit with smoothing off. Ten hand-drawn 16×16
shapes cover all eighteen generators by swapping the palette underneath them. Sound effects are
synthesised with WebAudio oscillators, so there are no audio files either.

### Design notes

- **Fixed-step simulation.** Income ticks on a fixed 100ms step so a dropped frame never loses or
  duplicates zen; rendering runs free. UI text updates at ~15Hz because nobody can read a number
  changing sixty times a second.
- **Shop panels mutate in place.** Rebuilding hundreds of nodes several times a second would drop
  frames and cancel the click you were halfway through making.
- **Achievements pay.** Every one grants a permanent bonus, so the list is worth grinding rather
  than worth ignoring.
- **Saves are defensive.** Forward-only migrations, unknown fields tolerated, a single NaN scrubbed
  rather than allowed to poison every formula downstream, and an unreadable save is backed up
  rather than discarded.
- **A reset never costs a collection.** Prestige and ascension are rebuilt from `createState()` and
  then explicitly carry a whitelist across, so a field added later resets by default instead of
  leaking through. Companions, gear and trophies are always on the keep list — losing an hour of
  income is a decision the player made; losing a 5★ they pulled is a betrayal.
- **The gacha shows its numbers.** Both pity counters, the live 5★ rate, and the fact that the rate
  climbs from pull 65 are on screen at all times.

## What's in it

| | |
|---|---|
| Purchasable upgrades | **131** — 16 tap, 18 generators, 36 generator tiers, 27 talents, 22 relics, 12 constellations |
| Gear | 42 pieces across 6 slots, each enhanceable +0 → +15 |
| Companions | 24, summoned, three in the party |
| Combat skills | 18, three slotted |
| Achievements | 66, every one paying a permanent bonus |
| Zones / stages | 12 / 120, with 25 enemies and bosses |
| Currencies | Zen, Yuzu, Lotus, tickets, shards |

**281 collectible or purchasable entries in total**, plus the systems around them: combo chains,
crits, Golden Capybaras, offline income, auto-battle, elemental stances, a forge, gacha pity,
two prestige layers, quests, a login streak, a battle pass, timed chests and secret codes.

## Status

Built in stages. Landed so far:

- [x] **Core** — game loop, saves, pixel renderer, tap juice (crit, combo, particles, squash),
      18 generators, 52 upgrades, offline Nap Report, Golden Capybara, settings
- [x] **RPG** — stats and levels, auto-battle, 12 zones / 120 stages, 25 enemies and bosses,
      42 gear pieces across 6 slots, the forge (+0→+15), 18 skills, elemental stances,
      66 achievements
- [x] **Meta** — gacha with a visible pity counter, 24 companions, a party of three, 22 prestige
      relics, 12 ascension constellations, a 27-node talent tree with free respec, and two
      reset layers
- [x] **Retention** — daily and weekly quests, a seven-day login streak, a 40-level free Zen Pass,
      a chest that fills every 15 minutes, eight secret codes, and a stats page that grows as you do
