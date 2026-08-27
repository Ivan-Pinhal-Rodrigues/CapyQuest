// The opening: six frames, and a skip button on every one of them.
//
// Each frame is a gradient sky, a ground line and one pixel sprite — composed
// from the sprites and palettes the game already has, so the whole opening adds
// no assets. That is not only a size argument: it means the capybara you meet in
// frame one is drawn by exactly the code that draws the one you tap in frame
// seven.
//
// Skip is the first thing on screen, not the last. Someone reopening the game
// on a new device should not have to sit through this to get to their save.

import { CAPY, ICONS, familyShape } from '../render/sprites.js';
import { CAPY_SKINS, PROP_PALETTE, BUILDING_ART } from '../render/palettes.js';
import { SHAPES } from '../render/shapes.js';
import { ENEMIES } from '../data/enemies.js';
import { BUILDINGS_BY_ID } from '../data/buildings.js';
import { spriteDataUrl } from './icons.js';

/**
 * Six frames. `art` names what to draw; `sky` is the backdrop, top to bottom.
 * Text is two short lines at most — a wall of prose on frame one is how you
 * teach someone to press skip.
 */
export const FRAMES = [
  {
    id: 'pond',
    sky: ['#1b1428', '#2d2038'],
    ground: '#241a2e',
    art: { kind: 'capy', skin: 'classic' },
    lines: [
      'There has always been a pond, and there has always been someone in it.',
      'The water comes down from somewhere upstream. Nobody has ever asked where.',
    ],
  },
  {
    id: 'cold',
    sky: ['#101a2a', '#1a2a3d'],
    ground: '#152232',
    art: { kind: 'capy', skin: 'frost' },
    lines: [
      'Last night it went cold.',
      'Not evening cold. Cold like something upstream stopped.',
    ],
  },
  {
    id: 'elder',
    sky: ['#221a2c', '#33283f'],
    ground: '#2a2035',
    art: { kind: 'capy', skin: 'npcElder' },
    lines: [
      '"It has never done this," says Yuzu-baa, who has been here longer than the pond.',
      '"So either the water changed its mind, or something changed it for the water."',
    ],
  },
  {
    id: 'downstream',
    sky: ['#182618', '#22381f'],
    ground: '#1b2b1a',
    art: { kind: 'enemy', id: 'snapper' },
    lines: [
      'Downstream, the things that live in the reeds have started biting.',
      'They never used to bite.',
    ],
  },
  {
    id: 'onsen',
    sky: ['#2b1f18', '#3d2b1f'],
    ground: '#33241a',
    art: { kind: 'building', id: 'onsenBasin' },
    lines: [
      'You can hold the heat, if you build for it. Lilypads. Stones. A proper bath.',
      'Enough small warm things and the cold has somewhere it cannot get to.',
    ],
  },
  {
    id: 'stillPoint',
    sky: ['#0d1a1d', '#123037'],
    ground: '#0f2126',
    art: { kind: 'capy', skin: 'npcQuiet' },
    lines: [
      'And at the very bottom, where the stream should start, there is a place where nothing moves.',
      'That is a long way down. Best get warm first.',
    ],
  },
];

function artUrl(art) {
  if (art.kind === 'capy') {
    return spriteDataUrl(CAPY, CAPY_SKINS[art.skin] || CAPY_SKINS.classic, `cut:capy:${art.skin}`);
  }
  if (art.kind === 'enemy') {
    const def = ENEMIES[art.id];
    return spriteDataUrl(SHAPES[def.shape], def.palette, `cut:enemy:${art.id}`);
  }
  // The opening always shows things as they start out — stage one, before the
  // player has upgraded anything. It is the first thing they see.
  const build = BUILDING_ART[art.id];
  const shape = familyShape(BUILDINGS_BY_ID[art.id]?.family, 0);
  return spriteDataUrl(ICONS[shape], build.palette, `cut:build:${art.id}`);
}

/**
 * Run the opening. Resolves when it finishes or is skipped — the caller does not
 * need to know which, because either way the player has decided they are done.
 */
let running = false;

/**
 * Whether the opening is on screen. The game asks before it queues anything of
 * its own — a login reward stacking on top of frame one is how a first-run
 * player learns the game will interrupt them.
 */
export function cutsceneOpen() {
  return running;
}

export function playCutscene({ onDone } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'cutscene';

  const frame = document.createElement('div');
  frame.className = 'cutscene__frame';

  const art = document.createElement('img');
  art.className = 'cutscene__art pixel-icon';
  art.alt = '';

  const ground = document.createElement('div');
  ground.className = 'cutscene__ground';

  const box = document.createElement('div');
  box.className = 'cutscene__box';
  const text = document.createElement('p');
  text.className = 'cutscene__text';
  box.appendChild(text);

  const dots = document.createElement('div');
  dots.className = 'cutscene__dots';
  const dotNodes = FRAMES.map(() => {
    const dot = document.createElement('span');
    dot.className = 'cutscene__dot';
    dots.appendChild(dot);
    return dot;
  });

  // First in the DOM as well as first in the tab order.
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'cutscene__skip';
  skip.textContent = 'Skip';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn--gold cutscene__next';

  frame.append(art, ground);
  backdrop.append(skip, frame, box, dots, next);
  document.body.appendChild(backdrop);
  running = true;

  let index = 0;
  let done = false;

  const paint = () => {
    const f = FRAMES[index];
    frame.style.background = `linear-gradient(180deg, ${f.sky[0]}, ${f.sky[1]})`;
    ground.style.background = f.ground;
    art.src = artUrl(f.art);
    art.classList.remove('is-in');
    void art.offsetWidth; // restart the entrance
    art.classList.add('is-in');
    text.textContent = f.lines.join('\n');
    next.textContent = index === FRAMES.length - 1 ? 'Into the water' : 'Next';
    dotNodes.forEach((d, i) => d.classList.toggle('is-on', i === index));
  };

  const finish = () => {
    if (done) return;
    done = true;
    running = false;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    onDone?.();
  };

  const advance = () => {
    if (index < FRAMES.length - 1) {
      index++;
      paint();
      return;
    }
    finish();
  };

  function onKey(e) {
    if (e.key === 'Escape') finish();
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      advance();
    }
  }

  skip.addEventListener('click', finish);
  next.addEventListener('click', advance);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target === frame || e.target === box) advance();
  });
  document.addEventListener('keydown', onKey);

  paint();
  skip.focus();
  return { finish };
}
