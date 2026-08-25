// The Daily panel: quests, the timed chest, the login calendar and the Zen Pass.

import { fmtInt, fmtClock, fmtTime } from './numbers.js';
import {
  activeQuests, questSummary, chestsReady, chestProgress, msUntilNextChest,
  msUntilTomorrow, loginCalendar, passProgress, passTrack,
  CHEST_MAX_STORED,
} from '../systems/quests.js';

export class DailyPanel {
  constructor(root, { onClaimQuest, onCollectChest, onClaimPass }) {
    this.root = root;
    this.h = { onClaimQuest, onCollectChest, onClaimPass };
    this.questNodes = new Map();
    this.passNodes = new Map();
    this.calendarNodes = [];
    this.build();
  }

  build() {
    const r = this.root;

    // --- chest
    this.chestCard = div('chest');
    this.chestTitle = add(this.chestCard, 'div', 'chest__title', 'Onsen Chest');
    this.chestTimer = add(this.chestCard, 'div', 'chest__timer');
    const track = div('chest__track');
    this.chestFill = div('chest__fill');
    track.appendChild(this.chestFill);
    this.chestCard.appendChild(track);
    this.chestBtn = button('btn btn--gold', 'Collect', () => this.h.onCollectChest());
    this.chestCard.appendChild(this.chestBtn);
    r.appendChild(this.chestCard);

    // --- quests
    const questHead = div('daily__head');
    this.questTitle = add(questHead, 'h3', 'kit__heading', 'Quests');
    this.questReset = add(questHead, 'span', 'daily__reset');
    r.appendChild(questHead);

    this.questList = div('quest-list');
    r.appendChild(this.questList);

    // --- login streak
    r.appendChild(heading('Login streak'));
    this.streakLine = add(r, 'p', 'streak__line');
    this.calendar = div('calendar');
    for (let i = 0; i < 7; i++) {
      const cell = div('calendar__day');
      const label = add(cell, 'span', 'calendar__label', `Day ${i + 1}`);
      const reward = add(cell, 'span', 'calendar__reward');
      this.calendar.appendChild(cell);
      this.calendarNodes.push({ cell, label, reward });
    }
    r.appendChild(this.calendar);

    // --- zen pass
    const passHead = div('daily__head');
    this.passTitle = add(passHead, 'h3', 'kit__heading', 'Zen Pass');
    this.passLevelLabel = add(passHead, 'span', 'daily__reset');
    r.appendChild(passHead);

    const passBar = div('progress');
    this.passFill = div('progress__fill');
    passBar.appendChild(this.passFill);
    r.appendChild(passBar);

    add(r, 'p', 'pass__note', 'Free track only. Nothing here is for sale.');

    this.passTrackEl = div('pass-track');
    r.appendChild(this.passTrackEl);
  }

  update(state, now = Date.now()) {
    this.updateChest(state, now);
    this.updateQuests(state, now);
    this.updateStreak(state);
    this.updatePass(state);
  }

  updateChest(state, now) {
    const ready = chestsReady(state, now);
    const progress = chestProgress(state, now);
    const wait = msUntilNextChest(state, now);

    this.chestFill.style.transform = `scaleX(${progress})`;
    this.chestCard.classList.toggle('is-ready', ready > 0);
    this.chestCard.classList.toggle('is-full', ready >= CHEST_MAX_STORED);

    setText(
      this.chestTimer,
      ready >= CHEST_MAX_STORED
        ? `${CHEST_MAX_STORED} waiting — full up`
        : ready > 0
          ? `${ready} waiting · next in ${fmtClock(wait)}`
          : `Next in ${fmtClock(wait)}`,
    );

    this.chestBtn.textContent = ready > 0 ? `Collect ${ready}` : 'Not yet';
    this.chestBtn.disabled = ready <= 0;
  }

