// The Rebirth panel: the wall, the button that answers it, the 210-node tree,
// and the unfinished Ascension layer.
//
// The panel is wall-aware on purpose. v1 showed a currency threshold, which
// told the player nothing about whether they were actually stuck. This shows
// the number that matters — how long the boss in front of you now takes to
// kill — and turns red when that crosses thirty seconds.

import { fmt, fmtInt, fmtTime } from './numbers.js';
import { CONSTELLATIONS, FIGURES, figureOf } from '../data/constellations.js';
import { rankCost, ascendPreview, ASCEND_MIN_ESSENCE, figureStatus } from '../systems/ascension.js';
import { TREE_BRANCHES, TIER_GATES, TIERS, treeLayout } from '../data/rebirthTree.js';
import { KEYSTONE_COST, KEYSTONE_GATE, keystonesFor } from '../data/keystones.js';
import { NODE_CONDITIONS, conditionLabel } from '../data/conditions.js';
import {
  branchSpend,
  canBuyNode,
  canTakeKeystone,
  hasKeystone,
  isNodeUnlocked,
  nextCost,
  ranksOf,
  treeSummary,
} from '../systems/tree.js';
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

    // --- ascension
    this.ascendCard = section('meta-card meta-card--ascend');
    add(this.ascendCard, 'h3', 'meta-card__title', 'The Still Point');
    this.ascendLead = add(this.ascendCard, 'p', 'meta-card__lead');
    this.ascendGain = add(this.ascendCard, 'p', 'meta-card__gain');
    // Where the next run starts. This is the line that says an ascension is
    // not the last one over again, so it gets its own row rather than being
    // buried in the payout sentence.
    this.ascendFloor = add(this.ascendCard, 'p', 'meta-card__floor');
    this.ascendBtn = button('btn btn--primary', 'Ascend', () => this.h.onAscend());
    this.ascendCard.appendChild(this.ascendBtn);
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
    if (this.keystoneRefs) {
      for (const [, ref] of this.keystoneRefs) ref.cell.hidden = ref.branch !== id;
    }
    this.applyBranchChrome();

    // The grid holds one tab stop, and switching branch hides the column that
    // held it — so it has to move, or the tree becomes unreachable from the
    // keyboard entirely. Set, not focused: arriving on this tab should not
    // yank focus out of whatever the player was doing.
    // Selected by the column's own hidden flag rather than by offsetParent:
    // the whole panel is hidden when the tree is first built, so every node
    // reports offsetParent null and the grid would end up with no tab stop at
    // all until the player happened to change branch.
    if (this.treeGrid) {
      for (const n of this.treeGrid.querySelectorAll('.tree-node')) n.tabIndex = -1;
      const first = this.treeGrid.querySelector('.tree__column:not([hidden]) .tree-node');
      if (first) first.tabIndex = 0;
    }
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

    // Keystones sit above the grid rather than inside it. They are not the
    // bottom of the branch, they are what the branch is *for*, and burying two
    // build-defining choices among thirty percentage nodes would lose them.
    this.keystoneWrap = section('keystones');
    this.keystoneHead = add(this.keystoneWrap, 'p', 'keystones__head');
    this.keystoneRow = section('keystones__row');
    this.keystoneWrap.appendChild(this.keystoneRow);
    this.keystoneRefs = new Map();
    for (const branch of TREE_BRANCHES) {
      for (const k of keystonesFor(branch.id)) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'keystone';
        const name = add(cell, 'strong', 'keystone__name', k.name);
        const line = add(cell, 'span', 'keystone__line', k.line);
        const terms = add(cell, 'span', 'keystone__terms');
        const status = add(cell, 'span', 'keystone__status');
        cell.addEventListener('click', () => this.h.onKeystone(k.id));
        this.keystoneRow.appendChild(cell);
        this.keystoneRefs.set(k.id, { cell, name, line, terms, status, keystone: k, branch: branch.id });
      }
    }
    this.treeWrap.appendChild(this.keystoneWrap);

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
          // Roving tabindex: the tree is ONE tab stop, not two hundred and ten.
          // Tab reached the first node and then needed 210 more presses to get
          // past the panel, which makes the keyboard route through this screen
          // unusable. Arrow keys move within the grid instead — the pattern a
          // grid widget is supposed to use.
          cell.tabIndex = -1;
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
    this.wireTreeKeyboard();
    this.setBranch(this.branch);
  }

  /**
   * Arrow keys move around the tree; Tab leaves it.
   *
   * Two hundred and ten buttons in a row is two hundred and ten Tab presses
   * between the top of this panel and the bottom of it, which is not a
   * keyboard route anybody would use. So the grid holds exactly one tab stop
   * and the arrows do the moving, which is what a grid widget is for.
   *
   * One listener on the container rather than 210 on the cells: they are
   * rebuilt whenever the branch changes, and per-cell listeners would have to
   * be rebuilt with them.
   */
  wireTreeKeyboard() {
    const visible = () =>
      [...this.treeGrid.querySelectorAll('.tree__column:not([hidden]) .tree-node')];

    this.treeGrid.addEventListener('keydown', (e) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const cells = visible();
      const at = cells.indexOf(document.activeElement);
      if (at < 0) return;

      // Down and up move a whole tier rather than one cell, because a tier is
      // the row the eye reads. Falling back to one step keeps the ends usable.
      const perRow = this.treeGrid.querySelector('.tree-tier__cells')?.children.length || 1;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[e.key];

      let next;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = cells.length - 1;
      else next = Math.min(cells.length - 1, Math.max(0, at + step));

      e.preventDefault();
      this.focusTreeNode(cells[next]);
    });
  }

  /** Move the single tab stop to `cell` and put focus on it. */
  focusTreeNode(cell) {
    if (!cell) return;
    for (const n of this.treeGrid.querySelectorAll('.tree-node')) n.tabIndex = -1;
    cell.tabIndex = 0;
    cell.focus();
  }

  buildStars() {
    // The figures come first. They are the reason the twelve are a board rather
    // than a price list, and a player who never sees them will buy in cost
    // order and never notice there was a shape to complete.
    this.figureWrap = section('figures');
    add(this.figureWrap, 'p', 'figures__head', 'Figures — light all three stars for a bonus');
    this.figureRefs = new Map();
    for (const figure of FIGURES) {
      const card = section('figure');
      const name = add(card, 'strong', 'figure__name', figure.name);
      const line = add(card, 'span', 'figure__line', figure.line);
      const pay = add(card, 'span', 'figure__pay', figure.blurb);
      const progress = add(card, 'span', 'figure__progress');
      this.figureWrap.appendChild(card);
      this.figureRefs.set(figure.id, { card, progress });
    }
    this.starList.appendChild(this.figureWrap);

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

      // Which figure this star belongs to, on the star itself. Otherwise the
      // only way to work out what completes a shape is to read four lists and
      // hold them in your head.
      const figure = figureOf(star.id);
      if (figure) {
        const tag = document.createElement('span');
        tag.className = 'relic__figure';
        tag.textContent = figure.name;
        main.appendChild(tag);
      }

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
    // Split the payout, because the two halves reward different things and a
    // player deciding whether to go now should be able to see which of them
    // another hour would move.
    setText(
      this.ascendGain,
      a.canAscend
        ? `+${fmtInt(a.lotus)} lotus — ${fmtInt(a.fromEssence)} for essence, ${fmtInt(a.fromDepth)} for ground covered`
        : `Needs ${fmtInt(ASCEND_MIN_ESSENCE)} lifetime essence`,
    );
    setText(
      this.ascendFloor,
      a.floor > 0
        ? `The next run starts at stage ${Math.floor(a.floor / 10) + 1} rather than the first.`
        : '',
    );
    this.ascendFloor.hidden = a.floor <= 0;
    this.ascendBtn.disabled = !a.canAscend;
    this.ascendCard.classList.toggle('is-ready', a.canAscend);
  }

  updateTree(state) {
    const summary = treeSummary(state);
    setText(
      this.essenceLabel,
      `${fmtInt(state.essence)} essence · ${summary.ranks}/${summary.maxRanks} ranks`,
    );
    this.respecBtn.disabled = summary.ranks === 0 && summary.keystones.length === 0;

    this.updateKeystones(state, summary);

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
      const check = canBuyNode(state, node.id);

      setText(rank, `${owned}/${node.max}`);
      setText(cost, maxed ? 'MAX' : fmt(price));
      cell.classList.toggle('is-owned', owned > 0);
      cell.classList.toggle('is-maxed', maxed);
      cell.classList.toggle('is-locked', !unlocked);
      cell.classList.toggle('is-ready', affordable);
      cell.disabled = maxed || !unlocked || !affordable;
      // A deep node blocked by the three-branch limit is not the same as one
      // you have not paid for yet, and the tooltip has to say which.
      const shallow = check.reason === 'shallow';
      cell.classList.toggle('is-shallow', shallow);

      const condition = NODE_CONDITIONS[node.id];
      cell.classList.toggle('is-conditional', !!condition);
      const conditionText = condition ? ` (${conditionLabel(condition)})` : '';

      cell.title = shallow
        ? `${node.name} — you are already committed to ${check.deep.length} branches. Respec to change that.`
        : unlocked
          ? `${node.name} — ${node.blurb}${conditionText}`
          : `${node.name} — needs ${TIER_GATES[node.tier]} ranks in this branch`;
    }
  }

  /**
   * The keystones for the open branch. Two per branch, at most three taken in
   * total, and the header says how many of those three are gone — a cap you
   * cannot see is a cap you resent.
   */
  updateKeystones(state, summary) {
    setText(
      this.keystoneHead,
      `Keystones — ${summary.keystones.length} of ${summary.keystoneMax} taken` +
        (summary.deep.length
          ? ` · deep in ${summary.deep.length} of ${summary.deepMax} branches`
          : ''),
    );

    for (const [id, ref] of this.keystoneRefs) {
      const { cell, terms, status, keystone } = ref;
      const owned = hasKeystone(state, id);
      const check = canTakeKeystone(state, id);

      setText(terms, describeKeystone(keystone));
      cell.classList.toggle('is-taken', owned);
      cell.classList.toggle('is-locked', !owned && check.reason === 'locked');

      if (owned) {
        setText(status, 'Taken — tap to drop, essence back in full');
        cell.disabled = false;
        cell.title = 'Drop this keystone. The essence comes back.';
        continue;
      }

      cell.disabled = !check.ok;
      if (check.reason === 'locked') {
        setText(status, `Needs ${KEYSTONE_GATE} ranks in this branch`);
      } else if (check.reason === 'full') {
        setText(status, `All ${summary.keystoneMax} slots are taken`);
      } else if (check.reason === 'poor') {
        setText(status, `${fmt(KEYSTONE_COST)} essence`);
      } else {
        setText(status, `Take it — ${fmt(KEYSTONE_COST)} essence`);
      }
      cell.title = `${keystone.name} — ${describeKeystone(keystone)}`;
    }
  }

  updateStars(state) {
    for (const figure of figureStatus(state)) {
      const ref = this.figureRefs.get(figure.id);
      if (!ref) continue;
      ref.card.classList.toggle('is-lit', figure.lit);
      setText(
        ref.progress,
        figure.lit ? 'Lit' : `${figure.owned} of ${figure.stars.length} stars`,
      );
    }

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

/**
 * A keystone's terms in one line: what it gives, then what it takes.
 *
 * Generated from the effect lists rather than written out, for the same reason
 * the tree's node blurbs are — a hand-typed description is a description that
 * can end up disagreeing with the number it describes.
 */
function describeKeystone(keystone) {
  const say = (e) => {
    const pct = (v) => `${Math.round(Math.abs(v) * 100)}%`;
    const mult = (v) => `${Math.round(Math.abs(1 - v) * 100)}%`;
    const up = (label) => `+${label}`;
    const down = (label) => `−${label}`;
    const dir = MULT_EFFECTS.has(e.type) ? (e.value >= 1 ? up : down) : (e.value >= 0 ? up : down);
    const size = MULT_EFFECTS.has(e.type) ? mult(e.value) : FLAT_EFFECTS.has(e.type) ? String(Math.abs(e.value)) : pct(e.value);
    return `${dir(size)} ${EFFECT_LABELS[e.type] || e.type}`;
  };
  return `${keystone.gain.map(say).join(', ')} · ${keystone.cost.map(say).join(', ')}`;
}

const MULT_EFFECTS = new Set(['clickMult', 'zpsMult', 'globalMult', 'allBuildingMult', 'buffMult']);
const FLAT_EFFECTS = new Set(['combatLuck', 'comboCap', 'offlineCapHours', 'clickFlat']);

const EFFECT_LABELS = {
  combatAtk: 'attack', combatDef: 'defence', combatHp: 'health', combatSpd: 'speed',
  combatLuck: 'luck', critChance: 'crit chance', critDamage: 'crit damage',
  comboCap: 'max combo', comboStep: 'per combo point', zpsShare: 'tap share of income',
  goldenChance: 'golden rate', goldenDuration: 'golden length',
  offlineRate: 'offline rate', offlineCapHours: 'h cache', costDiscount: 'generator prices',
  clickFlat: 'flat tap', ticketRate: 'ticket rate', essenceGain: 'essence',
  clickMult: 'tap power', zpsMult: 'idle income', globalMult: 'all income',
  allBuildingMult: 'every generator', buffMult: 'buff strength',
};
