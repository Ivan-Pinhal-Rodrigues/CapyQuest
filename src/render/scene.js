// The onsen scene: capybara, water, bobbing yuzu, drifting steam, and the
// golden capybara when it shows up.

import { CAPY, EYES, EYE_OVERLAY_ORIGIN, YUZU, STEAM, GOLDEN_CAPY, ICONS } from './sprites.js';
import { BUILDING_ART, CAPY_SKINS, PROP_PALETTE } from './palettes.js';
import { bake, bakeLayered, blit, blitSquash, resizeCanvas, fitScale } from './canvas.js';
import { wornKey, wornLayers } from './wearables.js';
import { ParticleField } from './particles.js';

const YUZU_COUNT = 3;
const STEAM_COUNT = 5;

/** Draw order for the banks: the order they unlock in, cheapest first. */
const BUILDING_ORDER = Object.keys(BUILDING_ART);
/** No single generator may take over the pond, however many you own. */
const MAX_PER_BUILDING = 6;

/**
 * A small deterministic hash, so a building sits in the same spot every time.
 *
 * Math.random would scatter them freshly on every rebuild, and a pond that
 * rearranges itself whenever you buy something is a pond you cannot learn the
 * shape of. FNV-1a: short, no dependencies, and good enough to decorrelate
 * "lilypad:0" from "lilypad:1".
 */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = new ParticleField();

    this.time = 0;
    this.squash = 0; // 0..1, decays after each tap
    this.expression = 'open';
    this.expressionUntil = 0;
    this.blinkAt = 2 + Math.random() * 4;
    this.skin = 'classic';
    /** What is worn, as ids. `none` in a slot means bare. */
    this.worn = { hat: 'none', outfit: 'none', accessory: 'none' };
    this.reducedMotion = false;

    // Props get fixed random phases so they bob independently but repeatably.
    this.yuzu = Array.from({ length: YUZU_COUNT }, (_, i) => ({
      offset: (i - (YUZU_COUNT - 1) / 2) * 0.34,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.5,
    }));
    this.steam = Array.from({ length: STEAM_COUNT }, () => ({
      x: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.14,
      seed: Math.random(),
    }));

    /**
     * The party, in the water with you.
     *
     * Twenty-four companions existed for two versions and none of them was ever
     * visible — they were a list in a tab. Each carries its own bob phase and
     * blink timer so the three of them do not move as one object, which is what
     * makes a group of sprites read as a group of animals.
     */
    this.party = [];
    this.crewBoxes = [];

    /**
     * What you have built, standing around the pond.
     *
     * Eighteen generators, thirty-six tiers, three hundred and six purchasable
     * upgrades — and for three versions the pond looked exactly the same at
     * minute one and at hour fifty. The art was already there: BUILDING_ART has
     * a shape and a palette for every one of them, and this file already
     * imported it to draw the crew's lily pads. Nothing drew the buildings.
     *
     * An idle game is a place you tend. If tending it never changes the place,
     * the numbers are all there is.
     */
    this.buildings = [];
    this.buildingBoxes = [];

    this.golden = null; // { x, y, vx, vy, bornAt, ttl }
    // Both are recomputed in draw(); seeded here so a hitTest before the first
    // frame does not read undefined.
    this.capyBox = { x: 0, y: 0, r: 0 };
    this.goldenScale = 4;
  }

  setSkin(skin) {
    if (CAPY_SKINS[skin]) this.skin = skin;
  }

  /**
   * Who is in the water. Takes what gacha.partyMembers() returns, plus a `hat`
   * per member.
   */
  setParty(members = []) {
    const next = members.slice(0, 3);
    // Rebuilding the phases every frame would freeze the animation, so they are
    // only re-seeded when the party actually changes.
    const key = next.map((m) => `${m.id}:${m.skin}:${m.hat || 'none'}`).join(',');
    if (key === this.partyKey) return;
    this.partyKey = key;

    this.party = next.map((member, i) => ({
      ...member,
      phase: (i * 2.1) % (Math.PI * 2),
      speed: 1.3 + i * 0.19,
      blinkAt: 1 + i * 1.7 + Math.random() * 3,
      blinking: false,
    }));
  }

  /**
   * What you own, as `state.buildings` — `{ id: count }`.
   *
   * HOW MANY GET DRAWN. Not one per building: the late game owns thousands and
   * a pond with three thousand lily pads in it is not a pond. The count is
   * logarithmic — 1 gives one, 2 gives two, 4 gives three, 1024 gives eleven —
   * so early purchases visibly change the place and later ones keep adding
   * without ever flooding it. Capped per type as well, so no single generator
   * can take over.
   *
   * WHERE. Along the banks, left and right, ordered by the generator's own
   * index so the cheap things stay near the front and the expensive ones sit
   * further back. Positions come from a seeded hash of the id, not from
   * Math.random, so the pond looks the same every time you open it — a pond
   * that rearranges itself on every frame is a slot machine.
   */
  setBuildings(owned = {}) {
    // Rebuilding the layout every frame would make it crawl; only re-seed when
    // what is owned actually changes.
    const key = Object.entries(owned).filter(([, n]) => n > 0).map(([id, n]) => `${id}:${n}`).join(',');
    if (key === this.buildingsKey) return;
    this.buildingsKey = key;

    const placed = [];
    for (const [index, def] of BUILDING_ORDER.entries()) {
      const count = owned[def] || 0;
      if (count <= 0) continue;
      const many = Math.min(MAX_PER_BUILDING, 1 + Math.floor(Math.log2(count)));
      for (let i = 0; i < many; i++) {
        const seed = hash(`${def}:${i}`);
        placed.push({
          id: def,
          // Alternate banks so the two sides fill evenly rather than the whole
          // catalogue piling up on the left.
          side: (index + i) % 2 === 0 ? -1 : 1,
          // Where along the bank, as 0..1 across the band that is left once the
          // capybara has its clearance — NOT an absolute fraction of the
          // stage. The first draft used absolute fractions and then clamped
          // them outward past the capybara, which collapsed almost every one of
          // them onto the same x: the late-game pond rendered as two vertical
          // walls of sprites. The browser showed it immediately; the numbers
          // (nothing overlapping, nothing off-canvas) were perfectly happy.
          out: ((seed % 100) / 100) * 0.82 + (i % 3) * 0.06,
          up: -0.06 + (((seed >> 7) % 100) / 100) * 0.30,
          depth: index, // used for draw order and size
          phase: (seed % 628) / 100,
        });
      }
    }

    // Furthest-back first, so nearer things overlap them rather than the other
    // way round.
    placed.sort((a, b) => b.depth - a.depth);
    this.buildings = placed;
  }

  /** What the capybara has on. Unknown ids simply draw nothing. */
  setWorn(worn = {}) {
    this.worn = {
      hat: worn.hat || 'none',
      outfit: worn.outfit || 'none',
      accessory: worn.accessory || 'none',
    };
  }

  setReducedMotion(on) {
    this.reducedMotion = !!on;
  }

  /** Play a reaction. `mood` is a key of EYES. */
  react(mood, durationSec = 0.45) {
    this.expression = mood;
    this.expressionUntil = this.time + durationSec;
  }

  /** Called on every tap: squash the capybara and throw water. */
  tap({ crit = false, frenzy = false } = {}) {
    this.squash = 1;
    this.react(crit ? 'star' : 'happy', crit ? 0.6 : 0.35);

    const { x, y, r } = this.capyBox;
    if (this.reducedMotion) return;

    if (crit) {
      this.particles.burst(x, y + r * 0.15, {
        count: 22,
        colors: ['#f7c948', '#fff7d6', '#ffe08a'],
        speed: 260,
        life: 0.75,
        size: 4,
      });
      this.particles.addShake(9);
    } else {
      this.particles.burst(x, y + r * 0.55, {
        count: frenzy ? 12 : 7,
        colors: ['#7fd0e6', '#c9f2ff', '#fdf6e8'],
        speed: 150,
        life: 0.5,
        size: 3,
      });
      this.particles.addShake(2.2);
    }
  }

  /** Spawn the roaming bonus capybara somewhere along the edges. */
  spawnGolden(ttlSec, logicalW, logicalH) {
    const margin = 60;
    this.golden = {
      x: margin + Math.random() * Math.max(1, logicalW - margin * 2),
      y: margin + Math.random() * Math.max(1, logicalH * 0.6),
      vx: (Math.random() - 0.5) * 70,
      vy: (Math.random() - 0.5) * 50,
      ttl: ttlSec,
      maxTtl: ttlSec,
      scale: 1,
    };
  }

  clearGolden() {
    this.golden = null;
  }

  /**
   * Hit test in logical (CSS) pixels. Returns 'golden' | 'capy' | null so the
   * caller can prioritise the bonus over the main target.
   */
  hitTest(px, py) {
    if (this.golden) {
      const g = this.golden;
      const size = GOLDEN_CAPY.w * this.goldenScale;
      if (Math.abs(px - g.x) <= size / 2 && Math.abs(py - g.y) <= size / 2) return 'golden';
    }
    const { x, y, r } = this.capyBox;
    // Generous circular hitbox — a clicker should never feel like it missed.
    // Tested before the crew on purpose: the pond is the clicker, and a
    // companion that ate a tap would be a companion costing you zen.
    if ((px - x) ** 2 + (py - y) ** 2 <= r * r) return 'capy';

    for (const box of this.crewBoxes) {
      if ((px - box.x) ** 2 + (py - box.y) ** 2 <= box.r * box.r) return `companion:${box.id}`;
    }

    // The banks come last, for the same reason the crew do: the pond is the
    // clicker, and scenery that ate a tap would be scenery costing you zen.
    // Nearest first, so the front row wins where two overlap.
    for (const box of [...this.buildingBoxes].reverse()) {
      if ((px - box.x) ** 2 + (py - box.y) ** 2 <= box.r * box.r) return `building:${box.id}`;
    }
    return null;
  }

  update(dt) {
    this.time += dt;
    this.squash = Math.max(0, this.squash - dt * 5.5);

    if (this.time > this.expressionUntil) {
      // Idle blink loop keeps the capybara looking alive between taps.
      if (this.time > this.blinkAt) {
        this.expression = 'blink';
        if (this.time > this.blinkAt + 0.13) {
          this.expression = 'open';
          this.blinkAt = this.time + 2.4 + Math.random() * 4.5;
        }
      } else {
        this.expression = 'open';
      }
    }

    if (this.golden) {
      const g = this.golden;
      g.ttl -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      const { width, height } = this.canvas.getBoundingClientRect();
      // Bounce off the edges so it stays catchable.
      if (g.x < 40 || g.x > width - 40) g.vx *= -1;
      if (g.y < 40 || g.y > height - 40) g.vy *= -1;
      g.x = Math.max(40, Math.min(width - 40, g.x));
      g.y = Math.max(40, Math.min(height - 40, g.y));
      if (g.ttl <= 0) this.golden = null;
    }

    this.particles.update(dt);
  }

  draw({ frenzy = false } = {}) {
    const { ctx, canvas } = this;
    const { width, height, dpr } = resizeCanvas(canvas);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const shake = this.reducedMotion ? { x: 0, y: 0 } : this.particles.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Sprite scale: fill roughly 62% of the shorter axis, snapped to integers.
    const target = Math.min(width, height) * 0.62;
    const scale = fitScale(CAPY.w, target, 2);
    const cx = width / 2;
    // Sit slightly above centre. The bottom of the stage carries the toast strip
    // on narrow screens, and rising numbers need headroom above.
    const cy = height * 0.47;
    this.capyBox = { x: cx, y: cy, r: (CAPY.w * scale) / 2.35 };
    this.goldenScale = Math.max(2, Math.round(scale * 0.55));

    this.drawSteam(ctx, width, height, scale);
    // The banks go first, behind everything: they are scenery. The capybara is
    // the thing you tap and nothing may sit in front of it.
    this.drawBuildings(ctx, cx, cy, scale, width, height);
    // The crew go behind the capybara: it is the thing being tapped, and a
    // companion overlapping in front of it would eat the hitbox visually even
    // though hitTest puts the capybara first.
    this.drawParty(ctx, cx, cy, scale, width);
    this.drawCapy(ctx, cx, cy, scale, frenzy);
    this.drawYuzu(ctx, cx, cy, scale);
    if (this.golden) this.drawGolden(ctx);

    this.particles.draw(ctx);
    ctx.restore();
  }

  drawCapy(ctx, cx, cy, scale, frenzy) {
    const palette = CAPY_SKINS[frenzy ? 'golden' : this.skin] || CAPY_SKINS.classic;
    const mood = frenzy && this.expression === 'open' ? 'star' : this.expression;

    // Expression first, then the clothes, so a hat can sit over the ears and a
    // pair of glasses over the eyes rather than under them. The key has to
    // carry everything the composite depends on — a stale bake here is a
    // capybara wearing the last thing you tried on.
    const layers = [{ sprite: EYES[mood] || EYES.open, origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(this.worn)];
    const key = `capy:${frenzy ? 'golden' : this.skin}:${mood}:${wornKey(this.worn)}`;
    const baked = bakeLayered(CAPY, layers, palette, key);

    // Slow breathing bob, plus squash-and-stretch on tap.
    const bob = this.reducedMotion ? 0 : Math.sin(this.time * 1.7) * scale * 0.35;
    const s = this.reducedMotion ? 0 : this.squash;
    const squashX = 1 + s * 0.09;
    const squashY = 1 - s * 0.11;

    blitSquash(ctx, baked, cx, cy + bob, scale, squashX, squashY);
  }

  /**
   * Up to three companions on their own lily pads, arranged around the pool.
   *
   * Positions are fractions of the capybara's own size rather than of the
   * canvas, so the arrangement holds together at every viewport: the crew stays
   * the same distance from the capybara whether the stage is 900px wide or 350.
   */
  drawParty(ctx, cx, cy, scale, width) {
    this.crewBoxes = [];
    if (!this.party.length) return;

    // 0.38, not 0.45. At 0.45 the three of them read as four capybaras of
    // roughly equal standing; smaller, they read as the crew, which is what
    // they are.
    const crewScale = Math.max(1, Math.round(scale * 0.38));
    const span = CAPY.w * scale;
    // Left, right, and behind-left. Three points that read as "around" without
    // any of them sitting on the capybara's own silhouette.
    const spots = [
      { dx: -0.78, dy: 0.20 },
      { dx: 0.78, dy: 0.20 },
      { dx: -0.46, dy: -0.34 },
    ];

    this.party.forEach((member, i) => {
      const spot = spots[i] || spots[0];
      let x = cx + spot.dx * span;
      const y = cy + spot.dy * span;

      // On a narrow stage the outer two would sit off the edge. Pull them in
      // rather than letting them clip — a companion you cannot see is worse
      // than one standing slightly too close.
      const margin = CAPY.w * crewScale * 0.6;
      x = Math.max(margin, Math.min(width - margin, x));

      const bob = this.reducedMotion ? 0 : Math.sin(this.time * member.speed + member.phase) * crewScale * 0.7;
      this.drawPad(ctx, x, y + bob + CAPY.h * crewScale * 0.30, crewScale);

      const palette = CAPY_SKINS[member.skin] || CAPY_SKINS.classic;
      // Companions blink on their own clocks. Cheap, and the difference between
      // three animals and three copies of a sprite.
      const blinking = !this.reducedMotion
        && ((this.time + member.phase) % (5 + i)) < 0.14;
      const mood = blinking ? 'blink' : 'open';
      const worn = { hat: member.hat || 'none' };
      const layers = [{ sprite: EYES[mood], origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(worn)];
      const baked = bakeLayered(CAPY, layers, palette, `crew:${member.skin}:${mood}:${wornKey(worn)}`);

      blit(ctx, baked, x, y + bob, crewScale);
      this.crewBoxes.push({ id: member.id, x, y: y + bob, r: (CAPY.w * crewScale) / 2.4 });
    });
  }

  /**
   * The lily pad each companion sits on.
   *
   * Worth noting why it is bigger than the capybara it holds: the CAPY sprite
   * carries its own water in rows 25-30, so a pad the same width disappears
   * entirely behind it. Drawn wider, the green rim shows around the little pool
   * and the two read as one object — a companion in its own pond.
   */
  /**
   * The banks.
   *
   * Everything is pushed outside the capybara's tap circle, measured — the
   * first draft used a fixed fraction of the half-width and the browser said
   * thirty-four of sixty-three were inside it, crowding the silhouette. The
   * capybara is still tapped first by hitTest, so nothing was broken; it simply
   * looked cramped, and the comment claiming otherwise was wrong. The clearance
   * is computed from the real radius now, and a test asserts it.
   *
   * Further-back generators are drawn smaller and dimmer. It is not real
   * perspective, just enough of it that eighteen kinds of thing on two banks
   * read as depth rather than as a list.
   */
  drawBuildings(ctx, cx, cy, scale, width, height) {
    this.buildingBoxes = [];
    if (!this.buildings.length) return;

    const half = width / 2;
    const waterY = cy + CAPY.h * scale * 0.34;

    for (const b of this.buildings) {
      const art = BUILDING_ART[b.id];
      if (!art) continue;

      // Later generators are further away: smaller, paler, higher up the bank.
      const distance = b.depth / Math.max(1, BUILDING_ORDER.length - 1);
      const size = Math.max(1, Math.round(scale * (0.34 - distance * 0.14)));
      const alpha = 0.92 - distance * 0.34;

      // The band runs from just outside the capybara's tap circle to the edge
      // of the stage. Placing within the band rather than clamping into it is
      // what keeps the spread — see the note in setBuildings.
      const iconR = (ICONS[art.shape].w * size) / 2;
      const near = this.capyBox.r + iconR;
      const band = Math.max(0, half - near - iconR);
      const x = cx + b.side * (near + b.out * band);
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * 0.6 + b.phase) * 1.2;
      const y = waterY + height * b.up + bob - distance * height * 0.06;

      const baked = bake(ICONS[art.shape], art.palette, `pond:${b.id}`);
      blit(ctx, baked, x, y, size, { alpha });

      // Tappable, so the pond is a way into the shop and not only a picture.
      this.buildingBoxes.push({ id: b.id, x, y, r: (ICONS[art.shape].w * size) / 2.2 });
    }
  }

  drawPad(ctx, x, y, scale) {
    const baked = bake(ICONS.pad, BUILDING_ART.lilypad.palette, 'crewpad');
    blit(ctx, baked, x, y, Math.max(1, Math.round(scale * 1.7)), { alpha: 0.85 });
  }

  drawYuzu(ctx, cx, cy, scale) {
    const baked = bake(YUZU, PROP_PALETTE, 'yuzu');
    const yScale = Math.max(1, Math.round(scale * 0.55));
    const waterY = cy + CAPY.h * scale * 0.32;
    for (const y of this.yuzu) {
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * y.speed + y.phase) * yScale * 1.5;
      const drift = this.reducedMotion ? 0 : Math.cos(this.time * y.speed * 0.6 + y.phase) * scale * 0.8;
      blit(ctx, baked, cx + y.offset * CAPY.w * scale + drift, waterY + bob, yScale);
    }
  }

  drawSteam(ctx, width, height, scale) {
    if (this.reducedMotion) return;
    const baked = bake(STEAM, PROP_PALETTE, 'steam');
    // Keep puffs small and faint. At larger sizes they stop reading as steam
    // and start reading as grey rocks floating past the capybara.
    const sScale = Math.max(1, Math.round(scale * 0.26));
    for (const p of this.steam) {
      // Each puff rises on its own loop and fades near the top.
      const t = (this.time * p.speed + p.seed) % 1;
      const x = width * (0.18 + p.x * 0.64) + Math.sin(t * Math.PI * 2 + p.phase) * 18;
      const y = height * (0.72 - t * 0.55);
      const alpha = Math.sin(t * Math.PI) * 0.14;
      if (alpha <= 0.01) continue;
      blit(ctx, baked, x, y, sScale, { alpha });
    }
  }

  drawGolden(ctx) {
    const g = this.golden;
    const baked = bake(GOLDEN_CAPY, CAPY_SKINS.golden, 'goldencapy');
    const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.time * 8) * 0.06;
    // Blink out over the last second so the player feels the timer.
    const alpha = g.ttl < 1 ? Math.max(0.25, g.ttl) : 1;

    ctx.save();
    ctx.shadowColor = 'rgba(247,201,72,0.9)';
    ctx.shadowBlur = 18;
    blit(ctx, baked, g.x, g.y, this.goldenScale * pulse, { alpha });
    ctx.restore();
  }
}
