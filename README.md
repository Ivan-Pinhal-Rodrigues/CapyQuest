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
underneath: stats, gear, auto-battle, gacha companions, a 210-node skill tree, and two reset
layers.

At 5,000 zen the Quest line opens: unlimited stages of ten levels each, a boss on every tenth, 18
cycling terrains and 42 pieces of gear to find and enhance. Combat runs itself — what you choose is
the kit, the three skills, and the elemental stance.

Bosses drop summon tickets. Twenty-four capybaras can be summoned, three of them fight alongside
you, and the pity counter is on screen the whole time.

Eventually a boss will not fall inside thirty seconds, and the game says so out loud. That is
Rebirth: start the run again, paid in Essence for how deep you got, and spend it on a tree of 210
nodes that no reset can take back. Beyond that is the Still Point, which works and is openly
still being built.

## Running it

There is no build step and there are no dependencies. Serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Because it is plain static files, pushing to the Pages branch is the whole deploy.

## Tests

```sh
npm test    # node --experimental-vm-modules --test "tests/*.test.js"
```

Node's built-in runner, no test framework installed. The suite covers the balance formulas, the
save/migration path, purchase logic, and the integrity of the content tables — including a check
that every hand-drawn sprite grid is rectangular and that every character it uses has a colour in
the palette it gets drawn with. One suite parses every module in `src/` — `main.js` included, which
nothing else imports because it needs a DOM — so a syntax error in the file that boots the game
cannot hide behind a green suite again. Another checks the documentation against the code it
describes — four rows of the beat table in `docs/STORY.md` were wrong on the first draft, written
from memory and entirely plausible-looking, so the tables that can be verified mechanically are.

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
docs/             EVENTS.md, STORY.md, BALANCE.md
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
  income is a decision the player made; losing a 5★ they pulled is a betrayal. The story you have
  read and the name you chose are on that list too — sitting through the opening again is not a
  cost anyone agreed to.
- **The gacha shows its numbers.** Both pity counters, the live 5★ rate, and the fact that the rate
  climbs from pull 65 are on screen at all times.

## What's in it

| | |
|---|---|
| Purchasable upgrades | **306** — 16 tap, 18 generators, 36 generator tiers, 210 tree nodes, 14 keystones, 12 constellations |
| Gear | 42 pieces across 6 slots, on a 20-rung rarity ladder, 1–5 stars, enhanceable +0 → +15 |
| Companions | 24, summoned, three in the party |
| Combat skills | 18, three slotted, cast by hand or automatically |
| Achievements | 232 across 13 groups, every one paying a permanent bonus |
| Terrains / stages | 18 cycling, unlimited stages, with 71 enemies and bosses |
| Currencies | Zen, Essence, Leafs, Lotus, tickets, shards |
| Store | 3 cases with their odds on the card, 5 boosts, 24 cosmetics — all simulated |
| Season | 45 days, a 100-level two-track pass, 60 simulated rivals, 3 live events of 10 designed |
| Story | 3 acts, 20 beats, 5 NPCs, a 6-frame opening and 6 coach-marked tutorial steps |
| Offline | A cache with a stated capacity, a fill rate, and a spill marker when it overflows |

**631 collectible or purchasable entries in total**, plus the systems around them: combo chains,
crits, Golden Capybaras, offline income, auto-battle, elemental stances, a forge, gacha pity,
two reset layers, quests, a login streak, a battle pass, timed chests and secret codes.

Nothing in the store takes real money. The leaf packs carry price tags because that is the shape
of the genre and this is a study of it; `PAYMENTS` is off, there is no processor, no card is ever
asked for, and every purchase surface says so where you cannot miss it.

## Status

Built in stages. Landed so far:

- [x] **Core** — game loop, saves, pixel renderer, tap juice (crit, combo, particles, squash),
      18 generators, 52 upgrades, offline Nap Report, Golden Capybara, settings
- [x] **RPG** — stats and levels, auto-battle, gear across 6 slots, the forge (+0→+15),
      18 skills, elemental stances, 71 achievements
- [x] **Infinite stages** — 10 levels per stage with the difficulty in the boundary, 18 cycling
      terrains, 71 enemies including 18 hostile capybaras, and a wall detector that tells you
      when the run is over instead of leaving you to grind into a ceiling
