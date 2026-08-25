// The Rebirth panel: the wall, the button that answers it, the 210-node tree,
// and the unfinished Ascension layer.
//
// The panel is wall-aware on purpose. v1 showed a currency threshold, which
// told the player nothing about whether they were actually stuck. This shows
// the number that matters — how long the boss in front of you now takes to
// kill — and turns red when that crosses thirty seconds.

import { fmt, fmtInt, fmtTime } from './numbers.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { rankCost, ascendPreview, ASCEND_MIN_ESSENCE, ASCENSION_ROADMAP } from '../systems/ascension.js';
import { TREE_BRANCHES, TIER_GATES, TIERS, treeLayout } from '../data/rebirthTree.js';
import { branchSpend, isNodeUnlocked, nextCost, ranksOf, treeSummary } from '../systems/tree.js';
import { rebirthPreview } from '../systems/rebirth.js';

export class RebirthPanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.nodeRefs = new Map();
    this.branchRefs = new Map();
    this.starRefs = new Map();
    this.view = 'tree';
    this.branch = TREE_BRANCHES[0].id;
    this.build();
  }

  build() {
    const r = this.root;

    // --- the wall / rebirth card
    this.rebirthCard = section('meta-card meta-card--rebirth');
    add(this.rebirthCard, 'h3', 'meta-card__title', 'Rebirth');
    this.wallLine = add(this.rebirthCard, 'p', 'meta-card__wall');
    this.wallTrack = section('wall-meter');
    this.wallFill = section('wall-meter__fill');
    this.wallTrack.appendChild(this.wallFill);
    this.rebirthCard.appendChild(this.wallTrack);
    this.rebirthLead = add(this.rebirthCard, 'p', 'meta-card__lead');
    this.rebirthGain = add(this.rebirthCard, 'p', 'meta-card__gain');
    this.rebirthNext = add(this.rebirthCard, 'p', 'meta-card__next');
    this.rebirthBtn = button('btn btn--gold', 'Begin again', () => this.h.onRebirth());
    this.rebirthCard.appendChild(this.rebirthBtn);
    r.appendChild(this.rebirthCard);

    // --- ascension, kept working and openly unfinished
    this.ascendCard = section('meta-card meta-card--ascend');
    add(this.ascendCard, 'h3', 'meta-card__title', 'The Still Point');
    this.ascendBanner = add(this.ascendCard, 'p', 'meta-card__wip', 'Still being built — what is here works, but it is not finished.');
    this.ascendLead = add(this.ascendCard, 'p', 'meta-card__lead');
    this.ascendGain = add(this.ascendCard, 'p', 'meta-card__gain');
    this.ascendBtn = button('btn btn--primary', 'Ascend', () => this.h.onAscend());
    this.ascendCard.appendChild(this.ascendBtn);
    const roadmap = section('roadmap');
    add(roadmap, 'strong', 'roadmap__title', 'Coming to this layer');
    const items = document.createElement('ul');
    items.className = 'roadmap__list';
    for (const line of ASCENSION_ROADMAP) {
      const li = document.createElement('li');
      li.textContent = line;
      items.appendChild(li);
    }
    roadmap.appendChild(items);
    this.ascendCard.appendChild(roadmap);
    r.appendChild(this.ascendCard);

    // --- sub-tabs
    this.switcher = section('meta-switch');
    this.switchBtns = new Map();
    for (const [key, label] of [['tree', 'Tree'], ['stars', 'Stars']]) {
      const btn = button('meta-switch__btn', label, () => this.setView(key));
      this.switcher.appendChild(btn);
      this.switchBtns.set(key, btn);
    }
    r.appendChild(this.switcher);

    this.treeWrap = section('tree');
    this.starList = section('relic-list');
    r.append(this.treeWrap, this.starList);

    this.buildTree();
    this.buildStars();
    this.setView('tree');
  }

  setView(view) {
    this.view = view;
    for (const [key, btn] of this.switchBtns) btn.classList.toggle('is-active', key === view);
    this.treeWrap.hidden = view !== 'tree';
    this.starList.hidden = view !== 'stars';
  }

  setBranch(id) {
    this.branch = id;
    for (const [key, ref] of this.branchRefs) ref.btn.classList.toggle('is-active', key === id);
    for (const [, ref] of this.nodeRefs) {
      ref.column.hidden = ref.branch !== id;
    }
    this.applyBranchChrome();
  }

  applyBranchChrome() {
    const branch = TREE_BRANCHES.find((b) => b.id === this.branch);
    this.treeGrid.style.setProperty('--branch', branch.color);
    setText(this.branchBlurb, branch.blurb);
  }

  buildTree() {
    const header = section('tree__head');
    this.essenceLabel = add(header, 'span', 'tree__essence');
    this.respecBtn = button('btn btn--small', 'Respec (free)', () => this.h.onRespec());
    header.appendChild(this.respecBtn);
    this.treeWrap.appendChild(header);

    // Branch selector. Seven branches is too many to show at once on a phone,
    // so one is open at a time and the rest stay one tap away.
    const picker = section('tree__branches');
    for (const branch of TREE_BRANCHES) {
      const btn = button('tree-branch-btn', '', () => this.setBranch(branch.id));
      btn.style.setProperty('--branch', branch.color);
      const name = document.createElement('strong');
      name.textContent = branch.name;
      const spend = document.createElement('span');
      spend.className = 'tree-branch-btn__spend';
      btn.append(name, spend);
      picker.appendChild(btn);
      this.branchRefs.set(branch.id, { btn, spend });
    }
    this.treeWrap.appendChild(picker);

    this.branchBlurb = add(this.treeWrap, 'p', 'tree__blurb');

    this.treeGrid = section('tree__grid');
    const layout = treeLayout();
    for (const branch of TREE_BRANCHES) {
      const column = section('tree__column');
      for (let tier = 1; tier <= TIERS; tier++) {
        const row = section('tree-tier');
        const gate = add(row, 'span', 'tree-tier__gate', `T${tier}`);
        gate.title = `Opens at ${TIER_GATES[tier]} ranks in this branch`;
        const cells = section('tree-tier__cells');
        for (const node of layout[branch.id].tiers[tier]) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'tree-node';

          const name = document.createElement('span');
          name.className = 'tree-node__name';
          name.textContent = node.name;

          const rank = document.createElement('span');
          rank.className = 'tree-node__rank';

          const cost = document.createElement('span');
          cost.className = 'tree-node__cost';

          cell.append(name, rank, cost);
          cell.addEventListener('click', () => this.h.onBuyNode(node.id));
          cells.appendChild(cell);
          this.nodeRefs.set(node.id, { cell, rank, cost, node, column, branch: branch.id });
        }
        row.appendChild(cells);
        this.nodeRefs.set(`gate:${branch.id}:${tier}`, { gate, column, branch: branch.id, tier });
        column.appendChild(row);
      }
      this.treeGrid.appendChild(column);
      this.nodeRefs.set(`column:${branch.id}`, { column, branch: branch.id });
    }
    this.treeWrap.appendChild(this.treeGrid);
    this.setBranch(this.branch);
  }

  buildStars() {
    for (const star of CONSTELLATIONS) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'relic';

      const main = document.createElement('span');
      main.className = 'relic__main';
      const name = document.createElement('strong');
      name.className = 'relic__name';
      name.textContent = star.name;
      const blurb = document.createElement('span');
      blurb.className = 'relic__blurb';
      blurb.textContent = star.blurb;
      main.append(name, blurb);

      const side = document.createElement('span');
      side.className = 'relic__side';
      const cost = document.createElement('span');
      cost.className = 'relic__cost relic__cost--lotus';
      const ranks = document.createElement('span');
      ranks.className = 'relic__ranks';
      side.append(cost, ranks);

      row.append(main, side);
      row.addEventListener('click', () => this.h.onBuyStar(star.id));
      this.starList.appendChild(row);
      this.starRefs.set(star.id, { row, cost, ranks });
    }
  }

  update(state, stats) {
    this.updateRebirth(state, stats);
    this.updateAscend(state);
    this.updateTree(state);
    this.updateStars(state);
  }

  updateRebirth(state, stats) {
    const p = rebirthPreview(state, stats);

    if (p.ttk == null) {
      setText(this.wallLine, 'Walk downstream and find a boss you cannot beat.');
      this.wallFill.style.width = '0%';
    } else if (p.walled) {
      setText(this.wallLine, `This stage's boss would take ${fmtTime(p.ttk * 1000)}. You are stuck.`);
      this.wallFill.style.width = '100%';
    } else {
      setText(this.wallLine, `This stage's boss takes ${fmtTime(p.ttk * 1000)} of the 30s you have.`);
      this.wallFill.style.width = `${Math.round(p.pressure * 100)}%`;
    }
    this.rebirthCard.classList.toggle('is-walled', p.walled);

    setText(
      this.rebirthLead,
      state.rebirthCount > 0
        ? `Done ${state.rebirthCount} time${state.rebirthCount === 1 ? '' : 's'}. Resets zen, generators, upgrades and your place downstream. The tree, your gear and everything you have collected stay.`
        : 'Starting over resets zen, generators, upgrades and your place downstream — and pays Essence for how deep you got. The tree you buy with it is permanent.',
    );

    setText(this.rebirthGain, p.essence > 0 ? `+${fmtInt(p.essence)} essence` : 'Nothing yet');
    setText(
      this.rebirthNext,
      p.unlocked
        ? `From stage ${p.stage}. Next essence at stage ${p.nextStage}.`
        : 'Unlocks the first time a boss takes longer than 30 seconds.',
    );
    this.rebirthBtn.disabled = !p.canRebirth;
    this.rebirthCard.classList.toggle('is-ready', p.canRebirth);
  }

  updateAscend(state) {
    const a = ascendPreview(state);
    const show = state.lifetimeEssence >= ASCEND_MIN_ESSENCE * 0.25 || state.ascendCount > 0;
    this.ascendCard.hidden = !show;
    if (!show) return;

    setText(
      this.ascendLead,
      'Ascending takes the essence and the whole tree, and pays Lotus. Constellations, gear, companions and trophies survive.',
    );
    setText(
      this.ascendGain,
      a.canAscend ? `+${fmtInt(a.lotus)} lotus` : `Needs ${fmtInt(ASCEND_MIN_ESSENCE)} lifetime essence`,
    );
    this.ascendBtn.disabled = !a.canAscend;
    this.ascendCard.classList.toggle('is-ready', a.canAscend);
  }

  updateTree(state) {
    const summary = treeSummary(state);
    setText(
      this.essenceLabel,
      `${fmtInt(state.essence)} essence · ${summary.ranks}/${summary.maxRanks} ranks`,
    );
    this.respecBtn.disabled = summary.ranks === 0;

    for (const [id, ref] of this.branchRefs) {
      const spend = branchSpend(state, id);
      setText(ref.spend, String(spend));
      ref.btn.classList.toggle('is-invested', spend > 0);
    }

    for (const [key, ref] of this.nodeRefs) {
      if (key.startsWith('column:')) continue;
      if (key.startsWith('gate:')) {
        const open = branchSpend(state, ref.branch) >= TIER_GATES[ref.tier];
        ref.gate.classList.toggle('is-locked', !open);
        // A locked tier shows what it takes rather than what it is — the number
        // on its own would read as a tier index.
        setText(ref.gate, open ? `T${ref.tier}` : `🔒${TIER_GATES[ref.tier]}`);
        continue;
      }

      const { cell, rank, cost, node } = ref;
      const owned = ranksOf(state, node.id);
      const unlocked = isNodeUnlocked(state, node);
      const price = nextCost(state, node.id);
      const maxed = price === null;
      const affordable = !maxed && unlocked && state.essence >= price;

      setText(rank, `${owned}/${node.max}`);
      setText(cost, maxed ? 'MAX' : fmt(price));
      cell.classList.toggle('is-owned', owned > 0);
      cell.classList.toggle('is-maxed', maxed);
      cell.classList.toggle('is-locked', !unlocked);
      cell.classList.toggle('is-ready', affordable);
      cell.disabled = maxed || !unlocked || !affordable;
      cell.title = unlocked
        ? `${node.name} — ${node.blurb}`
        : `${node.name} — needs ${TIER_GATES[node.tier]} ranks in this branch`;
    }
  }

  updateStars(state) {
    for (const def of CONSTELLATIONS) {
      const entry = this.starRefs.get(def.id);
      const owned = state.constellations[def.id] || 0;
      const maxed = owned >= def.max;
      const price = maxed ? 0 : rankCost(def, owned);

      setText(entry.cost, maxed ? 'MAX' : fmtInt(price));
      setText(entry.ranks, def.max > 1 ? `${owned}/${def.max}` : owned ? 'owned' : '');
      entry.row.classList.toggle('is-owned', owned > 0);
      entry.row.classList.toggle('is-maxed', maxed);
      entry.row.classList.toggle('is-affordable', !maxed && state.lotus >= price);
      entry.row.disabled = maxed || state.lotus < price;
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
