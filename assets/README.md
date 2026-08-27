# assets/

Everything else in this repository is text. Sprites are character grids, sound
is synthesised, and the boot screen's backdrops are 16×16 tiles in
`src/render/backdrops.js`. That is deliberate: content that reviews as a picture
cannot be reviewed at all, and a photographic backdrop behind a 32×32 capybara
looks like two games stapled together.

This folder is the exception, for the two things that genuinely have to be
binary.

## `assets/events/` — event backdrops

An event's `background` is painted behind the capybara on the loading screen.
It accepts either:

- **the id of a procedural backdrop** — `petals`, `steam`, `embers`, `citrus`,
  `stars`, `reeds`, `ripples`, `snow`, `rift`. This is what every shipped event
  uses, and what you should reach for first.
- **a path to an image**, relative to the site root, which is what this folder
  is for: `assets/events/my-event.png`. An absolute URL or a data URI works too.

```json
"events": {
  "patch": {
    "steamFestival": { "background": "assets/events/steam-festival.png" }
  }
}
```

The image is loaded before it is applied, so a path that 404s leaves the plain
background rather than flashing a broken image. It is drawn at 35% opacity with
a slight blur behind the text — a busy picture will still read as texture, but
do not put anything in it you need people to be able to see.

Anything wide and dark works best. 1280×720 is plenty; the boot screen covers
the viewport and centres it.

## `assets/icons/` — app icons

The manifest needs real raster icons for the installed-app tile, and iOS needs
an `apple-touch-icon` on top of that. There is no way around either: a home
screen icon cannot be a character grid, and iOS will not take an SVG.

| File | Used by |
|---|---|
| `icon-192.png` | the manifest, `purpose: any` |
| `icon-512.png` | the manifest, `purpose: any` — splash screens and app listings |
| `icon-maskable-512.png` | the manifest, `purpose: maskable` — Android crops this to its own shape |
| `apple-touch-icon.png` | iOS Add to Home Screen, 180×180, referenced from `index.html` |

They are **generated from the game's own `CAPY` grid and `CAPY_SKINS.classic`
palette**, not drawn separately, so the icon cannot drift from the capybara. The
maskable one keeps everything inside the middle 56% — Android may crop to a
circle inscribed in the middle 80%, and a capybara with its ears cut off is
worse than a smaller capybara — and is the only one not pre-rounded, because the
platform applies its own shape and a rounded icon shows its corners inside the
mask.

`tests/pwa.test.js` reads each PNG's IHDR chunk and fails if a file is missing
or is not the size the manifest claims.

## Adding something here

Keep it small, keep it few, and say why in the commit. The claim in the README
is that all *character art* is text and the only binaries are event backdrops
and app icons — a third category means that claim needs rewriting rather than
quietly stretching.
