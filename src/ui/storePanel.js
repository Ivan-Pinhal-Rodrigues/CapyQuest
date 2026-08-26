// The Store: cases, boosts, looks and leafs.
//
// The simulated-payment line is rendered once at the top of the panel and again
// on the leaf-pack view, and neither can be dismissed. That is deliberate — a
// notice you can close is a notice most people never read.

import { fmtInt, fmtPct, fmtTime } from './numbers.js';
import { el } from './modal.js';
import { CASES, caseOdds, pityTier } from '../data/cases.js';
import { SOURCES } from '../data/cosmetics.js';
import { rarityFor } from '../data/rarities.js';
import { DAILY_LEAFS, SIMULATED_NOTICE, dailyLeafsReady, boostRemaining } from '../systems/store.js';
// The shelves are read from the registry at build time rather than imported as
// constants, so an admin change reaches the panel — see rebuild() below.
import { liveBoosts, liveCosmeticKinds, liveLeafPacks } from '../content/registry.js';
import { collection, equipped, meetsNeed, owns } from '../systems/cosmetics.js';
import { pityLeft } from '../systems/cases.js';

const VIEWS = [
  ['cases', 'Cases'],
  ['boosts', 'Boosts'],
  ['looks', 'Looks'],
  ['leafs', 'Leafs'],
];

