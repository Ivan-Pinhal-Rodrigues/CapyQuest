// The Quest panel: the fight itself, zone progress, and the stance selector.

import { fmt, fmtInt } from './numbers.js';
import { zoneForStage, stageInZone, isBossStage, STAGES_PER_ZONE, MAX_STAGE } from '../data/zones.js';
import { ELEMENTS, ELEMENT_IDS } from '../data/elements.js';
import { buildEnemy } from '../systems/combat.js';
import { spriteDataUrl } from './icons.js';
import { ENEMY_SHAPES } from '../render/enemySprites.js';

export class BattlePanel {
  constructor(root, { onToggleAuto, onTravel, onStance }) {
    this.root = root;
    this.onToggleAuto = onToggleAuto;
    this.onTravel = onTravel;
    this.onStance = onStance;
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
    for (let i = 0; i < STAGES_PER_ZONE; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      if (i === STAGES_PER_ZONE - 1) pip.classList.add('pip--boss');
      this.pips.appendChild(pip);
      this.pipNodes.push(pip);
    }
    r.appendChild(this.pips);

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
    const stage = state.combat.stage;
    const zone = zoneForStage(stage);
    const inZone = stageInZone(stage);

    setText(this.zoneName, zone.name);
    setText(this.zoneBlurb, zone.blurb);
    setText(this.stageLabel, `Stage ${stage + 1} / ${MAX_STAGE + 1}`);

    this.pipNodes.forEach((pip, i) => {
      pip.classList.toggle('is-done', i + 1 < inZone);
      pip.classList.toggle('is-current', i + 1 === inZone);
    });

    // Show the live enemy when fighting, otherwise a preview of what waits here.
    const enemy = combat.enemy || buildEnemy(stage);
    if (enemy.id !== this.currentEnemyId) {
      this.currentEnemyId = enemy.id;
      this.enemySprite.src = spriteDataUrl(
        ENEMY_SHAPES[enemy.shape],
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

    // --- controls
    this.autoBtn.textContent = state.combat.autoBattle ? 'Pause the fight' : 'Start fighting';
    this.autoBtn.classList.toggle('btn--primary', !state.combat.autoBattle);
    this.backBtn.disabled = stage <= 0;
    this.fwdBtn.disabled = stage >= Math.min(MAX_STAGE, state.combat.bestStage);
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
        this.logLine(`Fell back to stage ${ev.stage + 1}.`, 'lose');
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
