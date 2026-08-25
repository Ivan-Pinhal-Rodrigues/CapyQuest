// Auto-battle. The capybara fights on its own; the player's input is what gear
// it wears, which skills are slotted, and when to push deeper.
//
// The simulation is a plain state machine advanced by dt, so it runs the same
// whether it is ticked at 60Hz or caught up in bigger steps.

import * as B from '../balance.js';
import { ELEMENT_CHART } from '../data/elements.js';
import { ENEMIES } from '../data/enemies.js';
import { SKILLS_BY_ID } from '../data/skills.js';
import { buildEnemy, depthInfo, terrainForDepth, levelInStage, LEVELS_PER_STAGE } from './stages.js';

const RETREAT_AFTER_LOSSES = 3;
// Short enough that a clear rolls straight into the next fight, long enough to
// read what you just killed.
const RESPAWN_DELAY = 0.8;
const DEFEAT_DELAY = 1.6;

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
    this.losses = 0;
    this.events = []; // drained by the UI each frame
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
    this.emit({ kind: 'engage', enemy: this.enemy });
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
      this.phaseTimer -= dt;
      if (this.phaseTimer > 0) return;
      this.engage(stats);
      return;
    }

    if (!this.enemy) {
      this.engage(stats);
      return;
    }

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
    this.enemyTimer -= dt;
    while (this.enemyTimer <= 0) {
      this.enemyAttack(stats);
      this.enemyTimer += this.enemy.attackEvery;
      if (this.phase !== 'fighting') return this.settle(onReward);
    }
  }

  playerAttack(stats) {
    const crit = Math.random() < stats.crit;
    const element = B.elementModifier(stats.element, this.enemy.element, ELEMENT_CHART);
    const dmg = B.damage({
      atk: stats.atk,
      def: this.enemy.def,
      crit,
      critMult: stats.critMult,
      element,
    });
    this.dealToEnemy(dmg, { crit, element, source: 'attack' });
  }

  dealToEnemy(dmg, meta) {
    this.enemy.hp -= dmg;
    this.emit({ kind: 'hit', target: 'enemy', amount: dmg, ...meta });
    if (this.enemy.hp <= 0) {
      this.enemy.hp = 0;
      this.phase = 'won';
      this.phaseTimer = RESPAWN_DELAY;
    }
  }

  enemyAttack(stats) {
    const element = B.elementModifier(this.enemy.element, stats.element, ELEMENT_CHART);
    const dmg = B.damage({ atk: this.enemy.atk, def: stats.def, element });
    this.playerHp -= dmg;
    this.emit({ kind: 'hit', target: 'player', amount: dmg, element });
    if (this.playerHp <= 0) {
      this.playerHp = 0;
      this.phase = 'lost';
      this.phaseTimer = DEFEAT_DELAY;
    }
  }

  tickSkills(dt, stats) {
    for (const id of this.state.combat.skills) {
      const skill = SKILLS_BY_ID[id];
      if (!skill || skill.kind !== 'active') continue;

      const ready = (this.cooldowns[id] || 0) - dt;
      this.cooldowns[id] = ready;
      if (ready > 0) continue;

      this.cooldowns[id] = skill.cooldown;
      this.castSkill(skill, stats);
      if (this.phase !== 'fighting') return;
    }
  }

  castSkill(skill, stats) {
    const e = skill.effect;

    if (e.type === 'heal') {
      const healed = Math.min(this.playerMaxHp - this.playerHp, this.playerMaxHp * e.pct);
      this.playerHp += healed;
      this.emit({ kind: 'skill', skill: skill.name, heal: healed });
      return;
    }

    if (e.type !== 'strike') return;

    const element = B.elementModifier(e.element || stats.element, this.enemy.element, ELEMENT_CHART);
    // ignoreDef shaves the enemy's defence for this hit only.
    const effDef = this.enemy.def * (1 - (e.ignoreDef || 0));
    const hpScale = e.scaleWithHp ? 1 + this.playerMaxHp / 4000 : 1;
    const crit = Math.random() < stats.crit;

    const dmg = B.damage({
      atk: stats.atk * e.mult * hpScale,
      def: effDef,
      crit,
      critMult: stats.critMult,
      element,
    });

    this.emit({ kind: 'skill', skill: skill.name });
    this.dealToEnemy(dmg, { crit, element, source: 'skill', skill: skill.name });

    if (e.healPct) {
      const healed = Math.min(this.playerMaxHp - this.playerHp, this.playerMaxHp * e.healPct);
      this.playerHp += healed;
    }
    if (e.selfStun) this.stunUntil = this.clock + e.selfStun;
  }

  /** Resolve a finished fight: pay out, advance or retreat. */
  settle(onReward) {
    if (this.phase === 'won') {
      this.losses = 0;
      const depth = this.state.combat.depth;
      const cleared = this.enemy;
      this.state.combat.clears = (this.state.combat.clears || 0) + 1;
      if (cleared.boss) this.state.combat.bossKills = (this.state.combat.bossKills || 0) + 1;

      onReward?.({ depth, stage: cleared.stage, enemy: cleared });

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

  /** Jump to a depth the player has already reached. No upper bound but theirs. */
  travelTo(depth) {
    const target = B.clamp(Math.floor(depth), 0, this.state.combat.bestDepth);
    this.state.combat.depth = target;
    this.losses = 0;
    this.phase = 'idle';
    this.enemy = null;
  }

  progress() {
    return {
      enemyHp: this.enemy ? this.enemy.hp / this.enemy.maxHp : 0,
      playerHp: this.playerMaxHp ? this.playerHp / this.playerMaxHp : 0,
    };
  }
}

export { buildEnemy, depthInfo, terrainForDepth, levelInStage, LEVELS_PER_STAGE };
