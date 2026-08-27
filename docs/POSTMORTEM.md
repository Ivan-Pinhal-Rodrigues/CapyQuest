# Postmortem

CapyQuest was built in twenty-seven phases and audited twice.

Six phases built the game. The seventh was a design audit of the finished thing, and the six after
it were what that audit found. Seven more are v3.0 — a wardrobe, the crew in the water, a fight
you can watch, a real boss clock, editable content, and an app you can install. Then a second
audit, of v3 this time, and the seven phases that answers it are v4.0: a pipeline, text you can
read, a save that tells you when it fails, gear that is a decision again, an optional backend, a
way onto a phone, and forty-eight generators standing around a pond that grows into them.

This is the record of what both audits found, what it cost, and what actually caught the bugs. It
is written down because the pattern in it is more useful than any individual fix: **every system
passed its tests, and several of them were wrong anyway.**

Each version said it again in a new accent. v2: a model is a claim that needs checking before its
output is treated as a finding. v3: four bugs shipped past green suites and headless probes, and
it took a screenshot to see each one. v4: a check that shares the thing's assumptions is not a
check — a decoder written beside its encoder read a broken QR code back perfectly, because it read
the bits in the same wrong order they were written in.

---

## The one-line verdict

> The engineering was better than the game.

At the end of phase 6 there were 434 passing tests, 631 collectible entries, and about six real
decisions. Every system the plan named existed and worked. What was missing was the
moment-to-moment reason to keep tapping — and, in one case, a third of the core loop.

---

## What the audit found

### 🔴 A third of the generators were unbuyable

The cost ladder climbs ×13–16 per rung for the first twelve. Then:

| Generator | Cost step | Payback |
|---|---|---|
| skyTerrace | ×12,143 | 12.5 years |
| timeOnsen | ×12,381 | 39,000 years |
| astralPond | ×11,923 | 65 million years |
| capySingularity | ×169 | 45 billion years |

Six digit-count typos in a row: the exponents stepped e15 → e18 → e21 → e24 → e27 → e30 while
the mantissas never scaled down. Each line was plausible on its own.

**Why the tests missed it.** `tests/content.test.js` asserted that costs *increase*. They did.

**Why the balance pass missed it.** Phase 6 was called a "full balance pass". It measured the
combat wall and the achievement ceiling, and never added up the cost column — the audit's most
embarrassing finding, and it was self-inflicted.

### 🔴 Combat was a screensaver

Half the game — 42 gear pieces, 24 companions, 18 skills, unlimited stages, 232 achievements
pointing at it — and there was nothing to *do* in it. Skills fired themselves on cooldown, every
decision was made outside the fight, and `grep -c "audio\." src/systems/combat.js` returned **0**.
Eight synthesised sounds on the clicker side, silence in the tab you were meant to live in.

### 🟠 The 210-node tree was 210 sliders

23 effect types, one effect each, every one a linear "+x% per rank", free respec, and Essence
arriving forever. Given enough rebirths you bought all of it. Seven branches were the same node
wearing different colours.

### 🟠 Retention was nine buttons marked Claim

Daily quests, weekly quests, login streak, timed chest, two pass tracks, an event exchange, a
season rollover, achievement toasts. None of it asked a question; it asked for a tap.

### 🟠 The leaderboard had no stakes

Sixty rivals, generated deterministically, advancing on a believable curve, never interacting
with the player and unaffected by anything they did. A screenshot of a leaderboard.

### 🟡 Twelve tabs, and a seven-minute doorway

A new player met a 6×2 grid of nouns before doing anything. Combat was gated at 5,000 lifetime
zen, which a simulated player reached at **7m 12s** — having bought one generator and one
upgrade in the six minutes before it.

---

## What caught what

This is the part worth keeping.

| Found by | Bugs |
|---|---|
| **Measuring** | The generator ladder. Two keystones that did the opposite of what they said. A combat design 26% *worse* than idling. A Focus trickle that never moved the meter. A `settle()` unreachable from manual casting. |
| **The browser** | "+0% all income" on a third of the achievements. Controls below the fold on a phone. Dead CSS overriding new CSS. A parse error that took the whole game down. |
| **Tests** | Regressions, mostly. Reset keep-lists. Save migrations. The invariants already known to matter. |
| **Writing it down** | Four wrong rows in `docs/STORY.md`. Figures grouped by cost. A doc claiming a number the code no longer produced. |

Tests were the weakest of the four at finding *new* problems, and the strongest at stopping old
ones coming back. That is the correct division of labour, but it is not what the test count
suggests from the outside.

