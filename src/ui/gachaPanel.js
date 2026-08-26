// The Summon panel: pulls, the pity meter, the roster and the party.
//
// The pity counter and the real rates are on screen at all times. Hiding them
// is what separates a gacha from a slot machine, and the counter climbing is
// itself the hook — you can see the guarantee coming.

import { fmt, fmtInt, fmtPct } from './numbers.js';
import { COMPANIONS, PARTY_SIZE, SHARDS_PER_LEVEL, MAX_COMPANION_LEVEL, companionMultiplier } from '../data/companions.js';
import { ELEMENTS } from '../data/elements.js';
import { pityProgress, ownedCompanions, collectionProgress, ticketPrice, FOUR_STAR_RATE, TEN_PULL } from '../systems/gacha.js';
import { PITY_SOFT, PITY_HARD, fiveStarChance } from '../balance.js';
import { CAPY_SKINS } from '../render/palettes.js';
import { GOLDEN_CAPY } from '../render/sprites.js';
import { capyLookUrl, spriteDataUrl } from './icons.js';
import { el } from './modal.js';
import { COMPANION_SLOTS } from '../data/companionGear.js';
import { crewEquipped, crewGearStats, crewHat, crewUnequipped } from '../systems/crew.js';
import { liveCosmeticsOfKind } from '../content/registry.js';
import { owns } from '../systems/cosmetics.js';

export function companionIconUrl(companion) {
  return spriteDataUrl(GOLDEN_CAPY, CAPY_SKINS[companion.skin] || CAPY_SKINS.classic, `capy:${companion.skin}`);
}

const STAR_CLASS = { 3: 'is-three', 4: 'is-four', 5: 'is-five' };

export class GachaPanel {
  constructor(root, { onPull, onBuyTicket, onInspect }) {
    this.root = root;
    this.h = { onPull, onBuyTicket, onInspect };
    this.cards = new Map();
    this.build();
  }

  build() {
    const r = this.root;

    // --- tickets and pulls
    this.header = document.createElement('div');
    this.header.className = 'summon__header';
    this.ticketLabel = document.createElement('span');
    this.ticketLabel.className = 'summon__tickets';
    this.pullCount = document.createElement('span');
    this.pullCount.className = 'summon__pulls';
    this.header.append(this.ticketLabel, this.pullCount);
    r.appendChild(this.header);

    // --- pity meter
    const pity = document.createElement('div');
    pity.className = 'pity';

    const fiveRow = document.createElement('div');
    fiveRow.className = 'pity__row';
    this.fiveLabel = document.createElement('span');
    this.fiveLabel.className = 'pity__label';
    this.fiveTrack = document.createElement('div');
    this.fiveTrack.className = 'pity__track';
    this.fiveFill = document.createElement('div');
    this.fiveFill.className = 'pity__fill pity__fill--five';
    this.fiveTrack.appendChild(this.fiveFill);
    fiveRow.append(this.fiveLabel, this.fiveTrack);

    const fourRow = document.createElement('div');
    fourRow.className = 'pity__row';
    this.fourLabel = document.createElement('span');
    this.fourLabel.className = 'pity__label';
    this.fourTrack = document.createElement('div');
    this.fourTrack.className = 'pity__track';
    this.fourFill = document.createElement('div');
    this.fourFill.className = 'pity__fill pity__fill--four';
    this.fourTrack.appendChild(this.fourFill);
    fourRow.append(this.fourLabel, this.fourTrack);

    this.rates = document.createElement('p');
    this.rates.className = 'pity__rates';

    pity.append(fiveRow, fourRow, this.rates);
    r.appendChild(pity);

    // --- pull buttons
    const buttons = document.createElement('div');
    buttons.className = 'summon__buttons';
    this.pullOne = btn('btn btn--primary', 'Summon ×1', () => this.h.onPull(1));
    this.pullTen = btn('btn btn--gold', `Summon ×${TEN_PULL}`, () => this.h.onPull(TEN_PULL));
    buttons.append(this.pullOne, this.pullTen);
    r.appendChild(buttons);

    this.buyBtn = btn('btn btn--small summon__buy', 'Buy a ticket', () => this.h.onBuyTicket());
    r.appendChild(this.buyBtn);

    // --- party
    r.appendChild(heading('Party'));
    this.partyRow = document.createElement('div');
    this.partyRow.className = 'party';
    this.partySlots = [];
    for (let i = 0; i < PARTY_SIZE; i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'party__slot';
      const img = document.createElement('img');
      img.className = 'party__icon pixel-icon';
      img.alt = '';
      const name = document.createElement('span');
      name.className = 'party__name';
      slot.append(img, name);
      slot.addEventListener('click', () => this.h.onInspect(null, i));
      this.partyRow.appendChild(slot);
      this.partySlots.push({ slot, img, name });
    }
    r.appendChild(this.partyRow);

    // --- roster
    const rosterHead = document.createElement('div');
    rosterHead.className = 'summon__roster-head';
    this.rosterTitle = document.createElement('h3');
    this.rosterTitle.className = 'kit__heading';
    this.collectionBar = document.createElement('div');
    this.collectionBar.className = 'progress';
    this.collectionFill = document.createElement('div');
    this.collectionFill.className = 'progress__fill';
    this.collectionBar.appendChild(this.collectionFill);
    rosterHead.append(this.rosterTitle, this.collectionBar);
    r.appendChild(rosterHead);

    this.roster = document.createElement('div');
    this.roster.className = 'roster';
    r.appendChild(this.roster);

    this.empty = document.createElement('p');
    this.empty.className = 'shop__hint';
    this.empty.textContent = 'No capybaras yet. Bosses drop summon tickets.';
    r.appendChild(this.empty);
  }

