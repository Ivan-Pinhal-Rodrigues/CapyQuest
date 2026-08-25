// The five who talk to you.
//
// They are portraits and a voice, not a system: nothing an NPC says changes a
// number, and none of them ever asks you to do anything you were not already
// going to do. They exist so the pond has people in it.
//
// Each has a palette from render/palettes.js — the same 32×32 capybara, swapped,
// which is how everything else in this game gets its variety too. Merchant
// Tanuki is a capybara insisting otherwise; nobody corrects him.

export const NPCS = [
  {
    id: 'yuzuBaa',
    name: 'Yuzu-baa',
    skin: 'npcElder',
    color: '#ded4c6',
    role: 'The elder',
    blurb: 'Has been in this pond longer than the pond has.',
  },
  {
    id: 'kettle',
    name: 'Kettle',
    skin: 'npcKeeper',
    color: '#d9a37b',
    role: 'Bathhouse keeper',
    blurb: 'Runs the water. Will tell you the temperature whether you asked or not.',
  },
  {
    id: 'pip',
    name: 'Pip',
    skin: 'npcYoung',
    color: '#f0c78e',
    role: 'Young and loud',
    blurb: 'Enormously excited about everything, including things that have not happened.',
  },
  {
    id: 'quietOne',
    name: 'The Quiet One',
    skin: 'npcQuiet',
    color: '#7b7199',
    role: 'Turns up when you begin again',
    blurb: 'Nobody has ever seen them arrive.',
  },
  {
    id: 'tanuki',
    name: 'Merchant Tanuki',
    skin: 'npcTanuki',
    color: '#96775f',
    role: 'Sells things',
    blurb: 'Insists he is a tanuki. He is a capybara. It has stopped being worth arguing about.',
  },
];

export const NPCS_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));
