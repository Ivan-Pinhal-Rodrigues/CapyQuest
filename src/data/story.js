// The story, told in the margins.
//
// The premise: you wake in a pond that has gone cold. The water stopped
// somewhere upstream. You rebuild the onsen, travel down through the terrains,
// and find out what happened at the Still Point.
//
// It is delivered as *beats* — short exchanges that fire once, at a moment the
// player reached on their own. Nothing here blocks anything, nothing here has a
// choice in it, and no beat ever fires twice. An idle game that stops you to
// talk is an idle game you close, so a beat is a bar at the bottom of the scene
// that you can ignore, and the whole story is skippable from settings.
//
//   id     the milestone that fires it, matched by systems/story.js
//   npc    who says it
//   lines  one or more; the bar advances on a tap
//   act    which act it belongs to, for the story log

/** The three acts, for the log on the profile. */
export const ACTS = [
  { id: 1, name: 'The Cold Pond', blurb: 'Something upstream stopped, and nobody can say when.' },
  { id: 2, name: 'Downstream', blurb: 'The terrains get stranger the further you go, and so do their capybaras.' },
  { id: 3, name: 'The Still Point', blurb: 'Whatever stopped the water is down there, and it is not water.' },
];

export const BEATS = [
  // ------------------------------------------------------------------ act 1
  {
    id: 'wake', act: 1, npc: 'yuzuBaa',
    lines: [
      'You are awake. Good. The water has gone cold — properly cold, not evening cold.',
      'It has never done that. Not once, and I have been here a very long time.',
      'Tap the water. Keep it moving. Cold water that moves is still water.',
    ],
  },
  {
    id: 'firstGenerator', act: 1, npc: 'kettle',
    lines: [
      'A lilypad. Small, but it holds heat where it sits.',
      'That is the whole trick, honestly. Enough small warm things and you have a bath.',
    ],
  },
  {
    id: 'firstUpgrade', act: 1, npc: 'kettle',
    lines: ['Better. You are getting more out of the same water. Keep doing that.'],
  },
  {
    id: 'questOpen', act: 1, npc: 'yuzuBaa',
    lines: [
      'The stream runs downhill from here, and it is running the wrong way.',
      'Go and see. Something down there is holding it, and holding is not what water does.',
    ],
  },
  {
    id: 'firstFight', act: 1, npc: 'pip',
    lines: [
      'It bit you! It BIT you!',
      'They never used to bite. The cold has got into them, I think. Sorry.',
    ],
  },
  {
    id: 'firstBoss', act: 1, npc: 'pip',
    lines: [
      'That was a big one. That was a BIG one.',
      'They get bigger. Sorry again.',
    ],
  },
  {
    id: 'firstCapybara', act: 1, npc: 'yuzuBaa',
    lines: [
      'Ah. So it is not only the fish.',
      'That was one of ours, once. Do not think about it too hard, and do not let it near the bath.',
    ],
  },

  // ------------------------------------------------------------------ act 2
  {
    id: 'terrain2', act: 2, npc: 'pip',
    lines: ['New mud! Different mud! I did not know mud came in kinds.'],
  },
  {
    id: 'terrain4', act: 2, npc: 'kettle',
    lines: [
      'Bamboo this deep is wrong. It grows where it is warm and it is not warm.',
      'Something down there is still putting heat out. That is almost worse.',
    ],
  },
  {
    id: 'firstDrop', act: 2, npc: 'tanuki',
    lines: [
      'You found something! Marvellous. Wear it, break it, sell it back to me — any of those.',
      'I am a tanuki, by the way. In case you were wondering.',
    ],
  },
  {
    id: 'firstCase', act: 2, npc: 'tanuki',
    lines: [
      'Ah, a case. Now — the odds are printed on the front. I did not want to print them.',
      'Yuzu-baa insisted. She said a shop that hides its numbers is a different kind of shop.',
      'She was right, obviously. It has been very bad for business.',
    ],
  },
  {
    id: 'firstStar', act: 2, npc: 'kettle',
    lines: ['A star. That took, then. They do not always.'],
  },
  {
    id: 'firstFuse', act: 2, npc: 'kettle',
    lines: [
      'Three into one. It is not thrift, it is the only way up past a certain point.',
      'Everything down there is on a ladder. You may as well be on it too.',
    ],
  },
  {
    id: 'terrain7', act: 2, npc: 'yuzuBaa',
    lines: [
      'You are further than anyone has been in my lifetime, and I have had several.',
      'The water is warmer here. That is the wrong direction and you know it.',
    ],
  },

  // ------------------------------------------------------------------ act 3
  {
    id: 'wall', act: 3, npc: 'quietOne',
    lines: [
      'You have stopped.',
      'Not given up — stopped. There is a difference and it is the whole difference.',
      'What is in front of you is not too strong. You are too new. Those are not the same problem.',
      'Go back to the beginning. You will keep what you learned. That is what learning is for.',
    ],
  },
  {
    id: 'rebirth1', act: 3, npc: 'quietOne',
    lines: [
      'There. The pond is cold again and you are not the same.',
      'It will be quicker this time. It is always quicker.',
    ],
  },
  {
    id: 'rebirth3', act: 3, npc: 'quietOne',
    lines: [
      'Three times now. You are beginning to see the shape of it.',
      'Everything down there is doing this too, you understand. Round and round. That is why it never ends.',
    ],
  },
  {
    id: 'rebirth10', act: 3, npc: 'quietOne',
    lines: [
      'Ten. You have been further than the water has.',
      'At the bottom there is a place where nothing moves at all. That is what stopped the stream.',
      'It is not holding the water back. It simply has not been told to let go.',
    ],
  },
  {
    id: 'terrain12', act: 3, npc: 'yuzuBaa',
    lines: [
      'I cannot follow you past here. Nobody can. Send word if there is anything to send it about.',
      'And — the water. If you find where it stopped. Ask it nicely first.',
    ],
  },
  {
    id: 'ascendTease', act: 3, npc: 'quietOne',
    lines: [
      'You can feel it now. The Still Point.',
      'It is not finished. Neither is what is built around it — the panel will tell you so plainly.',
      'Come back. It will be here. It is extremely good at being here.',
    ],
  },

  // ------------------------------------------------------- boss cutscenes
  //
  // Tied to a specific fight rather than a threshold — fired by
  // dueCombatBeat() in systems/story.js off the Combat event stream itself,
  // not the poll every beat above uses. A curated subset: the four bosses
  // that already anchor the terrain2/4/7/12 beats above, so a cutscene lands
  // exactly where the story already treats the moment as meaningful.
  {
    id: 'beforeBoilerBeast', act: 2, npc: 'pip',
    lines: [
      'That is the Boiler Beast. It runs every spring down here.',
      'It does not like being interrupted. You are about to interrupt it.',
    ],
  },
  {
    id: 'afterBoilerBeast', act: 2, npc: 'kettle',
    lines: [
      'You beat the Boiler Beast. The water is calmer already — you can feel it through the floor.',
      'Whoever runs the springs now, I suppose it is you.',
    ],
  },
  {
    id: 'beforeRiverElder', act: 2, npc: 'yuzuBaa',
    lines: [
      'The River Elder. Older than the river, and the river is old.',
      'It waited a long time for someone to come this far. Do not keep it waiting politely.',
    ],
  },
  {
    id: 'afterRiverElder', act: 2, npc: 'pip',
    lines: [
      'You beat something OLDER THAN THE RIVER.',
      'I do not think the river knows what to do with itself now.',
    ],
  },
  {
    id: 'beforeGeodeTitan', act: 2, npc: 'kettle',
    lines: [
      'Hollow, and something inside it is humming. That is the Geode Titan, that hum.',
      'Whatever it is humming, I do not think it is for you.',
    ],
  },
  {
    id: 'afterGeodeTitan', act: 2, npc: 'yuzuBaa',
    lines: [
      'The hum has stopped. I did not know it could stop.',
      'I am not sure that is good news. I am not sure it is bad news either.',
    ],
  },
  {
    id: 'beforeEmberJudge', act: 3, npc: 'quietOne',
    lines: [
      'The Ember Judge decides what burned fairly.',
      'It will not ask you first. It never does.',
    ],
  },
  {
    id: 'afterEmberJudge', act: 3, npc: 'quietOne',
    lines: [
      'It decided fairly, in the end. That is rarer than it sounds.',
      'You are close now. Closer than the round-and-round usually allows.',
    ],
  },
];

