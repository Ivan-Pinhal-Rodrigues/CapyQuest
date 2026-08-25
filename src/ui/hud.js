// The top bar: zen, income, tap power, the combo meter and active buffs.
//
// This updates every frame, so every write is guarded against no-op changes.
// Setting textContent to the value it already holds still invalidates layout.

import { fmt, fmtShort, fmtClock } from './numbers.js';

export class Hud {
  constructor(refs) {
    this.refs = refs;
    this.buffNodes = new Map();
    this.lastZenText = '';
    this.popTimer = 0;
  }

  update(state, derived, combo, now) {
    const { refs } = this;

    const zenText = fmt(state.zen);
    if (zenText !== this.lastZenText) {
      refs.zenValue.textContent = zenText;
      this.lastZenText = zenText;
    }

    setText(refs.zpsValue, `${fmtShort(derived.zps)}/sec`);
    setText(refs.clickValue, `${fmtShort(derived.clickValue)}/tap`);

    this.updateCombo(derived, combo, now);
    this.updateBuffs(state, now);
    this.updateMeta(state);
  }

  /**
   * Prestige currencies only appear once you have some — showing three empty
   * counters on minute one just advertises systems the player cannot reach.
   */
  updateMeta(state) {
    const { refs } = this;
    show(refs.essenceValue, state.essence > 0 || state.rebirthCount > 0, `🍋 ${fmtShort(state.essence)}`);
    show(refs.lotusValue, state.lotus > 0 || state.ascendCount > 0, `🪷 ${fmtShort(state.lotus)}`);
    show(refs.ticketValue, state.gacha.tickets > 0 || state.gacha.pulls > 0, `🎟 ${fmtShort(state.gacha.tickets)}`);
  }

  updateCombo(derived, combo, now) {
    const { refs } = this;
    const points = combo.points;
    const active = points > 0;

    refs.comboWrap.classList.toggle('is-active', active);
    if (!active) {
      setText(refs.comboLabel, '');
      refs.comboFill.style.width = '0%';
      refs.comboFill.style.transform = 'scaleX(0)';
      return;
    }

    // The bar shows time remaining, not streak length — it is a countdown the
    // player is fighting, which is what makes chaining taps feel urgent.
    const urgency = combo.urgency(now);
    refs.comboFill.style.transform = `scaleX(${urgency})`;
    refs.comboFill.classList.toggle('is-critical', urgency < 0.3);

    setText(refs.comboLabel, `${points}× combo · ${derived.comboMult.toFixed(2)}×`);
    refs.comboWrap.classList.toggle('is-maxed', points >= derived.comboCap);
  }

  updateBuffs(state, now) {
    const { refs } = this;
    const live = state.buffs.filter((b) => b.until > now);

    for (const buff of live) {
      let node = this.buffNodes.get(buff.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'buff';
        const name = document.createElement('span');
        name.className = 'buff__name';
        name.textContent = buff.name;
        const time = document.createElement('span');
        time.className = 'buff__time';
        node.append(name, time);
        node._time = time;
        refs.buffList.appendChild(node);
        this.buffNodes.set(buff.id, node);
      }
      setText(node._time, fmtClock(buff.until - now));
      node.classList.toggle('is-expiring', buff.until - now < 4000);
    }

    for (const [id, node] of this.buffNodes) {
      if (live.some((b) => b.id === id)) continue;
      node.remove();
      this.buffNodes.delete(id);
    }
  }

  /** Kick the zen counter when a big payout lands. */
  pop() {
    const el = this.refs.zenValue;
    el.classList.remove('is-pop');
    void el.offsetWidth;
    el.classList.add('is-pop');
  }
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function show(node, visible, value) {
  if (!node) return;
  node.hidden = !visible;
  if (visible) setText(node, value);
}
