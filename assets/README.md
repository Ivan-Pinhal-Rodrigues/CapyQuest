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

Added in the PWA phase. The web app manifest needs real raster icons for the
installed-app tile, and there is no way around that one.

## Adding something here

Keep it small, keep it few, and say why in the commit. The claim in the README
is that all *character art* is text and the only binaries are event backdrops
and app icons — a third category means that claim needs rewriting rather than
quietly stretching.
