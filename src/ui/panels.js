// The trophy case, the stats sheet, and the settings dialog.

import { fmt, fmtInt, fmtPct, fmtTime, fmtMult } from './numbers.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { achievementProgress, describeReward } from '../systems/achievements.js';
import { totalBuildings } from '../systems/shop.js';
import { CLICK_UPGRADES } from '../data/clickUpgrades.js';
import { TIER_UPGRADES } from '../data/tierUpgrades.js';
import { openModal, el } from './modal.js';
import { exportSave, importSave } from '../save.js';
import { collectionProgress } from '../systems/gacha.js';

// ------------------------------------------------------------- achievements

export class AchievementPanel {
  constructor(root) {
    this.root = root;
    this.tiles = new Map();

    this.header = document.createElement('div');
    this.header.className = 'trophy-header';
    this.bar = document.createElement('div');
    this.bar.className = 'progress';
    this.fill = document.createElement('div');
    this.fill.className = 'progress__fill';
    this.bar.appendChild(this.fill);
    this.count = document.createElement('span');
    this.count.className = 'trophy-header__count';
    this.header.append(this.count, this.bar);

    this.grid = document.createElement('div');
    this.grid.className = 'trophy-grid';

    this.root.append(this.header, this.grid);
    this.build();
  }

  build() {
    for (const ach of ACHIEVEMENTS) {
      const tile = document.createElement('div');
      tile.className = 'trophy';

      const name = document.createElement('strong');
      name.className = 'trophy__name';

      const blurb = document.createElement('span');
      blurb.className = 'trophy__blurb';

      const reward = document.createElement('span');
      reward.className = 'trophy__reward';
      reward.textContent = describeReward(ach.reward);

      tile.append(name, blurb, reward);
      this.grid.appendChild(tile);
      this.tiles.set(ach.id, { tile, name, blurb });
    }
  }

  update(state) {
    const { done, total, ratio } = achievementProgress(state);
    this.count.textContent = `${done} / ${total}`;
    this.fill.style.transform = `scaleX(${ratio})`;

    for (const ach of ACHIEVEMENTS) {
      const entry = this.tiles.get(ach.id);
      const unlocked = !!state.achievements[ach.id];
      // Secret achievements stay masked until earned — the tease is the point.
      const hidden = ach.secret && !unlocked;

      entry.tile.classList.toggle('is-unlocked', unlocked);
      entry.tile.classList.toggle('is-secret', hidden);
      setText(entry.name, hidden ? '???' : ach.name);
      setText(entry.blurb, hidden ? 'A secret, for now.' : ach.blurb);
    }
  }
}

// -------------------------------------------------------------------- stats

export class StatsPanel {
  constructor(root) {
    this.root = root;
    this.rows = new Map();
    this.list = document.createElement('dl');
    this.list.className = 'stats';
    this.root.appendChild(this.list);
  }

