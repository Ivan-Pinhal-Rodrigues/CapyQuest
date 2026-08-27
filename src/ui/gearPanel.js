// The Kit panel: six equipment slots, the bag, the forge, and the skill bar.

import { fmtInt, fmtPct, fmtMult } from './numbers.js';
import { SLOTS } from '../data/gear.js';
import { MAX_STARS, MAX_TIER, refineChance, FUSE_COST } from '../data/rarities.js';
import { SKILLS, SKILLS_BY_ID, SKILL_SLOTS } from '../data/skills.js';
import { GEAR_SHAPES } from '../render/gearSprites.js';
import { resolveItem, equippedItem } from '../systems/combatStats.js';
import { forgePrice, refinePrice, MAX_FORGE } from '../systems/loot.js';
import { spriteDataUrl } from './icons.js';
import { openModal, el } from './modal.js';
import { setOf, SET_THRESHOLDS } from '../data/gearSets.js';
import { equippedSets } from '../systems/equipment.js';

/** The rung supplies the palette, so a piece visibly changes as it climbs. */
function gearPalette(rarity) {
  const base = rarity?.color || '#9aa5b1';
  return {
    '.': null,
    o: '#1c1420',
    1: shade(base, -0.45),
    2: shade(base, -0.2),
    3: shade(base, 0.15),
    4: base,
    w: '#fff7d6',
  };
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const to = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const ch = (shift) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (to - c) * t);
  };
  return `#${[ch(16), ch(8), ch(0)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function gearIconUrl(item) {
  return spriteDataUrl(GEAR_SHAPES[item.slot], gearPalette(item.rarity), `gear:${item.slot}:${item.tier}`);
}

/** "+7 ★★★" — the two things about a piece that are not its name. */
export function itemMarks(item) {
  const parts = [];
  if (item.forge > 0) parts.push(`+${item.forge}`);
  if (item.stars > 1) parts.push('★'.repeat(item.stars));
  return parts.join(' ');
}

function itemTitle(item) {
  const marks = itemMarks(item);
  return marks ? `${item.name} ${marks}` : item.name;
}

/** Human-readable stat line. resolveItem has already applied every multiplier. */
function statLine(item) {
  const parts = [];
  const s = item.stats;
  if (s.atk) parts.push(`ATK ${fmtInt(s.atk)}`);
  if (s.def) parts.push(`DEF ${fmtInt(s.def)}`);
  if (s.hp) parts.push(`HP ${fmtInt(s.hp)}`);
  if (s.spd) parts.push(`SPD ${fmtInt(s.spd)}`);
  if (s.luck) parts.push(`LUK ${fmtInt(s.luck)}`);
  if (s.crit) parts.push(`CRIT ${fmtPct(s.crit)}`);
  if (s.critDmg) parts.push(`CDMG +${s.critDmg.toFixed(2)}×`);
  return parts.join(' · ');
}

function bonusLine(item) {
  if (!item.bonus) return '';
  const b = item.bonus;
  const pct = (v) => `${Math.round((v - 1) * 100)}%`;
  switch (b.type) {
    case 'zpsMult': return `+${pct(b.value)} idle income`;
    case 'clickMult': return `+${pct(b.value)} tap power`;
    case 'globalMult': return `+${pct(b.value)} all income`;
    case 'costDiscount': return `−${Math.round(b.value * 100)}% generator prices`;
    case 'goldenChance': return `+${Math.round(b.value * 100)}% golden rate`;
    case 'offlineRate': return `+${Math.round(b.value * 100)}% offline rate`;
    case 'offlineCapHours': return `+${b.value}h offline cap`;
    case 'critChance': return `+${Math.round(b.value * 100)}% tap crit`;
    default: return '';
  }
}

export class GearPanel {
  constructor(root, { onEquip, onUnequip, onForge, onScrap, onSlotSkill }) {
    this.root = root;
    this.handlers = { onEquip, onUnequip, onForge, onScrap, onSlotSkill };
    this.slotNodes = new Map();
    this.bagCards = new Map();
    this.filter = 'all';
    this.build();
  }

  build() {
    const r = this.root;

    // --- power summary
    this.summary = document.createElement('div');
    this.summary.className = 'kit__summary';
    r.appendChild(this.summary);
    this.summaryRows = new Map();

    // --- equipment slots
    r.appendChild(heading('Equipped'));
    this.slotGrid = document.createElement('div');
    this.slotGrid.className = 'slot-grid';
    for (const slot of SLOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.dataset.slot = slot.id;

      const img = document.createElement('img');
      img.className = 'slot__icon pixel-icon';
      img.alt = '';

      const name = document.createElement('span');
      name.className = 'slot__name';

      const forge = document.createElement('span');
      forge.className = 'slot__forge';

      btn.append(img, name, forge);
      btn.addEventListener('click', () => this.openSlot(slot.id));
      this.slotGrid.appendChild(btn);
      this.slotNodes.set(slot.id, { btn, img, name, forge });
    }
    r.appendChild(this.slotGrid);

    // --- sets
    //
    // Directly under the slots, because that is where the decision is made.
    // Rebuilt rather than mutated in place: it holds at most six short rows and
    // only changes when you equip something, so the cost is nothing and the
    // alternative is a diffing routine nobody will ever need.
    this.setStrip = document.createElement('div');
    this.setStrip.className = 'set-strip';
    r.appendChild(this.setStrip);

    // --- skills
    r.appendChild(heading('Skills'));
    this.skillBar = document.createElement('div');
    this.skillBar.className = 'skill-bar';
    this.skillSlots = [];
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-slot';
      btn.addEventListener('click', () => this.openSkillPicker(i));
      this.skillBar.appendChild(btn);
      this.skillSlots.push(btn);
    }
    r.appendChild(this.skillBar);

    // --- bag
    const bagHead = document.createElement('div');
    bagHead.className = 'kit__bag-head';
    this.bagTitle = document.createElement('h3');
    this.bagTitle.className = 'kit__heading';
    bagHead.appendChild(this.bagTitle);

    this.shardLabel = document.createElement('span');
    this.shardLabel.className = 'kit__shards';
    bagHead.appendChild(this.shardLabel);
    r.appendChild(bagHead);

    this.bag = document.createElement('div');
    this.bag.className = 'bag';
    r.appendChild(this.bag);

    this.bagEmpty = document.createElement('p');
    this.bagEmpty.className = 'shop__hint';
    this.bagEmpty.textContent = 'Nothing in the bag yet. Win a fight.';
    r.appendChild(this.bagEmpty);
  }

  /**
   * What you are wearing, set-wise, and what the next threshold pays.
   *
   * Shows sets you have ONE piece of as well. Two is where the first bonus
   * lands, so a player holding one piece needs to be told the mechanic exists
   * and that they are a single slot away from it — otherwise sets are a system
   * you only find by accident.
   */
  updateSets(state) {
    const worn = equippedSets(state);
    const key = worn.map((w) => `${w.set.id}:${w.count}`).join(',');
    if (key === this.setKey) return;
    this.setKey = key;

    this.setStrip.replaceChildren();
    if (!worn.length) {
      this.setStrip.appendChild(el('p', 'set-strip__hint',
        'Gear comes in sets. Wear two pieces of one for a bonus, four for a real one.'));
      return;
    }

    for (const { set, count } of worn) {
      const next = SET_THRESHOLDS.find((t) => count < t);
      const active = SET_THRESHOLDS.filter((t) => count >= t);

      const row = el('div', `set-row${active.length ? ' is-active' : ''}`);
      row.appendChild(el('span', 'set-row__name', set.name));
      row.appendChild(el('span', 'set-row__count', `${count} / ${next ?? SET_THRESHOLDS.at(-1)}`));
      row.appendChild(el(
        'span',
        'set-row__what',
        active.length ? set.identity : `${next - count} more for ${set.identity.toLowerCase()}`,
      ));
      this.setStrip.appendChild(row);
    }
  }

  summaryRow(label, value) {
    let node = this.summaryRows.get(label);
    if (!node) {
      const row = document.createElement('div');
      row.className = 'kit__stat';
      const l = document.createElement('span');
      l.className = 'kit__stat-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'kit__stat-value';
      row.append(l, v);
      this.summary.appendChild(row);
      node = v;
      this.summaryRows.set(label, node);
    }
    if (node.textContent !== value) node.textContent = value;
  }

  update(state, stats) {
    this.summaryRow('Level', String(stats.level));
    this.summaryRow('Power', fmtInt(stats.power));
    this.summaryRow('ATK', fmtInt(stats.atk));
    this.summaryRow('DEF', fmtInt(stats.def));
    this.summaryRow('HP', fmtInt(stats.hp));
    this.summaryRow('SPD', fmtInt(stats.spd));
    this.summaryRow('Crit', `${fmtPct(stats.crit)} / ${fmtMult(stats.critMult)}`);
    this.summaryRow('Luck', fmtInt(stats.luck));
    this.summaryRow('XP', `${fmtInt(stats.xpIntoLevel)} / ${fmtInt(stats.xpForNext)}`);

    this.updateSets(state);

    // --- slots
    for (const slot of SLOTS) {
      const node = this.slotNodes.get(slot.id);
      const item = equippedItem(state, slot.id);
      if (item) {
        node.img.src = gearIconUrl(item);
        node.img.hidden = false;
        node.name.textContent = item.name;
        node.forge.textContent = itemMarks(item);
        node.btn.style.setProperty('--rarity', item.rarity.color);
        node.btn.classList.add('is-filled');
      } else {
        node.img.hidden = true;
        node.name.textContent = slot.name;
        node.forge.textContent = '';
        node.btn.style.removeProperty('--rarity');
        node.btn.classList.remove('is-filled');
      }
    }

    // --- skills
    this.skillSlots.forEach((btn, i) => {
      const id = state.combat.skills[i];
      const skill = SKILLS_BY_ID[id];
      btn.textContent = skill ? skill.name : '+ Skill';
      btn.classList.toggle('is-empty', !skill);
      btn.classList.toggle('is-passive', skill?.kind === 'passive');
      btn.title = skill ? skill.blurb : 'Slot a skill';
    });

    // --- bag
    this.shardLabel.textContent = `${fmtInt(state.combat.shards)} shards`;
    this.bagTitle.textContent = `Bag (${state.combat.inventory.length})`;
    this.renderBag(state);
  }

  renderBag(state) {
    const equipped = new Set(Object.values(state.combat.equipped || {}));
    const items = state.combat.inventory
      .map(resolveItem)
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    this.bagEmpty.hidden = items.length > 0;
    const seen = new Set();

    for (const item of items) {
      seen.add(item.uid);
      let entry = this.bagCards.get(item.uid);
      if (!entry) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'bag__item';
        const img = document.createElement('img');
        img.className = 'bag__icon pixel-icon';
        img.alt = '';
        const badge = document.createElement('span');
        badge.className = 'bag__forge';
        card.append(img, badge);
        card.addEventListener('click', () => this.openItem(state, item.uid));
        this.bag.appendChild(card);
        entry = { card, img, badge };
        this.bagCards.set(item.uid, entry);
      }
      entry.img.src = gearIconUrl(item);
      entry.badge.textContent = itemMarks(item);
      entry.card.style.setProperty('--rarity', item.rarity.color);
      entry.card.classList.toggle('is-equipped', equipped.has(item.uid));
      entry.card.title = `${itemTitle(item)} — ${item.rarity.name}`;
    }

    for (const [uid, entry] of this.bagCards) {
      if (seen.has(uid)) continue;
      entry.card.remove();
      this.bagCards.delete(uid);
    }
  }

  // ------------------------------------------------------------------ modals

  /** Tapping a slot lists everything you own that fits it. */
  openSlot(slotId) {
    const slot = SLOTS.find((s) => s.id === slotId);
    this.handlers.onEquip(null, slotId, { pick: true, slot });
  }

  openItem(state, uid) {
    this.handlers.onEquip(uid, null, { inspect: true });
  }

  openSkillPicker(index) {
    this.handlers.onSlotSkill(index);
  }
}

// The modal bodies live here so the panel and main.js share one presentation.

export function itemDetailBody(item, { equipped, shards, leafs = 0, fodder = 0 }) {
  const body = el('div', 'item-detail');

  const head = el('div', 'item-detail__head');
  const img = document.createElement('img');
  img.className = 'item-detail__icon pixel-icon';
  img.src = gearIconUrl(item);
  img.alt = '';
  const titles = el('div', 'item-detail__titles');
  const name = el('strong', 'item-detail__name', itemTitle(item));
  const rarity = el('span', 'item-detail__rarity', `${item.rarity.name} · ${'★'.repeat(item.stars)}`);
  rarity.style.color = item.rarity.color;
  titles.append(name, rarity);
  head.append(img, titles);
  body.append(head);

  body.appendChild(el('p', 'item-detail__stats', statLine(item)));

  const bonus = bonusLine(item);
  if (bonus) body.appendChild(el('p', 'item-detail__bonus', bonus));

  // Which set this belongs to, and what the set is for. A piece whose set
  // membership is invisible until you happen to equip a second one is a
  // mechanic nobody discovers.
  const set = setOf(item.id);
  if (set) {
    const line = el('p', 'item-detail__set', `${set.name} set — ${set.identity}`);
    body.appendChild(line);
  }

  body.appendChild(el('p', 'item-detail__blurb', item.blurb));

  const entry = { id: item.id, forge: item.forge, tier: item.tier, stars: item.stars };

  if (item.forge >= MAX_FORGE) {
    body.appendChild(el('p', 'item-detail__forge', 'Fully enhanced. +15 is the ceiling.'));
  } else {
    const price = forgePrice(entry);
    const line = el(
      'p',
      'item-detail__forge',
      `Enhance to +${item.forge + 1}: ${fmtInt(price)} shards (you have ${fmtInt(shards)})`,
    );
    if (shards < price) line.classList.add('is-short');
    body.appendChild(line);
  }

  // --- refine. The odds go on screen every time, not just in a wiki somewhere.
  if (item.stars >= MAX_STARS) {
    body.appendChild(el('p', 'item-detail__forge', `${MAX_STARS} stars. Nothing left to add.`));
  } else if (item.forge < MAX_FORGE) {
    body.appendChild(el('p', 'item-detail__note', `Refine for a ${item.stars + 1}${nth(item.stars + 1)} star opens at +${MAX_FORGE}.`));
  } else {
    const price = refinePrice(entry);
    const odds = Math.round(refineChance(item.stars) * 100);
    const line = el(
      'p',
      'item-detail__forge',
      `Refine to ${item.stars + 1}★: ${fmtInt(price.shards)} shards + ${price.leafs} 🍃 · ${odds}% chance`,
    );
    if (shards < price.shards || leafs < price.leafs) line.classList.add('is-short');
    body.appendChild(line);
    if (item.refineFails > 0) {
      body.appendChild(
        el('p', 'item-detail__note', `${item.refineFails} failed. Guaranteed on the 5th attempt.`),
      );
    }
  }

  // --- fuse
  if (item.tier >= MAX_TIER) {
    body.appendChild(el('p', 'item-detail__forge', 'Capybaric. The top of the ladder.'));
  } else {
    const line = el(
      'p',
      'item-detail__forge',
      `Fuse to the next rung: ${FUSE_COST} spare ${item.slot} pieces at ${item.rarity.name} (you have ${fodder})`,
    );
    if (fodder < FUSE_COST) line.classList.add('is-short');
    body.appendChild(line);
  }

  if (equipped) body.appendChild(el('p', 'item-detail__note', 'Currently equipped.'));
  return body;
}

export function slotPickerBody(state, slotId, onPick) {
  const body = el('div', 'picker');
  const items = state.combat.inventory
    .map(resolveItem)
    .filter((i) => i && i.slot === slotId)
    .sort((a, b) => b.score - a.score);

  if (!items.length) {
    body.appendChild(el('p', 'shop__hint', 'Nothing for this slot yet. Keep fighting.'));
    return body;
  }

  const current = state.combat.equipped[slotId];
  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `picker__row${item.uid === current ? ' is-current' : ''}`;
    row.style.setProperty('--rarity', item.rarity.color);

    const img = document.createElement('img');
    img.className = 'picker__icon pixel-icon';
    img.src = gearIconUrl(item);
    img.alt = '';

    const text = el('span', 'picker__text');
    text.appendChild(el('strong', 'picker__name', itemTitle(item)));
    text.appendChild(el('span', 'picker__stats', statLine(item)));

    row.append(img, text);
    row.addEventListener('click', () => onPick(item.uid));
    body.appendChild(row);
  }
  return body;
}

export function skillPickerBody(state, onPick) {
  const body = el('div', 'picker');
  const slotted = new Set(state.combat.skills);

  for (const skill of SKILLS) {
    const unlocked = Math.floor(state.combat.bestDepth / 10) >= skill.req.stage;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `picker__row picker__row--skill${unlocked ? '' : ' is-locked'}`;
    row.disabled = !unlocked;

    const text = el('span', 'picker__text');
    const title = el('strong', 'picker__name', skill.name);
    const kind = el('span', 'picker__kind', skill.kind === 'active' ? `active · ${skill.cooldown}s` : 'passive');
    const head = el('span', 'picker__head');
    head.append(title, kind);
    text.append(head);
    text.appendChild(
      el('span', 'picker__stats', unlocked ? skill.blurb : `Unlocks at stage ${skill.req.stage + 1}`),
    );

    row.append(text);
    if (slotted.has(skill.id)) row.classList.add('is-current');
    row.addEventListener('click', () => onPick(skill.id));
    body.appendChild(row);
  }

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'picker__row picker__row--clear';
  clear.textContent = 'Clear this slot';
  clear.addEventListener('click', () => onPick(null));
  body.appendChild(clear);

  return body;
}

function heading(text) {
  const h = document.createElement('h3');
  h.className = 'kit__heading';
  h.textContent = text;
  return h;
}

export { statLine, bonusLine };

function nth(n) {
  return n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}
