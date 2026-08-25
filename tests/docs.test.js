// The documentation, checked against the code it describes.
//
// Four rows of the beat table in docs/STORY.md were wrong on the first draft —
// written from memory rather than from the data, and entirely plausible-looking.
// A document nothing verifies is a document that is quietly wrong, so the tables
// that can be checked mechanically are.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ACTS, BEATS, BEATS_BY_ID } from '../src/data/story.js';
import { NPCS, NPCS_BY_ID } from '../src/data/npcs.js';
import { CASES } from '../src/data/cases.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (name) => readFileSync(root + name, 'utf8');

test('every beat row in STORY.md names the speaker the data names', () => {
  const doc = read('docs/STORY.md');
  let checked = 0;
  for (const [, id, who] of doc.matchAll(/^\| `(\w+)` \| ([^|]+?) \|/gm)) {
    const def = BEATS_BY_ID[id];
    assert.ok(def, `docs/STORY.md documents a beat "${id}" that does not exist`);
    assert.equal(NPCS_BY_ID[def.npc]?.name, who.trim(), `${id} is attributed to the wrong capybara`);
    checked++;
  }
  assert.equal(checked, BEATS.length, `documented ${checked} beats of ${BEATS.length}`);
});

test('STORY.md documents every act and every NPC', () => {
  const doc = read('docs/STORY.md');
  for (const act of ACTS) assert.ok(doc.includes(act.name), `act "${act.name}" is undocumented`);
  for (const npc of NPCS) assert.ok(doc.includes(npc.name), `${npc.name} is undocumented`);
});

test('BALANCE.md quotes the case table the data holds', () => {
  const doc = read('docs/BALANCE.md');
  for (const c of CASES) {
    // The doc calls them "Reed" where the data calls them "Reed Case"; match on
    // the distinguishing word rather than forcing the prose to repeat itself.
    const label = (c.name || c.id).split(' ')[0];
    const row = new RegExp(`\\|\\s*${label}[^|]*\\|\\s*${c.cost}\\s*🍃\\s*\\|\\s*${c.floor}\\s*\\|\\s*${c.pity}\\s*\\|`, 'i');
    assert.ok(row.test(doc), `${c.id} is documented wrong — data says cost ${c.cost}, floor ${c.floor}, pity ${c.pity}`);
  }
});

test('BALANCE.md quotes the achievement count the table holds', () => {
  const doc = read('docs/BALANCE.md');
  assert.ok(doc.includes(`${ACHIEVEMENTS.length} entries`), `doc does not say "${ACHIEVEMENTS.length} entries"`);
});

test('the README claims the number of achievements that exist', () => {
  const readme = read('README.md');
  assert.ok(
    readme.includes(`| Achievements | ${ACHIEVEMENTS.length}`),
    `README does not claim ${ACHIEVEMENTS.length} achievements`,
  );
});

test('every doc the README points at is actually there', () => {
  const readme = read('README.md');
  for (const [, path] of readme.matchAll(/`(docs\/[A-Z]+\.md)`/g)) {
    assert.doesNotThrow(() => read(path), `README points at ${path}, which does not exist`);
  }
});
