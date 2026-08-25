// The Rivals panel: the seasonal board, and whatever event is running.
//
// The board is simulated and the notice at the top says so without softening
// it. What makes it worth looking at anyway is that the rivals are inspectable:
// tapping one opens their full kit, drawn by the same code that draws yours,
// with the same rungs and the same stars.

import { fmtInt, fmtTime } from './numbers.js';
import { SIMULATED_NOTICE } from '../systems/leaderboard.js';
import { activeEvent, nextEvent, exchangeRows } from '../systems/events.js';
import { gearIconUrl, itemMarks } from './gearPanel.js';
import { el } from './modal.js';

export class LeaderboardPanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.rowNodes = new Map();
    this.exchangeNodes = new Map();
    this.build();
  }

  build() {
    const r = this.root;

    // --- event banner
    this.eventCard = section('event-card');
    this.eventHead = section('event-card__head');
    this.eventName = add(this.eventHead, 'strong', 'event-card__name');
    this.eventClock = add(this.eventHead, 'span', 'event-card__clock');
    this.eventCard.appendChild(this.eventHead);
    this.eventBlurb = add(this.eventCard, 'p', 'event-card__blurb');
    this.eventHook = add(this.eventCard, 'p', 'event-card__hook');

    this.petalRow = section('event-card__petals');
    this.petalCount = add(this.petalRow, 'strong', 'event-card__petal-count');
    add(this.petalRow, 'span', 'event-card__petal-note', 'Petals go when the event does.');
    this.eventCard.appendChild(this.petalRow);

    this.exchange = section('exchange');
    this.eventCard.appendChild(this.exchange);
    r.appendChild(this.eventCard);

    // --- the board
    const head = section('board-head');
    this.boardTitle = add(head, 'h3', 'board-head__title');
    this.boardRank = add(head, 'span', 'board-head__rank');
    r.appendChild(head);

    const notice = add(r, 'p', 'store__notice', SIMULATED_NOTICE);
    notice.setAttribute('role', 'note');

    this.board = section('board');
    r.appendChild(this.board);
  }

  // ------------------------------------------------------------------ event

  updateEvent(state, now) {
    const live = activeEvent(now);

    if (!live) {
      const next = nextEvent(now);
      this.eventCard.style.removeProperty('--event');
      this.eventCard.classList.remove('is-live');
      setText(this.eventName, 'Nothing on right now');
      setText(this.eventClock, '');
      setText(this.eventBlurb, `${next.icon} ${next.name} opens in ${fmtTime(next.inMs)}.`);
      setText(this.eventHook, next.blurb);
      this.petalRow.hidden = true;
      this.exchange.hidden = true;
      return;
    }

    this.eventCard.style.setProperty('--event', live.color);
    this.eventCard.classList.add('is-live');
    setText(this.eventName, `${live.icon} ${live.name}`);
    setText(this.eventClock, `${fmtTime(live.msLeft)} left · day ${live.day} of ${live.days}`);
    setText(this.eventBlurb, live.blurb);
    setText(this.eventHook, live.hook);

    this.petalRow.hidden = false;
    setText(this.petalCount, `${fmtInt(state.events.petals)} petals`);

    this.exchange.hidden = false;
    const rows = exchangeRows(state, now);
    const seen = new Set();
    for (const row of rows) {
      seen.add(row.id);
      let ref = this.exchangeNodes.get(row.id);
      if (!ref) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exchange__row';
        const text = add(btn, 'span', 'exchange__text');
        const cost = add(btn, 'span', 'exchange__cost');
        btn.addEventListener('click', () => this.h.onExchange(row.id));
        this.exchange.appendChild(btn);
        ref = { btn, text, cost };
        this.exchangeNodes.set(row.id, ref);
      }
      setText(ref.text, row.text);
      setText(ref.cost, row.soldOut ? 'Taken' : `${row.petals} 🌸`);
      ref.btn.classList.toggle('is-affordable', row.affordable && !row.soldOut);
      ref.btn.classList.toggle('is-sold', row.soldOut);
      ref.btn.disabled = row.soldOut || !row.affordable;
    }
    // A different event has a different exchange; drop rows that left.
    for (const [id, ref] of this.exchangeNodes) {
      if (seen.has(id)) continue;
      ref.btn.remove();
      this.exchangeNodes.delete(id);
    }
  }

  // ------------------------------------------------------------------ board

  update(board, state, now = Date.now()) {
    this.updateEvent(state, now);

    setText(this.boardTitle, board.season.name);
    setText(this.boardRank, `You are #${board.you.rank} of ${board.rows.length}`);

    const seen = new Set();
    for (const row of board.rows) {
      seen.add(row.id);
      let ref = this.rowNodes.get(row.id);
      if (!ref) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'board-row';

        const rank = add(node, 'span', 'board-row__rank');
        const main = section('board-row__main');
        const name = add(main, 'strong', 'board-row__name');
        const sub = add(main, 'span', 'board-row__sub');
        node.appendChild(main);
        const power = add(node, 'span', 'board-row__power');

        node.addEventListener('click', () => this.h.onInspect(row.id));
        this.board.appendChild(node);
        ref = { node, rank, name, sub, power };
        this.rowNodes.set(row.id, ref);
      }

      setText(ref.rank, `#${row.rank}`);
      setText(ref.name, row.name + (row.premium ? ' ✦' : ''));
      setText(
        ref.sub,
        `Stage ${row.stage} · ${row.rebirths} rebirth${row.rebirths === 1 ? '' : 's'} · pass ${row.passLevel}`,
      );
      setText(ref.power, fmtInt(row.power));
      ref.node.classList.toggle('is-you', row.you);
      ref.node.style.order = row.rank;
    }

    for (const [id, ref] of this.rowNodes) {
      if (seen.has(id)) continue;
      ref.node.remove();
      this.rowNodes.delete(id);
    }
  }
}