### Three bugs found by simulation that no test would have caught

1. **Manual combat was 26% worse than idling.** The first design had skills spend a Focus meter,
   so the clever play was holding a ready skill until it filled. A skill idle on cooldown costs
   more throughput than any per-cast bonus returns. Every unit test passed; the mechanic was
   simply bad. *Lesson: any design where the skilful option is "wait" loses to "act on cooldown".*

2. **Two keystones inverted.** "The Absentee" was meant to make tapping ceremonial and was a
   tapping *buff*; "Hands On" was meant to triple your tap and left you tapping for less. Tap
   value is `(base+flat)·mult + zps·zpsShare`, and with a real pond the second term dwarfs the
   first — so both were modifying the wrong half of their own formula.

3. **A negative click value.** Fixing The Absentee with `zpsShare: -1` subtracted the entire pond
   from the tap. The floors added for keystones sat on the values reported *out* of
   `recomputeDerived`, not on the one the formula consumes.

### The measurement that was itself wrong

The first pass at the opening reported a **400-second dead patch** and that combat never opened
inside ten minutes. Both were artefacts of the simulated player, which bought the cheapest
affordable thing every tick — so it stacked Lily Pads forever and could never save the 100 zen
for the second generator.

Fixing the *model* moved the second generator from 3m 2s to 36s **without a line of game code
changing**. Had the retune gone ahead against the broken model, it would have gutted a curve that
was mostly fine.

*Lesson: a simulated player is a model, and a model is a claim that needs checking before its
output is treated as a finding.*

---

## Tests that were added because something got through

Each of these exists because of a specific escape, and each fails if the original bug is put back.

| Test | Escape it closes |
|---|---|
| `content.test.js` — cost slope and payback | The generator ladder |
| `modules.test.js` — parses every module including `main.js` | A duplicate import that took the game down at boot, while 375 tests stayed green |
| `modules.test.js` — exported constants must be imported | Two missing imports in a file no test can load, because it needs a DOM |
| `achievements.test.js` — no reward describes itself as "+0%" | A third of the table advertising that it paid nothing |
| `achievements.test.js` — ladder monotonicity | Banding a table that already had hand-picked values inverted four ladders |
| `docs.test.js` — every documented beat against its speaker | Four wrong rows written from memory |
| `keystones.test.js` — figures are not the three cheapest | A grouping that was four cost bands and no decision |
| `fight.test.js` — an idler clears every boss pattern | The line the interactive layer must never cross |

---

## What was decided rather than discovered

Not every finding became a change.

- **The difficulty sawtooth stays.** Boss time-to-kill oscillates by up to ×2.3 between adjacent
  stages, because gear unlocks a rung every two stages while HP grows every stage. Smoothing it
  means consuming the ladder twice as fast and topping it out at stage 19 instead of 38 —
  trading a bumpy curve for a shorter one.
- **The first wall lands at stage 7, not the planned 8–11.** Stars move it from 44s to 32s and
  not the last two seconds. The test asserts 5–13, the honest range, rather than the aspiration.
- **New players win their first brackets.** A feature has to teach that entering is worth doing.
  It becomes a real competition with depth, and the two halves are asserted separately.
- **No demo video in the repo.** A README that claims there are no binary assets is a claim worth
  keeping true. The tour was recorded and handed over rather than committed.

---

## Numbers

| | End of phase 6 | End of v2 | v3.0 |
|---|---|---|---|
| Tests | 434 | 536 | **673** |
| Lines (excluding tests) | ~19,300 | ~22,400 | **~27,500** |
| Tabs | 12 | 8 | 8 |
| Time to combat | 7m 12s | 3m 17s | 3m 17s |
| `domcontentloaded` | 12,656ms | **294ms** | 294ms |
| Achievements | 232 | 232 | 232 |
| Wardrobe | 27 | 27 | **89** |
| Binary assets | 0 | 0 | **4** — the app icons |

The load time was the last thing the audit found and the cheapest thing it fixed: the Google
Fonts stylesheet was render-blocking, so a font CDN that is slow, blocked or down cost the entire
first paint. It loads asynchronously now. The game was always interactive in 19ms; nothing but
the `<link>` was in the way.

---

## v3.0 — seven more phases

v3 was seven phases: content packs and an admin editor, the wardrobe, the pond crew, the arena,
the boss clock and the two resets, the loading screen, and the app. The division of labour above
held, with one shift: **the screenshot became the sharpest tool in the box.** Four of the phases
shipped a bug that every green test and every headless probe agreed was not there.