export class StorePanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.view = 'cases';
    this.lookKind = 'skin';
    this.caseRefs = new Map();
    this.boostRefs = new Map();
    this.packRefs = new Map();
    this.lookRefs = new Map();
    this.build();
  }

  build() {
    const r = this.root;

    this.balance = add(r, 'p', 'store__balance');
    const notice = add(r, 'p', 'store__notice', SIMULATED_NOTICE);
    notice.setAttribute('role', 'note');

    this.dailyCard = section('store-daily');
    this.dailyLead = add(this.dailyCard, 'p', 'store-daily__lead');
    this.dailyBtn = button('btn btn--gold', `Collect ${DAILY_LEAFS} 🍃`, () => this.h.onClaimDaily());
    this.dailyCard.appendChild(this.dailyBtn);
    r.appendChild(this.dailyCard);

    this.switcher = section('meta-switch');
    this.switchBtns = new Map();
    for (const [key, label] of VIEWS) {
      const btn = button('meta-switch__btn', label, () => this.setView(key));
      this.switcher.appendChild(btn);
      this.switchBtns.set(key, btn);
    }
    r.appendChild(this.switcher);

    this.caseList = section('case-list');
    this.boostList = section('relic-list');
    this.looksWrap = section('looks');
    this.packList = section('pack-list');
    r.append(this.caseList, this.boostList, this.looksWrap, this.packList);

    this.buildCases();
    this.buildBoosts();
    this.buildLooks();
    this.buildPacks();
    this.setView(this.view);
  }

  /**
   * Rebuild the shelves from the current catalogue.
   *
   * The panel builds its rows once and then only writes text into them, which
   * is what keeps it cheap at 15Hz — so a content change has to be pushed in
   * rather than picked up. The admin panel calls this after applying an edit;
   * nothing else needs to.
   */
  rebuild() {
    const view = this.view;
    const lookKind = this.lookKind;
    this.root.textContent = '';
    this.caseRefs.clear();
    this.boostRefs.clear();
    this.packRefs.clear();
    this.lookRefs.clear();
    this.view = view;
    this.lookKind = lookKind;
    this.build();
  }

  setView(view) {
    this.view = view;
    for (const [key, btn] of this.switchBtns) btn.classList.toggle('is-active', key === view);
    this.caseList.hidden = view !== 'cases';
    this.boostList.hidden = view !== 'boosts';
    this.looksWrap.hidden = view !== 'looks';
    this.packList.hidden = view !== 'leafs';
  }

  // ------------------------------------------------------------------ cases

  buildCases() {
    for (const def of CASES) {
      const card = section('case');
      card.style.setProperty('--case', def.color);

      const head = section('case__head');
      add(head, 'strong', 'case__name', def.name);
      const pity = add(head, 'span', 'case__pity');
      card.appendChild(head);

      add(card, 'p', 'case__blurb', def.blurb);

      // The drop table, always visible. Not behind a tooltip, not behind an
      // "info" button — on the card, every time.
      const table = section('case__odds');
      for (const row of caseOdds(def)) {
        const cell = section('case__odd');
        const name = add(cell, 'span', 'case__odd-name', rarityFor(row.tier).name);
        name.style.color = rarityFor(row.tier).color;
        add(cell, 'span', 'case__odd-pct', `${(row.chance * 100).toFixed(row.chance < 0.01 ? 2 : 1)}%`);
        table.appendChild(cell);
      }
      card.appendChild(table);

      add(card, 'p', 'case__floor', `Never worse than ${rarityFor(def.guaranteed).name}. Pity forces ${rarityFor(pityTier(def)).name}.`);

      const btn = button('btn btn--gold', `Open · ${def.cost} 🍃`, () => this.h.onOpenCase(def.id));
      card.appendChild(btn);

      this.caseList.appendChild(card);
      this.caseRefs.set(def.id, { card, btn, pity });
    }
  }

  // ----------------------------------------------------------------- boosts

  buildBoosts() {
    for (const def of liveBoosts()) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'relic';

      const main = document.createElement('span');
      main.className = 'relic__main';
      const name = document.createElement('strong');
      name.className = 'relic__name';
      name.textContent = `${def.icon} ${def.name}`;
      const blurb = document.createElement('span');
      blurb.className = 'relic__blurb';
      blurb.textContent = def.blurb;
      const timer = document.createElement('span');
      timer.className = 'relic__blurb relic__timer';
      main.append(name, blurb, timer);

      const side = document.createElement('span');
      side.className = 'relic__side';
      const cost = document.createElement('span');
      cost.className = 'relic__cost relic__cost--leaf';
      cost.textContent = `${def.cost} 🍃`;
      const dur = document.createElement('span');
      dur.className = 'relic__ranks';
      dur.textContent = def.hours >= 1 ? `${def.hours}h` : `${def.hours * 60}m`;
      side.append(cost, dur);

      row.append(main, side);
      row.addEventListener('click', () => this.h.onBuyBoost(def.id));
      this.boostList.appendChild(row);
      this.boostRefs.set(def.id, { row, timer });
    }
  }

  // ------------------------------------------------------------------ looks

  buildLooks() {
    const picker = section('looks__kinds');
    this.kindBtns = new Map();
    for (const kind of liveCosmeticKinds()) {
      const btn = button('meta-switch__btn', kind.name, () => this.setLookKind(kind.id));
      picker.appendChild(btn);
      this.kindBtns.set(kind.id, btn);
    }
    this.looksWrap.appendChild(picker);
    this.lookCount = add(this.looksWrap, 'p', 'looks__count');

    this.lookGrid = section('looks__grid');
    for (const kind of liveCosmeticKinds()) {
      for (const def of kind.items) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'look';

        const name = document.createElement('strong');
        name.className = 'look__name';
        name.textContent = def.name;
        const blurb = document.createElement('span');
        blurb.className = 'look__blurb';
        blurb.textContent = def.blurb;
        const state = document.createElement('span');
        state.className = 'look__state';

        card.append(name, blurb, state);
        card.addEventListener('click', () => this.h.onLook(kind.id, def.id));
        this.lookGrid.appendChild(card);
        this.lookRefs.set(`${kind.id}:${def.id}`, { card, state, def, kind: kind.id });
      }
    }
    this.looksWrap.appendChild(this.lookGrid);
    this.setLookKind('skin');
  }

  setLookKind(kind) {
    this.lookKind = kind;
    for (const [key, btn] of this.kindBtns) btn.classList.toggle('is-active', key === kind);
    for (const [, ref] of this.lookRefs) ref.card.hidden = ref.kind !== kind;
  }

  // ------------------------------------------------------------------ packs

  buildPacks() {
    const notice = add(this.packList, 'p', 'store__notice store__notice--loud', SIMULATED_NOTICE);
    notice.setAttribute('role', 'note');
    add(
      this.packList,
      'p',
      'store__hint',
      'These are price tags, not prices. Nothing asks for a card and nothing is charged — pressing one simply adds the leafs.',
    );

    for (const pack of liveLeafPacks()) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `pack${pack.best ? ' is-best' : ''}`;

      const main = document.createElement('span');
      main.className = 'pack__main';
      const name = document.createElement('strong');
      name.className = 'pack__name';
      name.textContent = pack.name;
      const amount = document.createElement('span');
      amount.className = 'pack__amount';
      amount.textContent = `${fmtInt(pack.leafs)} 🍃${pack.bonus ? ` · ${pack.bonus} bonus` : ''}`;
      main.append(name, amount);

      const side = document.createElement('span');
      side.className = 'pack__side';
      const price = document.createElement('span');
      price.className = 'pack__price';
      price.textContent = pack.price;
      side.appendChild(price);
      if (pack.best) {
        const badge = document.createElement('span');
        badge.className = 'pack__badge';
        badge.textContent = 'Best value';
        side.appendChild(badge);
      }

      row.append(main, side);
      row.addEventListener('click', () => this.h.onBuyPack(pack.id));
      this.packList.appendChild(row);
      this.packRefs.set(pack.id, { row });
    }
  }

  // ----------------------------------------------------------------- update

  update(state, now = Date.now()) {
    setText(this.balance, `${fmtInt(state.leafs)} 🍃 · ${fmtInt(state.combat.shards)} shards`);

    const ready = dailyLeafsReady(state, now);
    setText(
      this.dailyLead,
      ready
        ? `${DAILY_LEAFS} free leafs, once a day. Not quite a Reed Case on its own — two days is.`
        : 'Collected today. Come back tomorrow.',
    );
    this.dailyBtn.disabled = !ready;
    this.dailyCard.classList.toggle('is-ready', ready);

    for (const def of CASES) {
      const ref = this.caseRefs.get(def.id);
      const left = pityLeft(state, def.id);
      setText(ref.pity, left === 0 ? 'Next one is guaranteed' : `${left} to pity`);
      ref.btn.disabled = state.leafs < def.cost;
      ref.card.classList.toggle('is-affordable', state.leafs >= def.cost);
      ref.card.classList.toggle('is-pitied', left === 0);
    }

    for (const def of liveBoosts()) {
      const ref = this.boostRefs.get(def.id);
      if (!ref) continue;
      const left = boostRemaining(state, def.id, now);
      setText(ref.timer, left > 0 ? `Running · ${fmtTime(left)} left` : '');
      ref.row.classList.toggle('is-owned', left > 0);
      ref.row.classList.toggle('is-affordable', state.leafs >= def.cost);
      ref.row.disabled = state.leafs < def.cost;
    }

    const counts = collection(state, this.lookKind);
    setText(this.lookCount, `${counts.owned} of ${counts.total} owned`);

    for (const [, ref] of this.lookRefs) {
      const { def, kind, card, state: label } = ref;
      const held = owns(state, kind, def.id);
      const worn = equipped(state, kind) === def.id;

      card.classList.toggle('is-owned', held);
      card.classList.toggle('is-worn', worn);
      card.disabled = !held && def.source !== 'store';

      if (worn) setText(label, 'Worn');
      else if (held) setText(label, 'Wear it');
      else if (def.source === 'store') setText(label, `${def.cost} 🍃`);
      else setText(label, meetsNeed(state, def.need) ? 'Unlocking…' : SOURCES[def.source]);
    }
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

/** What just came out of a case. Shown once, then it is an ordinary bag item. */
export function caseRevealBody(item, result) {
  const body = el('div', 'reveal');

  const rarity = el('strong', 'reveal__rarity', item.rarity.name);
  rarity.style.color = item.rarity.color;
  body.appendChild(rarity);

  body.appendChild(el('span', 'reveal__name', item.name));
  if (item.stars > 1) body.appendChild(el('span', 'reveal__stars', '★'.repeat(item.stars)));

  const s = item.stats;
  const parts = [];
  if (s.atk) parts.push(`ATK ${fmtInt(s.atk)}`);
  if (s.def) parts.push(`DEF ${fmtInt(s.def)}`);
  if (s.hp) parts.push(`HP ${fmtInt(s.hp)}`);
  if (s.spd) parts.push(`SPD ${fmtInt(s.spd)}`);
  if (s.luck) parts.push(`LUK ${fmtInt(s.luck)}`);
  if (s.crit) parts.push(`CRIT ${fmtPct(s.crit)}`);
  body.appendChild(el('span', 'reveal__stats', parts.join(' · ')));

  if (result.pitied) body.appendChild(el('span', 'reveal__pity', 'Pity came through.'));
  body.appendChild(el('span', 'reveal__stats', item.blurb));
  return body;
}
