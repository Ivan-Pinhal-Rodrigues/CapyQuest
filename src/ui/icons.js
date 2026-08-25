// Sprites as DOM images.
//
// The shop shows a pixel icon on every row. Baking each one to a data URL once
// and reusing it means the browser treats them as ordinary images — no canvas
// per row, no redraw when the list re-renders.

import { bake } from '../render/canvas.js';
import { ICONS, YUZU, GOLDEN_CAPY, SPARKLE } from '../render/sprites.js';
import { BUILDING_ART, PROP_PALETTE, CAPY_SKINS } from '../render/palettes.js';

const urlCache = new Map();

export function spriteDataUrl(spr, palette, key) {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const url = bake(spr, palette, key).toDataURL();
  urlCache.set(key, url);
  return url;
}

export function buildingIconUrl(buildingId) {
  const art = BUILDING_ART[buildingId];
  if (!art) return '';
  return spriteDataUrl(ICONS[art.shape], art.palette, `building:${buildingId}`);
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
