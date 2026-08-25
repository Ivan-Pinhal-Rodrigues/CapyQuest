// One place where every source of power gets folded together.
//
// Effect vocabulary — every upgrade, achievement, relic and buff speaks it:
//
//   clickFlat        +n to base tap value          (summed)
//   clickMult        ×n tap value                  (multiplied)
//   zpsMult          ×n idle income                (multiplied)
//   globalMult       ×n to both tap and idle       (multiplied)
//   buildingMult     ×n one generator line         (multiplied, keyed by id)
//   allBuildingMult  ×n every generator line       (multiplied)
//   critChance       +n crit probability           (summed, capped)
//   critDamage       +n crit multiplier            (summed on top of 2×)
//   comboCap         +n max combo points           (summed)
//   comboStep        +n power per combo point      (summed)
//   zpsShare         taps also grant n × ZPS       (summed)
//   goldenChance     ×(1+n) golden spawn rate      (summed)
//   goldenDuration   ×(1+n) golden buff length     (summed)
//   offlineRate      +n offline income rate        (summed)
//   offlineCapHours  +n hours of offline credit    (summed)
//   costDiscount     ×(1-n) generator prices       (summed, capped)

import * as B from '../balance.js';
import { BUILDINGS } from '../data/buildings.js';
import { CLICK_UPGRADES_BY_ID } from '../data/clickUpgrades.js';
import { TIER_UPGRADES_BY_ID } from '../data/tierUpgrades.js';
import { ACHIEVEMENTS_BY_ID } from '../data/achievements.js';
import { metaEffects } from './meta.js';

function emptyAccumulator() {
  return {
    clickFlat: 0,
    clickMult: 1,
    zpsMult: 1,
    globalMult: 1,
    buildingMult: {},
    allBuildingMult: 1,
    critChance: 0.02, // everyone starts with a small chance — crits must exist to be chased
    critDamage: 0,
    comboCap: 0,
    comboStep: 0,
    zpsShare: 0,
    goldenChance: 0,
    goldenDuration: 0,
    offlineRate: 0,
    offlineCapHours: 0,
    costDiscount: 0,
  };
}

function applyEffect(acc, effect) {
  if (!effect) return;
  switch (effect.type) {
    case 'clickFlat': acc.clickFlat += effect.value; break;
    case 'clickMult': acc.clickMult *= effect.value; break;
    case 'zpsMult': acc.zpsMult *= effect.value; break;
    case 'globalMult': acc.globalMult *= effect.value; break;
    case 'allBuildingMult': acc.allBuildingMult *= effect.value; break;
    case 'buildingMult':
      acc.buildingMult[effect.id] = (acc.buildingMult[effect.id] || 1) * effect.value;
      break;
    case 'critChance': acc.critChance += effect.value; break;
    case 'critDamage': acc.critDamage += effect.value; break;
    case 'comboCap': acc.comboCap += effect.value; break;
    case 'comboStep': acc.comboStep += effect.value; break;
    case 'zpsShare': acc.zpsShare += effect.value; break;
    case 'goldenChance': acc.goldenChance += effect.value; break;
    case 'goldenDuration': acc.goldenDuration += effect.value; break;
    case 'offlineRate': acc.offlineRate += effect.value; break;
    case 'offlineCapHours': acc.offlineCapHours += effect.value; break;
    case 'costDiscount': acc.costDiscount += effect.value; break;
    default:
      // Unknown effect types are ignored rather than thrown, so a save from a
      // newer build degrades gracefully instead of hard-failing at boot.
      break;
  }
}

/**
 * Recompute everything derived from owned content. Called once per frame —
 * it walks a few hundred entries, which is nothing, and keeps every consumer
 * reading from a single consistent snapshot.
 */
export function recomputeDerived(state, { comboPoints = 0, now = Date.now() } = {}) {
  const acc = emptyAccumulator();

  for (const id of Object.keys(state.clickUpgrades)) {
    CLICK_UPGRADES_BY_ID[id]?.effects.forEach((e) => applyEffect(acc, e));
  }
  for (const id of Object.keys(state.tierUpgrades)) {
    TIER_UPGRADES_BY_ID[id]?.effects.forEach((e) => applyEffect(acc, e));
  }
  for (const id of Object.keys(state.achievements)) {
    applyEffect(acc, ACHIEVEMENTS_BY_ID[id]?.reward);
  }

  // Gear, talents, relics, constellations and party companions all speak the
  // same effect vocabulary; metaEffects() gathers them so a new relic is wired
  // in by existing in its table rather than by being remembered here.
  for (const effect of metaEffects(state)) applyEffect(acc, effect);

  // Prestige currency is a permanent global boost, measured on LIFETIME yuzu
  // rather than yuzu in hand. Paying the bonus on held currency would mean
  // buying a relic makes you weaker, which turns the relic shop into a trap.
  const yuzuMult = B.yuzuBonus(state.lifetimeYuzu) * B.yuzuBonus(state.lifetimeLotus, 0.5);

  // Active buffs (golden capybara frenzies, event bonuses) stack on last.
  let buffMult = 1;
  for (const buff of state.buffs) {
    if (buff.until <= now) continue;
    buff.effects?.forEach((e) => {
      if (e.type === 'buffMult') buffMult *= e.value;
      else applyEffect(acc, e);
    });
  }

  const globalMult = acc.globalMult * yuzuMult;

  // --- idle income
  let zps = 0;
  const perBuilding = {};
  for (const b of BUILDINGS) {
    const owned = state.buildings[b.id] || 0;
    if (owned <= 0) {
      perBuilding[b.id] = 0;
      continue;
    }
    const mult = (acc.buildingMult[b.id] || 1) * acc.allBuildingMult;
    const out = B.buildingOutput(b.rate, owned, mult) * acc.zpsMult * globalMult;
    perBuilding[b.id] = out;
    zps += out;
  }
  zps *= buffMult;

  // --- tap income
  const comboCap = B.comboCap(acc.comboCap);
  const comboStep = B.COMBO_STEP + acc.comboStep;
  const cappedCombo = Math.min(comboPoints, comboCap);
  const comboMult = B.comboMultiplier(cappedCombo, comboStep);

  const clickValue = B.clickPower({
    base: 1,
    flat: acc.clickFlat,
    mult: acc.clickMult * globalMult,
    comboMult,
    buffMult,
    zps,
    zpsShare: acc.zpsShare,
  });

  return {
    zps,
    perBuilding,
    clickValue,
    clickValueNoCombo: B.clickPower({
      base: 1,
      flat: acc.clickFlat,
      mult: acc.clickMult * globalMult,
      comboMult: 1,
      buffMult,
      zps,
      zpsShare: acc.zpsShare,
    }),
    critChance: B.critChance(acc.critChance),
    critMult: B.critMultiplier(acc.critDamage),
    comboCap,
    comboStep,
    comboMult,
    cappedCombo,
    globalMult,
    yuzuMult,
    buffMult,
    zpsShare: acc.zpsShare,
    goldenChanceMult: 1 + acc.goldenChance,
    goldenDurationMult: 1 + acc.goldenDuration,
    offlineRate: Math.min(1, B.OFFLINE_RATE + acc.offlineRate),
    offlineCapMs: B.OFFLINE_CAP_MS + acc.offlineCapHours * 3600e3,
    costDiscount: 1 - B.clamp(acc.costDiscount, 0, 0.75),
  };
}