- [x] **Meta** — gacha with a visible pity counter, 24 companions, a party of three, and 12
      ascension constellations
- [x] **The ladder** — rarity moved off the definition and onto the piece: 20 rungs, 1–5 stars,
      and three ways up. Enhance is the grind, refine is a stated roll with a pity counter, and
      fuse eats three matching pieces to promote one rung. Any piece can be carried to the top.
- [x] **Rebirth** — a reset that unlocks when the maths says you are stuck rather than at a round
      currency number, paying Essence for depth reached, spent on a 210-node tree across seven
      branches with a free respec. Every rank survives every rebirth. The 49 permanent upgrades
      from the previous version live on inside it, ids and ranks intact.
- [x] **The store** — three cases with their full drop tables and pity counters printed on the
      card, five timed boosts, twenty-four cosmetics that change how things look and not one
      number, and simulated leaf packs that add leafs and charge nothing
- [x] **The season** — 45 days computed from the clock rather than announced by a server, a
      100-level pass across a free and a premium track, sixty simulated rivals whose gear you can
      actually open and read, and three live events of ten designed in `docs/EVENTS.md`
- [x] **The story** — a pond gone cold and the water stopped somewhere upstream, told in twenty
      beats across three acts by five capybaras who turn up when something actually happens: a new
      terrain, a boss down, the wall, a rebirth. A six-frame opening you can skip, then six coach
      marks that point at the real UI as it unlocks rather than at a wall of modal text. A profile
      with a name you can change, an avatar and a title from what you own, and a story log that
      lets you read any beat again. None of it can be reset away.
- [x] **The cache** — offline income became a tank you can see rather than a receipt you
      read afterwards. It states its capacity while it is empty, shows what spilled when it
      overflowed, and holds what it caught until you take it — so the offline cap is something
      to plan around instead of something you discover in a bill. Time spent with the tab
      merely backgrounded now goes in too, where it used to vanish outright.
- [x] **Two hundred and thirty-two trophies** — every system in the game has some, grouped by
      where they come from and filterable down to what you have not done yet. The payouts sit on
      four fixed bands rather than on hand-picked numbers, because two hundred entries each
      paying "just a few percent" compounds to a factor of eight million; a full clear is worth
      x68, which is a number somebody chose.
- [x] **A tree with a shape** — 210 nodes of "+x% per rank" and a free respec is a shopping
      list: buy long enough and you own all of it, and nothing you did was a decision. There
      are now 14 keystones, two per branch, each a large gain and a real cost in one package —
      and you may hold three. Tier 5 and 6 are limited to three branches of seven, and twenty
      of the deepest nodes only pay a build that has earned them. Measured on one baseline, the
      tapping build out-taps the idle build by a factor of millions and loses to it while
      asleep; neither is a better version of the other.
- [x] **A fight you can play** — combat used to run itself entirely: skills fired on cooldown,
      every decision was made outside the fight, and the whole RPG half was silent. Enemies now
      wind up their heavy hits and tell you first; reading the tell halves the blow and fills a
      Focus meter worth up to ×1.4 on everything you do. Bosses carry one pattern each — a ward
      that asks a question of your stance, an escort that has to die first, an enrage that
      punishes a slow kill. Idling is untouched: a Focus of zero is a multiplier of exactly 1.0,
      and a test asserts an auto-battler still clears every pattern.
- [x] **The balance pass** — every number in `docs/BALANCE.md` was measured rather than asserted,
      and `tests/economy-balance.test.js` holds each one, so a constant cannot move without the
      document failing with it. Some of what it records is unflattering: the first rebirth wall
      lands at stage 7 rather than the 8–11 that was planned, and difficulty sawtooths by up to
      ×2.3 between neighbouring stages because gear unlocks a rung every two stages while boss
      HP grows every stage. Both are written down as what happens, with the reasoning for
      leaving them alone.
- [x] **Retention** — daily and weekly quests, a seven-day login streak, a 40-level free Zen Pass,
      a chest that fills every 15 minutes, eight secret codes, and a stats page that grows as you do
