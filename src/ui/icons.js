// Sprites as DOM images.
//
// The shop shows a pixel icon on every row. Baking each one to a data URL once
// and reusing it means the browser treats them as ordinary images — no canvas
// per row, no redraw when the list re-renders.

import { bake, bakeLayered } from '../render/canvas.js';
import { ICONS, YUZU, GOLDEN_CAPY, SPARKLE, CAPY, EYES, EYE_OVERLAY_ORIGIN, familyShape } from '../render/sprites.js';
import { BUILDING_ART, PROP_PALETTE, CAPY_SKINS } from '../render/palettes.js';
import { BUILDINGS_BY_ID } from '../data/buildings.js';
import { wornKey, wornLayers } from '../render/wearables.js';

const urlCache = new Map();

export function spriteDataUrl(spr, palette, key) {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const url = bake(spr, palette, key).toDataURL();
  urlCache.set(key, url);
  return url;
}

/**
 * The capybara wearing a specific set of things, as an <img> source.
 *
 * Used by the wardrobe and by every card in the Looks shelf, so a hat can be
 * seen before it is bought. Fifty-two wearables is far too many to sell on a
 * name and a one-line blurb.
 *
 * Both the scene and this go through bakeLayered with the same key shape, so a
 * look already on screen costs nothing to preview.
 */
export function capyLookUrl({ skin = 'classic', hat, outfit, accessory } = {}) {
  const worn = { hat, outfit, accessory };
  const palette = CAPY_SKINS[skin] || CAPY_SKINS.classic;
  const layers = [{ sprite: EYES.open, origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(worn)];
  const key = `capy:${skin}:open:${wornKey(worn)}`;

  const hit = urlCache.get(key);
  if (hit) return hit;
  const url = bakeLayered(CAPY, layers, palette, key).toDataURL();
  urlCache.set(key, url);
  return url;
}

/**
 * The shop row's icon, at the stage that line has reached.
 *
 * The stage is passed in rather than read from a global, because this is called
 * from the shop's in-place update: the row re-renders on every purchase, and it
 * has the state to hand. The cache key carries the stage, so the three drawings
 * of one generator are three cached URLs rather than one that goes stale the
 * moment an upgrade lands.
 */
export function buildingIconUrl(buildingId, stage = 0) {
  const art = BUILDING_ART[buildingId];
  const shape = familyShape(BUILDINGS_BY_ID[buildingId]?.family, stage);
  if (!art || !shape) return '';
  return spriteDataUrl(ICONS[shape], art.palette, `building:${buildingId}:${stage}`);
}

export function yuzuIconUrl() {
  return spriteDataUrl(YUZU, PROP_PALETTE, 'icon:yuzu');
}

export function goldenIconUrl() {
  return spriteDataUrl(GOLDEN_CAPY, CAPY_SKINS.golden, 'icon:golden');
}

export function sparkleIconUrl() {
  return spriteDataUrl(SPARKLE, PROP_PALETTE, 'icon:sparkle');
}

/** An <img> wired for crisp upscaling. */
export function iconImg(url, alt = '', className = 'pixel-icon') {
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  if (!alt) img.setAttribute('aria-hidden', 'true');
  img.className = className;
  img.decoding = 'async';
  return img;
}

/**
 * Upgrade icons reuse the generator art for tier upgrades, and a themed shape
 * for tap upgrades, so the shop reads at a glance without new sprites.
 */
export function upgradeIconUrl(upgrade) {
  if (upgrade.kind === 'tier' && upgrade.buildingId) {
    return buildingIconUrl(upgrade.buildingId);
  }
  return spriteDataUrl(ICONS.orb, CLICK_UPGRADE_PALETTE, 'icon:clickUpgrade');
}

const CLICK_UPGRADE_PALETTE = {
  '.': null,
  o: '#2c1e2f',
  1: '#7a5334',
  2: '#a67243',
  3: '#c99560',
  4: '#f0a63d',
};