### The four that only a picture found

1. **The black cloak.** Every wearable layer uses the same palette letters, `O A B C D`, and the
   layers' palettes were merged into one map — so wearing sunglasses and a red cloak together
   painted the cloak in the sunglasses' colours. A node test asserting no wearable uses a
   capybara character passed. A browser probe rendering each wearable *in isolation* passed. Both
   were asking about one layer at a time, and the bug only exists between two. Fixed by remapping
   each layer's characters into its own private-use codepoint range, so a layer cannot reach
   another layer's palette even in principle.

2. **A loading screen that faded out mid-sentence.** `finish()` set its done flag before asking
   for the final step, and `step()` refuses to write once done — correctly, so a late callback
   cannot scribble on a fading overlay. The flag swallowed the one call that mattered, the bar
   stopped wherever it had got to, and the whole thing read as a stall rather than a finish.

3. **A loading screen underneath the game.** The overlay sat at `z-index: 90`, below the modal
   layer at 100 and the story cutscene at 120. The cutscene opens while the boot screen is still
   fading, so the opening frames painted straight over it. The test that replaced it reads the
   real numbers out of `styles/` rather than pinning a constant that drifts the next time a panel
   is added.

4. **Nine backdrops that were two.** Seven of the nine event backdrops were the same two shapes in
   different colours — three diamonds, which at six screen pixels a cell are plus signs, and four
   single dots. The browser probe compared the baked images and reported all nine distinct, which
   was *true*: they differ by palette. It was asking the wrong question, and answering it
   confidently. They are compared by mask now, colour discarded.

### And one the browser found in the service worker

The first service worker cached three entries and left the other 119 files to the fetch handler,
on the reasoning that one online visit would pull the whole app through it. Chromium's answer:
three entries, no JavaScript, no CSS. **The visit that installs a worker is not controlled by
it** — its stylesheets and modules were requested before the worker existed. Someone who opened
the game once and then got on a train had an app that could not start, which is the entire case
for having a service worker.

It appeared to work when tested, because the ordinary HTTP cache answered while the network was
off. That is evictable and guaranteed by nobody, and "it worked offline" was not evidence of what
it seemed to be evidence of. The check that settled it fetches an icon referenced only from the
manifest — one the page never requests, so it can never be in the HTTP cache. It loads offline;
therefore the worker's cache served it.

The fix has no file list. At install the worker reads `index.html` for the stylesheets and entry
module and follows the import graph from there, which caches 126 files without anyone writing 126
paths down. It rests on there being no dynamic imports in `src/`, so a test asserts that.

### The lesson from v2, three more times

*A model is a claim that needs checking before its output is treated as a finding.* v3 produced
three more instances, each caught before it changed a design:

- Crew gear measured at **+540%**, because the model compared a geared companion to an *ungeared
  player*. Against a depth-matched player it is about +50%. `docs/BALANCE.md` records both.
- The plan asserted a full crew set was "worth about three companion levels". Measured: more than
  twenty. The real figure went in rather than the design being bent to match the claim.
- A boss-timeout test passed while asserting nothing at all. The "weak player" fixture *dies*
  three times long before thirty seconds elapse, so the timeout path never ran. It needed a
  deliberate stalemate — `atk: 0.0001, def: 1e9, hp: 1e9` — and a second test asserting the two
  kinds of failure stay distinct.

Three of the phase probes were also wrong rather than the code: a boss reported `isBoss: false`
because the fixture seeded a depth past `bestDepth` and `reconcileState` correctly clamps it;
three skill looks came back as `slash` because the probe invented skill ids that do not exist; and
an `elementFromPoint` check reported the cutscene on top of the boot screen because `is-done` sets
`pointer-events: none`, which that API skips — it was measuring pointer behaviour, not paint
order.

---

## v4.0 — a second audit, and the seven phases it produced

v3 shipped as a finished game and was audited the same way v2 was: run it, stress it, read it as
somebody who did not write it. The engineering held up — 16.7ms median frames with combat running,
zero heap growth over four hundred taps, no `innerHTML` anywhere in `src/`, every poisoned save
value scrubbed to zero. The findings were elsewhere, and two of them were embarrassing.

### 🔴 A save that failed silently

`saveState()` returns `false` when the write fails, and **all twenty-six call sites in `main.js`
discarded it.** Measured with writes blocked — Safari private mode, a full quota, an installed iOS
app whose storage had been evicted — the game reported `savedValue: null`, `stillPlayable: true`,
`anyWarningOnScreen: false`. A player plays for hours, loses everything, and is never told.