export const BEATS_BY_ID = Object.fromEntries(BEATS.map((b) => [b.id, b]));

/** Beats that fire on reaching a terrain stage, keyed by stage index. */
export const TERRAIN_BEATS = Object.fromEntries(
  BEATS.filter((b) => /^terrain\d+$/.test(b.id)).map((b) => [Number(b.id.slice(7)), b.id]),
);

/** Beats that fire on a rebirth count, keyed by count. */
export const REBIRTH_BEATS = Object.fromEntries(
  BEATS.filter((b) => /^rebirth\d+$/.test(b.id)).map((b) => [Number(b.id.slice(7)), b.id]),
);

/**
 * Boss cutscenes, keyed by the boss's own id in data/enemies.js rather than a
 * threshold — dueCombatBeat() in systems/story.js resolves these off a single
 * Combat `engage`/`cleared` event, not the poll TERRAIN_BEATS/REBIRTH_BEATS
 * use. A poll can miss the moment entirely: a boss fight can resolve, in
 * auto-battle especially, on the same tick a poll would have fired, so
 * "right before this boss" needs an event to hang off rather than a number to
 * cross.
 */
export const BOSS_INTRO_BEATS = {
  boilerBeast: 'beforeBoilerBeast',
  riverElder: 'beforeRiverElder',
  geodeTitan: 'beforeGeodeTitan',
  emberJudge: 'beforeEmberJudge',
};

/** The same bosses' aftermath, shown once the fight actually resolves in a win. */
export const BOSS_DEFEAT_BEATS = {
  boilerBeast: 'afterBoilerBeast',
  riverElder: 'afterRiverElder',
  geodeTitan: 'afterGeodeTitan',
  emberJudge: 'afterEmberJudge',
};
