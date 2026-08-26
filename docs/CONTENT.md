# Content packs

Everything in CapyQuest that is *content* rather than *mechanism* — what the shop sells, what a
boost costs, which looks exist, which events run and when, what a pass level pays — is now a
catalogue that can be changed without touching a line of code.

The tables in `src/data/` are the **defaults**. A JSON file, `content/pack.json`, is a patch over
them. Commit the file and every player has the change on their next load.

---

## The short version

1. Open the game with `?admin=1`.
2. Change what you want. It applies to the running game immediately, so you can look at it.
3. Press **Export…**, copy the JSON over `content/pack.json`, commit, push.

Until step 3 the change exists only in your own browser, in `localStorage` under
`capyquest:content:draft`. The panel says so, on screen, the whole time.

## What "admin" means here

There is no backend, so it cannot mean an account with a role. It means **whoever can commit the
file**. `?admin=1` is not a password and is not treated as one — anyone who finds it gets a shop
editor whose changes stop at their own browser.

That is safe because of what the panel is not allowed to do:

- It edits the **catalogue**, never a save. It cannot grant a leaf, a look, a level or a ticket.
- It cannot take a look out of a wardrobe. Removing a cosmetic removes it from the shop and from
  the collection screens; anyone who already owned it still owns it and can still wear it.
- Nothing it writes affects the simulation. Cosmetics are powerless by construction and a test
  wears every one of them and asserts that no number moves.

## The order things load in

```
built-in tables  →  content/pack.json  →  your local draft
```

Later wins, one field at a time. `src/content/load.js` fetches and merges; `src/content/registry.js`
holds the result and is what every system reads.

If the fetch fails — offline, a 404, a host answering with an HTML error page — the game boots on
the built-in tables and says so in the console. **A missing or broken pack can never stop the game
starting.** That is the single most important property of this whole system, and
`tests/pack.test.js` throws a lot of garbage at it to keep it true.

---

## The format

Five sections. Four are catalogues taking the same three operations; the fifth is the pass.

```json
{
  "version": 1,
  "cosmetics": { "add": [], "patch": {}, "remove": [] },
  "boosts":    { "add": [], "patch": {}, "remove": [] },
  "leafPacks": { "add": [], "patch": {}, "remove": [] },
  "events":    { "add": [], "patch": {}, "remove": [] },
  "pass":      { "free": {}, "premium": {} }
}
```

| Operation | What it does |
|---|---|
| `add` | New entries, appended. An `add` whose id already exists is treated as a `patch`, so a pack can never produce two entries with one id. |
| `patch` | Keyed by id; merges the fields you name over the entry, leaving the rest. |
| `remove` | Deletes entries from the catalogue by id. |

Keys beginning with `_` are ignored everywhere, which is how `content/pack.json` carries its own
instructions in a format that has no comments.

### `hidden` — almost always what you want

`"hidden": true` takes something off the shelf: it stops being sold, stops being listed, and
stays wearable for everyone who owns it. `remove` takes it out of the catalogue entirely.

Prefer `hidden`. It is reversible, it does not disturb anyone's collection count, and the admin
panel can still find the entry to un-hide it.

### Cosmetics

Keyed `kind:id`. Six kinds: `skin`, `pond`, `title`, `hat`, `outfit`, `accessory`.

```json
{ "kind": "title", "id": "earlyBird", "name": "Early Bird",
  "source": "store", "cost": 200, "blurb": "Up before the steam." }
```

| Field | Notes |
|---|---|
| `kind` | One of the kinds in `src/data/cosmetics.js`. An unknown kind is refused. |
| `source` | `start`, `play`, `store`, `pass` or `event`. Decides how it is come by. |
| `cost` | Required for `source: "store"`, in leafs. |
| `need` | For `source: "play"` — the counters in `systems/cosmetics.js` → `progressFor`. |

A `skin` names a palette in `src/render/palettes.js`. **Adding a skin whose palette does not exist
is refused with a warning**, because the alternative is a look that silently draws as the default
and nothing saying why.

