// The Bath panel: prestige, ascension, relics, constellations and the talent
// tree. Everything that survives a reset lives here.

import { fmt, fmtInt } from './numbers.js';
import { RELICS, CONSTELLATIONS, rankCost } from '../data/relics.js';
import { TALENT_BRANCHES, TIER_GATES } from '../data/talents.js';
import { prestigePreview, ascendPreview, PRESTIGE_MIN_ZEN, ASCEND_MIN_YUZU } from '../systems/prestige.js';
import { availablePoints, branchSpend, isTalentUnlocked, treeLayout } from '../systems/talents.js';

export class MetaPanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.relicNodes = new Map();
    this.starNodes = new Map();
    this.talentNodes = new Map();
    this.view = 'relics';
    this.build();
  }

  build() {
    const r = this.root;

    // --- prestige card
    this.prestigeCard = section('meta-card meta-card--prestige');
    this.prestigeTitle = add(this.prestigeCard, 'h3', 'meta-card__title', 'The Yuzu Bath');
    this.prestigeLead = add(this.prestigeCard, 'p', 'meta-card__lead');
    this.prestigeGain = add(this.prestigeCard, 'p', 'meta-card__gain');
    this.prestigeNext = add(this.prestigeCard, 'p', 'meta-card__next');
    this.prestigeBtn = button('btn btn--gold', 'Take the bath', () => this.h.onPrestige());
    this.prestigeCard.appendChild(this.prestigeBtn);
    r.appendChild(this.prestigeCard);

    // --- ascension card, hidden until it is even conceivable
    this.ascendCard = section('meta-card meta-card--ascend');
    add(this.ascendCard, 'h3', 'meta-card__title', 'The Still Point');
    this.ascendLead = add(this.ascendCard, 'p', 'meta-card__lead');
    this.ascendGain = add(this.ascendCard, 'p', 'meta-card__gain');
    this.ascendBtn = button('btn btn--primary', 'Ascend', () => this.h.onAscend());
    this.ascendCard.appendChild(this.ascendBtn);
    r.appendChild(this.ascendCard);

    // --- sub-tabs
    this.switcher = document.createElement('div');
    this.switcher.className = 'meta-switch';
    this.switchBtns = new Map();
    for (const [key, label] of [['relics', 'Relics'], ['talents', 'Talents'], ['stars', 'Stars']]) {
      const btn = button('meta-switch__btn', label, () => this.setView(key));
      this.switcher.appendChild(btn);
      this.switchBtns.set(key, btn);
    }
    r.appendChild(this.switcher);

    this.relicList = section('relic-list');
    this.talentTree = section('talent-tree');
    this.starList = section('relic-list');
    r.append(this.relicList, this.talentTree, this.starList);

    this.buildRelics();
    this.buildTalents();
    this.setView('relics');
  }

  setView(view) {
    this.view = view;
    for (const [key, btn] of this.switchBtns) btn.classList.toggle('is-active', key === view);
    this.relicList.hidden = view !== 'relics';
    this.talentTree.hidden = view !== 'talents';
    this.starList.hidden = view !== 'stars';
  }

  buildRelics() {
    for (const relic of RELICS) {
      this.relicList.appendChild(this.makeRankRow(relic, 'yuzu', this.relicNodes, (id) => this.h.onBuyRelic(id)));
    }
    for (const star of CONSTELLATIONS) {
      this.starList.appendChild(this.makeRankRow(star, 'lotus', this.starNodes, (id) => this.h.onBuyStar(id)));
    }
  }

  makeRankRow(def, currency, registry, onBuy) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'relic';

    const main = document.createElement('span');
    main.className = 'relic__main';
    const name = document.createElement('strong');
    name.className = 'relic__name';
    name.textContent = def.name;
    const blurb = document.createElement('span');
    blurb.className = 'relic__blurb';
    blurb.textContent = def.blurb;
    main.append(name, blurb);

    const side = document.createElement('span');
    side.className = 'relic__side';
    const cost = document.createElement('span');
    cost.className = `relic__cost relic__cost--${currency}`;
    const ranks = document.createElement('span');
    ranks.className = 'relic__ranks';
    side.append(cost, ranks);

    row.append(main, side);
    row.addEventListener('click', () => onBuy(def.id));
    registry.set(def.id, { row, cost, ranks });
    return row;
  }

  buildTalents() {
    this.talentHeader = document.createElement('div');
    this.talentHeader.className = 'talent-header';
    this.pointsLabel = document.createElement('span');
    this.pointsLabel.className = 'talent-header__points';
    this.respecBtn = button('btn btn--small', 'Respec (free)', () => this.h.onRespec());
    this.talentHeader.append(this.pointsLabel, this.respecBtn);
    this.talentTree.appendChild(this.talentHeader);

    const layout = treeLayout();
    for (const [branchId, tiers] of Object.entries(layout)) {
      const branch = TALENT_BRANCHES[branchId];
      const col = document.createElement('div');
      col.className = 'talent-branch';
      col.style.setProperty('--branch', branch.color);

      const head = document.createElement('div');
      head.className = 'talent-branch__head';
      const bname = document.createElement('strong');
      bname.className = 'talent-branch__name';
      bname.textContent = branch.name;
      const bspend = document.createElement('span');
      bspend.className = 'talent-branch__spend';
      head.append(bname, bspend);
      col.appendChild(head);

      for (const tier of [1, 2, 3]) {
        const group = document.createElement('div');
        group.className = 'talent-tier';
        for (const talent of tiers[tier]) {
          const node = document.createElement('button');
          node.type = 'button';
          node.className = 'talent';

          const tname = document.createElement('span');
          tname.className = 'talent__name';
          tname.textContent = talent.name;

          const rank = document.createElement('span');
          rank.className = 'talent__rank';

          node.append(tname, rank);
          node.title = talent.blurb;
          node.addEventListener('click', () => this.h.onBuyTalent(talent.id));
          group.appendChild(node);
          this.talentNodes.set(talent.id, { node, rank, talent });
        }
        col.appendChild(group);
      }

      this.talentTree.appendChild(col);
      this.talentNodes.set(`branch:${branchId}`, { spend: bspend });
    }
  }

  update(state, level) {
    // --- prestige
    const p = prestigePreview(state);
    setText(
      this.prestigeLead,
      state.prestigeCount > 0
        ? `Taken ${state.prestigeCount} time${state.prestigeCount === 1 ? '' : 's'}. Resets zen, generators and upgrades. Keeps everything else.`
        : 'A long soak resets the pond — zen, generators and upgrades — and pays out Yuzu. Relics, gear, companions and trophies all stay.',
    );
    setText(this.prestigeGain, p.canPrestige ? `+${fmtInt(p.yuzu)} yuzu` : 'Not yet');
    setText(
      this.prestigeNext,
      p.canPrestige
        ? `Next yuzu at ${fmt(p.nextAt)} zen this run.`
        : `Needs ${fmt(PRESTIGE_MIN_ZEN)} zen in one run. You are at ${fmt(state.lifetimeZen)}.`,
    );
    this.prestigeBtn.disabled = !p.canPrestige;
    this.prestigeCard.classList.toggle('is-ready', p.canPrestige);

    // --- ascension
    const a = ascendPreview(state);
    const showAscend = state.lifetimeYuzu >= ASCEND_MIN_YUZU * 0.25 || state.ascendCount > 0;
    this.ascendCard.hidden = !showAscend;
    if (showAscend) {
      setText(
        this.ascendLead,
        'Ascending takes the yuzu and the relics too, and pays Lotus. Constellations, companions and trophies survive.',
      );
      setText(this.ascendGain, a.canAscend ? `+${fmtInt(a.lotus)} lotus` : `Needs ${fmtInt(ASCEND_MIN_YUZU)} lifetime yuzu`);
      this.ascendBtn.disabled = !a.canAscend;
      this.ascendCard.classList.toggle('is-ready', a.canAscend);
    }

    // --- relics and constellations
    this.updateRanks(state, RELICS, this.relicNodes, state.relics, state.yuzu);
    this.updateRanks(state, CONSTELLATIONS, this.starNodes, state.constellations, state.lotus);

    // --- talents
    this.updateTalents(state, level);
  }

  updateRanks(state, table, registry, bag, wallet) {
    for (const def of table) {
      const entry = registry.get(def.id);
      const owned = bag[def.id] || 0;
      const maxed = owned >= def.max;
      const price = maxed ? 0 : rankCost(def, owned);

      setText(entry.cost, maxed ? 'MAX' : fmtInt(price));
      setText(entry.ranks, def.max > 1 ? `${owned}/${def.max}` : owned ? 'owned' : '');
      entry.row.classList.toggle('is-owned', owned > 0);
      entry.row.classList.toggle('is-maxed', maxed);
      entry.row.classList.toggle('is-affordable', !maxed && wallet >= price);
      entry.row.disabled = maxed || wallet < price;
    }
  }

  updateTalents(state, level) {
    const points = availablePoints(state, level);
    setText(this.pointsLabel, `${points} point${points === 1 ? '' : 's'} to spend`);
    this.respecBtn.disabled = Object.keys(state.talents).length === 0;

    for (const [key, entry] of this.talentNodes) {
      if (key.startsWith('branch:')) {
        const branch = key.slice(7);
        setText(entry.spend, `${branchSpend(state, branch)} spent`);
        continue;
      }
      const { node, rank, talent } = entry;
      const owned = state.talents[talent.id] || 0;
      const unlocked = isTalentUnlocked(state, talent);
      const maxed = owned >= talent.max;

      setText(rank, `${owned}/${talent.max}`);
      node.classList.toggle('is-owned', owned > 0);
      node.classList.toggle('is-maxed', maxed);
      node.classList.toggle('is-locked', !unlocked);
      node.classList.toggle('is-ready', unlocked && !maxed && points > 0);
      node.disabled = !unlocked || maxed || points < 1;
      node.title = unlocked
        ? `${talent.name} — ${talent.blurb}`
        : `${talent.name} — needs ${TIER_GATES[talent.tier]} points in this branch`;
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
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
