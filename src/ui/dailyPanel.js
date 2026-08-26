// The Daily panel: quests, the timed chest and the login calendar.
//
// The season pass used to live here too. At forty levels it fitted; at a
// hundred across two tracks it did not, so it has its own screen — see
// ui/seasonPanel.js.

import { fmtInt, fmtClock, fmtTime } from './numbers.js';
import {
  activeQuests, questSummary, chestsReady, chestProgress, msUntilNextChest,
  msUntilTomorrow, loginCalendar, questOffers,
  CHEST_MAX_STORED,
} from '../systems/quests.js';
import { REROLL_COST } from '../data/quests.js';

export class DailyPanel {
  constructor(root, { onClaimQuest, onCollectChest, onChooseQuest, onReroll, onClaimAll }) {
    this.root = root;
    this.h = { onClaimQuest, onCollectChest, onChooseQuest, onReroll, onClaimAll };
    this.offerNodes = new Map();
    this.questNodes = new Map();
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

    // --- the picker
    //
    // Sits above the list because until the slots are full it is the only
    // thing on this screen worth doing.
    this.picker = div('picker');
    this.pickerHead = add(this.picker, 'p', 'picker__head');
    this.pickerList = div('picker__list');
    this.picker.appendChild(this.pickerList);
    this.rerollBtn = button('btn btn--small picker__reroll', '', () => this.h.onReroll('daily'));
    this.picker.appendChild(this.rerollBtn);
    this.picker.hidden = true;
    r.appendChild(this.picker);

    this.questList = div('quest-list');
    r.appendChild(this.questList);

    // One button for everything finished, rather than a row of identical taps.
    this.claimAllBtn = button('btn btn--primary quest__claim-all', '', () => this.h.onClaimAll());
    this.claimAllBtn.hidden = true;
    r.appendChild(this.claimAllBtn);

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

  }

  update(state, now = Date.now()) {
    this.updateChest(state, now);
    this.updateQuests(state, now);
    this.updateStreak(state);
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
    this.updatePicker(state);
    const quests = activeQuests(state);
    const summary = questSummary(state);
    // "Quests 0/0" before anything is picked reads like a bug rather than an
    // invitation, so an empty board says what to do instead of counting it.
    setText(
      this.questTitle,
      summary.total === 0 ? 'Quests — pick yours' : `Quests ${summary.done}/${summary.total}`,
    );
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

    // The single button replaces the row of identical Claim taps. The
    // individual ones stay for anyone who wants to take them one at a time —
    // what is removed is the obligation to.
    const ready = quests.filter((q) => q.done && !q.claimed).length;
    this.claimAllBtn.hidden = ready < 2;
    setText(this.claimAllBtn, `Collect all ${ready}`);
  }

  /**
   * The offer. Shown only while there are slots left, so the day settles once
   * you have chosen — a decision you can revisit all afternoon is not one.
   */
  updatePicker(state) {
    const daily = questOffers(state, 'daily');
    const weekly = questOffers(state, 'weekly');
    const open = daily.open || weekly.open;

    if (this.picker.hidden === open) this.picker.hidden = !open;
    if (!open) return;

    const kind = daily.open ? 'daily' : 'weekly';
    const info = daily.open ? daily : weekly;
    this.rerollBtn.onclick = () => this.h.onReroll(kind);

    const left = info.slots - info.taken;
    setText(
      this.pickerHead,
      `Pick ${left} more ${kind === 'daily' ? 'daily' : 'weekly'} quest${left === 1 ? '' : 's'} — ${info.offers.length} on offer`,
    );
    setText(this.rerollBtn, `New offer · ${REROLL_COST} 🍃`);
    this.rerollBtn.disabled = (state.leafs || 0) < REROLL_COST;

    const seen = new Set();
    for (const quest of info.offers) {
      seen.add(quest.id);
      let entry = this.offerNodes.get(quest.id);
      if (!entry) {
        const btn = button('offer', '', () => this.h.onChooseQuest(quest.id, kind));
        const text = add(btn, 'span', 'offer__text', quest.text);
        const pay = add(btn, 'span', 'offer__pay');
        this.pickerList.appendChild(btn);
        entry = { btn, text, pay };
        this.offerNodes.set(quest.id, entry);
      }
      entry.btn.hidden = false;
      entry.btn.onclick = () => this.h.onChooseQuest(quest.id, kind);
      setText(entry.pay, describeQuestReward(quest.reward));
    }
    for (const [id, entry] of this.offerNodes) {
      if (!seen.has(id)) entry.btn.hidden = true;
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

/** What a quest pays, in one short line. */
function describeQuestReward(reward = {}) {
  const parts = [];
  if (reward.pass) parts.push(`${reward.pass} pass xp`);
  if (reward.tickets) parts.push(`${reward.tickets} ticket${reward.tickets === 1 ? '' : 's'}`);
  if (reward.leafs) parts.push(`${reward.leafs} leafs`);
  return parts.join(' · ') || 'a reward';
}