A `hat`, `outfit` or `accessory` needs a grid in `src/render/wearables.js` — `WEARABLE_ART`, keyed
the same `kind:id` way. A pack can reprice or hide one of those, and can add one whose art already
exists, but it cannot draw new art: grids are code. Adding one with no art gets you a card that
does nothing when worn, which `tests/wearables.test.js` refuses for the shipped catalogue and
cannot catch in a pack.

### Boosts and leaf packs

```json
"boosts":    { "patch": { "frenzy": { "cost": 40, "hours": 2 } } },
"leafPacks": { "patch": { "pondful": { "hidden": true } } }
```

Leaf packs carry price tags and **take no money, ever**. `systems/store.js` holds the whole of what
that means; a pack can change the number on the tag and changes nothing about that fact.

### Events

An event can run one of two ways.

**In the season rotation** (the default): three windows at fixed days of every season, filled by
whichever live events exist, rotating with the season index. Nothing to configure — set
`"live": true` and it joins the rotation.

**On the clock**: give it `startsAt` and `endsAt` and it runs between exactly those two moments,
and takes precedence over the rotation.

```json
"events": {
  "patch": {
    "steamFestival": {
      "live": true,
      "startsAt": "2026-09-01T00:00:00Z",
      "endsAt":   "2026-09-10T23:59:00Z"
    }
  }
}
```

Both dates or neither — **an event that starts and never stops is refused**, because petals expire
with their event and an event that never closes is a currency that never expires. Dates may be
ISO strings or millisecond numbers. If two dated events overlap, the one closing soonest runs.

Clearing both dates puts the event back in the rotation.

#### An event's loading screen

An event also carries a `background`, painted behind the capybara on the boot screen for as long
as the event is live. It takes either the id of one of the nine backdrops drawn in
`src/render/backdrops.js` —

`petals` · `steam` · `embers` · `citrus` · `stars` · `reeds` · `ripples` · `snow` · `rift`

— or a path to a picture you have put in `assets/events/`:

```json
"events": { "patch": { "steamFestival": { "background": "assets/events/steam-festival.png" } } }
```

An absolute URL or a data URI works too. The image is loaded before it is applied, so a path that
404s leaves the plain background rather than flashing a broken image, and a `background` that is
neither a known id nor a loadable file costs you the decoration and nothing else.

It is drawn at 35% opacity under a slight blur, behind the title and the status line — treat it
as texture, not as a poster. `assets/README.md` has the sizing.

### Pass levels

The hundred levels of each track are generated from the level number (`src/data/pass.js`). An
override replaces exactly one level of one track:

```json
"pass": { "premium": { "50": { "leafs": 300, "text": "300 leafs" } } }
```

A reward may pay `leafs`, `tickets`, `shards`, `zen`, `zenMult`, `essence`, `lotus`, or a
`cosmetic` written `"kind:id"`. **A reward that pays nothing is refused** — the free track promises
that every level pays something, and an override is not allowed to quietly break that.

---

## What happens to a bad pack

Nothing dramatic, which is the point.

- Malformed entries are **dropped one at a time**, not in a batch — three bad rows out of forty
  costs you three rows.
- Each drop produces a warning naming its path (`cosmetics.add[2]: unknown kind "hatt"`). The
  warnings go to the console and to the top of the admin panel.
- A section that is not an object, a pack that is not an object, a file that is not JSON: ignored,
  defaults applied, game runs.
- A pack cannot introduce a field nobody validates. Only known fields are copied through, so
  writing `"clickMult": 1000` onto a cosmetic does exactly nothing.

## Where the code is

| File | What it does |
|---|---|
| `src/content/schema.js` | Validates and normalises a pack. Never throws. |
| `src/content/registry.js` | Holds defaults + pack, and is what the systems read. Pure — no fetch, no storage. |
| `src/content/load.js` | Fetches the file, reads the draft, merges the two. The only part that touches the browser. |
| `src/ui/adminPanel.js` | The editor. |
| `src/render/backdrops.js` | The nine drawn loading-screen backdrops. |
| `src/ui/bootScreen.js` | The loading screen that paints them. |
| `tests/pack.test.js` | The merge rules, the refusals, and the garbage. |
| `tests/boot.test.js` | That every event names a backdrop something can draw. |
