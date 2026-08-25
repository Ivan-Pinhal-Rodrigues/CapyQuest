// The Season panel: which season it is, how long is left, and the two-track
// pass to level 100.
//
// A hundred levels is too many to render as a grid, so the track is a single
// scrolling column with the free reward on the left and the premium one on the
// right. The premium column is always visible, locked or not — seeing what you
// are not getting is the whole point of a two-track pass, and hiding it would
// be worse rather than kinder.

import { fmtInt, fmtTime } from './numbers.js';
import { PASS_LEVELS, PREMIUM_PRICE, PREMIUM_LEAFS } from '../data/pass.js';
import { SIMULATED_NOTICE } from '../systems/store.js';
import { passProgress, passTrack, premiumBacklog, season } from '../systems/season.js';

export class SeasonPanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.rows = new Map();
    this.build();
  }

  build() {
    const r = this.root;

    // --- the season itself
    this.head = section('season-head');
    this.title = add(this.head, 'h3', 'season-head__name');
    this.clock = add(this.head, 'span', 'season-head__clock');
    r.appendChild(this.head);

    this.dayBar = section('progress');
    this.dayFill = section('progress__fill');
    this.dayBar.appendChild(this.dayFill);
    r.appendChild(this.dayBar);
    this.dayLabel = add(r, 'p', 'season-head__day');

    // --- pass level
    this.levelRow = section('season-level');
    this.levelLabel = add(this.levelRow, 'strong', 'season-level__value');
    this.xpLabel = add(this.levelRow, 'span', 'season-level__xp');
    r.appendChild(this.levelRow);

    this.xpBar = section('progress');
    this.xpFill = section('progress__fill');
    this.xpBar.appendChild(this.xpFill);
    r.appendChild(this.xpBar);

    // --- premium offer
    this.offer = section('season-offer');
    add(this.offer, 'strong', 'season-offer__title', 'Premium track');
    this.offerLead = add(this.offer, 'p', 'season-offer__lead');
    this.offerBacklog = add(this.offer, 'p', 'season-offer__backlog');
    const buttons = section('season-offer__buttons');
    this.priceBtn = button('btn btn--gold', `Unlock · ${PREMIUM_PRICE}`, () => this.h.onBuyPremiumPrice());
    this.leafBtn = button('btn btn--primary', `or ${fmtInt(PREMIUM_LEAFS)} 🍃`, () => this.h.onBuyPremiumLeafs());
    buttons.append(this.priceBtn, this.leafBtn);
    this.offer.appendChild(buttons);
    const note = add(this.offer, 'p', 'store__notice', SIMULATED_NOTICE);
    note.setAttribute('role', 'note');
    r.appendChild(this.offer);

    this.claimAllBtn = button('btn btn--primary', 'Claim everything', () => this.h.onClaimAll());
    r.appendChild(this.claimAllBtn);

    // --- the track
    const legend = section('pass-legend');
    add(legend, 'span', 'pass-legend__free', 'Free');
    add(legend, 'span', 'pass-legend__lvl', 'Lv');
    add(legend, 'span', 'pass-legend__premium', 'Premium');
    r.appendChild(legend);

    this.trackEl = section('pass-track');
    for (let level = 1; level <= PASS_LEVELS; level++) {
      const row = section('pass-row');

      const free = this.makeCell('free', level);
      const num = add(row, 'span', 'pass-row__lvl', String(level));
      const premium = this.makeCell('premium', level);

      row.prepend(free.cell);
      row.appendChild(premium.cell);
      this.trackEl.appendChild(row);
      this.rows.set(level, { row, num, free, premium });
    }
    r.appendChild(this.trackEl);

    this.history = section('season-history');
    r.appendChild(this.history);
  }

  makeCell(track, level) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `pass-cell pass-cell--${track}`;
    const text = add(cell, 'span', 'pass-cell__text');
    cell.addEventListener('click', () => this.h.onClaim(level, track));
    return { cell, text };
  }

  update(state, now = Date.now()) {
    const info = season(state, now);
    setText(this.title, info.name);
    setText(this.clock, `${fmtTime(info.msLeft)} left`);
    this.dayFill.style.transform = `scaleX(${info.ratio})`;
    setText(this.dayLabel, `Season ${info.number} · day ${info.day} of ${info.days}`);

    const p = passProgress(state);
    setText(this.levelLabel, `Level ${p.level} / ${p.levels}`);
    setText(this.xpLabel, p.maxed ? 'Complete' : `${p.into} / ${p.needed} xp`);
    this.xpFill.style.transform = `scaleX(${p.ratio})`;

    // --- the offer
    this.offer.hidden = p.premium;
    if (!p.premium) {
      const backlog = premiumBacklog(state);
      setText(
        this.offerLead,
        'Everything the free track gives, and more of it, plus two looks of its own. The free track keeps paying either way.',
      );
      setText(
        this.offerBacklog,
        backlog.levels > 0
          ? `${backlog.levels} level${backlog.levels === 1 ? '' : 's'} already waiting — ${backlog.leafs} leafs and ${backlog.tickets} tickets of it.`
          : 'Unlock it any time. Levels you have already passed pay out the moment you do.',
      );
      this.leafBtn.disabled = state.leafs < PREMIUM_LEAFS;
    }

    // --- the track
    const rows = passTrack(state);
    let claimable = 0;
    for (const row of rows) {
      const ref = this.rows.get(row.level);
      ref.row.classList.toggle('is-locked', !row.unlocked);
      ref.row.classList.toggle('is-current', row.level === p.level);

      claimable += this.paintCell(ref.free, row.free, row.unlocked, true);
      claimable += this.paintCell(ref.premium, row.premium, row.unlocked, p.premium);
    }

    this.claimAllBtn.hidden = claimable === 0;
    setText(this.claimAllBtn, `Claim everything (${claimable})`);

    // --- past seasons
    const past = state.pass.history || [];
    this.history.hidden = past.length === 0;
    if (past.length) {
      this.history.textContent = '';
      add(this.history, 'strong', 'season-history__title', 'Seasons past');
      for (const h of past) {
        add(
          this.history,
          'p',
          'season-history__row',
          `Season ${h.index + 1} — reached level ${h.level}${h.premium ? ' · premium' : ''}`,
        );
      }
    }
  }

  /** Returns 1 when this cell is claimable, so the caller can total them. */
  paintCell(ref, data, unlocked, trackOpen) {
    const { cell, text } = ref;
    setText(text, data.reward.text);
    cell.classList.toggle('is-claimed', data.claimed);
    cell.classList.toggle('is-ready', data.claimable);
    cell.classList.toggle('is-shut', !trackOpen);
    cell.disabled = !data.claimable;
    cell.title = data.claimed
      ? 'Claimed'
      : !trackOpen
        ? 'Premium track'
        : unlocked
          ? data.reward.text
          : 'Not there yet';
    return data.claimable ? 1 : 0;
  }
}

// -------------------------------------------------------------------- helpers

function section(className) {
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
