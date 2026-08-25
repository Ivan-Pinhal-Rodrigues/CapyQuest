// The profile card, and the story log under it.
//
// It sits at the top of the You tab rather than in a thirteenth tab. That is
// partly a width argument — twelve tabs already share one panel — and partly
// that "who you are" and "what you have done" are the same screen. The stats
// were already there; this gives them a face.


import { CAPY } from '../render/sprites.js';
import { CAPY_SKINS } from '../render/palettes.js';
import { spriteDataUrl } from './icons.js';
import { profile, avatarChoices, titleChoices, NAME_MAX } from '../systems/profile.js';
import { storyLog, storyProgress } from '../systems/story.js';
import { el } from './modal.js';

export class ProfileCard {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.build();
  }

  build() {
    this.card = document.createElement('div');
    this.card.className = 'profile';

    this.avatar = document.createElement('img');
    this.avatar.className = 'profile__avatar pixel-icon';
    this.avatar.alt = '';

    const body = document.createElement('div');
    body.className = 'profile__body';

    const nameRow = document.createElement('div');
    nameRow.className = 'profile__name-row';
    this.name = document.createElement('strong');
    this.name.className = 'profile__name';
    this.edit = button('profile__edit', '✎', () => this.h.onRename());
    this.edit.setAttribute('aria-label', 'Change your name');
    nameRow.append(this.name, this.edit);

    this.title = document.createElement('span');
    this.title.className = 'profile__title';
    this.sub = document.createElement('span');
    this.sub.className = 'profile__sub';
    body.append(nameRow, this.title, this.sub);

    const actions = document.createElement('div');
    actions.className = 'profile__actions';
    actions.append(
      button('btn btn--small', 'Change look', () => this.h.onPickAvatar()),
      button('btn btn--small', 'Change title', () => this.h.onPickTitle()),
    );

    this.card.append(this.avatar, body, actions);
    this.root.appendChild(this.card);

    // --- story
    const head = document.createElement('div');
    head.className = 'profile__story-head';
    this.storyTitle = document.createElement('h3');
    this.storyTitle.className = 'kit__heading';
    this.storyTitle.textContent = 'The story so far';
    this.storyCount = document.createElement('span');
    this.storyCount.className = 'profile__story-count';
    head.append(this.storyTitle, this.storyCount);
    this.root.appendChild(head);

    this.log = document.createElement('div');
    this.log.className = 'story-log';
    this.root.appendChild(this.log);
    this.logNodes = new Map();
  }

  update(state) {
    const p = profile(state);

    this.avatar.src = spriteDataUrl(CAPY, CAPY_SKINS[p.avatar] || CAPY_SKINS.classic, `profile:${p.avatar}`);
    setText(this.name, p.name);
    setText(this.title, p.title || '');
    this.title.hidden = !p.title;
    setText(
      this.sub,
      `Guest · stage ${p.bestStage} best · ${p.rebirths} rebirth${p.rebirths === 1 ? '' : 's'}`,
    );
    this.card.classList.toggle('is-generated', p.generated);

    const prog = storyProgress(state);
    setText(this.storyCount, `${prog.seen} of ${prog.total}`);
    this.renderLog(state);
  }

  renderLog(state) {
    for (const act of storyLog(state)) {
      let ref = this.logNodes.get(act.id);
      if (!ref) {
        const wrap = document.createElement('div');
        wrap.className = 'story-act';
        const name = document.createElement('strong');
        name.className = 'story-act__name';
        name.textContent = `${act.name}`;
        const blurb = document.createElement('p');
        blurb.className = 'story-act__blurb';
        blurb.textContent = act.blurb;
        const list = document.createElement('div');
        list.className = 'story-act__beats';
        wrap.append(name, blurb, list);
        this.log.appendChild(wrap);
        ref = { wrap, list, beats: new Map() };
        this.logNodes.set(act.id, ref);
      }

      for (const b of act.beats) {
        let node = ref.beats.get(b.id);
        if (!node) {
          node = document.createElement('button');
          node.type = 'button';
          node.className = 'story-beat';
          node.addEventListener('click', () => this.h.onReadBeat(b.id));
          ref.list.appendChild(node);
          ref.beats.set(b.id, node);
        }
        // An unseen beat is a locked slot, not a spoiler.
        node.textContent = b.seen ? b.speaker.name : '· · ·';
        node.classList.toggle('is-seen', b.seen);
        node.disabled = !b.seen;
        node.style.setProperty('--who', b.speaker.color);
        node.title = b.seen ? `${b.speaker.name} — tap to read again` : 'Not yet';
      }
    }
  }
}

/** Re-reading a beat you have already had. */
export function beatBody(beat) {
  const body = el('div', 'beat-read');
  const head = el('div', 'beat-read__head');

  const img = document.createElement('img');
  img.className = 'beat-read__portrait pixel-icon';
  img.alt = '';
  img.src = spriteDataUrl(CAPY, CAPY_SKINS[beat.speaker.skin] || CAPY_SKINS.classic, `npc:${beat.speaker.skin}`);

  const who = el('div', 'beat-read__who');
  const name = el('strong', 'beat-read__name', beat.speaker.name);
  name.style.color = beat.speaker.color;
  who.append(name, el('span', 'beat-read__role', beat.speaker.role));

  head.append(img, who);
  body.appendChild(head);

  for (const line of beat.lines) body.appendChild(el('p', 'beat-read__line', line));
  return body;
}

/** The rename dialog's body. Returns the input so the caller can read it. */
export function renameBody(current) {
  const body = el('div', 'confirm');
  body.appendChild(el('p', 'confirm__lead', 'Whatever you like. It stays on this device — there is no account and nobody else sees it.'));

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'profile__input';
  input.maxLength = NAME_MAX;
  input.value = current;
  input.setAttribute('aria-label', 'Your name');
  body.appendChild(input);

  return { body, input };
}

/** A picker over owned cosmetics of one kind. */
export function lookPickerBody(state, kind, onPick) {
  const choices = kind === 'skin' ? avatarChoices(state) : titleChoices(state);
  const body = el('div', 'picker');

  if (!choices.length) {
    body.appendChild(el('p', 'shop__hint', 'Nothing owned yet. The Store has some.'));
    return body;
  }

  for (const choice of choices) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `picker__row${choice.worn ? ' is-current' : ''}`;

    if (kind === 'skin') {
      const img = document.createElement('img');
      img.className = 'picker__icon pixel-icon';
      img.alt = '';
      img.src = spriteDataUrl(CAPY, CAPY_SKINS[choice.id] || CAPY_SKINS.classic, `profile:${choice.id}`);
      row.appendChild(img);
    }

    const text = el('span', 'picker__text');
    text.appendChild(el('strong', 'picker__name', choice.name));
    text.appendChild(el('span', 'picker__stats', choice.blurb));
    row.appendChild(text);

    row.addEventListener('click', () => onPick(choice.id));
    body.appendChild(row);
  }
  return body;
}

// -------------------------------------------------------------------- helpers

function button(className, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

