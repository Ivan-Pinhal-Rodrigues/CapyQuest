# Story

A pond has gone cold. The water stopped somewhere upstream and nobody can say when. You
rebuild the onsen, travel down through the terrains, and find out what happened at the Still
Point.

Twenty-eight beats across three acts, spoken by five capybaras. The content lives in
`src/data/story.js` and `src/data/npcs.js`; when each one fires lives in
`src/systems/story.js`.

---

## How it is told

A beat is three or four lines in a bar over the stage, not a modal. Stopping an idle game to
talk at the player is how a story gets skipped, so the game keeps running underneath and the
bar advances on a click.

Three rules the implementation is built on:

- **A beat fires once, ever.** Terrain and rebirth beats key off the deepest point you have
  ever reached, so walking back up and down again cannot replay one.
- **`dueBeats()` only reads.** A beat that could not be shown this tick — a modal is up, the
  cutscene is playing — is not marked seen, so it comes round again rather than being
  silently burned.
- **No reset can take it.** `story` and `profile` are on the explicit keep-list in both
  `rebirth()` and `ascend()`. Sitting through the opening again after a reset is not a cost
  anyone agreed to, and your own name is yours.

There is a skip toggle in settings for people who would rather not. Turning it on forfeits
one secret achievement, which is the only consequence.

Almost every beat above is resolved by a poll — `dueBeats()` checks the state against a
threshold each tick, which is fine for "have you ever owned a generator" but wrong for "the
instant this specific fight starts": a boss fight can resolve, especially in auto-battle, on
the same tick a poll would have fired, so the beat either lands too late or gets skipped
outright. The eight boss cutscenes below are resolved differently — `dueCombatBeat()` reads a
single `Combat` event (`engage` or `cleared`) the moment `main.js`'s `tickCombat()` sees it,
keyed by the boss's own id in `BOSS_INTRO_BEATS`/`BOSS_DEFEAT_BEATS` rather than a threshold.
Same bar, same one-beat-once-ever rule, same skip toggle — just a different trigger.

## Who talks

| | Who | What they are for |
|---|---|---|
| **Yuzu-baa** | The elder | Opens the game, names the problem, and is the only one who ever sounds certain |
| **Kettle** | Bathhouse keeper | The practical one — generators, upgrades, what things are for |
| **Pip** | Young and loud | Fights, bosses, and enthusiasm about both |
| **The Quiet One** | Turns up when you begin again | The wall, every rebirth, and the Still Point |
| **Merchant Tanuki** | Sells things | The store, and cheerfully unbothered about it |

Each is the same 32×32 capybara grid under a different palette — five palettes in
`src/render/palettes.js`, no new art.

## The beats

### Act 1 — The Cold Pond
> Something upstream stopped, and nobody can say when.

| Beat | Who | Fires on |
|---|---|---|
| `wake` | Yuzu-baa | Your first tap |
| `firstGenerator` | Kettle | Owning any generator |
| `firstUpgrade` | Kettle | Buying any upgrade |
| `questOpen` | Yuzu-baa | Combat unlocking |
| `firstFight` | Pip | Your first clear |
| `firstBoss` | Pip | Your first boss |
| `firstCapybara` | Yuzu-baa | Fighting another capybara |

### Act 2 — Downstream
> The terrains get stranger the further you go, and so do their capybaras.

| Beat | Who | Fires on |
|---|---|---|
| `terrain2` | Pip | Reaching stage 2 |
| `beforeBoilerBeast` | Pip | Engaging the Boiler Beast, stage 2's boss |
| `afterBoilerBeast` | Kettle | Beating the Boiler Beast |
| `terrain4` | Kettle | Reaching stage 4 |
| `beforeRiverElder` | Yuzu-baa | Engaging the River Elder, stage 4's boss |
| `afterRiverElder` | Pip | Beating the River Elder |
| `firstDrop` | Merchant Tanuki | Your first piece of gear |
| `firstCase` | Merchant Tanuki | Opening any case |
| `firstStar` | Kettle | Refining to two stars |
| `firstFuse` | Kettle | Your first fuse |
| `terrain7` | Yuzu-baa | Reaching stage 7 |
| `beforeGeodeTitan` | Kettle | Engaging the Geode Titan, stage 7's boss |
| `afterGeodeTitan` | Yuzu-baa | Beating the Geode Titan |

### Act 3 — The Still Point
> Whatever stopped the water is down there, and it is not water.

| Beat | Who | Fires on |
|---|---|---|
| `wall` | The Quiet One | The thirty-second boss wall being detected |
| `rebirth1` | The Quiet One | Your first rebirth |
| `rebirth3` | The Quiet One | Your third |
| `rebirth10` | The Quiet One | Your tenth |
| `terrain12` | Yuzu-baa | Reaching stage 12 |
| `beforeEmberJudge` | The Quiet One | Engaging the Ember Judge, stage 12's boss |
| `afterEmberJudge` | The Quiet One | Beating the Ember Judge |
| `ascendTease` | The Quiet One | 1,000 lifetime Essence |

Act 3 is where the beats stop keying off "you did a thing for the first time" and start
keying off having been stuck — which is the point at which the game is about starting again
rather than about getting further.

## The opening

Six frames: a pixel backdrop drawn from the same character grids as everything else, one or
two lines of text, and Skip focused first so nobody has to hunt for it. It renders above the
modal layer, so the day-one login prompt queues behind it rather than landing on frame one.

After it, six coach marks point at the real UI as each system unlocks — tap the capybara,
your first generator, upgrades, quests, the kit, rebirth. Each is gated on a `when(state)`
predicate, so they arrive when the thing exists rather than on a script. A coach mark that
would be stranded behind a modal closes *without* being marked seen, so it returns.

## Profiles

Guest by default, with a generated capybara name. You can change it, pick an avatar and a
title from cosmetics you own, and re-read any beat from the log. No account, no server: the
save is local and moves between devices as an export code.

## The seven unbuilt events

`docs/EVENTS.md` designs ten events; three are live. The remaining seven are marked plainly
as designs there rather than being hinted at in the story, so nothing in these twenty beats
depends on content that does not exist.
