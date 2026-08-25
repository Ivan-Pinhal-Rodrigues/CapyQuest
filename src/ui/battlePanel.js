// The Quest panel: the fight itself, stage progress, the stance selector, and
// the wall warning that tells you when the run is over.

import { fmt, fmtInt, fmtTime } from './numbers.js';
import { LEVELS_PER_STAGE } from '../balance.js';
import { ELEMENTS, ELEMENT_IDS } from '../data/elements.js';
import { buildEnemy, depthInfo, terrainForDepth } from '../systems/stages.js';
import { assess } from '../systems/wall.js';
import { spriteDataUrl } from './icons.js';
import { SHAPES } from '../render/shapes.js';

export class BattlePanel {
  constructor(root, { onToggleAuto, onTravel, onStance, onCast, onToggleAutoCast }) {
    this.root = root;
    this.onToggleAuto = onToggleAuto;
    this.onTravel = onTravel;
    this.onStance = onStance;
    this.onCast = onCast;
    this.onToggleAutoCast = onToggleAutoCast;
    this.currentEnemyId = null;
    this.build();
  }

  build() {
    const r = this.root;

    // --- zone header
    this.zoneName = div('battle__zone-name');
    this.zoneBlurb = div('battle__zone-blurb');
    this.stageLabel = div('battle__stage');
    const header = div('battle__header');
    header.append(this.zoneName, this.stageLabel);
    r.append(header, this.zoneBlurb);

    // --- zone progress pips: ten stages, boss last
    this.pips = div('battle__pips');
    this.pipNodes = [];
    for (let i = 0; i < LEVELS_PER_STAGE; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      if (i === LEVELS_PER_STAGE - 1) pip.classList.add('pip--boss');
      this.pips.appendChild(pip);
      this.pipNodes.push(pip);
    }
    r.appendChild(this.pips);

    // --- wall warning
    this.wall = div('wall');
    this.wallTitle = div('wall__title');
    this.wallBody = div('wall__body');
    const wallTrack = div('wall__track');
    this.wallFill = div('wall__fill');
    wallTrack.appendChild(this.wallFill);
    this.wall.append(this.wallTitle, this.wallBody, wallTrack);
    this.wall.hidden = true;
    r.appendChild(this.wall);

    // --- the enemy
    this.arena = div('battle__arena');
    this.enemySprite = document.createElement('img');
    this.enemySprite.className = 'battle__enemy pixel-icon';
    this.enemySprite.alt = '';
    this.enemyName = div('battle__enemy-name');
    this.enemyElement = div('battle__enemy-element');

    this.enemyBar = bar('hp-bar hp-bar--enemy');
    this.enemyHpText = div('battle__hp-text');

    this.arena.append(
      this.enemySprite,
      this.enemyName,
      this.enemyElement,
      this.enemyBar.wrap,
      this.enemyHpText,
    );
    r.appendChild(this.arena);

    // --- the capybara's own bar
    this.playerBar = bar('hp-bar hp-bar--player');
    const playerRow = div('battle__player');
    this.playerLabel = div('battle__player-label', 'You');
    playerRow.append(this.playerLabel, this.playerBar.wrap);
    r.appendChild(playerRow);

    // --- the interactive layer
    //
    // Three things the player can act on, in the order they matter: the
    // wind-up (act *now*), Focus (a resource that is filling), and the three
    // skills (what you spend attention on).
    //
    // They live in one wrapper because on a phone this cluster becomes a
    // sticky HUD pinned to the bottom of the panel. A 0.8-second window is
    // unusable if reading it requires a scroll, and the skill buttons have to
    // be under a thumb rather than somewhere below the fold.
    this.fightbar = div('fightbar');

    this.tellRow = div('tell');
    this.tellLabel = div('tell__label', 'Brace!');
    this.tellBar = bar('tellbar');
    this.tellRow.append(this.tellLabel, this.tellBar.wrap);
    this.tellRow.hidden = true;
    this.fightbar.appendChild(this.tellRow);

    this.patternRow = div('battle__pattern');
    this.patternRow.hidden = true;
    this.fightbar.appendChild(this.patternRow);

    const focusWrap = div('focus');
    this.focusLabel = div('focus__label', 'Focus');
    this.focusBar = bar('focusbar');
    focusWrap.append(this.focusLabel, this.focusBar.wrap);
    this.fightbar.appendChild(focusWrap);

    this.skillRow = div('skillbar');
    this.skillButtons = [];
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skillbtn';
      const key = div('skillbtn__key', String(i + 1));
      const name = div('skillbtn__name');
      const cd = div('skillbtn__cd');
      btn.append(key, name, cd);
      btn.addEventListener('click', () => this.onCast(i));
      this.skillRow.appendChild(btn);
      this.skillButtons.push({ btn, name, cd });
    }
    this.fightbar.appendChild(this.skillRow);