For an idle game, whose entire proposition is that progress accumulates, that is the worst bug in
the codebase, and it had been there since the first commit. It is a sticky warning toast now, with
the export code one tap away.

### 🔴 The text was too small to read

Not a judgement — a count. **Fifty-two CSS declarations under 8px**, ninety-six under 11px, the
smallest at `0.3rem` = 4.8px on a 20px-tall tap target. WCAG 2.2 sets the floor at 24px. Worse
offline: the service worker deliberately does not cache the font CDN, so an installed app always
renders in the `ui-monospace` fallback, whose metrics the scale was never tuned for.

The fix is a token scale with an 11px floor. Raising the type then broke the 320px layout — nine
horizontal overflows appeared — and the cause was not the type at all: grid items default to
`min-width: auto`, so a long word could push a column wider than its track. A latent bug the old
type was too small to expose.

### 🟠 No CI, and a version nobody could forget by accident

There was no `.github/` directory. 673 tests ran when somebody remembered, and `VERSION` in
`sw.js` had to be hand-bumped every deploy or installed apps never updated — silently. Three
workflows now: tests and the browser suite on every push; a version check before deploy; and one
that bumps the patch itself when player-facing files change and the version does not.

### What v4 added

| | |
|---|---|
| A | The pipeline, and `tools/version.mjs` |
| B | The save warning, the type scale, the accessibility pass |
| C | The pond, first cut — superseded by H |
| D | Gear sets, so the endgame is a decision again |
| E | A Cloudflare Worker and D1: cloud save, and real players on the board |
| F | A QR install code and the free distribution routes |
| H | Eighteen generators to forty-eight, and a pond that grows into them |

### The lesson that was new: a self-check is not a check

The QR encoder wrote its format information least-significant bit first. Everything agreed it was
fine. Every structural assertion passed — finder patterns, timing pattern, dark module, correct
size for the version. The Reed-Solomon output matched the specification's own published test
vector, exactly. And a decoder written alongside the encoder read `"HELLO"` back perfectly.

That last one is the point. **A decoder written by the same hand as the encoder shares its
assumptions, so it cannot find them.** It read the bits back in the same wrong order they were
written in and got the right answer, which is exactly what a broken pair does. The bug was found
by `jsqr` — somebody else's implementation, added as a devDependency for precisely this — and it
is the second dependency in the project because a QR code verified by nothing is worse than a
second devDependency.

The same shape appears in the v2 and v3 sections under a different name. The general rule is
sharper now: *a check that shares the thing's assumptions is not a check.* An independent
implementation, a real browser, a real database, somebody else's decoder.

### Measurement found design failures, not just bugs

Twice the numbers said a finished-looking feature did not work:

- **Gear sets were strictly dominated on the first draft.** Wearing a full set cost 24–29% of the
  best-in-slot power and 55–64% of its income; the set bonus returned about 2%. Nobody would ever
  wear one. The bonuses were raised several-fold from the measured gap rather than from taste.
- **The Still Point scored exactly 0.0%**, which looked like a bug in the probe and was not: the
  set *was* the best-in-slot loadout, so choosing it cost nothing and meant nothing. A piece moved
  to another set, and a test now asserts no set equals best-in-slot.

`docs/BALANCE.md` also records the two sets that remain genuinely undistinguished, because `power`
ignores crit and `reachableStage` is pure DPS — a tank set is not measurable with the harnesses
this project has, and writing "six clean identities" would have been a claim rather than a
finding.

### And the browser, again, four more times

A pattern with no sign of stopping. Every one of these passed the unit suite:

1. **The pond rendered as two vertical walls.** Clamping each sprite outward past the capybara
   collapsed almost all of them onto the same x. Nothing overlapped, nothing was off-canvas, every
   number was content.
2. **The settings button was sliced by the viewport edge at 320px** while the overflow count read
   zero, because `overflow-x: clip` hides exactly that. A separate check counts controls that run
   past the edge with no scrollable ancestor.
3. **Thirty-four of sixty-three sprites sat on top of the capybara**, under a comment asserting
   that was impossible by construction.
4. **Five of the twenty new pond drawings did not read as what they were** — and the fountain took
   three attempts: invisible at one pixel wide, then a tent pitched on the basin, then an arrow
   pointing down into the water.

### The probes were wrong before the code was, seven more times

Recorded because the reflex to blame the code first is the expensive one:

- Three of four accessibility findings were the probe. `!img.alt` treats `alt=""` — the correct
  markup for a decorative image — as missing; the scene canvas already had a label; the arena
  canvas gets one when a fight starts. Only the 210-tab-stop tree was real.
- "The capybara still earns: false" — zen was 1e18, and `1e18 + 1 === 1e18` in float64.
- Six gear ids in a test were written from display names and did not exist. `onsenBasin` is a
  *building*.
- An iframe host built with `setContent` lands on `about:blank`, and Chromium refuses storage
  under an opaque top-level document — so the harness reported a game that could not save when the
  game was fine.
- A service worker registered by the first iframe check answered the second navigation out of its
  cached shell, returning the game where the host page should have been.
- The pond's size check asserted three distinct sprite sizes and failed against correct code:
  sprites blit at whole-number scales and a 320px canvas has room for two. The measured truth — 2
  at 320, 3 at 768, 5 at 1280 — went into the check.
- A dev harness silently dropped the D1 schema, because splitting the file on `;` left chunks
  beginning with a `--` comment that swallowed the statement after them.

### One assumption in the plan, corrected by measuring it

The plan said the worst case for embedding the game on itch.io was "a playable game without
offline support". It is not. Loaded in an `<iframe sandbox>` without `allow-same-origin`, the
document gets an opaque origin, module scripts are fetched in CORS mode against origin `null`, and
`src/main.js` is refused outright — a loading screen that never finishes. Nothing inside the page
can fix it, because the thing that would apply the fix is the module loader that failed to load.

Hence the classic script at the bottom of `index.html`: twelve seconds after the module should
have arrived, it says so and prints the direct URL. Whether itch itself passes `allow-same-origin`
could not be verified from the sandbox this was built in, and is written down as unverified rather
than guessed at.

### A rule that could not survive the thing it guarded

`docs/BALANCE.md` carried "every generator repays inside a year", added after the six digit-count
typos that made a third of the ladder unbuyable. At eighteen rungs, ending at 181 days, it was a
reasonable proxy. At forty-eight it is arithmetically impossible, and keeping it would have meant
flattening payback until thirty new rungs were one blurred purchase.

It was also never the check that would have caught the bug it was written for. That bug produced a
payback **step** of ×3,120 between adjacent rungs. The step is what is bounded now — and the
absolute question is asked properly instead, against a multiplier computed from the real code
rather than assumed: rung 48's thirteen-year raw payback is 118 seconds for a player who has
actually got there.

A guard that has to be deleted to ship is worth reading twice: sometimes it is protecting
something, and sometimes it is a proxy that outlived its range.

---

## What is still open

Ranked by what a player would notice.

### Closed by v4

- ~~**Gear is the only system with a real tradeoff, and it collapses late.**~~ Six sets of six
  with 2-piece and 4-piece bonuses, measured against best-in-slot rather than eyeballed. Two of
  the six remain undistinguished for reasons `docs/BALANCE.md` states plainly.
- ~~**No cloud save.**~~ Opt-in, off by default, an opaque device id and no personal data. The
  game boots, plays, saves and exports exactly as before with the Worker down, unreachable, or
  never configured — checked by pulling its plug.

### Still open

1. **The seven unbuilt events.** `docs/EVENTS.md` designs ten; three are live. The content pack
   makes the *scheduling* of them a JSON edit, but the mechanics still need code. This is the
   oldest item on the list and the one a returning player would notice first.
2. **Seventy-one enemies share fourteen silhouettes.** Palette-swapping is the pipeline's whole
   premise and it earns its keep — but five variants per shape is where the seams show across
   eighteen terrains. Phase H proved the point again in the other direction: ten families of three
   drawings now cover forty-eight generators, and the pond stopped looking repetitive the moment
   the shapes stopped repeating.
3. **The pond's sprite sizes quantise badly on a phone.** Sprites blit at whole-number scales and
   `fitScale` measures the CSS box rather than the backing store, so a 320px screen gets two
   distinct sizes where a desktop gets five — and a retina screen does not help, it just draws the
   same two more sharply. Taking the scale from the backing store would give phones the full range
   for free, but it moves every sprite in the scene and wanted its own change.
4. **The admin panel writes to one browser.** Edits live in `localStorage` until somebody exports
   the JSON and commits it. The Worker added in v4 stores saves and scores and deliberately does
   not store content: a pack that could be edited remotely is a pack that can be broken remotely,
   and the static-file promise is worth more than the convenience.
5. **Two admins still cannot collaborate**, for the same reason, and an unexported pack can be
   lost by clearing site data.
