// Combat. The capybara can fight on its own, and it can fight better with you.
//
// The original version was entirely automatic: skills fired themselves on
// cooldown and the player's every decision — gear, three skills, a stance, when
// to walk deeper — was made outside the fight. Then you watched a bar. That is
// half the game, and there was nothing to do in it.
//
// So there are now two verbs, and both are optional:
//
//   BRACE   Enemies wind up a heavy hit and tell you first. Tapping the
//           capybara inside that window halves the blow and builds Focus.
//   FOCUS   A damage multiplier on everything you do, filled by bracing and
//           bleeding away when you stop. Being in the zone, not a resource.
//
// Focus is deliberately NOT spent by casting, and that is the second design
// this file has had. The first version had skills consume the meter for a bonus
// on that cast, so the clever play was to hold a ready skill until the meter
// filled — and measurement said that clever play was 26% WORSE than idling,
// because a skill sitting unused on cooldown costs more throughput than any
// per-cast bonus returns. Any design where the skilful option is "wait" loses
// to "cast on cooldown". So attention now pays a straight multiplier and never
// competes with throughput: an attentive player casts exactly as often as an
// idler, and hits harder while doing it.
//
// Neither verb is mandatory. Auto-battle with auto-cast is at least as strong
// as it was before any of this existed, and tests/fight.test.js holds that line
// — an idler must still clear every boss pattern.
//
// The simulation is a plain state machine advanced by dt, so it runs the same
// whether it is ticked at 60Hz or caught up in bigger steps.

import * as B from '../balance.js';
import { ELEMENT_CHART } from '../data/elements.js';
import { ENEMIES } from '../data/enemies.js';
import { SKILLS_BY_ID } from '../data/skills.js';
import {
  ADD_HP_SHARE,
  ENRAGE_AFTER,
  ENRAGE_RAMP,
  SHIELD_LEAK,
  SHIELD_SECONDS,
  patternForStage,
  wardElement,
} from '../data/bossPatterns.js';
import { buildEnemy, depthInfo, terrainForDepth, levelInStage, LEVELS_PER_STAGE } from './stages.js';

const RETREAT_AFTER_LOSSES = 3;
// Short enough that a clear rolls straight into the next fight, long enough to
// read what you just killed.
const RESPAWN_DELAY = 0.8;
const DEFEAT_DELAY = 1.6;

// --- the brace window
/** How long before a heavy lands that the wind-up is visible, in seconds. */
export const TELEGRAPH_SECONDS = 0.8;
/** Every Nth enemy attack winds up instead of just landing. */
export const HEAVY_EVERY = 4;
/** What a heavy hits for, against an ordinary swing. */
export const HEAVY_MULT = 2.5;
/** What a braced heavy hits for instead. */
export const BRACE_REDUCTION = 0.5;

// --- focus
export const FOCUS_MAX = 100;
/**
 * Focus for reading a wind-up correctly — the only source there is.
 *
 * An earlier version also trickled focus in from ordinary landed hits, so that
 * an idler was "never at a flat zero". Measurement showed the trickle was worth
 * exactly nothing: at 1.2 per hit against a decay of 3.5 per second it never
 * once got the meter off the floor. A mechanic that cannot move the number it
 * feeds is not a gentle default, it is dead code with a kind comment on it, so
 * it is gone. Bracing fills the meter; nothing else does.
 */
export const FOCUS_PER_BRACE = 34;
/** Damage multiplier at a full meter, applied to attacks and skills alike. */
export const FOCUS_BONUS = 1.4;
/** Focus lost per second. Stop paying attention and the zone fades. */
export const FOCUS_DECAY = 4;

export class Combat {
  constructor(state) {
    this.state = state;
    this.enemy = null;
    this.playerHp = 1;
    this.playerMaxHp = 1;
    this.enemyTimer = 0;
    this.playerTimer = 0;
    this.cooldowns = {};
    this.stunUntil = 0;
    this.clock = 0;
    this.phase = 'idle'; // idle | fighting | won | lost
    this.phaseTimer = 0;
    this.settled = true; // nothing to pay out before the first fight
    this.losses = 0;
    this.events = []; // drained by the UI each frame

    // --- the interactive layer
    this.focus = 0;
    this.winding = false; // a heavy is on its way
    this.windUpLeft = 0;
    this.braced = false; // the player read this one
    this.pattern = null; // boss pattern, if this is a boss
    this.ward = null; // { element, left } while a shield is up
    this.add = null; // { hp, maxHp } while an escort is alive
    this.enrage = 0; // attack-speed multiplier from an impatient boss
    this.fightTime = 0;
    this.bossClock = 0; // seconds left to finish a boss; 0 for anything else
  }

