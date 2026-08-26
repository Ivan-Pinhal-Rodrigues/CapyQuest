// The admin panel — editing content without editing code.
//
// There is no backend, so "admin" cannot mean an account with a role. It means
// whoever can open this panel and, crucially, whoever can commit
// `content/pack.json`. The panel is not a security boundary and does not
// pretend to be one: it edits a *catalogue*, never a save, and it cannot grant
// a single leaf. Anyone who finds the URL parameter sees a shop editor whose
// changes stop at their own browser until someone with commit access ships
// them.
//
// The workflow it is built around:
//
//   1. open with ?admin=1
//   2. change prices, hide things, add a look, schedule an event
//   3. watch the change in the running game immediately — it is applied live
//   4. press Export, commit the JSON, and everybody has it
//
// Step 3 is the reason this exists at all rather than a README telling people
// to hand-edit JSON. A shop change you cannot see is a shop change you get
// wrong.

import { closeModal, el, openModal } from './modal.js';
import {
  applyPack, currentPack, liveBoosts, liveCosmeticKinds, liveCosmetics,
  liveEventDefs, liveLeafPacks, packWarnings, passOverrides,
} from '../content/registry.js';
import { clearDraft, mergePacks, PACK_README, readDraft, writeDraft } from '../content/load.js';
import { SOURCES } from '../data/cosmetics.js';

/** ?admin=1 — deliberately not a secret, because it is not a permission. */
export function adminRequested(search = globalThis.location?.search || '') {
  return new URLSearchParams(search).has('admin');
}

const SECTIONS = [
  ['cosmetics', 'Looks'],
  ['boosts', 'Boosts'],
  ['leafPacks', 'Leafs'],
  ['events', 'Events'],
  ['pass', 'Pass'],
];

/**
 * Open the panel.
 *
 * `onApply` is called after every change with no arguments; the game uses it to
 * rebuild the panels that cache their rows, so an edit is visible at once.
 */
