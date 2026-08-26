# Postmortem

CapyQuest was built in thirteen phases. Six of them built the game; the seventh was a design
audit of the finished thing, and the six after it were the audit's findings.

This is the record of what that audit found, what it cost, and what actually caught the bugs. It
is written down because the pattern in it is more useful than any individual fix: **every system
passed its tests, and several of them were wrong anyway.**

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

| | End of phase 6 | Now |
|---|---|---|
| Tests | 434 | 536 |
| Lines (excluding tests) | ~19,300 | ~22,400 |
| Tabs | 12 | 8 |
| Time to combat | 7m 12s | 3m 17s |
| `domcontentloaded` | 12,656ms | **294ms** |
| Achievements | 232 | 232 |
| Binary assets | 0 | 0 |

The load time was the last thing the audit found and the cheapest thing it fixed: the Google
Fonts stylesheet was render-blocking, so a font CDN that is slow, blocked or down cost the entire
first paint. It loads asynchronously now. The game was always interactive in 19ms; nothing but
the `<link>` was in the way.

---

## If there were a phase 14

Ranked by what a player would notice.

1. **Gear is still the only system with a real tradeoff, and it collapses late.** Any piece can
   be carried to rung 20, so eventually there is one correct answer per slot. Set bonuses, or a
   rung ceiling per piece, would keep the decision alive.
2. **The seven unbuilt events.** `docs/EVENTS.md` designs ten; three are live.
3. **Seventy-one enemies share fourteen silhouettes.** Palette-swapping is the pipeline's whole
   premise and it earns its keep — but five variants per shape is where the seams start to show
   across eighteen terrains. More hand-drawn shapes is the cheapest variety in the project.
4. **No cloud save.** Export codes work and are honest about being the only option, but a lost
   browser profile is a lost save.