    this.autoCastBtn = document.createElement('button');
    this.autoCastBtn.type = 'button';
    this.autoCastBtn.className = 'btn btn--small autocast';
    this.autoCastBtn.addEventListener('click', () => this.onToggleAutoCast());
    this.fightbar.appendChild(this.autoCastBtn);

    r.appendChild(this.fightbar);

    // --- stance selector
    const stanceWrap = div('stance');
    stanceWrap.appendChild(div('stance__label', 'Stance'));
    this.stanceButtons = new Map();
    const stanceRow = div('stance__row');
    for (const id of ELEMENT_IDS) {
      const el = ELEMENTS[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stance__btn';
      btn.textContent = el.icon;
      btn.title = `${el.name} — strong against ${ELEMENTS[el.strong].name}`;
      btn.setAttribute('aria-label', el.name);
      btn.addEventListener('click', () => this.onStance(id));
      stanceRow.appendChild(btn);
      this.stanceButtons.set(id, btn);
    }
    stanceWrap.appendChild(stanceRow);
    this.matchup = div('stance__matchup');
    stanceWrap.appendChild(this.matchup);
    r.appendChild(stanceWrap);

    // --- controls
    const controls = div('battle__controls');

    this.autoBtn = document.createElement('button');
    this.autoBtn.type = 'button';
    this.autoBtn.className = 'btn btn--primary';
    this.autoBtn.addEventListener('click', () => this.onToggleAuto());

    this.backBtn = smallBtn('◀ Back', () => this.onTravel(-1));
    this.fwdBtn = smallBtn('Forward ▶', () => this.onTravel(1));

    controls.append(this.backBtn, this.autoBtn, this.fwdBtn);
    r.appendChild(controls);

    this.log = div('battle__log');
    r.appendChild(this.log);
  }

  /** Push a line into the rolling combat log. */
  logLine(text, kind = '') {
    const line = document.createElement('div');
    line.className = `battle__log-line${kind ? ` is-${kind}` : ''}`;
    line.textContent = text;
    this.log.prepend(line);
    while (this.log.childElementCount > 6) this.log.lastElementChild.remove();
  }

