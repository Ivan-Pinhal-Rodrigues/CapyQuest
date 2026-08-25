# Balance

Every number here was measured, not asserted. The probes live in
`tests/balance.test.js`, `tests/stages.test.js` and `tests/achievements.test.js`, so if a
constant moves and this document stops being true, the suite says so.

Where a figure below is a target rather than an observation it is labelled as one.

---

## The generator ladder

Eighteen generators. Cost climbs on a steady slope and payback lengthens down the list, so a
later generator is a bigger commitment rather than a strictly better deal.

| | |
|---|---|
| Cost step, generator to generator | **×13–16** (the opening step is ×6.7, deliberately) |
| Rate step | ×5.5–7.5 |
| Payback, first generator | 150s |
| Payback, last generator | **181 days** — a goal bought across rebirths |
| Cost of 100 of everything | 1.09e27 |

`COST_GROWTH = 1.15` per unit owned, the classic idle curve.

The Lily Pad repays in 150s against the Yuzu Sapling's 100s — the only inversion in the table,
and it is deliberate. The first purchase is a tutorial rather than a deal, and the second one
being visibly better is what teaches that generators improve.

### The bug this section exists because of

Until the design audit, the last six generators cost this:

| | Cost step | Payback |
|---|---|---|
| skyTerrace | ×12,143 | 12.5 years |
| timeOnsen | ×12,381 | 39,000 years |
| astralPond | ×11,923 | 65 million years |
| capySingularity | ×169 | 45 billion years |

A third of the core loop was unreachable. The exponents stepped e15 → e18 → e21 → e24 → e27 →
e30 while the mantissas never scaled down — six digit-count typos in a row.

It survived six phases and 434 tests because `tests/content.test.js` asserted only that costs
*increase*, which they did, and because the Phase 6 balance pass measured the combat wall and the
achievement ceiling and never added up the cost column. Three tests now cover this table: the
slope stays in ×8–20, no single step exceeds twice the median step, and every generator repays
inside a year. All three fail if the old values are put back.

## The difficulty curve

```
enemyHp(stage, level)  = 25 · 2.2^stage  · 1.015^level
enemyAtk(stage, level) = 4  · 1.75^stage · 1.012^level
boss                   = ×10 hp, ×1.8 atk, on level 9 of every stage
```

| | |
|---|---|
| Across a stage's ten levels | **×1.14** — a gentle ramp |
| Crossing into the next stage | **×2.2** — the jump you feel |
| A boss against the level before it | **×10** |

That ratio is the design: the *stage* is the wall, not the level. Ten levels of a stage
should feel like the same fight getting slightly harder, and the boundary should feel like
somewhere new.

## What attention is worth

Combat can be played or watched. Measured as damage dealt over a three-minute window against a
dummy that cannot die — so respawn timing and kill rounding cannot distort it:

| How you play | Damage |
|---|---|
| Pure idle — auto-cast, never brace | baseline |
| Manual casting only | **+1%** |
| Bracing only | **+28%** |
| Full attention | **+29%** |

Two things that table has to say at once. An idler is at a Focus of exactly zero, which is a
multiplier of exactly 1.0 — **identical to the damage combat did before any of this existed**, so
nobody was nerfed into paying attention. And manual casting on its own is worth +1%, i.e. nothing,
which is deliberate: casting by hand is for *choosing* a skill against a warded boss, not for
out-clicking the autocaster.

### The design this replaced, and why

The first version had skills *spend* the Focus meter for a bonus on that cast. It reads well: hold
a ready skill, wait for a full meter, hit harder. Measured against idling, that clever play came
out **26% worse**, because a skill sitting unused on cooldown costs more throughput than any
per-cast bonus returns.

The lesson generalises: any design where the skilful option is *wait* loses to *act on cooldown*.
Focus is now a straight multiplier that is never consumed, so casting the instant a skill is ready
is always correct and attention never competes with throughput.

A second measurement killed a second piece of it. Focus used to also trickle in from ordinary
landed hits, "so an idler is never at a flat zero" — at 1.2 per hit against a decay of 3.5 per
second, it never once got the meter off the floor. A mechanic that cannot move the number it feeds
is dead code with a kind comment on it. Bracing is now the only source.

