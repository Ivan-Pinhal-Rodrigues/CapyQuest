// The fight, drawn.
//
// Until now the combat panel was an `<img>` of the enemy above two bars. Every
// mechanic the fight has — the wind-up, the brace, the ward, the escort, the
// enrage — was a line of text, and the capybara doing the fighting was not on
// screen at all. You watched a number go down.
//
// This is a sibling of render/scene.js and shares its whole toolkit: the same
// bake-once-blit-many rasteriser, the same particle field, the same reduced-
// motion discipline. What it adds is a small state machine per actor, driven by
// the event stream systems/combat.js already emits. No new combat logic lives
// here and none should: the arena reacts, it never decides.
//
//   engage      → the enemy walks in (a boss takes its time about it)
//   hit         → the striker lunges, the target recoils and flashes
//   skill       → one of six effects, tinted by the skill's element
//   windup      → the enemy winds back and a warning ring closes
//   brace       → the capybara hunkers down
//   ward / add  → a shimmer round the enemy, an escort beside it
//   enrage      → a red pulse that stays until the fight ends
//   cleared     → the enemy dissolves upward
//   defeat      → the capybara sinks
//
// The damage numbers stay in the DOM where they already worked. Canvas text at
// this scale is worse than DOM text, and reimplementing it would have been
// motion for its own sake.

import { CAPY, EYES, EYE_OVERLAY_ORIGIN } from './sprites.js';
import { CAPY_SKINS } from './palettes.js';
import { SHAPES } from './shapes.js';
import { bake, bakeLayered, blit, blitSquash, resizeCanvas, fitScale } from './canvas.js';
import { wornKey, wornLayers } from './wearables.js';
import { ParticleField } from './particles.js';
import { ELEMENTS } from '../data/elements.js';
import { SKILLS_BY_ID } from '../data/skills.js';

/** How a skill looks, worked out from the effect it declares. */
export function skillLook(skill) {
  const effect = skill?.effect;
  if (!effect) return 'slash';
  if (effect.type === 'heal') return 'heal';
  if (effect.scaleWithHp) return 'aura';
  if (effect.selfStun) return 'slam';
  if (effect.mult >= 6) return 'multi';
  if (effect.element) return 'bolt';
  return 'slash';
}

const LUNGE_DECAY = 4.2;
const FLASH_DECAY = 5.5;
const ENTRANCE_SPEED = 2.6;
const BOSS_ENTRANCE_SPEED = 1.1;

export class Arena {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = new ParticleField();

    this.time = 0;
    this.reducedMotion = false;

    /** What the capybara looks like. Fed from the wardrobe. */
    this.skin = 'classic';
    this.worn = { hat: 'none', outfit: 'none', accessory: 'none' };
    this.party = [];

    this.player = { lunge: 0, flash: 0, braced: 0, mood: 'open', sunk: 0 };
    this.enemy = null;
    this.enemyState = { lunge: 0, flash: 0, entrance: 1, dissolve: 0, enraged: false, warded: false, winding: 0 };
    this.add = null;

    /** Transient visuals. Each carries its own age and is dropped when spent. */
    this.effects = [];

