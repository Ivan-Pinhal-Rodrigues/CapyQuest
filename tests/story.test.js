// The story, the tutorial and the profile.
//
// Three rules carry the weight here, and all three are about *not* getting in
// the way.
//
// A beat fires once, ever. It survives every reset in the game, because a
// rebirth that made you sit through the opening again would be unbearable and a
// season rollover has no business touching it.
//
// Nothing narrative is a gate. dueBeats() and nextStep() only read; a caller
// that cannot show one right now gets it again next tick rather than losing it.
//
// And all of it is opt-out. One toggle silences the beats and the coach marks
// together, because someone who wants an idle game and not a story should be
// able to have one.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { rebirth } from '../src/systems/rebirth.js';
import { ascend } from '../src/systems/ascension.js';
import { checkRollover } from '../src/systems/season.js';
import { grant } from '../src/systems/cosmetics.js';
import { NPCS, NPCS_BY_ID } from '../src/data/npcs.js';
import { BEATS, BEATS_BY_ID, ACTS, TERRAIN_BEATS, REBIRTH_BEATS } from '../src/data/story.js';
import { CAPY_SKINS } from '../src/render/palettes.js';
import {
  dueBeats, nextBeat, beat, hasSeen, markSeen, storyLog, storyProgress,
} from '../src/systems/story.js';
import { STEPS, STEPS_BY_ID, nextStep, markStep, stepSeen, tutorialProgress } from '../src/systems/onboarding.js';
import {
  profile, displayName, setName, cleanName, generateName, currentTitle,
  avatarChoices, titleChoices, NAME_MAX,
} from '../src/systems/profile.js';
import { FRAMES } from '../src/ui/cutscene.js';

// ------------------------------------------------------------------- content