  /** Start (or restart) the fight at the state's current stage. */
  engage(stats) {
    this.enemy = buildEnemy(this.state.combat.depth);
    this.playerMaxHp = Math.max(1, stats.hp);
    this.playerHp = this.playerMaxHp;
    this.enemyTimer = this.enemy.attackEvery;
    this.playerTimer = this.playerInterval(stats);
    this.cooldowns = {};
    this.stunUntil = 0;
    this.phase = 'fighting';
    this.phaseTimer = 0;
    this.settled = false;

    // Focus carries between fights. Losing a full meter to a respawn you did
    // not control would make bracing feel wasted on the last swing of a mob.
    //
    // Bosses start the swing counter part-wound, so their *second* swing is the
    // telegraphed one. Ordinary enemies die in a handful of seconds and a first
    // heavy on swing four often never arrives at all — which would mean the one
    // mechanic the player is meant to learn first shows up under boss pressure.
    // Bosses are where bracing matters and where fights last long enough to
    // practise it, so bosses are where it gets taught.
    this.swings = this.enemy.boss ? HEAVY_EVERY - 2 : 0;
    this.winding = false;
    this.windUpLeft = 0;
    this.braced = false;
    this.fightTime = 0;
    this.enrage = 0;
    this.add = null;
    this.ward = null;
    this.pattern = this.enemy.boss ? patternForStage(this.enemy.stage) : null;
    // Thirty seconds, and now it is a real clock rather than a figure the wall
    // detector quotes at you. Only bosses carry one — an ordinary level you
    // cannot finish is a level you retreat from, which RETREAT_AFTER_LOSSES
    // already handles.
    this.bossClock = this.enemy.boss ? B.WALL_SECONDS : 0;

    if (this.pattern) this.openPattern();
    this.emit({ kind: 'engage', enemy: this.enemy, pattern: this.pattern });
  }

  /** Set up whatever this boss does differently. */
  openPattern() {
    if (this.pattern.id === 'shield') {
      const element = wardElement(this.enemy.element, ELEMENT_CHART);
      this.ward = { element, left: SHIELD_SECONDS };
      this.emit({ kind: 'ward', element, seconds: SHIELD_SECONDS });
      return;
    }
    if (this.pattern.id === 'adds') {
      const hp = Math.max(1, this.enemy.maxHp * ADD_HP_SHARE);
      this.add = { hp, maxHp: hp };
      this.emit({ kind: 'add', hp });
    }
  }

  /** Attacks per second rise with SPD, but only up to a sane ceiling. */
  playerInterval(stats) {
    const rate = 0.65 + Math.min(1.6, stats.spd / 260);
    return 1 / rate;
  }

