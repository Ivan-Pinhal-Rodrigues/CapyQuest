// Tapping: combo tracking, crits, and the payout for a single tap.

import * as B from '../balance.js';

export class ComboTracker {
  constructor() {
    this.points = 0;
    this.lastClickAt = 0;
    this.bestThisRun = 0;
  }

  /** Register a tap. Returns the new combo point total. */
  hit(now, cap) {
    // Decay first, so a tap after a long pause resumes from the decayed value
    // rather than from where the streak stood when it stalled.
    this.points = B.decayCombo(this.points, now - this.lastClickAt);
    this.points = Math.min(cap, this.points + 1);
    this.lastClickAt = now;
    this.bestThisRun = Math.max(this.bestThisRun, this.points);
    return this.points;
  }

  /** Called every frame so the meter drains visibly between taps. */
  tick(now) {
    if (this.points <= 0) return 0;
    this.points = B.decayCombo(this.points, now - this.lastClickAt);
    return this.points;
  }

  /** 0..1 for the meter fill, and how close the streak is to dropping. */
  urgency(now) {
    if (this.points <= 0) return 0;
    const elapsed = now - this.lastClickAt;
    return B.clamp(1 - elapsed / B.COMBO_DECAY_MS, 0, 1);
  }

  reset() {
    this.points = 0;
    this.lastClickAt = 0;
  }
}

/**
 * Resolve one tap against the current derived stats.
 * Pure apart from the RNG, which is injected so tests can pin it.
 */
export function resolveClick(derived, rng = Math.random) {
  const crit = rng() < derived.critChance;
  const amount = derived.clickValue * (crit ? derived.critMult : 1);
  return { amount, crit };
}
