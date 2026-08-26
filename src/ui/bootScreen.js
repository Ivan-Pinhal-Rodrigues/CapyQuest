// The boot screen.
//
// The overlay itself is inline in index.html and paints before any stylesheet
// or module has arrived — a loading screen that waits on a download is not a
// loading screen. This file takes it over once modules load: it replaces the
// CSS bob with a capybara that actually plays in the water, drives the bar off
// real progress rather than a guess, and paints whatever backdrop the running
// event asks for.
//
// The game is interactive in about 20ms and the content pack fetch is the only
// thing that reliably takes any time at all, so on a warm cache this screen is
// visible for a few frames. That is fine and is the point: it exists for the
// cold load, the slow connection and the update — not to pad the opening.
//
// Two rules it follows:
//
//   NEVER BLOCK THE GAME. Every method is safe to call when the overlay has
//   already gone, when the canvas is missing, or when an event names a backdrop
//   that 404s. Nothing here may be the reason the game does not start.
//
//   TELL THE TRUTH. The bar is tied to steps that actually happened. A fake
//   progress bar that always takes two seconds is a worse lie than no bar.

import { CAPY, EYES, EYE_OVERLAY_ORIGIN, YUZU } from '../render/sprites.js';
import { CAPY_SKINS, PROP_PALETTE } from '../render/palettes.js';
import { bake, bakeLayered, blit, blitSquash } from '../render/canvas.js';
import { ParticleField } from '../render/particles.js';
import { BACKDROPS, backdropFor } from '../render/backdrops.js';

/** The steps, in order, with how far along each one leaves the bar. */
export const BOOT_STEPS = {
  content: { at: 0.3, text: 'Reading the notice board…' },
  save: { at: 0.55, text: 'Finding your pond…' },
  game: { at: 0.85, text: 'Waking the capybara…' },
  ready: { at: 1, text: 'In you get.' },
  // Phase 20 uses this one when the service worker has a newer build waiting.
  updating: { at: 0.5, text: 'Updating…' },
};

export class BootScreen {
  constructor(doc = document) {
    this.root = doc.getElementById('boot');
    this.fill = doc.getElementById('bootFill');
    this.status = doc.getElementById('bootStatus');
    this.bg = doc.getElementById('bootBg');
    this.canvas = doc.getElementById('bootCanvas');
    this.ctx = this.canvas?.getContext('2d') || null;

    this.time = 0;
    this.splash = 0;
    this.nextSplashAt = 0.8;
    this.particles = new ParticleField();
    this.raf = null;
    this.done = false;

    this.reducedMotion = Boolean(
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );

    if (this.ctx) this.start();
  }

  /** Move the bar and say what is happening. Unknown steps are ignored. */
  step(name) {
    const step = BOOT_STEPS[name];
    if (!step || this.done) return;
    if (this.fill) this.fill.style.width = `${Math.round(step.at * 100)}%`;
    if (this.status) this.status.textContent = step.text;
  }

  /**
   * Paint the event's backdrop behind the capybara.
   *
   * `background` is whatever the content pack put on the event: a path into
   * assets/, an absolute URL, a data URI, or the id of one of the procedural
   * backdrops in render/backdrops.js. Anything unrecognised leaves the plain
   * colour, which is a perfectly good loading screen.
   */
  setBackground(background) {
    if (!this.bg || !background) return;

    const procedural = BACKDROPS[background];
    if (procedural) {
      this.bg.style.backgroundImage = `url("${backdropFor(background)}")`;
      // A 16-wide pixel pattern stretched to cover would be a smear; tiled at
      // a fixed size it reads as texture.
      this.bg.style.backgroundSize = '96px 96px';
      this.bg.style.backgroundRepeat = 'repeat';
      this.bg.style.imageRendering = 'pixelated';
      return;
    }

    // An image an admin dropped in. Loaded through an Image first so a 404
    // leaves the plain background rather than a broken-image flash.
    const img = new Image();
    img.onload = () => {
      if (this.done || !this.bg) return;
      this.bg.style.backgroundImage = `url("${background}")`;
    };
    img.onerror = () => {
      console.warn(`[capyquest] boot backdrop "${background}" could not be loaded`);
    };
    img.src = background;
  }

  start() {
    let last = performance.now();
    const frame = (now) => {
      if (this.done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  update(dt) {
    this.time += dt;
    this.splash = Math.max(0, this.splash - dt * 3.2);

    // Plays on its own, at a rhythm rather than a metronome — the splashes are
    // the whole reason this is a canvas rather than a CSS animation.
    if (!this.reducedMotion && this.time > this.nextSplashAt) {
      this.splash = 1;
      this.nextSplashAt = this.time + 1.1 + Math.random() * 1.4;
      this.particles.burst(48, 46, {
        count: 9,
        colors: ['#7fd0e6', '#c9f2ff', '#fdf6e8'],
        speed: 70,
        life: 0.6,
        size: 2,
        gravity: 200,
      });
    }

    this.particles.update(dt);
  }

  draw() {
    const { ctx, canvas } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = 2;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 2;

    // Blinks on its own clock, like the one in the pond does.
    const mood = !this.reducedMotion && (this.time % 4.4) < 0.16 ? 'blink' : 'happy';
    const baked = bakeLayered(
      CAPY,
      [{ sprite: EYES[mood], origin: EYE_OVERLAY_ORIGIN }],
      CAPY_SKINS.classic,
      `boot:${mood}`,
    );

    const bob = this.reducedMotion ? 0 : Math.sin(this.time * 2.1) * 1.6;
    const squashX = 1 + this.splash * 0.1;
    const squashY = 1 - this.splash * 0.12;
    blitSquash(ctx, baked, cx, cy + bob, scale, squashX, squashY);

    // Two yuzu, bobbing out of phase, because one looks like a mistake.
    const yuzu = bake(YUZU, PROP_PALETTE, 'boot:yuzu');
    for (const [i, offset] of [-22, 22].entries()) {
      const y = this.reducedMotion ? 0 : Math.sin(this.time * 1.3 + i * 2) * 2;
      blit(ctx, yuzu, cx + offset, cy + 16 + y, 2);
    }

    this.particles.draw(ctx);
  }

  /**
   * Fade out and stop drawing.
   *
   * Removed from the DOM after the fade rather than left transparent on top of
   * the game — an invisible full-screen div still swallows the first tap, and a
   * clicker whose first tap does nothing is a bad first impression.
   */
  finish() {
    if (this.done) return;
    // The last step goes in BEFORE `done` is set. step() refuses to write once
    // the screen is finished — which is right, so a late callback cannot
    // scribble on a fading overlay — but setting the flag first meant the flag
    // swallowed the one call that matters. The bar never reached the end and
    // the screen faded out mid-sentence, which looks like a stall rather than a
    // finish.
    this.step('ready');
    this.done = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (!this.root) return;

    this.root.classList.add('is-done');
    setTimeout(() => this.root?.remove(), 500);
  }
}
