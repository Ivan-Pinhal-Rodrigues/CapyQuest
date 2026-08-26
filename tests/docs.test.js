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
import { COSMETICS } from '../src/data/cosmetics.js';

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

test('the postmortem exists and names the bug it is mostly about', () => {
  // A postmortem that quietly drops the most embarrassing finding is a
  // marketing document. This one has to keep naming the generator ladder.
  const doc = read('docs/POSTMORTEM.md');
  assert.ok(doc.includes('skyTerrace'), 'the generator bug is not in the postmortem');
  assert.ok(doc.includes('capySingularity'));
  assert.ok(/balance pass/i.test(doc), 'the postmortem does not say why the balance pass missed it');
});

test('the README does not describe the game as unfinished', () => {
  // Every "coming soon" in this project has been either built or removed. A
  // stale one in the README is a promise nobody is going to keep.
  //
  // Quoted mentions are fine and are excluded: the changelog says the "still
  // being built" banner is *gone*, which is the opposite of a live claim.
  const readme = read('README.md').toLowerCase().replace(/["“”][^"“”]*["“”]/g, '');
  for (const phrase of ['still being built', 'coming soon', 'work in progress', 'v2 in progress']) {
    assert.ok(!readme.includes(phrase), `README still says "${phrase}"`);
  }
});

test('the font stylesheet does not block the first paint', () => {
  // It did, and it cost 12.6 seconds to the load event when the CDN was
  // unreachable — against 19ms to interactive. The game is playable in its
  // fallback fonts; a slow font CDN should cost the typeface, not the page.
  const html = read('index.html');
  // Whole tags, not lines — the real one is wrapped across two. And the
  // <noscript> copy is deliberately blocking: with scripts off the onload
  // swap cannot fire, so a plain stylesheet is the only thing that works.
  const withoutNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  const tags = withoutNoscript.match(/<link\b[^>]*>/g) || [];
  const fontLinks = tags.filter((t) => t.includes('fonts.googleapis.com/css2'));

  assert.equal(fontLinks.length, 1, `expected one font stylesheet, found ${fontLinks.length}`);
  assert.ok(
    fontLinks[0].includes('media="print"'),
    'the font stylesheet is render-blocking again',
  );
});

test('the document has exactly one h1, and it is the game', () => {
  const html = read('index.html');
  const h1s = html.match(/<h1\b/g) || [];
  assert.equal(h1s.length, 1, `found ${h1s.length} h1 elements`);
  assert.ok(/<h1 class="hud__title">CapyQuest<\/h1>/.test(html));
});

test('the README claims the number of looks that exist', () => {
  // Sixty-two looks landed in one commit and the README quoted the count in
  // three places. A number written by hand three times is a number that will be
  // wrong within a phase.
  const looks = COSMETICS.filter((c) => c.id !== 'none').length;
  const readme = read('README.md');
  assert.ok(
    readme.includes(`| Wardrobe | ${looks} looks`),
    `README does not claim ${looks} looks`,
  );

  const forSale = COSMETICS.filter((c) => c.source === 'store').length;
  assert.ok(
    readme.includes(`${forSale} looks for sale`),
    `README does not claim ${forSale} looks for sale`,
  );
});