test('five NPCs, each with a portrait the renderer actually has', () => {
  assert.equal(NPCS.length, 5);
  const ids = new Set();
  for (const npc of NPCS) {
    assert.ok(!ids.has(npc.id), `duplicate NPC "${npc.id}"`);
    ids.add(npc.id);
    assert.ok(npc.name && npc.role && npc.blurb, `${npc.id}: incomplete`);
    assert.match(npc.color, /^#[0-9a-f]{6}$/i, `${npc.id}: not a colour`);
    assert.ok(CAPY_SKINS[npc.skin], `${npc.id}: no palette "${npc.skin}"`);
  }
});

test('every beat is complete and spoken by somebody real', () => {
  const ids = new Set();
  for (const b of BEATS) {
    assert.ok(!ids.has(b.id), `duplicate beat "${b.id}"`);
    ids.add(b.id);
    assert.ok(NPCS_BY_ID[b.npc], `${b.id}: unknown speaker "${b.npc}"`);
    assert.ok(ACTS.some((a) => a.id === b.act), `${b.id}: unknown act`);
    assert.ok(b.lines.length > 0, `${b.id}: nothing to say`);
    for (const line of b.lines) {
      assert.ok(line.length > 8, `${b.id}: a line too short to be a line`);
      assert.ok(line.length < 200, `${b.id}: a line too long for a speech bar`);
    }
  }
  assert.ok(BEATS.length >= 15, `only ${BEATS.length} beats`);
});

test('every act has beats, and every NPC gets to speak', () => {
  for (const act of ACTS) {
    assert.ok(BEATS.some((b) => b.act === act.id), `act ${act.id} is silent`);
  }
  for (const npc of NPCS) {
    assert.ok(BEATS.some((b) => b.npc === npc.id), `${npc.name} never says anything`);
  }
});

test('the opening is six frames and every one of them draws', () => {
  assert.equal(FRAMES.length, 6);
  const ids = new Set();
  for (const f of FRAMES) {
    assert.ok(!ids.has(f.id), `duplicate frame "${f.id}"`);
    ids.add(f.id);
    assert.equal(f.sky.length, 2, `${f.id}: a gradient needs two colours`);
    assert.ok(f.ground && f.art?.kind, `${f.id}: incomplete`);
    assert.ok(f.lines.length >= 1 && f.lines.length <= 2, `${f.id}: ${f.lines.length} lines is too many for a frame`);
    if (f.art.kind === 'capy') assert.ok(CAPY_SKINS[f.art.skin], `${f.id}: no palette "${f.art.skin}"`);
  }
});

// ------------------------------------------------------------ what fires when

test('a fresh save has nothing to say yet', () => {
  assert.deepEqual(dueBeats(createState()), []);
  assert.equal(nextBeat(createState()), null);
});

test('the opening fires on the very first tap', () => {
  const s = createState();
  s.lifetimeClicks = 1;
  assert.deepEqual(dueBeats(s), ['wake']);
  assert.equal(nextBeat(s).speaker.name, 'Yuzu-baa');
});

test('a beat fires once and then never again', () => {
  const s = createState();
  s.lifetimeClicks = 5;
  assert.equal(markSeen(s, 'wake'), true);
  assert.equal(hasSeen(s, 'wake'), true);
  assert.equal(markSeen(s, 'wake'), false, 'marking twice must not re-fire it');
  assert.deepEqual(dueBeats(s), []);
  assert.equal(markSeen(s, 'notABeat'), false);
});

test('reading is separate from marking, so a beat cannot be lost', () => {
  // dueBeats() only reads. A caller that could not show one — a modal was up,
  // the bar was busy — must get it back on the next tick.
  const s = createState();
  s.lifetimeClicks = 1;
  assert.deepEqual(dueBeats(s), ['wake']);
  assert.deepEqual(dueBeats(s), ['wake'], 'reading must not consume it');
  markSeen(s, 'wake');
  assert.deepEqual(dueBeats(s), []);
});

test('terrain and rebirth beats fire off the deepest you have ever been', () => {
  const s = createState();
  s.combat.bestDepth = 45; // stage 4
  const due = dueBeats(s);
  assert.ok(due.includes(TERRAIN_BEATS[2]));
  assert.ok(due.includes(TERRAIN_BEATS[4]));
  assert.ok(!due.includes(TERRAIN_BEATS[7]), 'stage 4 has not reached the stage-7 beat');

  // Walking back up cannot un-fire it, because it reads bestDepth.
  s.combat.depth = 0;
  assert.ok(dueBeats(s).includes(TERRAIN_BEATS[4]));
});

test('the wall beat waits for the wall, and the rebirth beats for the count', () => {
  const s = createState();
  assert.ok(!dueBeats(s).includes('wall'));

  s.rebirthUnlocked = true;
  assert.ok(dueBeats(s).includes('wall'));
  assert.ok(!dueBeats(s).includes(REBIRTH_BEATS[1]));

  s.rebirthCount = 3;
  const due = dueBeats(s);
  assert.ok(due.includes(REBIRTH_BEATS[1]));
  assert.ok(due.includes(REBIRTH_BEATS[3]));
  assert.ok(!due.includes(REBIRTH_BEATS[10]));
});

test('every beat is reachable from some state the game can be in', () => {
  // A beat with no trigger is dead content. This walks a maximal save and
  // asserts the whole script becomes due.
  const s = createState();
  s.lifetimeClicks = 1e6;
  s.buildings.lilypad = 10;
  s.clickUpgrades.firmerPaw = true;
  s.combat.unlocked = true;
  s.combat.clears = 500;
  s.combat.bossKills = 50;
  s.combat.bestDepth = 5000;
  s.stats.metCapybara = 1;
  s.stats.drops = 100;
  s.stats.bestStars = 4;
  s.stats.fuses = 3;
  s.cases.reed = { opened: 4, since: 0 };
  s.rebirthUnlocked = true;
  s.rebirthCount = 20;
  s.lifetimeEssence = 50000;
  s.rebirthCount = 20;

  const due = dueBeats(s);
  for (const b of BEATS) {
    assert.ok(due.includes(b.id), `"${b.id}" can never fire`);
  }
});

test('the skip toggle silences the whole narrative layer', () => {
  const s = createState();
  s.lifetimeClicks = 1e6;
  s.rebirthUnlocked = true;
  assert.ok(dueBeats(s).length > 0);

  s.story.skip = true;
  assert.deepEqual(dueBeats(s), [], 'no beats');
  assert.equal(nextStep(s), null, 'and no coach marks either');
});

// ------------------------------------------------- surviving every reset

test('a rebirth never makes you sit through the story again', () => {
  const s = createState();
  s.combat.bestDepth = 95;
  s.rebirthUnlocked = true;
  markSeen(s, 'wake');
  markSeen(s, 'firstFight');
  markStep(s, 'tapCapy');
  s.story.onboarded = true;
  s.profile.name = 'Big Steve';

  assert.equal(rebirth(s).ok, true);
  assert.equal(hasSeen(s, 'wake'), true);
  assert.equal(hasSeen(s, 'firstFight'), true);
  assert.equal(stepSeen(s, 'tapCapy'), true);
  assert.equal(s.story.onboarded, true, 'and never the opening cutscene again');
  assert.equal(displayName(s), 'Big Steve', 'nor your name');
});

test('an ascension does not take the story either', () => {
  const s = createState();
  s.lifetimeEssence = 1e6;
  s.rebirthCount = 20;
  markSeen(s, 'wake');
  s.story.onboarded = true;
  s.profile.name = 'Kettle Jr';

  assert.equal(ascend(s).ok, true);
  assert.equal(hasSeen(s, 'wake'), true);
  assert.equal(s.story.onboarded, true);
  assert.equal(displayName(s), 'Kettle Jr');
});

test('a season rollover has no business touching the story', () => {
  const s = createState();
  s.pass.season = 0;
  markSeen(s, 'wake');
  s.story.onboarded = true;

  checkRollover(s, Date.now() + 1e12);
  assert.equal(hasSeen(s, 'wake'), true);
  assert.equal(s.story.onboarded, true);
});

// ------------------------------------------------------------- the tutorial

test('six steps, each pointing at a real selector', () => {
  assert.equal(STEPS.length, 6);
  const ids = new Set();
  for (const step of STEPS) {
    assert.ok(!ids.has(step.id), `duplicate step "${step.id}"`);
    ids.add(step.id);
    assert.ok(step.title && step.body, `${step.id}: incomplete`);
    assert.ok(step.selector.startsWith('#') || step.selector.startsWith('['), `${step.id}: odd selector`);
    assert.equal(typeof step.when, 'function', `${step.id}: no trigger`);
  }
});

test('the first step is the only thing a brand new save is told', () => {
  const s = createState();
  assert.equal(nextStep(s).id, 'tapCapy');
});

test('a step fires when the thing it explains becomes real, not before', () => {
  const s = createState();
  assert.notEqual(nextStep(s)?.id, 'kit', 'the forge means nothing with no gear');

  markStep(s, 'tapCapy');
  s.lifetimeClicks = 40;
  s.zen = 100;
  assert.equal(nextStep(s).id, 'firstGenerator');

  markStep(s, 'firstGenerator');
  s.buildings.lilypad = 6;
  assert.equal(nextStep(s).id, 'upgrades');
});

test('a step fires once, and reading is separate from marking', () => {
  const s = createState();
  assert.equal(nextStep(s).id, 'tapCapy');
  assert.equal(nextStep(s).id, 'tapCapy', 'reading must not consume it');

  assert.equal(markStep(s, 'tapCapy'), true);
  assert.equal(markStep(s, 'tapCapy'), false);
  assert.notEqual(nextStep(s)?.id, 'tapCapy');
  assert.equal(markStep(s, 'notAStep'), false);
});

test('the rebirth step waits for the wall and stops after the first one', () => {
  const s = createState();
  for (const step of STEPS) if (step.id !== 'rebirth') markStep(s, step.id);
  assert.equal(nextStep(s), null);

  s.rebirthUnlocked = true;
  assert.equal(nextStep(s).id, 'rebirth');

  s.rebirthCount = 1;
  assert.equal(nextStep(s), null, 'somebody who has done it does not need telling');
});

test('progress counts what has actually been shown', () => {
  const s = createState();
  assert.deepEqual(tutorialProgress(s), { seen: 0, total: STEPS.length });
  markStep(s, 'tapCapy');
  assert.equal(tutorialProgress(s).seen, 1);

  assert.equal(storyProgress(s).seen, 0);
  markSeen(s, 'wake');
  assert.equal(storyProgress(s).seen, 1);
  assert.equal(storyProgress(s).total, BEATS.length);
});

// -------------------------------------------------------------- the log

test('the log shows every beat but spoils none of them', () => {
  const s = createState();
  markSeen(s, 'wake');

  const log = storyLog(s);
  assert.equal(log.length, ACTS.length);
  const all = log.flatMap((a) => a.beats);
  assert.equal(all.length, BEATS.length, 'every beat has a slot, seen or not');

  const wake = all.find((b) => b.id === 'wake');
  assert.equal(wake.seen, true);
  assert.ok(wake.speaker.name);
  assert.equal(all.filter((b) => b.seen).length, 1);
});

test('a beat resolves with its speaker attached', () => {
  const b = beat('wake');
  assert.equal(b.speaker, NPCS_BY_ID.yuzuBaa);
  assert.deepEqual(b.lines, BEATS_BY_ID.wake.lines);
  assert.equal(beat('nope'), null);
});

// ------------------------------------------------------------- the profile

test('a guest starts with a generated name rather than an empty field', () => {
  const s = createState();
  const p = profile(s);
  assert.ok(p.name.length > 3, 'a nameless profile looks like a bug');
  assert.equal(p.generated, true);
  assert.equal(p.guest, true);
  assert.equal(p.avatar, 'classic');
  assert.equal(p.title, 'Bather');
});

test('the generated name is stable for a save and varies between them', () => {
  assert.equal(generateName(12345), generateName(12345), 'the same save keeps its name');
  const names = new Set();
  for (let seed = 1; seed < 60; seed++) names.add(generateName(seed));
  assert.ok(names.size > 12, `only ${names.size} distinct names in 60 seeds`);
});

test('a name is tidied, capped, and never allowed to be blank', () => {
  assert.equal(cleanName('  Big   Steve  ', 'x'), 'Big Steve');
  assert.equal(cleanName('', 'Fallback'), 'Fallback');
  assert.equal(cleanName('   ', 'Fallback'), 'Fallback');
  assert.equal(cleanName(null, 'Fallback'), 'Fallback');
  assert.equal(cleanName('x'.repeat(200), 'y').length, NAME_MAX);

  const s = createState();
  setName(s, '   ');
  assert.equal(displayName(s), generateName(s.createdAt), 'blank falls back rather than blanking');
  assert.equal(profile(s).generated, false, 'but it is no longer offering to generate one');
});

test('the pickers only ever offer what you own', () => {
  const s = createState();
  assert.deepEqual(avatarChoices(s).map((c) => c.id), ['classic']);
  assert.equal(titleChoices(s).length, 1);

  grant(s, 'skin', 'void');
  const ids = avatarChoices(s).map((c) => c.id);
  assert.ok(ids.includes('void'));
  assert.ok(!ids.includes('sakura'), 'an unowned skin must not be offered');
  assert.equal(avatarChoices(s).find((c) => c.id === 'classic').worn, true);
});

test('the profile reflects what is actually worn', () => {
  const s = createState();
  grant(s, 'skin', 'void');
  s.cosmetics.skin = 'void';
  grant(s, 'title', 'patron');
  s.cosmetics.title = 'patron';

  const p = profile(s);
  assert.equal(p.avatar, 'void');
  assert.equal(p.title, 'Patron of the Onsen');
  assert.equal(currentTitle(s).id, 'patron');
});

// --------------------------------------------------------------- the save

test('a mangled story block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 2,
    story: { seen: 'no', skip: 'yes', onboarded: 1, tutorial: null },
    profile: { name: 42 },
  });
  assert.deepEqual(s.story.seen, {});
  assert.deepEqual(s.story.tutorial, {});
  assert.equal(s.story.skip, true);
  assert.equal(s.story.onboarded, true);
  assert.equal(s.profile.name, '', 'a non-string name falls back to generated');
  assert.ok(displayName(s).length > 3);
  assert.deepEqual(dueBeats(s), [], 'and skip is still honoured');
});

test('a hand-edited name is trimmed on load rather than trusted', () => {
  const s = reconcileState({ version: 2, profile: { name: 'z'.repeat(500) } });
  assert.equal(s.profile.name.length, NAME_MAX);
});

test('a save from before any of this loads with the story intact', () => {
  // Nothing narrative existed a version ago; the defaults have to be a valid
  // starting point rather than something that needs a migration.
  const s = reconcileState({ version: 2, lifetimeClicks: 40, totalZen: 900 });
  assert.deepEqual(s.story.seen, {});
  assert.equal(s.story.onboarded, false);
  assert.deepEqual(dueBeats(s), ['wake'], 'and they pick the story up where they are');
});

test('the story round-trips through a save', () => {
  const s = createState();
  markSeen(s, 'wake');
  markStep(s, 'tapCapy');
  setName(s, 'Momo');
  s.story.onboarded = true;

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(hasSeen(reloaded, 'wake'), true);
  assert.equal(stepSeen(reloaded, 'tapCapy'), true);
  assert.equal(displayName(reloaded), 'Momo');
  assert.equal(reloaded.story.onboarded, true);
});