export function openAdminPanel({ onApply } = {}) {
  let draft = readDraft() || {};
  let section = 'cosmetics';

  const body = el('div', 'admin');
  const header = el('div', 'admin__header');
  const status = el('p', 'admin__status');
  const warnBox = el('p', 'admin__warnings');
  header.append(status, warnBox);

  const tabs = el('div', 'admin__tabs');
  const tabBtns = new Map();
  for (const [id, label] of SECTIONS) {
    const btn = button('admin__tab', label, () => {
      section = id;
      render();
    });
    tabs.appendChild(btn);
    tabBtns.set(id, btn);
  }

  const list = el('div', 'admin__list');
  const note = el('p', 'admin__note');
  note.textContent =
    'Changes are live for you only. Nobody else sees them until content/pack.json is exported and committed.';

  body.append(header, tabs, list, note);

  /** Push the draft into the registry and repaint everything. */
  function apply() {
    writeDraft(draft);
    // The committed file was merged in at boot; re-applying just the draft
    // would silently drop it, so the two are merged the same way load.js does.
    applyPack(mergePacks(bootPack, draft));
    onApply?.();
    render();
  }

  // What the game booted with, minus whatever draft was already applied — so
  // the panel's edits stack on the committed file rather than replacing it.
  const bootPack = subtractDraft(currentPack(), readDraft());

  function render() {
    for (const [id, btn] of tabBtns) btn.classList.toggle('is-active', id === section);

    const edits = countEdits(draft);
    status.textContent = edits
      ? `${edits} unexported ${edits === 1 ? 'change' : 'changes'} in your local draft.`
      : 'No local changes — you are seeing what everybody sees.';

    const warnings = packWarnings();
    warnBox.hidden = !warnings.length;
    warnBox.textContent = warnings.length
      ? `${warnings.length} entr${warnings.length === 1 ? 'y was' : 'ies were'} dropped: ${warnings.join('; ')}`
      : '';

    list.textContent = '';
    if (section === 'pass') renderPass(list);
    else renderCatalogue(list, section);
  }

  // ------------------------------------------------------------- catalogues

  function renderCatalogue(root, name) {
    const rows = {
      cosmetics: () => liveCosmetics().map((c) => ({
        key: `${c.kind}:${c.id}`,
        title: `${c.name}`,
        meta: `${c.kind} · ${SOURCES[c.source] || c.source}${c.cost ? ` · ${c.cost} 🍃` : ''}`,
        priced: c.source === 'store',
        cost: c.cost,
        hidden: !!c.hidden,
      })),
      boosts: () => liveBoosts().map((b) => ({
        key: b.id,
        title: `${b.icon || ''} ${b.name}`.trim(),
        meta: `${b.cost} 🍃 · ${b.hours >= 1 ? `${b.hours}h` : `${b.hours * 60}m`}`,
        priced: true,
        cost: b.cost,
        hidden: !!b.hidden,
      })),
      leafPacks: () => liveLeafPacks().map((p) => ({
        key: p.id,
        title: p.name,
        meta: `${p.leafs} 🍃 · ${p.price}`,
        priced: false,
        hidden: !!p.hidden,
      })),
      events: () => liveEventDefs().map((e) => ({
        key: e.id,
        title: `${e.icon || ''} ${e.name}`.trim(),
        meta: describeSchedule(e),
        priced: false,
        hidden: !e.live,
        event: e,
      })),
    }[name]();

    // A hidden entry is filtered out of the live shelves, so it would vanish
    // from its own editor the moment it was hidden. The draft is the only place
    // that still knows about it — read them back in so they can be un-hidden.
    for (const key of hiddenKeys(draft, name)) {
      if (rows.some((r) => r.key === key)) continue;
      rows.push({ key, title: key, meta: 'hidden', priced: false, hidden: true });
    }

    for (const row of rows) {
      const card = el('div', `admin-row${row.hidden ? ' is-hidden' : ''}`);
      const main = el('div', 'admin-row__main');
      main.append(el('strong', 'admin-row__name', row.title), el('span', 'admin-row__meta', row.meta));

      const controls = el('div', 'admin-row__controls');

      if (row.priced) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.className = 'admin-row__cost';
        input.value = String(row.cost ?? 0);
        input.setAttribute('aria-label', `Cost of ${row.title}`);
        input.addEventListener('change', () => {
          const cost = Number(input.value);
          if (!Number.isFinite(cost) || cost < 0) return;
          patch(name, row.key, { cost });
        });
        controls.appendChild(input);
      }

      const label = name === 'events'
        ? (row.hidden ? 'Run it' : 'Stop it')
        : (row.hidden ? 'Show' : 'Hide');
      controls.appendChild(button('btn btn--small', label, () => {
        if (name === 'events') patch(name, row.key, { live: !!row.hidden });
        else patch(name, row.key, { hidden: !row.hidden });
      }));

      if (name === 'events') {
        controls.appendChild(button('btn btn--small', 'Dates…', () => scheduleDialog(row.event)));
      }

      card.append(main, controls);
      root.appendChild(card);
    }
  }

  function renderPass(root) {
    const overrides = passOverrides();
    root.appendChild(el(
      'p',
      'admin__lead',
      'Pass levels are generated from the level number. An override replaces one level on one track; everything else keeps its generated reward.',
    ));

    for (const track of ['free', 'premium']) {
      root.appendChild(el('h3', 'admin__subhead', track === 'free' ? 'Free track' : 'Premium track'));
      const levels = Object.keys(overrides[track] || {}).map(Number).sort((a, b) => a - b);
      if (!levels.length) root.appendChild(el('p', 'admin__meta', 'No overrides.'));
      for (const level of levels) {
        const row = el('div', 'admin-row');
        row.append(
          el('div', 'admin-row__main', `Level ${level} — ${overrides[track][level].text || ''}`),
          button('btn btn--small', 'Clear', () => {
            delete draft.pass?.[track]?.[level];
            apply();
          }),
        );
        root.appendChild(row);
      }
      root.appendChild(button('btn btn--small', 'Add an override…', () => passDialog(track)));
    }
  }

  // ---------------------------------------------------------------- editing

  function patch(name, key, fields) {
    draft[name] = draft[name] || {};
    draft[name].patch = draft[name].patch || {};
    draft[name].patch[key] = { ...(draft[name].patch[key] || {}), ...fields };
    apply();
  }

  function scheduleDialog(event) {
    if (!event) return;
    const form = el('div', 'admin-form');
    form.appendChild(el(
      'p',
      'admin__lead',
      'Leave both empty to put this event back in the season rotation. Filled in, it runs on the clock between exactly these two moments.',
    ));
    const start = dateField(form, 'Starts', event.startsAt);
    const end = dateField(form, 'Ends', event.endsAt);

    openModal({
      title: `${event.name} — dates`,
      bodyNode: form,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          variant: 'primary',
          onClick: () => {
            const fields = start.value && end.value
              ? { live: true, startsAt: new Date(start.value).toISOString(), endsAt: new Date(end.value).toISOString() }
              : { startsAt: undefined, endsAt: undefined };
            // `undefined` cannot survive JSON, so clearing a schedule has to
            // drop the keys rather than blank them.
            if (fields.startsAt === undefined) {
              const held = draft.events?.patch?.[event.id];
              if (held) {
                delete held.startsAt;
                delete held.endsAt;
              }
              apply();
            } else {
              patch('events', event.id, fields);
            }
            reopen();
          },
        },
      ],
    });
  }

  function passDialog(track) {
    const form = el('div', 'admin-form');
    const level = numberField(form, 'Level', 50);
    const leafs = numberField(form, 'Leafs', 200);
    const text = textField(form, 'Shown as', '200 leafs');

    openModal({
      title: `Override a ${track} level`,
      bodyNode: form,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          variant: 'primary',
          onClick: () => {
            const lvl = Number(level.value);
            const amount = Number(leafs.value);
            if (!Number.isInteger(lvl) || lvl < 1 || !(amount > 0)) return;
            draft.pass = draft.pass || {};
            draft.pass[track] = draft.pass[track] || {};
            draft.pass[track][lvl] = { leafs: amount, text: text.value || `${amount} leafs` };
            apply();
            reopen();
          },
        },
      ],
    });
  }

  // ----------------------------------------------------------------- export

  function exportPack() {
    // The readme goes back on the front. Without it, the first admin to export
    // and commit would quietly strip the file's own instructions out, and the
    // next person to open it would find bare JSON with nothing explaining it.
    const merged = { _readme: PACK_README, ...mergePacks(bootPack, draft) };
    const json = `${JSON.stringify(merged, null, 2)}\n`;
    const form = el('div', 'admin-form');
    form.appendChild(el(
      'p',
      'admin__lead',
      'This is the whole of content/pack.json. Copy it over the file in the repo and commit it — that is the moment it reaches other players.',
    ));
    const area = document.createElement('textarea');
    area.className = 'admin__export';
    area.rows = 18;
    area.spellcheck = false;
    area.value = json;
    form.appendChild(area);

    openModal({
      title: 'content/pack.json',
      wide: true,
      bodyNode: form,
      actions: [
        { label: 'Close' },
        {
          label: 'Copy',
          variant: 'primary',
          onClick: () => {
            area.select();
            navigator.clipboard?.writeText(json).catch(() => {
              /* selection is already there to copy by hand */
            });
            return true; // stay open so the copy can be verified
          },
        },
      ],
    });
  }

  function reopen() {
    closeModal();
    openAdminPanel({ onApply });
  }

  render();

  openModal({
    title: 'Content — admin',
    wide: true,
    bodyNode: body,
    actions: [
      { label: 'Done' },
      {
        label: 'Discard my draft',
        onClick: () => {
          draft = {};
          clearDraft();
          applyPack(bootPack);
          onApply?.();
          render();
          return true;
        },
      },
      { label: 'Export…', variant: 'primary', onClick: () => { exportPack(); return true; } },
    ],
  });
}

