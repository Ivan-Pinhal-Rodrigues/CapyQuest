// The arena.
//
// Most of it needs a canvas and is checked in the browser instead. What can be
// asserted here is the one piece of judgement in the file: which of the six
// looks a skill gets, derived from the effect it already declares rather than
// from a hand-written table that would drift the moment a skill was added.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { skillLook } from '../src/render/arena.js';
import { SKILLS, SKILLS_BY_ID } from '../src/data/skills.js';

const LOOKS = new Set(['slash', 'slam', 'bolt', 'multi', 'heal', 'aura']);

test('every active skill gets a look, and it is one that exists', () => {
  for (const skill of SKILLS) {
    if (skill.kind !== 'active') continue;
    const look = skillLook(skill);
    assert.ok(LOOKS.has(look), `${skill.id} resolved to "${look}", which nothing draws`);
  }
});

test('the looks are spread across the roster rather than collapsing to one', () => {
  // A mapping that sends fifteen of eighteen skills to 'slash' is a mapping
  // that has stopped saying anything. Four distinct looks is the bar.
  const used = new Set();
  for (const skill of SKILLS) {
    if (skill.kind === 'active') used.add(skillLook(skill));
  }
  assert.ok(used.size >= 4, `only ${used.size} looks in use: ${[...used].join(', ')}`);
});

test('the look follows the shape of the effect, not the name', () => {
  assert.equal(skillLook(SKILLS_BY_ID.chomp), 'slash', 'a plain strike is a slash');
  assert.equal(skillLook(SKILLS_BY_ID.splash), 'bolt', 'an elemental strike is a bolt');
  assert.equal(skillLook(SKILLS_BY_ID.bellyFlop), 'slam', 'a strike that stuns you is a slam');
});

test('a heal is a heal whatever else it carries', () => {
  const heal = SKILLS.find((s) => s.effect?.type === 'heal');
  assert.ok(heal, 'there should be at least one heal to check');
  assert.equal(skillLook(heal), 'heal');
});

test('an unknown or malformed skill falls back rather than throwing', () => {
  // A passive has no effect, and a content pack could one day name a skill the
  // renderer has never seen. Neither should be able to take a frame down.
  assert.equal(skillLook(undefined), 'slash');
  assert.equal(skillLook(null), 'slash');
  assert.equal(skillLook({}), 'slash');
  assert.equal(skillLook({ effect: {} }), 'slash');
  for (const skill of SKILLS.filter((s) => s.kind === 'passive')) {
    assert.equal(skillLook(skill), 'slash', `${skill.id} should fall back quietly`);
  }
});

test('combat tells the arena which skill fired', () => {
  // The arena resolves the look from the id, so the id has to be on the event.
  // Without it every skill would draw as a slash and nothing would say why.
  const source = readCombat();
  const emits = [...source.matchAll(/emit\(\{ kind: 'skill'[^}]*\}/g)].map((m) => m[0]);
  assert.ok(emits.length >= 2, `expected the two skill emits, found ${emits.length}`);
  for (const emit of emits) {
    assert.match(emit, /id: skill\.id/, `a skill event without an id: ${emit}`);
  }
});

function readCombat() {
  return readFileSync(new URL('../src/systems/combat.js', import.meta.url), 'utf8');
}