  update(state, combat, stats) {
    const depth = state.combat.depth;
    const { stage, level } = depthInfo(depth);
    const terrain = terrainForDepth(depth);

    setText(this.zoneName, terrain.displayName);
    setText(this.zoneBlurb, terrain.blurb);
    // No denominator any more — there is no last stage to count towards.
    setText(this.stageLabel, `Stage ${stage + 1} · Lv ${level + 1}/${LEVELS_PER_STAGE}`);

    this.pipNodes.forEach((pip, i) => {
      pip.classList.toggle('is-done', i < level);
      pip.classList.toggle('is-current', i === level);
    });

    this.updateWall(state, stats, stage);

    // Show the live enemy when fighting, otherwise a preview of what waits here.
    const enemy = combat.enemy || buildEnemy(depth);
    if (enemy.id !== this.currentEnemyId) {
      this.currentEnemyId = enemy.id;
      this.enemySprite.src = spriteDataUrl(
        SHAPES[enemy.shape],
        enemy.palette,
        `enemy:${enemy.id}`,
      );
      this.enemySprite.alt = enemy.name;
      setText(this.enemyName, enemy.name);
      const el = ELEMENTS[enemy.element];
      setText(this.enemyElement, `${el.icon} ${el.name}`);
      this.enemyElement.style.color = el.color;
      this.enemySprite.classList.toggle('is-boss', !!enemy.boss);
    }

    const hpRatio = combat.enemy ? combat.enemy.hp / combat.enemy.maxHp : 1;
    this.enemyBar.fill.style.transform = `scaleX(${Math.max(0, hpRatio)})`;
    setText(
      this.enemyHpText,
      combat.enemy ? `${fmt(Math.max(0, combat.enemy.hp))} / ${fmt(combat.enemy.maxHp)}` : `${fmt(enemy.maxHp)} HP`,
    );

    const pRatio = combat.playerMaxHp ? combat.playerHp / combat.playerMaxHp : 1;
    this.playerBar.fill.style.transform = `scaleX(${Math.max(0, pRatio)})`;
    this.playerBar.fill.classList.toggle('is-low', pRatio < 0.3);
    setText(this.playerLabel, `Lv ${stats.level} · ${fmtInt(Math.max(0, combat.playerHp))} HP`);

    // --- stance
    for (const [id, btn] of this.stanceButtons) {
      btn.classList.toggle('is-active', state.combat.element === id);
    }
    this.updateMatchup(state.combat.element, enemy.element);

    // --- the interactive layer
    this.updateFight(state, combat);

    // --- controls
    this.autoBtn.textContent = state.combat.autoBattle ? 'Pause the fight' : 'Start fighting';
    this.autoBtn.classList.toggle('btn--primary', !state.combat.autoBattle);
    this.backBtn.disabled = depth <= 0;
    this.fwdBtn.disabled = depth >= state.combat.bestDepth;
  }

  /**
   * The wind-up, Focus and the skill buttons.
   *
   * Runs every frame, so every write is guarded — this is the part of the
   * screen that changes fastest and the part most able to cost frames.
   */
  updateFight(state, combat) {
    const p = combat.progress();

    // --- the wind-up. The bar drains, so it reads as time running out.
    const winding = !!p.winding;
    if (this.tellRow.hidden === winding) this.tellRow.hidden = !winding;
    if (winding) {
      this.tellBar.fill.style.transform = `scaleX(${Math.max(0, p.windUp)})`;
      this.tellRow.classList.toggle('is-braced', p.braced);
      setText(this.tellLabel, p.braced ? 'Braced' : 'Brace!');
    }

    // --- what this boss does differently
    const pattern = p.pattern;
    const showPattern = !!pattern;
    if (this.patternRow.hidden === showPattern) this.patternRow.hidden = !showPattern;
    if (pattern) {
      let text = `${pattern.name} — ${pattern.blurb}`;
      if (p.ward) {
        const el = p.ward.element ? ELEMENTS[p.ward.element] : null;
        text = el
          ? `Warded. It fears ${el.icon} ${el.name} — switch stance, or wait ${Math.ceil(p.ward.left)}s.`
          : `Warded. Nothing counters it — wait ${Math.ceil(p.ward.left)}s.`;
      } else if (p.add != null) {
        text = 'Escorted. The escort soaks your hits until it falls.';
      } else if (p.enraged) {
        text = 'Impatient. It is getting faster — finish this.';
      }
      setText(this.patternRow, text);
      this.patternRow.classList.toggle('is-urgent', !!p.ward || p.add != null || p.enraged);
    }

    // --- focus
    this.focusBar.fill.style.transform = `scaleX(${p.focus})`;
    this.focusBar.fill.classList.toggle('is-full', p.focus >= 0.999);
    setText(this.focusLabel, p.focus >= 0.999 ? 'Focus — full' : 'Focus');

    // --- the three skills
    const states = combat.skillStates();
    for (let i = 0; i < this.skillButtons.length; i++) {
      const ref = this.skillButtons[i];
      const s = states[i];
      const has = !!s?.skill;
      if (ref.btn.hidden === has) ref.btn.hidden = !has;
      if (!has) continue;

      setText(ref.name, s.skill.name);
      setText(ref.cd, s.ready ? 'Ready' : `${s.left.toFixed(1)}s`);
      ref.btn.classList.toggle('is-ready', s.ready);
      ref.btn.disabled = !s.ready || !state.combat.autoBattle;
      ref.btn.title = s.skill.blurb;
    }

    // Auto-cast is only worth showing once there is a skill to cast.
    const anySkill = states.some((s) => s.skill);
    if (this.skillRow.hidden === anySkill) this.skillRow.hidden = !anySkill;
    if (this.autoCastBtn.hidden === anySkill) this.autoCastBtn.hidden = !anySkill;
    const auto = state.combat.autoCast !== false;
    setText(this.autoCastBtn, auto ? 'Skills: automatic' : 'Skills: by hand');
    this.autoCastBtn.classList.toggle('is-manual', !auto);
    this.autoCastBtn.title = auto
      ? 'Skills fire themselves the moment they are ready. Tap to cast them yourself and spend Focus when it suits you.'
      : 'You cast the skills. Holding one until Focus is full is worth up to +60%.';
  }