  update(state) {
    const g = state.gacha;

    setText(this.ticketLabel, `${fmtInt(g.tickets)} ticket${g.tickets === 1 ? '' : 's'}`);
    setText(this.pullCount, `${fmtInt(g.pulls)} summoned`);

    const p = pityProgress(g.pity);
    this.fiveFill.style.transform = `scaleX(${p.five})`;
    this.fourFill.style.transform = `scaleX(${p.four})`;
    this.fiveFill.classList.toggle('is-soft', p.soft);
    setText(this.fiveLabel, `5★ in ${p.fiveRemaining}`);
    setText(this.fourLabel, `4★ in ${p.fourRemaining}`);
    setText(
      this.rates,
      p.soft
        ? `Rates are climbing: 5★ now ${fmtPct(p.chance)}. Guaranteed at ${PITY_HARD}.`
        : `5★ ${fmtPct(fiveStarChance(0))} · 4★ ${fmtPct(FOUR_STAR_RATE)} · rates rise from ${PITY_SOFT} pulls.`,
    );

    this.pullOne.disabled = g.tickets < 1;
    this.pullTen.disabled = g.tickets < TEN_PULL;
    this.pullTen.textContent = g.tickets >= TEN_PULL ? `Summon ×${TEN_PULL}` : `Summon ×${TEN_PULL} (need ${TEN_PULL})`;

    const price = ticketPrice(state);
    this.buyBtn.textContent = `Buy a ticket — ${fmt(price)} zen`;
    this.buyBtn.disabled = state.zen < price;

    // --- party
    const party = g.party || [];
    this.partySlots.forEach((entry, i) => {
      const id = party[i];
      const def = COMPANIONS.find((c) => c.id === id);
      const owned = id ? g.companions[id] : null;
      if (def && owned) {
        entry.img.src = companionIconUrl(def);
        entry.img.hidden = false;
        entry.name.textContent = `${def.name} Lv${owned.level}`;
        entry.slot.className = `party__slot is-filled ${STAR_CLASS[def.star]}`;
      } else {
        entry.img.hidden = true;
        entry.name.textContent = '+ Add';
        entry.slot.className = 'party__slot';
      }
    });

    // --- roster
    const owned = ownedCompanions(state);
    const collection = collectionProgress(state);
    setText(this.rosterTitle, `Roster ${collection.owned}/${collection.total}`);
    this.collectionFill.style.transform = `scaleX(${collection.ratio})`;
    this.empty.hidden = owned.length > 0;

    const seen = new Set();
    for (const companion of owned) {
      seen.add(companion.id);
      let entry = this.cards.get(companion.id);
      if (!entry) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'capy-card';
        const img = document.createElement('img');
        img.className = 'capy-card__icon pixel-icon';
        img.alt = '';
        img.src = companionIconUrl(companion);
        const name = document.createElement('span');
        name.className = 'capy-card__name';
        name.textContent = companion.name;
        const level = document.createElement('span');
        level.className = 'capy-card__level';
        card.append(img, name, level);
        card.addEventListener('click', () => this.h.onInspect(companion.id, null));
        this.roster.appendChild(card);
        entry = { card, level };
        this.cards.set(companion.id, entry);
      }
      setText(entry.level, `Lv${companion.level}`);
      entry.card.className = `capy-card ${STAR_CLASS[companion.star]}${party.includes(companion.id) ? ' is-party' : ''}`;
      entry.card.title = `${companion.name} — ${'★'.repeat(companion.star)}`;
    }