| | |
|---|---|
| Heavy attack, every | 4th enemy swing (a boss's 2nd, then every 4th) |
| Telegraph window | 0.8s |
| Heavy damage | ×2.5, or ×1.25 braced |
| Focus per brace | 34 of 100 |
| Focus decay | 4/second |
| Damage at a full meter | ×1.4 |

Bosses start their swing counter part-wound so their second swing telegraphs. Ordinary enemies die
in a handful of seconds and a first heavy on swing four often never arrives — which would mean the
player first meets bracing under boss pressure.

## The rebirth wall

Rebirth unlocks when the current stage's boss cannot be killed inside `WALL_SECONDS = 30`,
not at a currency threshold. A simulated player who clears every level and wears the best
gear the depth has plausibly dropped hits that wall at:

| Kit | First wall |
|---|---|
| Fresh, 1★ | **stage 7** |
| Refined, 3★ | stage 7 |
| Maxed, 5★ | stage 7 |

The plan's target band was 8–11 and the honest answer is 7. Stars do move the number — the
stage-7 boss goes from 44s at 1★ to 32s at 5★ — they just do not move it the last two
seconds. `tests/stages.test.js` asserts the band 5–13 rather than the aspiration, because a
test that asserts what you wanted rather than what happens is not a test.

### The sawtooth, which is real and is not a bug

Boss time-to-kill for a normally-equipped player, stages 1–11:

```
13s  12s  25s  23s  25s  21s  44s  19s  25s  30s  49s
                              ^^^ walled      ^^^ walled
```

Difficulty climbs, but it oscillates by up to ×2.3 between adjacent stages. The cause is
structural: `tierCeiling(stage) = floor(stage / 2)`, so gear unlocks a rung every *two*
stages while boss HP grows every stage. The player falls behind for one stage, catches up
at the step, and falls behind again.

This is left in deliberately. Smoothing it means stepping the rung every stage, which
doubles how fast the ladder is consumed and tops it out at stage 19 instead of 38 — trading
a bumpy curve for a shorter one. The bump is also what makes the wall legible: being stuck
at stage 7 and fine at stage 8 is exactly the shape that makes "you are stuck, rebirth" a
true statement rather than a nag.

### Where gear stops

`tierCeiling` reaches `MAX_TIER = 19` at **stage 38**. Past that, gear grows only through
stars and the forge, both capped. Everything after stage 38 is carried by the rebirth tree,
and that is the intended handover — the ladder is a mid-game system, the tree is the long
one.

## Rebirth payout

```
essence = floor(12 · deepestStage^1.45 · gainMult)
```

| Deepest stage | 1 | 5 | 10 | 20 | 50 | 100 | 500 |
|---|---|---|---|---|---|---|---|
| Essence | 12 | 123 | 338 | 924 | 3,488 | 9,531 | 98,330 |

Paying off depth rather than currency means the reset rewards the thing that actually
walled you. The curve is sub-linear per stage and super-linear overall, so going two stages
deeper is always worth more than going one, but never enough to make a single deep run
replace several shallow ones.

## The rarity ladder

`RARITY_MULT = 1.45` per rung, twenty rungs, `STAR_STEP` per star, forge +0 → +15.

1.45 is not the 1.55 the plan proposed. At 1.55 the first wall collapsed from stage 7 to
stage 3, because gear outran the HP curve early and then hit the ceiling long before the
tree could take over. The slope was chosen by sweeping `(RARITY_MULT, BASE_BUDGET)` against
the wall position, and it is not a free parameter.

## The leaf economy

| | |
|---|---|
| Daily grant | **80 leafs** |
| Reed Case | **100 leafs** |
| Ratio | **80%** — deliberately *nearly* enough for one case |

That 80% is the whole design of the daily. Enough to feel like progress, not enough to
close the loop, and never framed as a countdown to a purchase.

| Case | Cost | Floor rung | Pity |
|---|---|---|---|
| Reed | 100 🍃 | 1 | 20 |
| Onsen | 320 🍃 | 4 | 15 |
| Astral | 900 🍃 | 9 | 10 |

Every case prints its full drop table and its live pity counter on the card, generated from
the same weights the roll uses — there is no second table for display.

## The season pass

The premium track costs **1,200 leafs** (or a decorative `£8.99` that charges nothing) and
pays back **990 leafs** across its hundred levels — **83% of its own price**. A pass that
funds its own renewal is a treadmill; this one does not, and the shortfall is the point.

The free track pays every level, pays 450 leafs of its own, and hands out two cosmetics
nobody spends anything for. Nothing on the free track is gated behind the premium one.

## Achievements

232 entries. Payouts sit on four fixed bands — `SMALL` +0.5%, `STEP` +2%, `BIG` +4%,
`CAPSTONE` +9% — rather than on hand-picked numbers.

| | |
|---|---|
| Full clear, global multiplier | **×68** |
| Full clear, idle income | **×184** |
| The original 71, for comparison | ×38 |

The bands exist because the obvious approach fails at scale. Each entry carrying a
hand-picked +2% to +25% reads fine one line at a time; at 232 entries those same values
compound to **×8,854,758**, which would have made every other system in the game
decorative. Two hundred small things multiplied together is not a small thing.

`tests/achievements.test.js` holds the ceiling at ×100 and holds the rule that a later rung
of a ladder never pays less than an earlier one — not hypothetical, since banding a table
that already contained hand-picked values inverted four ladders on the first attempt.

## The offline cache

| | |
|---|---|
| Base rate | **60%** of live income |
| Base capacity | **12 hours** |
| Raised by | generators, the tree, boosts, achievements — all through `offlineRate` and `offlineCapHours` |

The tank banks *zen*, at the rate in force when it accrued. Leaving it uncollected across a
rebirth or a fresh multiplier therefore cannot pay more than collecting it would have;
sitting on it is a choice about when, never a way to earn more.

Zen does not survive a rebirth and neither does the tank — but the contents are banked into
the lifetime totals first, so time spent away still counted for something.

## Float ceiling

`VALUE_CEILING = 1e300` guards every accumulating value. float64 tops out near 1.8e308, and
an idle game that runs long enough will find that edge; hitting `Infinity` once poisons
every formula downstream and the symptom surfaces somewhere unrelated.