  /**
   * The wall banner. This is the whole point of the rebirth redesign: the game
   * says "you are stuck" out loud, with the number, instead of leaving the
   * player to grind into a ceiling they cannot see.
   */
  updateWall(state, stats, stage) {
    const report = assess(stage, stats);
    const walled = report.walled && stage >= 1;

    this.wall.hidden = !walled && report.pressure < 0.55;
    if (this.wall.hidden) return;

    this.wall.classList.toggle('is-walled', walled);
    setText(
      this.wallTitle,
      walled ? 'You are stuck here' : 'This boss is getting slow',
    );
    setText(
      this.wallBody,
      Number.isFinite(report.ttk)
        ? `${report.boss.name} would take ${fmtTime(report.ttk * 1000)} to bring down. Thirty seconds is the limit.`
        : `${report.boss.name} cannot be hurt with what you are carrying.`,
    );
    this.wallFill.style.transform = `scaleX(${Math.min(1, report.ttk / report.seconds)})`;
  }

  updateMatchup(mine, theirs) {
    const a = ELEMENTS[mine];
    const b = ELEMENTS[theirs];
    if (!a || !b) return;

    let text;
    let cls = '';
    if (a.strong === theirs) {
      text = `${a.name} beats ${b.name} — you hit for 150%.`;
      cls = 'is-good';
    } else if (b.strong === mine) {
      text = `${b.name} beats ${a.name} — you hit for 75%.`;
      cls = 'is-bad';
    } else {
      text = 'Neutral matchup.';
    }
    setText(this.matchup, text);
    this.matchup.className = `stance__matchup ${cls}`;
  }

  /** Turn combat events into log lines. */
  consume(events) {
    for (const ev of events) {
      if (ev.kind === 'cleared') {
        this.logLine(
          `${ev.enemy.name} defeated${ev.enemy.boss ? ' — boss down!' : ''}`,
          ev.enemy.boss ? 'boss' : 'win',
        );
      } else if (ev.kind === 'defeat') {
        this.logLine('You went down. Getting back up.', 'lose');
      } else if (ev.kind === 'retreat') {
        this.logLine(`Fell back to level ${ev.depth + 1}.`, 'lose');
      } else if (ev.kind === 'skill') {
        this.logLine(ev.heal ? `${ev.skill} — recovered ${fmt(ev.heal)} HP` : `${ev.skill}!`, 'skill');
      }
    }
  }

  /** Damage numbers over the enemy sprite. */
  showHit({ amount, crit, element }) {
    const node = document.createElement('span');
    node.className = `dmg${crit ? ' dmg--crit' : ''}${element > 1 ? ' dmg--super' : ''}`;
    node.textContent = fmt(amount);
    node.style.left = `${42 + Math.random() * 16}%`;
    this.arena.appendChild(node);
    setTimeout(() => node.remove(), 900);
  }
}

// -------------------------------------------------------------------- helpers

function div(className, text) {
  const node = document.createElement('div');
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function bar(className) {
  const wrap = div(className);
  const fill = div(`${className.split(' ')[0]}__fill`);
  wrap.appendChild(fill);
  return { wrap, fill };
}

function smallBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--small';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