  updateQuests(state, now) {
    const quests = activeQuests(state);
    const summary = questSummary(state);
    setText(this.questTitle, `Quests ${summary.done}/${summary.total}`);
    setText(this.questReset, `resets in ${fmtTime(msUntilTomorrow(now))}`);

    const seen = new Set();
    for (const quest of quests) {
      seen.add(quest.id);
      let entry = this.questNodes.get(quest.id);
      if (!entry) {
        const row = div('quest');
        const main = div('quest__main');
        const text = add(main, 'span', 'quest__text');
        const bar = div('quest__track');
        const fill = div('quest__fill');
        bar.appendChild(fill);
        main.appendChild(bar);
        const count = add(main, 'span', 'quest__count');

        const claim = button('btn btn--small quest__claim', 'Claim', () => this.h.onClaimQuest(quest.id));
        row.append(main, claim);
        this.questList.appendChild(row);
        entry = { row, text, fill, count, claim };
        this.questNodes.set(quest.id, entry);
      }

      setText(entry.text, quest.text);
      setText(entry.count, `${fmtInt(quest.progress)} / ${fmtInt(quest.goal)}`);
      entry.fill.style.transform = `scaleX(${quest.progress / quest.goal})`;
      entry.row.classList.toggle('is-done', quest.done);
      entry.row.classList.toggle('is-claimed', quest.claimed);
      entry.row.classList.toggle('is-weekly', quest.kind === 'weekly');
      entry.claim.hidden = quest.claimed || !quest.done;
      entry.claim.textContent = 'Claim';
      // Order daily before weekly, claimable first — the thing you can act on
      // should never be below the thing you cannot.
      entry.row.style.order = String(
        (quest.done && !quest.claimed ? 0 : quest.claimed ? 20 : 10) + (quest.kind === 'weekly' ? 5 : 0),
      );
    }

    for (const [id, entry] of this.questNodes) {
      if (seen.has(id)) continue;
      entry.row.remove();
      this.questNodes.delete(id);
    }
  }

  updateStreak(state) {
    const streak = state.login.streak || 0;
    setText(
      this.streakLine,
      streak > 0
        ? `${streak} day${streak === 1 ? '' : 's'} running · best ${state.login.best}`
        : 'Come back tomorrow to start a streak.',
    );

    loginCalendar(state).forEach((day, i) => {
      const node = this.calendarNodes[i];
      const bits = [];
      if (day.tickets) bits.push(`${day.tickets}🎟`);
      if (day.shards) bits.push(`${day.shards}⬡`);
      if (!bits.length) bits.push('zen');
      setText(node.reward, bits.join(' '));
      node.cell.classList.toggle('is-claimed', day.claimed);
      node.cell.classList.toggle('is-current', day.current || day.pending);
      node.cell.title = day.text;
    });
  }

  updatePass(state) {
    const p = passProgress(state);
    setText(this.passTitle, `Zen Pass · Lv ${p.level}`);
    setText(this.passLevelLabel, p.maxed ? 'complete' : `${p.into}/${p.needed} xp`);
    this.passFill.style.transform = `scaleX(${p.ratio})`;

    for (const tier of passTrack(state)) {
      let entry = this.passNodes.get(tier.level);
      if (!entry) {
        const node = button('pass-tier', '', () => this.h.onClaimPass(tier.level));
        const lvl = add(node, 'span', 'pass-tier__level', String(tier.level));
        const reward = add(node, 'span', 'pass-tier__reward', tier.reward.text);
        this.passTrackEl.appendChild(node);
        entry = { node, lvl, reward };
        this.passNodes.set(tier.level, entry);
      }
      entry.node.classList.toggle('is-unlocked', tier.unlocked);
      entry.node.classList.toggle('is-claimed', tier.claimed);
      entry.node.classList.toggle('is-ready', tier.unlocked && !tier.claimed);
      entry.node.disabled = !tier.unlocked || tier.claimed;
      entry.node.title = `Level ${tier.level} — ${tier.reward.text}`;
    }
  }
}

// -------------------------------------------------------------------- helpers

function div(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

function add(parent, tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function heading(text) {
  const h = document.createElement('h3');
  h.className = 'kit__heading';
  h.textContent = text;
  return h;
}

function button(className, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  if (label) btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