  row(label, value) {
    let entry = this.rows.get(label);
    if (!entry) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      this.list.append(dt, dd);
      entry = dd;
      this.rows.set(label, entry);
    }
    setText(entry, value);
  }

  update(state, derived, now) {
    const ownedUpgrades =
      Object.keys(state.clickUpgrades).length + Object.keys(state.tierUpgrades).length;
    const totalUpgrades = CLICK_UPGRADES.length + TIER_UPGRADES.length;

    this.row('Zen in hand', fmt(state.zen));
    this.row('Zen this run', fmt(state.lifetimeZen));
    this.row('Zen all time', fmt(state.totalZen));
    this.row('Zen per second', `${fmt(derived.zps)}/s`);
    this.row('Zen per tap', fmt(derived.clickValue));
    this.row('Taps', fmtInt(state.lifetimeClicks));
    this.row('Tapped zen', fmt(state.stats.handmadeZen));
    this.row('Critical taps', fmtInt(state.stats.crits));
    this.row('Crit chance', fmtPct(derived.critChance));
    this.row('Crit damage', fmtMult(derived.critMult));
    this.row('Best combo', `${fmtInt(state.stats.bestCombo)}×`);
    this.row('Generators owned', fmtInt(totalBuildings(state)));
    this.row('Upgrades bought', `${ownedUpgrades} / ${totalUpgrades}`);
    this.row('Goldens caught', fmtInt(state.stats.goldens));
    this.row('Nap reports', fmtInt(state.stats.naps));
    this.row('Global multiplier', fmtMult(derived.globalMult));

    // --- quest line
    if (state.combat.bestStage > 0 || state.combat.clears > 0) {
      this.row('Best stage', fmtInt(state.combat.bestStage + 1));
      this.row('Stages cleared', fmtInt(state.combat.clears));
      this.row('Bosses beaten', fmtInt(state.combat.bossKills));
      this.row('Gear found', fmtInt(state.stats.drops));
      this.row('Gear enhanced', fmtInt(state.stats.forges));
    }

    // --- meta
    if (state.gacha.pulls > 0) {
      const collection = collectionProgress(state);
      this.row('Summons', fmtInt(state.gacha.pulls));
      this.row('Five stars', fmtInt(state.gacha.fiveStars));
      this.row('Roster', `${collection.owned}/${collection.total} · ${fmtPct(collection.ratio, 0)}`);
    }
    if (state.prestigeCount > 0 || state.lifetimeYuzu > 0) {
      this.row('Prestiges', fmtInt(state.prestigeCount));
      this.row('Yuzu all time', fmt(state.lifetimeYuzu));
    }
    if (state.ascendCount > 0) {
      this.row('Ascensions', fmtInt(state.ascendCount));
      this.row('Lotus all time', fmt(state.lifetimeLotus));
    }

    // --- retention
    if (state.login.total > 0) {
      this.row('Login streak', `${fmtInt(state.login.streak)} · best ${fmtInt(state.login.best)}`);
      this.row('Days played', fmtInt(state.login.total));
    }
    if (state.stats.questsDone > 0) this.row('Quests done', fmtInt(state.stats.questsDone));
    if (state.stats.chestsOpened > 0) this.row('Chests opened', fmtInt(state.stats.chestsOpened));

    this.row('Session', fmtTime(state.stats.sessionMs));
    this.row('Total played', fmtTime(state.stats.playMs));
    this.row('Pond founded', new Date(state.createdAt).toLocaleDateString());
    this.row('Offline cap', fmtTime(derived.offlineCapMs));
    void now;
  }
}

// ----------------------------------------------------------------- settings