    for (const [id, entry] of this.cards) {
      if (seen.has(id)) continue;
      entry.card.remove();
      this.cards.delete(id);
    }
  }
}

/** Modal body for the pull results — the payoff screen. */
export function pullResultsBody(results) {
  const body = el('div', 'pull-results');
  const best = Math.max(...results.map((r) => r.star));

  body.appendChild(
    el(
      'p',
      'pull-results__lead',
      best === 5 ? 'A five star. Genuinely.' : best === 4 ? 'Something decent turned up.' : 'The reeds rustle politely.',
    ),
  );

  const grid = el('div', 'pull-results__grid');
  for (const result of results) {
    const companion = COMPANIONS.find((c) => c.id === result.id);
    const card = el('div', `pull-card ${STAR_CLASS[result.star]}`);

    const img = document.createElement('img');
    img.className = 'pull-card__icon pixel-icon';
    img.src = companionIconUrl(companion);
    img.alt = '';

    card.append(img);
    card.appendChild(el('span', 'pull-card__name', companion.name));
    card.appendChild(el('span', 'pull-card__stars', '★'.repeat(result.star)));
    card.appendChild(
      el('span', 'pull-card__tag', result.isNew ? 'NEW' : result.levelled ? `Lv${result.level}` : '+1 shard'),
    );
    grid.appendChild(card);
  }
  body.appendChild(grid);
  return body;
}

/**
 * Modal body for one companion.
 *
 * `state` and the two callbacks are optional: the roster in the Summon panel
 * shows companions you may not own yet, and a picker for gear you cannot equip
 * would be a dead control.
 */
export function companionDetailBody(companion, { inParty, state, onPickGear, onPickHat } = {}) {
  const body = el('div', 'item-detail');

  const head = el('div', 'item-detail__head');
  const img = document.createElement('img');
  img.className = 'item-detail__icon pixel-icon';
  // Wearing its hat, and at the size the pond draws it — the portrait should be
  // the animal you can see in the water, not a generic one.
  img.src = state
    ? capyLookUrl({ skin: companion.skin, hat: crewHat(state, companion.id) })
    : companionIconUrl(companion);
  img.alt = '';
  const titles = el('div', 'item-detail__titles');
  titles.appendChild(el('strong', 'item-detail__name', `${companion.name} · Lv${companion.level}`));
  const stars = el('span', 'item-detail__rarity', '★'.repeat(companion.star));
  stars.style.color = companion.star === 5 ? '#f0a63d' : companion.star === 4 ? '#a45fd9' : '#4d8fd9';
  titles.append(stars);
  head.append(img, titles);
  body.append(head);

  const element = ELEMENTS[companion.element];
  const elLine = el('p', 'item-detail__bonus', `${element.icon} ${element.name}`);
  elLine.style.color = element.color;
  body.appendChild(elLine);

  // Own stats, plus whatever the gear adds. Shown as one line rather than two
  // because the question is "how strong is this companion", not "how strong is
  // it before its charm".
  const mult = companionMultiplier(companion.level);
  const fromGear = state ? crewGearStats(state, companion.id) : {};
  const keys = new Set([...Object.keys(companion.stats), ...Object.keys(fromGear).filter((k) => fromGear[k])]);
  const parts = [];
  for (const key of keys) {
    const value = (companion.stats[key] || 0) * mult + (fromGear[key] || 0);
    if (!value) continue;
    parts.push(describeStat(key, value));
  }
  body.appendChild(el('p', 'item-detail__stats', parts.join(' · ')));

  if (companion.bonus) {
    body.appendChild(el('p', 'item-detail__bonus', describeBonus(companion.bonus)));
  }

  body.appendChild(el('p', 'item-detail__blurb', companion.blurb));

  if (companion.level < MAX_COMPANION_LEVEL) {
    const per = SHARDS_PER_LEVEL[companion.star];
    body.appendChild(
      el('p', 'item-detail__forge', `${companion.shards}/${per} duplicate shards toward Lv${companion.level + 1}.`),
    );
  } else {
    body.appendChild(el('p', 'item-detail__forge', 'Fully levelled.'));
  }

  if (state) body.appendChild(crewKitSection(companion, state, { onPickGear, onPickHat }));

  if (inParty) body.appendChild(el('p', 'item-detail__note', 'In your party.'));
  else if (state) {
    body.appendChild(el(
      'p',
      'item-detail__note',
      'Only the three in your party contribute. Gear stays on whoever is wearing it.',
    ));
  }
  return body;
}

