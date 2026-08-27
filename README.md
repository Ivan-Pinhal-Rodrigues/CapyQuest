# CapyQuest

A pixel-art idle clicker RPG about a very relaxed capybara, an endless hot spring, and far too
many upgrades.

Play it at **[ivan-pinhal-rodrigues.github.io/CapyQuest](https://ivan-pinhal-rodrigues.github.io/CapyQuest/)**.

> This repo is the expanded game — infinite stages, rebirth, a 210-node skill tree with keystones,
> a 20-rung rarity ladder, seasons, a weekly bracket and events. The original finite version is
> still playable at [ivan-pinhal-rodrigues.github.io/v1](https://ivan-pinhal-rodrigues.github.io/v1/)
> ([source](https://github.com/Ivan-Pinhal-Rodrigues/Ivan-Pinhal-Rodrigues.github.io)).
>
> It was built in six phases, audited as a finished game, and then rebuilt in six more from what
> that audit found. `docs/POSTMORTEM.md` is the honest record — including the six digit-count
> typos that made a third of the generators unbuyable, and the balance pass that failed to notice.
>
> Everything in the shop is **simulated**. Leafs are a fake currency, the price tags are
> decorative, and nothing anywhere takes real money.

## What it is

Tap the capybara to earn zen. Spend zen on generators that earn zen while you are not tapping.
Spend more zen on upgrades that multiply both. Then keep going, because there is a whole RPG
underneath: stats, gear, auto-battle, gacha companions, a 210-node skill tree, and two reset
layers.

At 1,000 zen — about three minutes in — the Quest line opens: unlimited stages of ten levels each, a boss on every tenth, 18
cycling terrains and 42 pieces of gear to find and enhance. You watch it happen: your capybara
faces the enemy in an arena that lunges, recoils, telegraphs the heavy hits and draws each of the
eighteen skills as one of six effects. Combat still runs itself if you want it to — what you
choose is the kit, the three skills, the elemental stance, and whether to cast by hand.

Bosses drop summon tickets. Twenty-four capybaras can be summoned, three of them fight alongside
you, and the pity counter is on screen the whole time.

Eventually a boss will not fall inside thirty seconds — and thirty seconds is a real clock, not a
warning. Run it out and the boss keeps its full health, you go back a whole stage, and the fight
stops advancing until you press Forward. That is the run over. Rebirth is the answer: start again,
paid in Essence for how deep you got, and spend it on a tree of 210 nodes no reset can take back.

Beyond that is the Still Point. Ascending takes the Essence and the whole tree and pays Lotus —
counted from the ground you covered across every run, not only from how often you pressed the
button — and each ascension leaves the next run starting deeper than the last. Lotus buys twelve
constellations arranged in four figures of three; light every star in a figure and it pays a
bonus of its own.

## Running it

There is no build step and there are no dependencies. Serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Because it is plain static files, pushing to the Pages branch is the whole deploy — with one
rule attached to it. **`VERSION` in `sw.js` must match `version` in `package.json`.** The cache
name carries that version and a new version is the only thing that makes a deployed change reach
somebody who already has the app installed. Forgetting is otherwise completely silent: no error,
no warning, just players on last month's build indefinitely.

**You do not have to remember.** `tests/pwa.test.js` fails if the two drift, and
`.github/workflows/version.yml` bumps them for you: push a change to anything a player actually
receives — `src/`, `styles/`, `content/`, `index.html`, `sw.js`, `manifest.webmanifest` — without
touching the version, and CI bumps the patch in both files and commits it. A README or docs edit
does not, because it does not reach anybody's browser and should not make every installed app
re-download itself. `node tools/version.mjs patch|minor|major` is the same code, for when you want
to choose.

To install it, open it in a browser and use Add to Home Screen or the install button in the
address bar. It runs offline from the first visit onwards.

## Tests

```sh
npm test            # 741 assertions, node's built-in runner, no framework
npm run test:browser # opens the real page in Chromium and looks at it
npm run test:all     # both, which is what CI runs
```

Node's built-in runner, no test framework installed. The suite covers the balance formulas, the
save/migration path, purchase logic, and the integrity of the content tables — including a check
that every hand-drawn sprite grid is rectangular and that every character it uses has a colour in
the palette it gets drawn with. One suite parses every module in `src/` — `main.js` included, which
nothing else imports because it needs a DOM — so a syntax error in the file that boots the game
cannot hide behind a green suite again. Another checks the documentation against the code it
describes — four rows of the beat table in `docs/STORY.md` were wrong on the first draft, written
from memory and entirely plausible-looking, so the tables that can be verified mechanically are.

**And a suite that opens the page.** `tests/browser/` drives the real game in Chromium at 320,
390, 768 and 1280, walks every tab, and checks what a unit test structurally cannot: what the
console actually prints, what size the text actually comes out, whether anything overflows
sideways, and whether every tap target clears 24px. It exists because four bugs in v3 shipped past
a green unit suite and a headless probe — a cloak painted in the sunglasses' palette, a loading
screen that faded out mid-sentence, a loading screen *underneath* the game, and nine event
backdrops that were secretly two. Each one needed something to look at the page.

Two of its checks run as a **ratchet**: the type scale has real debt, so `tests/browser/baseline.json`
records what is wrong today and the suite fails when a count goes up. Regression is blocked
immediately; the debt is paid down separately. The only permitted direction is down — the suite
rewrites the file when a number improves.

This is the one place the project has dependencies. `playwright-core` drives that browser and
nothing else: `npm test` and the game itself both work with `node_modules` deleted, and nothing
in `src/` imports anything that is not in `src/`.

## How it is put together

```
index.html          the game; the site root
styles/             tokens, layout, components, motion
src/
  balance.js        every formula, pure and unit-tested
  state.js          save schema and defaults
  save.js           localStorage, migrations, export/import codes
  data/             the content tables — generators, upgrades, achievements
  content/          the live catalogue: the tables with a pack merged over them
  systems/          game logic: clicking, income, shop, goldens, audio
  render/           sprites, palettes, canvas rasteriser, particles, scene
  ui/               HUD, shop panels, modals, toasts, tabs
content/
  pack.json         the editable half of the game — see docs/CONTENT.md
docs/               BALANCE.md, CONTENT.md, STORY.md, EVENTS.md, POSTMORTEM.md
tests/
```

### Content is editable without a deploy

What the shop sells, what a boost costs, which looks exist, when an event opens and closes and
what a pass level pays all live in `content/pack.json` — a patch over the built-in tables. Open
the game with `?admin=1` to edit it visually, watch the change in the running game, and export the
JSON to commit. A malformed pack is dropped entry by entry and the game boots on its defaults;
nothing in a pack can touch a save, take a look out of a wardrobe, or move a number in the
simulation. `docs/CONTENT.md` has the format.

### The wardrobe

Six kinds — skins, ponds, titles, hats, outfits and extras — and eighty-nine looks between them,
of which thirty-four are earned by playing, thirty-six are sold for leafs and thirteen sit on the
season pass. Hats, outfits and extras are drawn as layers stamped onto the capybara's own grid,
so nineteen hand-drawn shapes cover fifty-two items by palette swap.

**None of it moves a number.** That is asserted, not promised: a test wears every look in the
catalogue in turn and checks the income and combat blocks are bit-identical.

### The fight is drawn

The combat panel used to be an `<img>` of the enemy above two bars: every mechanic the fight had
was a line of text and the capybara doing the fighting was not on screen. `src/render/arena.js`
is a sibling of the pond scene sharing its whole toolkit — same rasteriser, same particles, same
reduced-motion discipline — driven entirely by the event stream `systems/combat.js` already
emitted. **No combat logic lives in it and none should: the arena reacts, it never decides.**

A skill's look is derived from the effect it declares rather than from a hand-written table, so
adding a skill cannot leave it drawing nothing.

### The pond crew

Your three party companions sit in the water beside the capybara on their own lily pads, each
with its own bob, its own blink and its own palette. Tapping one opens its sheet — and never
counts as a tap on the capybara, because the pond is the clicker.

They wear **your** hats: owning one puts it in reach of all four capybaras, and it moves no
number on any of them. What does carry stats is **crew gear** — charm, collar and trinket, 24
pieces on the same 20-rung ladder as player gear at 45% of the budget, dropped by bosses and
never sold. `docs/BALANCE.md` has what a full set is actually worth, measured.

### The art is text

Every character, prop, wearable and backdrop in the game is a grid of characters resolved
through a palette map — not one of them is an image file. Sprites look like this:

```js
export const YUZU = sprite([
  '....g...',
  '..ooog..',
  '.oyyyyo.',
  'oyywyyyo',
  /* ... */
]);
```

They rasterise to an offscreen canvas once and blit with smoothing off. Thirty hand-drawn 16×16
shapes — ten families of three growth stages — cover all forty-eight generators by swapping the
palette underneath them; nineteen more cover fifty-two wearables. Sound effects and all three music loops are synthesised with WebAudio
oscillators, so there are no audio files either.

The advantage is not smallness, it is that **art reviews as a diff**. A pull request that shifts
a hat two pixels reads as two changed lines. A pull request that replaces a PNG reads as nothing
at all.

**The one exception is `assets/`,** which holds two things and only two: a picture an admin
wants behind the loading screen for a seasonal event, and the app icons a phone needs to put
CapyQuest on a home screen. Neither can be a character grid — a home-screen icon has to be a
real file — and neither ships populated. The nine loading-screen backdrops the game comes with
are drawn as 16×16 tiles like everything else.

### The loading screen

`#boot` is inline in `index.html`, markup and CSS both, because it is the one thing on the page
that has to be up before a stylesheet has landed — a loading screen that waits on a download is
not a loading screen. `src/ui/bootScreen.js` takes it over once modules parse and swaps the CSS
bob for a canvas capybara that splashes and blinks.

The bar is wired to steps that actually happened — pack fetched, save read, game constructed —
and nothing but the last one reaches 100%. On a warm cache you will see it for a few frames.
That is the point: it is there for the cold load and the slow connection, not to pad the opening.

### It installs, and it runs offline

`manifest.webmanifest` and `sw.js` make it an app you can add to a phone's home screen. Still no
build step: both are hand-written files served as-is, and `python3 -m http.server` is unchanged.

The service worker keeps **one cache per version and deletes it whole**, so a page load is always
entirely one version of the app — never half the old modules and half the new. It never activates
itself; the page decides, and it decides by asking whether there is anything to interrupt:

| | |
|---|---|
| A build waiting **when you open the game** | Taken immediately. The loading screen says "Updating…" and the page reloads into it. Nothing is constructed yet, so it costs you nothing. |
| A build that lands **while you are playing** | A toast that waits for you. Reloading somebody out of a boss fight to deliver a shop-price change is not a trade anyone would agree to. |

`content/pack.json` is the one thing fetched **network-first**, because the promise of
`docs/CONTENT.md` is that an admin commits a change and sees it — putting that behind a worker
version bump would defeat the point of having a pack.

There is no file list to maintain. At install the worker reads `index.html` for the stylesheets
and the entry module, then follows the import graph, which is how it caches 126 files without
anybody writing 126 paths down. The first draft skipped this and let the fetch handler collect
files as they were requested — Chromium reported the result as three entries, no JavaScript and
no CSS, because *the visit that installs a worker is not controlled by it*.

### The pond is the progress bar

Forty-eight generators, and the pond draws **one of each** — not one per unit, and not the six-odd
copies an earlier version scattered on the banks. Each has a habitat it belongs to (water,
shallows, bank, ridge, sky), and the five bands stack from the water up to the sky so the place has
depth rather than being a list.

Two things change it, and they are deliberately different kinds of change:

| | |
|---|---|
| **Buying units** | grows the thing, continuously and logarithmically. The eleventh Lily Pad is visibly more pad than the tenth; the ten-thousandth has not eaten the pond. |
| **Buying a tier upgrade** | changes what the thing *is* — a different drawing and a different name, in the shop as well as on the water. A Lily Pad becomes a Lily Spread becomes a Lily Field. |

That split is the whole design. A pond where everything only ever swells is a pond where nothing
ever arrives; a pond that only ever changes at upgrades sits still for the hundreds of purchases in
between. `src/render/sprites.js` carries ten families of three drawings each to make the second
half possible, and the stage is read off the tier upgrades a save already has, so a 3.0 save needs
no migration to arrive at the right one.

The clearance around the capybara is solved rather than assumed — at any height, the horizontal
gap is `sqrt(r² - dy²)`, which is zero level with the top of its head and widest across its middle,
so a sky terrace passes over it and a lily pad goes round. Two earlier drafts used a fixed
fraction of the half-width instead. The first put thirty-four of sixty-three sprites on top of the
capybara; the second pushed everything to one distance and rendered the late-game pond as two
vertical walls. Every numeric check passed both times.

### Getting it onto a phone

Settings has a QR code of the page's own address, drawn by `src/render/qr.js` — a small encoder
written for this, byte mode at error-correction level M, versions 1 through 6. Point a camera at
it, open the link, and use **Add to Home Screen** (Safari) or **Install** (Chrome). That is the
whole install path, and it needs no store and no developer account.

The URL is printed underneath in full, deliberately. A code is faster when it works and useless
when the camera will not focus, the screen is too dim, or somebody is reading this over a screen
share.

A QR encoder is unusually easy to get wrong in a way that looks right — the grid has finder
patterns in the corners and a plausible spray of modules whether or not it decodes. Ours drew a
beautiful, unreadable code for a while: the format information was written least-significant bit
first. Every structural check passed, the Reed-Solomon output matched the specification's own
published vector, and a decoder written alongside the encoder read `HELLO` back perfectly, because
it shared the mistake. `tests/qr.test.js` therefore decodes every code with **jsqr**, somebody
else's implementation, and that is the entire reason the second devDependency exists.

The size is chosen in JavaScript rather than pinned in CSS, for the same class of reason: the grid
is 21 modules across at version 1 and 41 at version 6, so a canvas fixed at one width in the
stylesheet gets resampled by whatever ratio falls out, and a fractional module is one a camera
reads as grey.

#### A custom domain, when you want one

Pages will serve this from your own domain for nothing. **There is no `CNAME` file in this repo on
purpose** — adding one points the site at a domain that may not exist yet and takes it offline
until DNS agrees. Do the DNS first, then add it.

For an apex domain (`capyquest.example`), four `A` records and four `AAAA`:

```
A     @   185.199.108.153      AAAA  @  2606:50c0:8000::153
A     @   185.199.109.153      AAAA  @  2606:50c0:8001::153
A     @   185.199.110.153      AAAA  @  2606:50c0:8002::153
A     @   185.199.111.153      AAAA  @  2606:50c0:8003::153
```

For a subdomain (`play.capyquest.example`), one record instead:

```
CNAME  play   ivan-pinhal-rodrigues.github.io.
```

Then Settings → Pages → Custom domain in the repository, wait for the check to pass, and tick
*Enforce HTTPS*. The `domainDNS` error this project hit the first time round is DNS not resolving
yet, not a problem with the repository — the certificate cannot be issued until the records
propagate, which is usually minutes and occasionally a day.

#### itch.io

Free, no developer account, and an audience that is already there for games. Upload a zip of the
repository, tick **This file will be played in the browser**, and set the frame to about 960×720.

One caveat, and it is measured rather than assumed. itch serves HTML5 games from an `<iframe
sandbox=…>` on its own domain, and the sandbox list is theirs to choose. `tests/browser/run.mjs`
loads the game in both shapes it can take:

| Sandbox | What happens |
|---|---|
| with `allow-same-origin` | The document keeps its real origin. Modules load, saves work, the service worker registers. The full game. |
| without it | The origin is opaque. Module scripts are fetched in CORS mode against origin `null` and `src/main.js` is **refused outright** — a loading screen that never finishes. |

The plan for this work assumed the worst case was "playable, without offline support". It is not,
and there is no fix available from inside the page, because the thing that would apply the fix is
the module loader that failed to load. So `index.html` ends with a **classic** script — not a
module, which is the entire point — that says so after twelve seconds and prints the direct URL.
The suite asserts that message appears; deleting it turns the check red.

Whether itch itself passes `allow-same-origin` could not be verified from here, so it is written
down as unverified. If the embed comes up as a permanent loading screen, that is the reason, and
the game still works from its own URL.

#### The stores, if you ever want them

Not done, because both cost money, and listed here so the choice is informed rather than
rediscovered:

- **Google Play** — $25 once. [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or
  [PWABuilder](https://www.pwabuilder.com/) wrap the installed PWA in a Trusted Web Activity. The
  manifest and service worker this already ships are the inputs; no game code changes.
- **App Store** — $99 a year, and iOS will not accept a plain PWA wrapper, so it needs a real
  shell. Considerably more work than the fee.

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
| Purchasable upgrades | **396** — 16 tap, 48 generators, 96 generator tiers, 210 tree nodes, 14 keystones, 12 constellations |
| Gear | 42 pieces across 6 slots, on a 20-rung rarity ladder, 1–5 stars, enhanceable +0 → +15 |
| Wardrobe | 89 looks across 6 kinds — skins, ponds, titles, hats, outfits, extras — none of which moves a number |
| Companions | 24, summoned, three in the party — visible in the pond, wearing your hats and their own gear |
| Crew gear | 24 pieces across 3 slots, dropped by bosses, never sold |
| Combat skills | 18, three slotted, cast by hand or automatically |
| Achievements | 232 across 13 groups, every one paying a permanent bonus |
| Terrains / stages | 18 cycling, unlimited stages, with 71 enemies and bosses |
| Currencies | Zen, Essence, Leafs, Lotus, tickets, shards |
| Store | 3 cases with their odds on the card, 5 boosts, 36 looks for sale — all simulated |
| Season | 45 days, a 100-level two-track pass, 60 simulated rivals, a weekly bracket, 3 live events of 10 designed |
| Story | 3 acts, 20 beats, 5 NPCs, a 6-frame opening and 6 coach-marked tutorial steps |
| Offline | A cache with a stated capacity, a fill rate, and a spill marker when it overflows |

**631 collectible or purchasable entries in total**, plus the systems around them: combo chains,
crits, Golden Capybaras, offline income, auto-battle, elemental stances, a forge, gacha pity,
two reset layers, quests, a login streak, a battle pass, timed chests and secret codes.

Nothing in the store takes real money. The leaf packs carry price tags because that is the shape
of the genre and this is a study of it; `PAYMENTS` is off, there is no processor, no card is ever
asked for, and every purchase surface says so where you cannot miss it.

## Status

Playable and finished. Built in six phases, audited, then rebuilt in six more — see
`docs/POSTMORTEM.md` for what the audit found and what actually caught the bugs.

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
      card, five timed boosts, thirty-six of the eighty-nine looks in the wardrobe, and simulated
      leaf packs that add leafs and charge nothing
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
- [x] **The Still Point** — it shipped working and thin: a reset, a currency, twelve upgrades, and
      no reason to exist that Rebirth did not already provide. It pays for ground covered now
      rather than for button presses, each ascension starts the next run deeper so the second is
      not the first with bigger numbers, and the twelve constellations became four figures of
      three that cut across the price range. The "still being built" banner and its roadmap are
      gone, because they are done.
- [x] **A way in** — twelve tabs met a new player before they had done anything, several of them
      near-duplicates. Eight now, with the pairs that always belonged together sharing a tab and a
      small strip of sub-navigation. The opening was measured rather than guessed: a simulated
      player reached combat at seven and a half minutes, having bought one generator and one
      upgrade in the six before it. Combat now opens at three minutes and the first real choice
      lands inside sixty seconds. There is also music — three loops out of the same oscillators as
      the sound effects, still no audio files, off by default and on its own switch, because an
      idle game runs for hours in a background tab.
- [x] **Retention that asks something** — nine surfaces all ended in a button marked Claim.
      The day now offers seven quests for four slots and the week five for three, so a session
      starts with a decision about the session; the picker closes once you have chosen, and a
      reroll costs leafs and is refused afterwards. The leaderboard stopped being a screenshot:
      once a week three rivals from around your rank fight your actual kit, through the same
      damage function the real fight uses. A new player wins their first brackets on purpose,
      and it turns into a real competition as you get deeper. Every placement pays.
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

### 3.0

- [x] **Content stopped being code** — every shop shelf, price, look, pass reward and event window
      is a patch in `content/pack.json`, edited in-game with `?admin=1` and exported to commit. A
      malformed pack is dropped entry by entry with a warning naming the path, and the game boots
      on its defaults; nothing a pack can say will touch a save, take a look out of a wardrobe or
      move a number in the simulation. Events gained absolute scheduling, so an event can be told
      exactly when to stop — and an event that starts and never stops is refused, because petals
      expire with their event.
- [x] **A wardrobe** — sixty-two new looks across three new kinds, eighty-nine in total, drawn as
      layers stamped onto the capybara's own grid: nineteen hand-drawn shapes covering fifty-two
      items by palette swap. None of it moves a number, and that is asserted rather than promised.
      The one real bug the phase produced was invisible to both the test suite and a per-item
      browser probe — every wearable uses the same palette letters, so a red cloak rendered in the
      sunglasses' colours the moment both were worn. It took a screenshot to see and private-use
      codepoint remapping to fix.
- [x] **The pond crew** — your three party companions are in the water beside you on their own lily
      pads, wearing your hats, carrying their own gear: 24 pieces across charm, collar and trinket,
      on the same 20-rung ladder as player gear at 45% of the budget, dropped by bosses and never
      sold. Tapping one opens its sheet and never counts as a tap on the capybara, because the pond
      is the clicker. What a full set is worth was measured twice — the first answer, +540%,
      compared geared companions against an ungeared player, which is not a comparison anybody
      makes. Against a depth-matched player it is about +50%, and `docs/BALANCE.md` records both.
- [x] **The fight is drawn** — the combat panel's static image of the enemy became an arena with
      your capybara in it, wearing what you dressed it in: lunges, hit reactions, a white flash,
      dissolves, a boss entrance, and six skill archetypes derived from the effect a skill declares
      rather than from a hand-written table, so adding a skill cannot leave it drawing nothing. No
      combat logic lives in it and none should — the arena reacts, it never decides.
- [x] **The clock, and both resets** — a boss now has thirty seconds. Run out and it is not a
      rebirth: you are moved to the stage below and held there until you press Forward yourself,
      because a timer that silently costs you an hour is a punishment you did not see coming.
      Rebirth needs real depth before it unlocks and pays more when it does; Ascension needs eight
      rebirths and fifteen thousand essence, wipes the rebirth count in front of you in the confirm
      dialog, and pays enough to be worth it. Every number came out of the simulation harness.
- [x] **A loading screen** — inline in `index.html` so it paints before a stylesheet has landed,
      taken over by a canvas capybara that splashes and blinks, with a bar tied to steps that
      actually happened. Nine backdrops an event can pick from, drawn as tiles like everything
      else. Seven of the nine started out as two shapes in different colours; the browser probe
      compared the baked images and called all nine distinct, which was true and useless.
- [x] **An app** — installable to a phone's home screen and fully playable offline, with an updater
      that reloads at boot and asks mid-session. Still no build step and no dependencies: a
      hand-written manifest, a hand-written service worker, and icons generated from the same
      capybara grid the game draws.