    this.playerBox = { x: 0, y: 0, r: 0 };
    this.enemyBox = { x: 0, y: 0, r: 0 };
  }

  setReducedMotion(on) {
    this.reducedMotion = !!on;
  }

  setLook({ skin, worn, party } = {}) {
    if (skin && CAPY_SKINS[skin]) this.skin = skin;
    if (worn) this.worn = { hat: worn.hat || 'none', outfit: worn.outfit || 'none', accessory: worn.accessory || 'none' };
    if (party) this.party = party.slice(0, 3);
  }

  /**
   * Point the arena at an enemy.
   *
   * Only restarts the entrance when the enemy actually changes — the panel
   * calls this every frame with whatever is in front of you, and re-triggering
   * the walk-in sixty times a second would freeze it mid-stride.
   */
  setEnemy(enemy) {
    if (!enemy) {
      this.enemy = null;
      return;
    }
    if (this.enemy?.id === enemy.id && this.enemy?.boss === enemy.boss) return;
    this.enemy = enemy;
    this.enemyState = {
      lunge: 0,
      flash: 0,
      entrance: 0,
      dissolve: 0,
      enraged: false,
      warded: false,
      winding: 0,
    };
    this.add = null;
  }

  // ------------------------------------------------------------------ events

  /**
   * Turn combat events into animation.
   *
   * Called with the same array ui/battlePanel.js reads for its log, so the two
   * never disagree about what happened.
   */
  consume(events) {
    for (const ev of events) {
      switch (ev.kind) {
        case 'engage':
          this.setEnemy(ev.enemy);
          break;

        case 'hit':
          this.onHit(ev);
          break;

        case 'skill':
          this.onSkill(ev);
          break;

        case 'windup':
          this.enemyState.winding = 1;
          break;

        case 'brace':
          this.player.braced = 1;
          this.player.mood = 'blink';
          break;

        case 'ward':
          this.enemyState.warded = true;
          this.spawn('ward', { element: ev.element, life: 0.8 });
          break;

        case 'wardBroke':
          this.enemyState.warded = false;
          this.burstAt(this.enemyBox, ['#fdf6e8', '#7fd0e6'], 16);
          break;

        case 'add':
          this.add = { flash: 0, entrance: 0 };
          break;

        case 'addDown':
          this.add = null;
          this.burstAt(this.enemyBox, ['#e8556d', '#fdf6e8'], 12);
          break;

        case 'enrage':
          this.enemyState.enraged = true;
          this.spawn('enrage', { life: 0.9 });
          break;

        case 'cleared':
          this.enemyState.dissolve = 0.001; // non-zero starts the fade
          this.player.mood = 'happy';
          break;

        case 'defeat':
          this.player.sunk = 1;
          this.player.mood = 'blink';
          break;

        default:
          break;
      }
    }
  }

  onHit(ev) {
    if (ev.target === 'player') {
      this.player.flash = 1;
      this.enemyState.lunge = 1;
      this.enemyState.winding = 0;
      this.player.mood = ev.braced ? 'blink' : 'open';
      if (!this.reducedMotion) {
        this.particles.addShake(ev.heavy ? 10 : 4);
        this.burstAt(this.playerBox, ['#e8556d', '#ffb0b8'], ev.heavy ? 16 : 8);
      }
      return;
    }

    // A hit on the escort still reads as a hit on that side of the arena.
    this.player.lunge = 1;
    this.enemyState.flash = 1;
    if (ev.target === 'add' && this.add) this.add.flash = 1;
    if (this.reducedMotion) return;

    const colours = ev.crit ? ['#f7c948', '#fff7d6'] : ['#fdf6e8', '#c9f2ff'];
    this.burstAt(this.enemyBox, colours, ev.crit ? 20 : 9);
    if (ev.crit) this.particles.addShake(7);
  }

  onSkill(ev) {
    this.player.lunge = 1;
    this.player.mood = 'star';
    const look = skillLook(SKILLS_BY_ID[ev.id]);
    this.spawn(look, {
      element: ev.element,
      life: look === 'multi' ? 1 : 0.65,
      heal: !!ev.heal,
    });
  }

  spawn(kind, { element = null, life = 0.7, heal = false } = {}) {
    if (this.reducedMotion) return;
    this.effects.push({ kind, element, life, age: 0, heal });
  }

  burstAt(box, colors, count) {
    if (this.reducedMotion) return;
    this.particles.burst(box.x, box.y, { count, colors, speed: 190, life: 0.55, size: 3 });
  }

  // ------------------------------------------------------------------- ticks

  update(dt) {
    this.time += dt;

    const decay = (v, rate) => Math.max(0, v - dt * rate);
    this.player.lunge = decay(this.player.lunge, LUNGE_DECAY);
    this.player.flash = decay(this.player.flash, FLASH_DECAY);
    this.player.braced = decay(this.player.braced, 2.2);
    this.player.sunk = decay(this.player.sunk, 0.6);

    const e = this.enemyState;
    e.lunge = decay(e.lunge, LUNGE_DECAY);
    e.flash = decay(e.flash, FLASH_DECAY);
    e.winding = decay(e.winding, 1 / 0.8); // matches TELEGRAPH_SECONDS
    if (this.add) this.add.flash = decay(this.add.flash, FLASH_DECAY);

    const speed = this.enemy?.boss ? BOSS_ENTRANCE_SPEED : ENTRANCE_SPEED;
    if (e.entrance < 1) e.entrance = Math.min(1, e.entrance + dt * speed);
    if (this.add && this.add.entrance < 1) this.add.entrance = Math.min(1, this.add.entrance + dt * 3);
    if (e.dissolve > 0) e.dissolve = Math.min(1, e.dissolve + dt * 1.8);

    // The expression settles back on its own, so nothing has to remember to
    // clear it.
    if (this.player.lunge === 0 && this.player.flash === 0 && this.player.sunk === 0) {
      this.player.mood = 'open';
    }

    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter((fx) => fx.age < fx.life);

    this.particles.update(dt);
  }

  draw() {
    const { ctx, canvas } = this;
    const { width, height, dpr } = resizeCanvas(canvas);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const shake = this.reducedMotion ? { x: 0, y: 0 } : this.particles.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Both actors scale off the height so the arena keeps its proportions in a
    // narrow panel, which is where it spends most of its life. 0.68 rather than
    // something smaller because the canvas is only 150px tall: at half of that
    // the integer scale rounds down to 2 and the fight reads as two thumbnails
    // in a large empty box.
    const scale = fitScale(CAPY.w, height * 0.68, 2);
    const midY = height * 0.54;
    this.playerBox = { x: width * 0.27, y: midY, r: (CAPY.w * scale) / 2.4 };
    this.enemyBox = { x: width * 0.73, y: midY, r: (CAPY.w * scale) / 2.4 };

    this.drawGround(ctx, width, height, midY);
    this.drawParty(ctx, scale);
    this.drawPlayer(ctx, scale);
    if (this.enemy) this.drawEnemy(ctx, scale, width);
    this.drawEffects(ctx, scale);

    this.particles.draw(ctx);
    ctx.restore();
  }

  drawGround(ctx, width, height, midY) {
    // A single soft band under both actors. Without it they float, and with a
    // full background the sprites stop reading at panel size.
    const y = midY + height * 0.16;
    const gradient = ctx.createLinearGradient(0, y - 14, 0, y + 16);
    gradient.addColorStop(0, 'rgba(127, 208, 230, 0)');
    gradient.addColorStop(0.5, 'rgba(63, 143, 176, 0.30)');
    gradient.addColorStop(1, 'rgba(127, 208, 230, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 14, width, 30);
  }

  drawPlayer(ctx, scale) {
    const p = this.player;
    const palette = CAPY_SKINS[this.skin] || CAPY_SKINS.classic;
    const layers = [{ sprite: EYES[p.mood] || EYES.open, origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(this.worn)];
    const baked = bakeLayered(CAPY, layers, palette, `arena:${this.skin}:${p.mood}:${wornKey(this.worn)}`);

    const bob = this.reducedMotion ? 0 : Math.sin(this.time * 1.9) * scale * 0.3;
    // Lunge is towards the enemy, so rightward. Bracing pulls the other way and
    // squashes — the two read as opposite intentions at a glance.
    const x = this.playerBox.x + p.lunge * scale * 3.5 - p.braced * scale * 1.2;
    const y = this.playerBox.y + bob + p.sunk * scale * 4;

    const squashY = 1 - p.braced * 0.16;
    const squashX = 1 + p.braced * 0.12;

    ctx.save();
    if (p.flash > 0) {
      ctx.shadowColor = 'rgba(232, 85, 109, 0.9)';
      ctx.shadowBlur = 22 * p.flash;
    }
    blitSquash(ctx, baked, x, y, scale, squashX, squashY, 1 - p.sunk * 0.6);
    ctx.restore();

    if (p.braced > 0.05) this.drawBraceRing(ctx, x, y, scale, p.braced);
  }

  drawBraceRing(ctx, x, y, scale, strength) {
    ctx.save();
    ctx.strokeStyle = `rgba(127, 208, 230, ${0.55 * strength})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, CAPY.w * scale * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** The crew, small, behind and below the capybara. */
  drawParty(ctx, scale) {
    if (!this.party.length) return;
    const small = Math.max(1, Math.round(scale * 0.3));

    this.party.forEach((member, i) => {
      const palette = CAPY_SKINS[member.skin] || CAPY_SKINS.classic;
      const worn = { hat: member.hat || 'none' };
      const layers = [{ sprite: EYES.open, origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(worn)];
      const baked = bakeLayered(CAPY, layers, palette, `arenacrew:${member.skin}:${wornKey(worn)}`);

      const bob = this.reducedMotion ? 0 : Math.sin(this.time * (1.5 + i * 0.3) + i) * small * 0.6;
      const x = this.playerBox.x - CAPY.w * scale * 0.42 + i * CAPY.w * small * 0.62;
      const y = this.playerBox.y + CAPY.h * scale * 0.34 + bob;
      blit(ctx, baked, x, y, small, { alpha: 0.85 });
    });
  }

  drawEnemy(ctx, scale, width) {
    const e = this.enemyState;
    const shape = SHAPES[this.enemy.shape];
    if (!shape) return;

    const enemyScale = Math.max(2, Math.round(scale * (this.enemy.boss ? 1.35 : 1.05)));
    const baked = bake(shape, this.enemy.palette, `arena:enemy:${this.enemy.id}`);

    const bob = this.reducedMotion ? 0 : Math.sin(this.time * 1.6 + 1.2) * scale * 0.28;
    // Entrance: slide in from off the right edge. A boss takes longer over it.
    const enterOffset = (1 - easeOut(e.entrance)) * (width - this.enemyBox.x + 80);
    const windBack = e.winding * scale * 2.4;
    const x = this.enemyBox.x + enterOffset - e.lunge * scale * 3.5 + windBack;
    const y = this.enemyBox.y + bob;

    // Dissolving rises and fades rather than shrinking — a shrinking sprite at
    // this pixel scale turns to mush before it disappears.
    const alpha = e.dissolve > 0 ? Math.max(0, 1 - e.dissolve) : 1;
    const rise = e.dissolve * scale * 5;

    ctx.save();
    if (e.enraged) {
      ctx.shadowColor = 'rgba(232, 85, 109, 0.85)';
      ctx.shadowBlur = 16 + Math.sin(this.time * 9) * 6;
    } else if (this.enemy.boss) {
      ctx.shadowColor = 'rgba(232, 85, 109, 0.4)';
      ctx.shadowBlur = 14;
    }
    if (e.flash > 0) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 24 * e.flash;
    }
    blit(ctx, baked, x, y - rise, enemyScale, { alpha, flip: true });
    ctx.restore();

    if (e.warded) this.drawWard(ctx, x, y, enemyScale, shape);
    if (e.winding > 0) this.drawTell(ctx, x, y, enemyScale, shape, e.winding);
    if (this.add) this.drawAdd(ctx, x, y, scale);
  }

  drawWard(ctx, x, y, scale, shape) {
    const pulse = 0.45 + Math.sin(this.time * 4) * 0.15;
    ctx.save();
    ctx.strokeStyle = `rgba(200, 220, 255, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, shape.w * scale * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The wind-up ring.
   *
   * It closes rather than fills, because the thing running out is your time to
   * react. `winding` counts 1 → 0 over the telegraph, so the arc drawn is the
   * time you have left.
   */
  drawTell(ctx, x, y, scale, shape, winding) {
    const radius = shape.w * scale * 0.72;
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 85, 109, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * winding);
    ctx.stroke();
    ctx.restore();
  }

  drawAdd(ctx, x, y, scale) {
    const shape = SHAPES[this.enemy.shape];
    const addScale = Math.max(1, Math.round(scale * 0.5));
    const baked = bake(shape, this.enemy.palette, `arena:enemy:${this.enemy.id}`);
    const drop = (1 - easeOut(this.add.entrance)) * -scale * 4;
    ctx.save();
    if (this.add.flash > 0) {
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 18 * this.add.flash;
    }
    blit(ctx, baked, x + shape.w * addScale * 0.9, y + scale * 1.6 + drop, addScale, { alpha: 0.92, flip: true });
    ctx.restore();
  }

  // ----------------------------------------------------------------- effects

  drawEffects(ctx, scale) {
    for (const fx of this.effects) {
      const t = fx.age / fx.life;
      const colour = fx.element ? ELEMENTS[fx.element]?.color : null;
      switch (fx.kind) {
        case 'slash': this.drawSlash(ctx, t, colour || '#fdf6e8', scale); break;
        case 'slam': this.drawSlam(ctx, t, colour || '#f0a63d', scale); break;
        case 'bolt': this.drawBolt(ctx, t, colour || '#7fd0e6', scale); break;
        case 'multi': this.drawMulti(ctx, t, colour || '#fdf6e8', scale); break;
        case 'heal': this.drawHeal(ctx, t, scale); break;
        case 'aura': this.drawAura(ctx, t, colour || '#f7c948', scale); break;
        case 'ward': this.drawWardBurst(ctx, t, colour || '#c8dcff', scale); break;
        case 'enrage': this.drawEnrageFlash(ctx, t); break;
        default: break;
      }
    }
  }

  /** Three quick diagonal strokes across the enemy. */
  drawSlash(ctx, t, colour, scale) {
    const { x, y } = this.enemyBox;
    const reach = CAPY.w * scale * 0.5;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * reach * 0.28;
      ctx.beginPath();
      ctx.moveTo(x - reach * 0.6 + offset, y - reach * 0.5);
      ctx.lineTo(x + reach * 0.5 + offset, y + reach * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A shockwave ring on the ground — the heavy, committed skills. */
  drawSlam(ctx, t, colour, scale) {
    const { x, y } = this.enemyBox;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y + CAPY.h * scale * 0.3, CAPY.w * scale * 0.8 * t, CAPY.w * scale * 0.22 * t, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** A projectile crossing from the capybara to the enemy. */
  drawBolt(ctx, t, colour, scale) {
    const from = this.playerBox;
    const to = this.enemyBox;
    const x = from.x + (to.x - from.x) * easeOut(t);
    const y = from.y - Math.sin(t * Math.PI) * scale * 3;
    const size = scale * (1.6 - t * 0.6);

    ctx.save();
    ctx.globalAlpha = 1 - t * 0.3;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 14;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Several impacts in sequence, for the skills that hit more than once. */
  drawMulti(ctx, t, colour, scale) {
    const { x, y } = this.enemyBox;
    const spread = CAPY.w * scale * 0.4;
    ctx.save();
    ctx.fillStyle = colour;
    for (let i = 0; i < 5; i++) {
      const at = i / 5;
      if (t < at || t > at + 0.35) continue;
      const local = (t - at) / 0.35;
      ctx.globalAlpha = 1 - local;
      const px = x + Math.cos(i * 2.3) * spread;
      const py = y + Math.sin(i * 1.7) * spread * 0.7;
      ctx.beginPath();
      ctx.arc(px, py, scale * 1.4 * (1 - local), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Motes rising off the capybara. */
  drawHeal(ctx, t, scale) {
    const { x, y } = this.playerBox;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.fillStyle = '#8fd06a';
    for (let i = 0; i < 6; i++) {
      const phase = (t + i / 6) % 1;
      const px = x + Math.sin(i * 2.1 + this.time * 2) * CAPY.w * scale * 0.3;
      const py = y + CAPY.h * scale * 0.3 - phase * CAPY.h * scale * 0.8;
      ctx.beginPath();
      ctx.arc(px, py, scale * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A ring expanding off the capybara — the buffs and the desperate ones. */
  drawAura(ctx, t, colour, scale) {
    const { x, y } = this.playerBox;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, CAPY.w * scale * (0.35 + t * 0.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawWardBurst(ctx, t, colour, scale) {
    const { x, y } = this.enemyBox;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, CAPY.w * scale * (0.8 - t * 0.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawEnrageFlash(ctx, t) {
    const { width, height } = this.canvas.getBoundingClientRect();
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.28;
    ctx.fillStyle = '#e8556d';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}