/** A rival's whole kit — the thing the board exists to let you look at. */
export function rivalBody(entry) {
  const body = el('div', 'rival');

  body.appendChild(el('p', 'rival__sub', entry.archetype
    ? `${entry.archetype.name} — ${entry.archetype.blurb}`
    : 'That is you.'));

  const stats = el('div', 'rival__stats');
  for (const [label, value] of [
    ['Stage', String(entry.stage)],
    ['Depth', fmtInt(entry.depth)],
    ['Rebirths', String(entry.rebirths)],
    ['Pass', `${entry.passLevel}${entry.premium ? ' ✦' : ''}`],
    ['Gear power', fmtInt(entry.power)],
  ]) {
    const cell = el('div', 'rival__stat');
    cell.appendChild(el('span', 'rival__stat-label', label));
    cell.appendChild(el('strong', 'rival__stat-value', value));
    stats.appendChild(cell);
  }
  body.appendChild(stats);

  if (!entry.gear.length) {
    body.appendChild(el('p', 'shop__hint', 'Nothing equipped yet.'));
    return body;
  }

  const kit = el('div', 'rival__kit');
  for (const item of entry.gear) {
    const row = el('div', 'rival__piece');
    row.style.setProperty('--rarity', item.rarity.color);

    const img = document.createElement('img');
    img.className = 'rival__icon pixel-icon';
    img.src = gearIconUrl(item);
    img.alt = '';

    const text = el('span', 'rival__piece-text');
    const marks = itemMarks(item);
    text.appendChild(el('strong', 'rival__piece-name', marks ? `${item.name} ${marks}` : item.name));
    const rarity = el('span', 'rival__piece-rarity', item.rarity.name);
    rarity.style.color = item.rarity.color;
    text.appendChild(rarity);

    row.append(img, text);
    kit.appendChild(row);
  }
  body.appendChild(kit);
  return body;
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

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
