// Shop panels: the generator list and the upgrade grid.
//
// Both build their DOM once and then mutate text and classes in place. A
// clicker re-renders its shop several times a second; tearing down and
// rebuilding hundreds of nodes each time would drop frames and, worse, would
// cancel the click you were halfway through making.

import { fmt, fmtInt, fmtShort } from './numbers.js';
import { BUILDINGS } from '../data/buildings.js';
import { quoteBuilding, availableUpgrades, visibleBuildings } from '../systems/shop.js';
import { describeRequirement } from '../data/requirements.js';
import { buildingIconUrl, upgradeIconUrl, iconImg } from './icons.js';

// ------------------------------------------------------------ generator list

export class BuildingList {
  constructor(root, { onBuy }) {
    this.root = root;
    this.onBuy = onBuy;
    this.rows = new Map();
    this.locked = null;
    this.buildLockedHint();
  }

  buildLockedHint() {
    this.locked = document.createElement('p');
    this.locked.className = 'shop__hint';
    this.locked.textContent = 'Tap the capybara to earn your first zen.';
    this.root.appendChild(this.locked);
  }

  ensureRow(building) {
    const existing = this.rows.get(building.id);
    if (existing) return existing;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'building';
    row.dataset.id = building.id;

    const icon = iconImg(buildingIconUrl(building.id), '', 'building__icon pixel-icon');

    const main = document.createElement('span');
    main.className = 'building__main';

    const name = document.createElement('span');
    name.className = 'building__name';
    name.textContent = building.name;

    const cost = document.createElement('span');
    cost.className = 'building__cost';

    main.append(name, cost);

    const side = document.createElement('span');
    side.className = 'building__side';

    const owned = document.createElement('span');
    owned.className = 'building__owned';

    const rate = document.createElement('span');
    rate.className = 'building__rate';

    side.append(owned, rate);
    row.append(icon, main, side);

    row.addEventListener('click', () => this.onBuy(building.id));
    row.title = building.blurb;

    // Insert in canonical order rather than appending, so a generator that
    // becomes visible late still lands in the right place.
    const index = BUILDINGS.findIndex((b) => b.id === building.id);
    const after = BUILDINGS.slice(index + 1)
      .map((b) => this.rows.get(b.id)?.row)
      .find(Boolean);
    if (after) this.root.insertBefore(row, after);
    else this.root.appendChild(row);

    const entry = { row, cost, owned, rate, name };
    this.rows.set(building.id, entry);
    return entry;
  }

  update(state, derived) {
    const visible = visibleBuildings(state);
    this.locked.hidden = visible.length > 0 && state.lifetimeZen > 0;

    for (const building of visible) {
      const entry = this.ensureRow(building);
      const quote = quoteBuilding(state, building, state.settings.buyAmount, derived.costDiscount);
      const count = state.buildings[building.id] || 0;

      const label = quote.count > 1 ? `${fmt(quote.cost)} · ×${quote.count}` : fmt(quote.nextCost);
      setText(entry.cost, label);
      setText(entry.owned, count > 0 ? fmtInt(count) : '');
      setText(
        entry.rate,
        count > 0 ? `${fmtShort(derived.perBuilding[building.id] || 0)}/s` : `${fmtShort(building.rate)}/s each`,
      );

      entry.row.classList.toggle('is-affordable', quote.affordable);
      entry.row.classList.toggle('is-owned', count > 0);
      entry.row.disabled = !quote.affordable;
    }
  }
}

// -------------------------------------------------------------- upgrade grid

export class UpgradeGrid {
  constructor(root, { onBuy, onHover }) {
    this.root = root;
    this.onBuy = onBuy;
    this.onHover = onHover;
    this.cards = new Map();
    this.empty = document.createElement('p');
    this.empty.className = 'shop__hint';
    this.empty.textContent = 'No upgrades in reach yet. Keep tapping.';
    this.root.appendChild(this.empty);
  }

  ensureCard(upgrade) {
    const existing = this.cards.get(upgrade.id);
    if (existing) return existing;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'upgrade';
    card.dataset.id = upgrade.id;

    const icon = iconImg(upgradeIconUrl(upgrade), '', 'upgrade__icon pixel-icon');

    const name = document.createElement('span');
    name.className = 'upgrade__name';
    name.textContent = upgrade.name;

    const cost = document.createElement('span');
    cost.className = 'upgrade__cost';

    card.append(icon, name, cost);
    card.addEventListener('click', () => this.onBuy(upgrade.id));
    this.root.appendChild(card);

    const entry = { card, cost, upgrade };
    this.cards.set(upgrade.id, entry);
    return entry;
  }

  update(state) {
    const list = availableUpgrades(state);
    const seen = new Set();

    this.empty.hidden = list.length > 0;

    list.forEach((upgrade, index) => {
      seen.add(upgrade.id);
      const entry = this.ensureCard(upgrade);
      entry.upgrade = upgrade;

      const affordable = !upgrade.locked && state.zen >= upgrade.cost;
      setText(entry.cost, upgrade.locked ? 'locked' : fmt(upgrade.cost));
      entry.card.classList.toggle('is-affordable', affordable);
      entry.card.classList.toggle('is-locked', !!upgrade.locked);
      entry.card.disabled = !affordable;
      entry.card.style.order = String(index);
      entry.card.title = upgrade.locked
        ? `${upgrade.name} — unlock: ${describeRequirement(upgrade.req, fmt)}`
        : `${upgrade.name} — ${upgrade.blurb}`;
    });

    // Drop cards for upgrades that were bought or fell out of view.
    for (const [id, entry] of this.cards) {
      if (seen.has(id)) continue;
      entry.card.remove();
      this.cards.delete(id);
    }
  }
}

/** Avoid touching the DOM when the value has not actually changed. */
function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
