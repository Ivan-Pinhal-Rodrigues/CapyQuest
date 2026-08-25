# Events

Ten designs. **Three are built** and run in rotation today; the other seven are
written down here and marked plainly, so this file is a roadmap you can read
rather than one you have to infer from what is missing.

## How an event works

Three windows sit at fixed days of every 45-day season — **days 1–10, 16–25 and
31–40** — with a five-day gap between them. Which live event fills which window
rotates with the season index, so a season is not the same three in the same
order forever. The schedule is computed from the season, never stored: there is
no server to announce anything, so every device derives it identically.

The currency is **Petals** (🌸). Two rules give them their whole character:

- They are earned **only while an event is running** — 2 per clear, 25 per boss,
  doubled during Reed Rush.
- They are **gone when it closes.** Not converted, not banked. `syncEvent()`
  zeroes them on the clock rather than on a visit, so a player who closes the tab
  mid-event and returns a month later does not find a wallet full of a currency
  nothing accepts. The game says so when it happens.

A currency you can hoard forever is just a slower coin. The window closing is
the thing that makes an event an event.

Each live event has a four-row exchange: the same three staples at the same
prices across all of them — 90 leafs, 2,400 shards, 6 tickets — plus **one
cosmetic unique to that event**, buyable once, gone when the window shuts.

---

## Built

### 1. Yuzu Harvest 🍋
*The trees came in all at once. Everything downstream is dropping petals.*

The plain one, and the introduction to the mechanic: beat things, collect petals,
spend them before the trees are bare. Exclusive: **Harvest** skin — citrus all
the way through.

### 2. Moonlit Bathhouse 🌙
*The bathhouse opens at night for a fortnight and something in the water glows.*

Every terrain runs its night shift. Exclusive: **Bathhouse** pond — the whole
page goes to deep blue and pale moon-water.

### 3. Reed Rush 🏃
*Somebody started counting. Now everyone is running.*

Clears pay **double** petals, which tilts the event toward depth rather than
patience for ten days — the one event where pushing beats idling. Exclusive:
**Swift** title.

---

## Designed, not yet built

Each of these needs a system the game does not have yet; the note says which.

### 4. The Great Nap 😴
Offline income doubled for the window, and sleep cosmetics to match.
*Needs:* the offline cache meter from Phase 6, so the doubling is visible while
it accrues rather than only in the report.

### 5. Steam Festival 🔥
Ember enemies replace the usual roster across every terrain, and fire skins drop
from them.
*Needs:* an enemy-override hook in `systems/stages.js` — the terrain pools are
compounding and deterministic by design, so an event that rewrites them has to do
it without breaking "a depth is a place".

### 6. Crystal Tide 💠
A flood of shards; refines cost less and the forge runs hot.
*Needs:* a price-modifier hook in `systems/loot.js`. Refine odds stay untouched —
a discount is fine, better odds during a window is a trap.

### 7. Capybara Cup 🏆
A bracket against the rivals already on the board, run over three days.
*Needs:* combat that can resolve rival-vs-player from two stat blocks without a
live fight. The rivals already carry real loadouts, so most of the input exists.

### 8. The Long Winter ❄️
A survival ladder with no healing between floors — how deep can one health bar go.
*Needs:* a run mode that suspends the normal depth, and a separate best-run
record that a rebirth does not touch.

### 9. Founders' Week 🎂
The anniversary. Retro cosmetics, and the original pond palette as it shipped.
*Needs:* nothing but the date arithmetic and the art. This is the cheapest of the
seven and the most likely to land next.

### 10. The Still Point Rift 🌀
The endgame event, and the one that finally opens Ascension properly — the layer
currently marked "still being built" on its own panel.
*Needs:* the Ascension roadmap in `systems/ascension.js` closed out. This is
deliberately last: it is the payoff for the layer, not a patch over it.
