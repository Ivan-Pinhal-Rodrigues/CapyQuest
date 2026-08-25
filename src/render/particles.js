// Particles and floating numbers — the entire reason a tap feels good.
//
// One flat pooled array, no per-particle objects churned each frame. The pool
// is capped so a frenzy of clicks degrades into fewer particles rather than
// into dropped frames.

const MAX_PARTICLES = 420;
const MAX_FLOATERS = 60;

export class ParticleField {
  constructor() {
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.shakeDecay = 6;
  }

  /** A burst of pixel chips, e.g. water splashing off a tap. */
  burst(x, y, { count = 8, colors = ['#7fd0e6', '#fdf6e8'], speed = 120, spread = Math.PI * 2, angle = -Math.PI / 2, gravity = 340, life = 0.6, size = 3 } = {}) {
    const room = MAX_PARTICLES - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.55 + Math.random() * 0.75);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        gravity,
        life,
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.7),
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  /** Rising damage/reward number. */
  float(x, y, text, { color = '#fdf6e8', size = 18, life = 1.1, drift = 0, weight = 700 } = {}) {
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    // Fast tapping stacks numbers on the same spot, which turns the capybara's
    // face into unreadable mush. Scatter them widely and vary the rise speed so
    // a streak reads as a spray rather than a pile.
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 96,
      y: y - Math.random() * 26,
      text,
      color,
      size,
      life,
      maxLife: life,
      vx: drift + (Math.random() - 0.5) * 58,
      vy: -86 - Math.random() * 60,
      weight,
    });
  }

  /** Camera kick. Additive so rapid crits stack into a real thump. */
  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        // Swap-and-pop: order does not matter and it avoids O(n) splices.
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters[i] = this.floaters[this.floaters.length - 1];
        this.floaters.pop();
        continue;
      }
      f.vy += 52 * dt; // ease upward then settle
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }

    this.shake = Math.max(0, this.shake - this.shakeDecay * dt * 10);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (0.4 + t * 0.6)));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const t = f.life / f.maxLife;
      // Pop in over the first 15% of life, then fade out.
      const grow = t > 0.85 ? 1 + (1 - t) * 4 : 1;
      ctx.globalAlpha = t > 0.6 ? 1 : t / 0.6;
      ctx.font = `${f.weight} ${Math.round(f.size * grow)}px "Press Start 2P", ui-monospace, monospace`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,12,24,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /** Current camera offset from shake. Apply before drawing the scene. */
  shakeOffset() {
    if (this.shake <= 0.05) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake,
      y: (Math.random() - 0.5) * this.shake,
    };
  }

  clear() {
    this.particles.length = 0;
    this.floaters.length = 0;
    this.shake = 0;
  }
}