  emit(event) {
    this.events.push(event);
    // The UI drains this every frame; the cap only matters if it stops.
    if (this.events.length > 60) this.events.splice(0, this.events.length - 60);
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /**
   * Advance the fight. `stats` is the derived combat stat block; `onReward` is
   * called with zen/xp/loot when a stage is cleared.
   */
  update(dt, stats, onReward) {
    if (!this.state.combat.autoBattle) return;
    this.clock += dt;

    if (this.phase === 'idle') {
      this.engage(stats);
      return;
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      // A fight can end outside this loop — a skill cast by hand is the only
      // way in, and it is enough. Settling here as well as inline means the
      // kill pays out and the depth advances however the last blow was struck;
      // without it a manual finisher left the fight silently stuck on 'won',
      // paying nothing and never moving on.
      if (!this.settled) this.settle(onReward);
      this.phaseTimer -= dt;
      if (this.phaseTimer > 0) return;
      this.engage(stats);
      return;
    }

    if (!this.enemy) {
      this.engage(stats);
      return;
    }

    this.fightTime += dt;

    // Checked before the swings so the boundary is unambiguous: the boss is
    // still standing at thirty seconds, so the run is over. Letting the final
    // frame's damage land first would make the limit 30 seconds plus one tick,
    // which is the kind of edge that only shows up in a bug report.
    if (this.bossClock > 0) {
      this.bossClock -= dt;
      if (this.bossClock <= 0) return this.timeOut();
    }

    this.focus = Math.max(0, this.focus - FOCUS_DECAY * dt);
    this.tickPattern(dt);

    // --- player attacks
    if (this.clock >= this.stunUntil) {
      this.playerTimer -= dt;
      while (this.playerTimer <= 0) {
        this.playerAttack(stats);
        this.playerTimer += this.playerInterval(stats);
        if (this.phase !== 'fighting') return this.settle(onReward);
      }
      this.tickSkills(dt, stats);
      if (this.phase !== 'fighting') return this.settle(onReward);
    }

    // --- enemy attacks
    if (this.winding) {
      // A heavy is already in the air; the ordinary timer is paused while it
      // lands, so the wind-up reads as one attack rather than stacking with
      // the next swing.
      this.windUpLeft -= dt;
      if (this.windUpLeft <= 0) {
        this.landHeavy(stats);
        if (this.phase !== 'fighting') return this.settle(onReward);
      }
      return;
    }

    this.enemyTimer -= dt;
    while (this.enemyTimer <= 0) {
      this.swings++;
      this.enemyTimer += this.enemy.attackEvery / (1 + this.enrage);

      // Every fourth swing is telegraphed instead of landing immediately.
      if (this.swings % HEAVY_EVERY === 0) {
        this.winding = true;
        this.windUpLeft = TELEGRAPH_SECONDS;
        this.braced = false;
        this.emit({ kind: 'windup', seconds: TELEGRAPH_SECONDS });
        return;
      }

      this.enemyAttack(stats);
      if (this.phase !== 'fighting') return this.settle(onReward);
    }
  }

  /** Ward countdown, enrage ramp — the parts of a boss that move on their own. */
  tickPattern(dt) {
    if (this.ward) {
      this.ward.left -= dt;
      if (this.ward.left <= 0) {
        this.ward = null;
        this.emit({ kind: 'wardBroke', reason: 'lapsed' });
      }
    }
    if (this.pattern?.id === 'enrage' && this.fightTime > ENRAGE_AFTER) {
      const was = this.enrage;
      this.enrage = (this.fightTime - ENRAGE_AFTER) * ENRAGE_RAMP;
      if (was === 0) this.emit({ kind: 'enrage' });
    }
  }

  /**
   * The player read the wind-up. Halves the incoming hit and pays Focus.
   *
   * Returns whether it landed, so the caller can tell a good read from a
   * mistimed tap — the tap itself is never wasted, it just earns nothing.
   */
  brace() {
    if (!this.winding || this.braced) return false;
    this.braced = true;
    this.addFocus(FOCUS_PER_BRACE);
    this.emit({ kind: 'brace' });
    return true;
  }

  landHeavy(stats) {
    this.winding = false;
    const scale = HEAVY_MULT * (this.braced ? BRACE_REDUCTION : 1);
    this.enemyAttack(stats, { scale, heavy: true, braced: this.braced });
    this.braced = false;
  }

  addFocus(amount) {
    this.focus = Math.min(FOCUS_MAX, this.focus + amount);
  }

  /** What being in the zone is currently worth. 1.0 when the meter is empty. */
  focusMult() {
    return 1 + (FOCUS_BONUS - 1) * (this.focus / FOCUS_MAX);
  }

  playerAttack(stats) {
    const crit = Math.random() < stats.crit;
    const element = B.elementModifier(stats.element, this.enemy.element, ELEMENT_CHART);
    const dmg = B.damage({
      atk: stats.atk * this.focusMult(),
      def: this.enemy.def,
      crit,
      critMult: stats.critMult,
      element,
    });
    this.dealToEnemy(dmg, { crit, element, source: 'attack', stance: stats.element });
  }

  dealToEnemy(dmg, meta) {
    // An escort eats everything until it falls. This is the whole of that
    // pattern: the boss is untouchable, so burst the small one down.
    if (this.add) {
      this.add.hp -= dmg;
      this.emit({ kind: 'hit', target: 'add', amount: dmg, ...meta });
      if (this.add.hp <= 0) {
        this.add = null;
        this.emit({ kind: 'addDown' });
      }
      return;
    }

    // A ward turns the fight into a question about your stance. Hitting it with
    // the element it fears breaks it outright; anything else leaks a little
    // through, so a player who cannot answer is slowed rather than stopped.
    if (this.ward) {
      if (this.ward.element && meta.stance === this.ward.element) {
        this.ward = null;
        this.emit({ kind: 'wardBroke', reason: 'countered' });
      } else {
        const leaked = dmg * SHIELD_LEAK;
        this.enemy.hp -= leaked;
        this.emit({ kind: 'hit', target: 'enemy', amount: leaked, ...meta, warded: true });
        return;
      }
    }

    this.enemy.hp -= dmg;
    this.emit({ kind: 'hit', target: 'enemy', amount: dmg, ...meta });
    if (this.enemy.hp <= 0) {
      this.enemy.hp = 0;
      this.phase = 'won';
      this.phaseTimer = RESPAWN_DELAY;
    }
  }

  enemyAttack(stats, { scale = 1, heavy = false, braced = false } = {}) {
    const element = B.elementModifier(this.enemy.element, stats.element, ELEMENT_CHART);
    const dmg = B.damage({ atk: this.enemy.atk * scale, def: stats.def, element });
    this.playerHp -= dmg;
    this.emit({ kind: 'hit', target: 'player', amount: dmg, element, heavy, braced });
    if (this.playerHp <= 0) {
      this.playerHp = 0;
      this.phase = 'lost';
      this.phaseTimer = DEFEAT_DELAY;
    }
  }

  /**
   * Cooldowns always tick. Whether a ready skill fires by itself depends on
   * auto-cast, which is the player's choice and defaults to on — turning it off
   * is opting in to work, never a thing the game does to you.
   */
  tickSkills(dt, stats) {
    const auto = this.state.combat.autoCast !== false;
    for (const id of this.state.combat.skills) {
      const skill = SKILLS_BY_ID[id];
      if (!skill || skill.kind !== 'active') continue;

      const ready = (this.cooldowns[id] || 0) - dt;
      this.cooldowns[id] = ready;
      if (ready > 0 || !auto) continue;

      this.cooldowns[id] = skill.cooldown;
      this.castSkill(skill, stats);
      if (this.phase !== 'fighting') return;
    }
  }

  /** Is this slotted skill off cooldown right now? */
  skillReady(id) {
    if (!this.state.combat.skills.includes(id)) return false;
    return (this.cooldowns[id] || 0) <= 0;
  }

  /**
   * Fire a skill by hand. The only thing manual casting can do that auto-cast
   * cannot is *wait* — holding a skill until the Focus meter is full is worth
   * up to +60% on that cast, and it is the entire reward for paying attention.
   */
  castById(id, stats) {
    if (this.phase !== 'fighting') return false;
    const skill = SKILLS_BY_ID[id];
    if (!skill || skill.kind !== 'active') return false;
    if (!this.skillReady(id)) return false;

    this.cooldowns[id] = skill.cooldown;
    this.castSkill(skill, stats);
    return true;
  }

  castSkill(skill, stats) {
    const e = skill.effect;

    if (e.type === 'heal') {
      const healed = Math.min(this.playerMaxHp - this.playerHp, this.playerMaxHp * e.pct);
      this.playerHp += healed;
      // `id` rides along so the arena can look up how the skill should look
      // without the combat system knowing anything about how it is drawn.
      this.emit({ kind: 'skill', id: skill.id, skill: skill.name, heal: healed });
      return;
    }

    if (e.type !== 'strike') return;

    const stance = e.element || stats.element;
    const element = B.elementModifier(stance, this.enemy.element, ELEMENT_CHART);
    // ignoreDef shaves the enemy's defence for this hit only.
    const effDef = this.enemy.def * (1 - (e.ignoreDef || 0));
    const hpScale = e.scaleWithHp ? 1 + this.playerMaxHp / 4000 : 1;
    const crit = Math.random() < stats.crit;

    // Focus multiplies this cast and is NOT consumed by it. Spending the meter
    // here is what made holding a ready skill the optimal play, and holding a
    // ready skill is how the first version of this ended up 26% worse than
    // idling. Casting the moment a skill is ready is always right.
    const charge = this.focus / FOCUS_MAX;

    const dmg = B.damage({
      atk: stats.atk * e.mult * hpScale * this.focusMult(),
      def: effDef,
      crit,
      critMult: stats.critMult,
      element,
    });

    this.emit({ kind: 'skill', id: skill.id, skill: skill.name, charge, element: stance });
    this.dealToEnemy(dmg, { crit, element, source: 'skill', skill: skill.name, stance, charge });

    if (e.healPct) {
      const healed = Math.min(this.playerMaxHp - this.playerHp, this.playerMaxHp * e.healPct);
      this.playerHp += healed;
    }
    if (e.selfStun) this.stunUntil = this.clock + e.selfStun;
  }

  /** Resolve a finished fight: pay out, advance or retreat. Idempotent. */
  settle(onReward) {
    if (this.settled) return;
    this.settled = true;

    if (this.phase === 'won') {
      this.losses = 0;
      const depth = this.state.combat.depth;
      const cleared = this.enemy;
      this.state.combat.clears = (this.state.combat.clears || 0) + 1;
      if (cleared.boss) this.state.combat.bossKills = (this.state.combat.bossKills || 0) + 1;

      onReward?.({ depth, stage: cleared.stage, enemy: cleared });

      // Held here after a boss ran out the clock: the kill still pays, but the
      // fight does not walk you back up to the thing that beat you. Going on is
      // a press of Forward.
      if (this.state.combat.holding) {
        this.emit({ kind: 'held', depth });
        return;
      }

      // There is no last depth. This is the point of the update.
      this.state.combat.depth = depth + 1;
      // bestDepth is the furthest *reached*, not the furthest cleared — it has
      // to include the one you are standing on, or the load-time clamp
      // (depth <= bestDepth) knocks you back a level on every reload.
      this.state.combat.bestDepth = Math.max(this.state.combat.bestDepth, this.state.combat.depth);
      this.emit({ kind: 'cleared', depth, enemy: cleared });
      return;
    }

    if (this.phase === 'lost') {
      this.losses++;
      this.emit({ kind: 'defeat', depth: this.state.combat.depth, losses: this.losses });
      // Repeated wipes drop you back a level rather than parking you on a wall
      // you cannot pass — the grind should always be moving somewhere. Rebirth
      // is the real answer, and systems/wall.js is what says so.
      if (this.losses >= RETREAT_AFTER_LOSSES && this.state.combat.depth > 0) {
        this.state.combat.depth--;
        this.losses = 0;
        this.emit({ kind: 'retreat', depth: this.state.combat.depth });
      }
    }
  }

  /**
   * The boss outlasted you.
   *
   * You go back a whole stage — to the last level of the stage below, which is
   * that stage's boss and therefore something you have already proved you can
   * beat. And you *stay* there: `holding` stops the fight walking forward on
   * its own, so climbing back up is a decision you make rather than something
   * that happens to you while you are looking at another tab.
   *
   * Nothing is paid out and nothing is lost beyond the ground. The boss keeps
   * its full health, because a boss you softened and then ran out of time on is
   * a boss you did not beat.
   */
  timeOut() {
    this.settled = true; // there is nothing to settle: no reward, no defeat
    this.state.combat.bossTimeouts = (this.state.combat.bossTimeouts || 0) + 1;

    const from = this.state.combat.depth;
    const back = Math.max(0, from - LEVELS_PER_STAGE);
    this.state.combat.depth = back;
    this.state.combat.holding = true;
    this.losses = 0;

    this.emit({ kind: 'timeout', boss: this.enemy, from, depth: back });

    this.enemy = null;
    this.phase = 'idle';
  }

  /** Jump to a depth the player has already reached. No upper bound but theirs. */
  travelTo(depth) {
    const target = B.clamp(Math.floor(depth), 0, this.state.combat.bestDepth);
    this.state.combat.depth = target;
    // Travelling is the deliberate act the hold is waiting for. Clearing it
    // here rather than only on Forward means walking back on purpose also
    // releases it — being stuck in two ways at once is one way too many.
    this.state.combat.holding = false;
    this.losses = 0;
    this.phase = 'idle';
    this.enemy = null;
  }

  progress() {
    return {
      enemyHp: this.enemy ? this.enemy.hp / this.enemy.maxHp : 0,
      playerHp: this.playerMaxHp ? this.playerHp / this.playerMaxHp : 0,
      focus: this.focus / FOCUS_MAX,
      // The wind-up bar counts *down*, so it reads as time running out rather
      // than as something filling up.
      winding: this.winding,
      windUp: this.winding ? this.windUpLeft / TELEGRAPH_SECONDS : 0,
      braced: this.braced,
      ward: this.ward ? { element: this.ward.element, left: this.ward.left } : null,
      add: this.add ? this.add.hp / this.add.maxHp : null,
      enraged: this.enrage > 0,
      pattern: this.pattern,
      // null for anything that is not a boss, so the panel can tell "no clock"
      // from "no time left".
      bossTime: this.enemy?.boss ? Math.max(0, this.bossClock) : null,
      bossLimit: B.WALL_SECONDS,
      holding: !!this.state.combat.holding,
    };
  }

  /** Cooldown state for the three skill buttons. */
  skillStates() {
    return this.state.combat.skills.map((id) => {
      const skill = SKILLS_BY_ID[id];
      const left = Math.max(0, this.cooldowns[id] || 0);
      return {
        id,
        skill,
        left,
        ratio: skill?.cooldown ? 1 - left / skill.cooldown : 1,
        ready: left <= 0 && skill?.kind === 'active',
      };
    });
  }
}

export { buildEnemy, depthInfo, terrainForDepth, levelInStage, LEVELS_PER_STAGE };