/** Modal body for choosing who fills a party slot. */
export function partyPickerBody(state, onPick) {
  const body = el('div', 'picker');
  const owned = ownedCompanions(state);

  if (!owned.length) {
    body.appendChild(el('p', 'shop__hint', 'Nothing to add yet. Summon someone.'));
    return body;
  }

  for (const companion of owned) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `picker__row ${STAR_CLASS[companion.star]}`;
    if ((state.gacha.party || []).includes(companion.id)) row.classList.add('is-current');

    const img = document.createElement('img');
    img.className = 'picker__icon pixel-icon';
    img.src = companionIconUrl(companion);
    img.alt = '';

    const text = el('span', 'picker__text');
    const head = el('span', 'picker__head');
    head.append(
      el('strong', 'picker__name', `${companion.name} Lv${companion.level}`),
      el('span', 'picker__kind', '★'.repeat(companion.star)),
    );
    text.append(head, el('span', 'picker__stats', companion.blurb));

    row.append(img, text);
    row.addEventListener('click', () => onPick(companion.id));
    body.appendChild(row);
  }

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'picker__row picker__row--clear';
  clear.textContent = 'Empty this slot';
  clear.addEventListener('click', () => onPick(null));
  body.appendChild(clear);

  return body;
}

function describeBonus(bonus) {
  const pct = (v) => `${Math.round((v - 1) * 100)}%`;
  switch (bonus.type) {
    case 'zpsMult': return `+${pct(bonus.value)} idle income`;
    case 'clickMult': return `+${pct(bonus.value)} tap power`;
    case 'globalMult': return `+${pct(bonus.value)} all income`;
    case 'goldenChance': return `+${Math.round(bonus.value * 100)}% golden rate`;
    case 'offlineRate': return `+${Math.round(bonus.value * 100)}% offline rate`;
    case 'offlineCapHours': return `+${bonus.value}h offline cap`;
    case 'costDiscount': return `−${Math.round(bonus.value * 100)}% generator prices`;
    default: return '';
  }
}

function heading(text) {
  const h = document.createElement('h3');
  h.className = 'kit__heading';
  h.textContent = text;
  return h;
}

