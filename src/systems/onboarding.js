// The tutorial: six coach marks that fire as things actually unlock.
//
// Not a sequence you are walked through at the start — a step appears when the
// thing it explains has just become real, and never before. Explaining the forge
// to someone with no gear is how a tutorial becomes something to dismiss.
//
// Each step fires once ever and is recorded in `state.story.tutorial`, which
// survives every reset for the same reason story beats do.

/**
 * `when` reads the state and says whether this step is due. `selector` names the
 * real element to point at — if it is not on screen, ui/coachmark.js declines to
 * place the mark and the step simply comes round again.
 */
export const STEPS = [
  {
    id: 'tapCapy',
    selector: '#scene',
    title: 'Tap the capybara',
    body: 'That is the whole game, to begin with. Everything else is a way of doing this without you.',
    when: (s) => s.lifetimeClicks < 1,
  },
  {
    id: 'firstGenerator',
    selector: '#buildingList .building',
    title: 'Buy a lilypad',
    body: 'It earns while you are not tapping. Then it earns while you are asleep.',
    when: (s) => s.zen >= 15 && !Object.values(s.buildings).some((n) => n > 0),
  },
  {
    id: 'upgrades',
    selector: '[data-tab="upgrades"]',
    title: 'Upgrades multiply',
    body: 'Generators add. Upgrades multiply what they add. Buy them when you can.',
    when: (s) => Object.values(s.buildings).reduce((a, b) => a + b, 0) >= 5,
  },
  {
    id: 'quest',
    selector: '[data-tab="quest"]',
    title: 'The stream runs downhill',
    body: 'The fight runs itself. What you choose is the kit, the skills and the stance.',
    when: (s) => s.combat.unlocked && (s.combat.clears || 0) < 1,
  },
  {
    id: 'kit',
    selector: '[data-tab="kit"]',
    title: 'Something dropped',
    body: 'Everything you find sits on a twenty-rung ladder, and any piece can be carried to the top of it.',
    when: (s) => (s.stats.drops || 0) > 0,
  },
  {
    id: 'rebirth',
    selector: '[data-tab="rebirth"]',
    title: 'You are stuck, and that is the design',
    body: 'Beginning again pays Essence for how deep you got. The tree you buy with it is permanent.',
    when: (s) => s.rebirthUnlocked && (s.rebirthCount || 0) < 1,
  },
];

export const STEPS_BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));

export function stepSeen(state, id) {
  return !!state.story?.tutorial?.[id];
}

export function markStep(state, id) {
  if (!STEPS_BY_ID[id] || stepSeen(state, id)) return false;
  state.story.tutorial[id] = Date.now();
  return true;
}

/** The next step due, or null. A pure read, like the story beats. */
export function nextStep(state) {
  if (state.story?.skip) return null;
  return STEPS.find((step) => !stepSeen(state, step.id) && step.when(state)) || null;
}

export function tutorialProgress(state) {
  const seen = STEPS.filter((s) => stepSeen(state, s.id)).length;
  return { seen, total: STEPS.length };
}