export function openSettings(state, { onChange, onReset, onCode, toaster }) {
  const body = el('div', 'settings');

  body.appendChild(toggle('Sound effects', state.settings.sound, (v) => {
    state.settings.sound = v;
    onChange();
  }));

  body.appendChild(slider('Volume', state.settings.volume, (v) => {
    state.settings.volume = v;
    onChange();
  }));

  body.appendChild(toggle('Reduced motion', state.settings.reducedMotion, (v) => {
    state.settings.reducedMotion = v;
    onChange();
  }));

  body.appendChild(el('hr', 'settings__rule'));

  // --- secret codes
  const codeRow = el('div', 'settings__row settings__row--stack');
  codeRow.appendChild(el('span', 'settings__label', 'Secret code'));

  const codeEntry = el('div', 'settings__code-entry');
  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.className = 'settings__code-input';
  codeInput.placeholder = 'type something';
  codeInput.autocomplete = 'off';
  codeInput.spellcheck = false;

  const codeBtn = el('button', 'btn btn--small', 'Redeem');
  codeBtn.type = 'button';
  const submitCode = () => {
    if (!codeInput.value.trim()) return;
    if (onCode?.(codeInput.value)) codeInput.value = '';
  };
  codeBtn.addEventListener('click', submitCode);
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCode();
    }
    // Space would otherwise fall through to the tap-the-capybara shortcut.
    e.stopPropagation();
  });

  codeEntry.append(codeInput, codeBtn);
  codeRow.appendChild(codeEntry);
  codeRow.appendChild(
    el('span', 'settings__hint', `${Object.keys(state.codes || {}).length} redeemed so far.`),
  );
  body.appendChild(codeRow);

  body.appendChild(el('hr', 'settings__rule'));

  const saveRow = el('div', 'settings__row');
  saveRow.appendChild(el('span', 'settings__label', 'Save data'));

  const saveActions = el('div', 'settings__actions');

  const exportBtn = el('button', 'btn btn--small', 'Copy save code');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', async () => {
    const code = exportSave(state);
    try {
      await navigator.clipboard.writeText(code);
      toaster.show({ title: 'Save code copied', body: 'Paste it somewhere safe.', kind: 'info' });
    } catch {
      // Clipboard can be blocked by permissions or a non-secure context —
      // fall back to showing the code so the player can copy it by hand.
      showCode(code);
    }
  });

  const importBtn = el('button', 'btn btn--small', 'Load save code');
  importBtn.type = 'button';
  importBtn.addEventListener('click', () => promptImport(state, onChange, toaster));

  saveActions.append(exportBtn, importBtn);
  saveRow.appendChild(saveActions);
  body.appendChild(saveRow);

  const dangerRow = el('div', 'settings__row');
  dangerRow.appendChild(el('span', 'settings__label', 'Start over'));
  const wipe = el('button', 'btn btn--small btn--danger', 'Wipe the pond');
  wipe.type = 'button';
  wipe.addEventListener('click', () => confirmReset(onReset));
  dangerRow.appendChild(wipe);
  body.appendChild(dangerRow);

  openModal({ title: 'Settings', bodyNode: body, actions: [{ label: 'Done', variant: 'primary' }] });
}

function toggle(label, value, onInput) {
  const row = el('label', 'settings__row settings__row--toggle');
  row.appendChild(el('span', 'settings__label', label));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.className = 'settings__toggle';
  input.addEventListener('change', () => onInput(input.checked));
  row.appendChild(input);
  return row;
}

function slider(label, value, onInput) {
  const row = el('label', 'settings__row');
  row.appendChild(el('span', 'settings__label', label));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.05';
  input.value = String(value);
  input.className = 'settings__slider';
  input.addEventListener('input', () => onInput(Number(input.value)));
  row.appendChild(input);
  return row;
}

function showCode(code) {
  const body = el('div', 'settings');
  body.appendChild(el('p', 'settings__note', 'Copy this code and keep it somewhere safe.'));
  const area = document.createElement('textarea');
  area.className = 'settings__code';
  area.readOnly = true;
  area.value = code;
  area.rows = 6;
  body.appendChild(area);
  openModal({ title: 'Your save code', bodyNode: body, actions: [{ label: 'Done', variant: 'primary' }] });
  setTimeout(() => area.select(), 30);
}

function promptImport(state, onChange, toaster) {
  const body = el('div', 'settings');
  body.appendChild(
    el('p', 'settings__note', 'Loading a save code replaces your current pond. This cannot be undone.'),
  );
  const area = document.createElement('textarea');
  area.className = 'settings__code';
  area.placeholder = 'CAPY1.…';
  area.rows = 6;
  body.appendChild(area);

  openModal({
    title: 'Load a save code',
    bodyNode: body,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Load it',
        variant: 'primary',
        onClick: () => {
          try {
            const loaded = importSave(area.value);
            onChange(loaded);
            toaster.show({ title: 'Save loaded', body: 'Welcome back.', kind: 'info' });
          } catch (err) {
            toaster.show({ title: 'That code did not work', body: err.message, kind: 'warn' });
          }
        },
      },
    ],
  });
}

function confirmReset(onReset) {
  const body = el('div', 'settings');
  body.appendChild(
    el(
      'p',
      'settings__note',
      'This erases every generator, upgrade, achievement and trophy. There is no undo and no prestige credit.',
    ),
  );
  openModal({
    title: 'Wipe the pond?',
    bodyNode: body,
    actions: [
      { label: 'Keep my pond' },
      { label: 'Erase everything', variant: 'danger', onClick: () => onReset() },
    ],
  });
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