function btn(className, label, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

/**
 * The three gear slots and the hat, for one companion.
 *
 * Deliberately compact: it sits inside a modal that already carries stats, a
 * blurb and a shard counter, and a full inventory grid here would push the
 * party buttons off a phone screen. Tapping a slot opens the picker.
 */
function crewKitSection(companion, state, { onPickGear, onPickHat } = {}) {
  const wrap = el('div', 'crew-kit');
  wrap.appendChild(el('h4', 'crew-kit__head', 'Kit'));

  const row = el('div', 'crew-kit__slots');
  for (const slot of COMPANION_SLOTS) {
    const item = crewEquipped(state, companion.id, slot.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `crew-slot${item ? ' is-filled' : ''}`;
    btn.title = item ? `${item.rarity.name} ${item.name}` : `${slot.name} — ${slot.blurb}`;

    btn.appendChild(el('span', 'crew-slot__label', slot.name));
    const name = el('span', 'crew-slot__name', item ? item.name : 'Empty');
    if (item) name.style.color = item.rarity.color;
    btn.appendChild(name);
    if (item) btn.appendChild(el('span', 'crew-slot__stars', '★'.repeat(item.stars)));

    // Without a handler the slot is a label, not a dead button.
    if (onPickGear) btn.addEventListener('click', () => onPickGear(companion.id, slot.id));
    else btn.disabled = true;
    row.appendChild(btn);
  }
  wrap.appendChild(row);

  const hatId = crewHat(state, companion.id);
  const hatDef = liveCosmeticsOfKind('hat').find((h) => h.id === hatId);
  const hatBtn = document.createElement('button');
  hatBtn.type = 'button';
  hatBtn.className = 'btn btn--small crew-kit__hat';
  hatBtn.textContent = `Hat: ${hatDef?.name || 'Bare'}`;
  if (onPickHat) hatBtn.addEventListener('click', () => onPickHat(companion.id));
  else hatBtn.disabled = true;
  wrap.appendChild(hatBtn);

  return wrap;
}

/** Picker body: everything in the bag that fits one slot, plus "take it off". */
export function crewGearPickerBody(state, companionId, slot, onPick) {
  const body = el('div', 'picker');
  const current = crewEquipped(state, companionId, slot);
  const choices = crewUnequipped(state, slot);

  if (current) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'picker__row';
    row.appendChild(el('span', 'picker__text', 'Take it off'));
    row.addEventListener('click', () => onPick(null));
    body.appendChild(row);
  }

  if (!choices.length) {
    body.appendChild(el(
      'p',
      'shop__hint',
      current
        ? 'Nothing else for this slot yet. Bosses drop crew gear.'
        : 'Nothing for this slot yet. Bosses drop crew gear.',
    ));
    return body;
  }

  for (const item of choices) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'picker__row';

    const text = el('span', 'picker__text');
    const name = el('strong', 'picker__name', `${item.name} ${'★'.repeat(item.stars)}`);
    name.style.color = item.rarity.color;
    text.appendChild(name);
    text.appendChild(el('span', 'picker__stats', describeCrewStats(item.stats)));
    row.appendChild(text);

    row.addEventListener('click', () => onPick(item.uid));
    body.appendChild(row);
  }
  return body;
}

/** Picker body: every hat the player owns, wearable by any companion. */
export function crewHatPickerBody(state, companion, onPick) {
  const body = el('div', 'wardrobe');

  const grid = el('div', 'wardrobe__grid');
  const worn = crewHat(state, companion.id);

  for (const def of liveCosmeticsOfKind('hat')) {
    if (def.id !== 'none' && !owns(state, 'hat', def.id)) continue;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `wardrobe__item${worn === def.id ? ' is-worn' : ''}`;

    const img = document.createElement('img');
    img.className = 'wardrobe__thumb pixel-icon';
    img.alt = '';
    // Previewed on *this* companion's own skin, so the choice is what it will
    // actually look like rather than what it looks like on the player.
    img.src = capyLookUrl({ skin: companion.skin, hat: def.id });
    card.append(img, el('span', 'wardrobe__label', def.name));

    card.addEventListener('click', () => onPick(def.id));
    grid.appendChild(card);
  }

  body.appendChild(grid);
  return body;
}

function describeCrewStats(stats) {
  const parts = [];
  for (const [key, value] of Object.entries(stats)) {
    if (!value) continue;
    parts.push(describeStat(key, value));
  }
  return parts.join(' · ');
}

/**
 * One stat, labelled and formatted.
 *
 * Crit chance and crit damage are rates, not quantities. Printing crit damage
 * with fmtInt turned +30% into "CDMG 0" — true of every companion carrying it
 * since they were added, and invisible until gear started handing it out.
 */
const RATE_KEYS = new Set(['crit', 'critDmg']);

function describeStat(key, value) {
  const label = key === 'critDmg' ? 'CDMG' : key.toUpperCase();
  return RATE_KEYS.has(key) ? `${label} ${fmtPct(value)}` : `${label} ${fmtInt(value)}`;
}
