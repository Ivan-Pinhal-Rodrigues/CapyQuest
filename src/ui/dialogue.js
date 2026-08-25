// The speech bar.
//
// A beat is a bar across the bottom of the scene, not a modal. That is the
// whole design decision: an idle game that stops you to talk is an idle game
// you close. You can keep tapping, the fight keeps running, and the bar goes
// away on its own if you never touch it.
//
// It advances on a tap and closes on the last line. Escape dismisses the whole
// beat, and it is still marked seen — a story you have to sit through twice
// because you skipped it once is worse than one you missed.

import { CAPY } from '../render/sprites.js';
import { CAPY_SKINS } from '../render/palettes.js';
import { spriteDataUrl } from './icons.js';

/** How long a line sits there before moving on by itself. */
const LINE_MS = 6500;

export class Dialogue {
  constructor(root, { onDone } = {}) {
    this.root = root;
    this.onDone = onDone;
    this.beat = null;
    this.line = 0;
    this.timer = 0;
    this.build();
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'dialogue';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');

    this.portrait = document.createElement('img');
    this.portrait.className = 'dialogue__portrait pixel-icon';
    this.portrait.alt = '';

    const body = document.createElement('div');
    body.className = 'dialogue__body';
    this.name = document.createElement('strong');
    this.name.className = 'dialogue__name';
    this.text = document.createElement('p');
    this.text.className = 'dialogue__text';
    body.append(this.name, this.text);

    this.more = document.createElement('span');
    this.more.className = 'dialogue__more';
    this.more.textContent = '▾';

    this.close = document.createElement('button');
    this.close.type = 'button';
    this.close.className = 'dialogue__close';
    this.close.setAttribute('aria-label', 'Skip this');
    this.close.textContent = '✕';
    this.close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });

    this.el.append(this.portrait, body, this.more, this.close);
    this.el.addEventListener('click', () => this.advance());
    this.root.appendChild(this.el);
  }

  get open() {
    return !this.el.hidden;
  }

  /** Start a beat. Returns false if one is already running. */
  show(beat) {
    if (this.open || !beat?.lines?.length) return false;
    this.beat = beat;
    this.line = 0;
    this.el.hidden = false;
    this.el.classList.add('is-in');
    this.el.style.setProperty('--who', beat.speaker?.color || 'var(--text)');
    this.portrait.src = spriteDataUrl(
      CAPY,
      CAPY_SKINS[beat.speaker?.skin] || CAPY_SKINS.classic,
      `npc:${beat.speaker?.skin || 'classic'}`,
    );
    this.name.textContent = beat.speaker?.name || '';
    this.paint();
    return true;
  }

  paint() {
    this.text.textContent = this.beat.lines[this.line];
    const last = this.line >= this.beat.lines.length - 1;
    this.more.textContent = last ? '✓' : '▾';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.advance(), LINE_MS);
  }

  advance() {
    if (!this.open) return;
    if (this.line < this.beat.lines.length - 1) {
      this.line++;
      this.paint();
      return;
    }
    this.finish();
  }

  /** Close and report. The beat counts as seen either way. */
  finish() {
    if (!this.open) return;
    clearTimeout(this.timer);
    const done = this.beat;
    this.beat = null;
    this.el.classList.remove('is-in');
    this.el.hidden = true;
    this.onDone?.(done);
  }
}