// ------------------------------------------------------------------ plumbing

/**
 * The committed pack, with the local draft's contribution taken back out.
 *
 * `currentPack()` returns what is applied, which at boot is file+draft merged.
 * The panel needs the file half on its own so that discarding a draft goes back
 * to what everybody else sees rather than to the bare defaults.
 */
function subtractDraft(applied, draft) {
  if (!draft) return applied;
  const out = {};
  for (const [section, value] of Object.entries(applied)) {
    if (!(section in draft)) {
      out[section] = value;
      continue;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    const kept = {};
    for (const [key, inner] of Object.entries(value)) {
      if (draft[section] && key in draft[section]) continue;
      kept[key] = inner;
    }
    if (Object.keys(kept).length) out[section] = kept;
  }
  return out;
}

function countEdits(draft) {
  let n = 0;
  for (const value of Object.values(draft || {})) {
    if (typeof value !== 'object' || value === null) continue;
    for (const inner of Object.values(value)) {
      n += Array.isArray(inner) ? inner.length : Object.keys(inner || {}).length;
    }
  }
  return n;
}

function hiddenKeys(draft, name) {
  const patch = draft?.[name]?.patch || {};
  return Object.entries(patch)
    .filter(([, fields]) => fields.hidden === true || fields.live === false)
    .map(([key]) => key);
}

function describeSchedule(event) {
  if (!event.live) return 'not running';
  if (event.startsAt == null) return 'season rotation';
  return `${shortDate(event.startsAt)} → ${shortDate(event.endsAt)}`;
}

function shortDate(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

function field(form, label, input) {
  const wrap = el('label', 'admin-field');
  wrap.append(el('span', 'admin-field__label', label), input);
  form.appendChild(wrap);
  return input;
}

function dateField(form, label, value) {
  const input = document.createElement('input');
  input.type = 'datetime-local';
  input.className = 'admin-field__input';
  // datetime-local wants local wall-clock text; the pack stores UTC.
  if (value != null) input.value = new Date(value).toISOString().slice(0, 16);
  return field(form, label, input);
}

function numberField(form, label, value) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'admin-field__input';
  input.value = String(value);
  return field(form, label, input);
}

function textField(form, label, value) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'admin-field__input';
  input.value = value;
  return field(form, label, input);
}

function button(className, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
