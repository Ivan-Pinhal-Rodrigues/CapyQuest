// The rebirth tree: 7 branches × 6 tiers × 5 nodes = 210.
//
// This replaces v1's two parallel permanent-upgrade systems — 22 relics bought
// with Yuzu, and a 27-node talent tree bought with level-derived points. Three
// screens that all mean "permanent upgrade" is two screens too many, so there
// is now one tree, one currency, one place to look.
//
// All 49 of those v1 ids live on in here, keeping their id, name, effect value
// and max rank. That is deliberate: because the ids are unchanged, migrating a
// v1 save is a *merge* of two rank maps rather than a translation table that
// has to be maintained forever.
//
//   tier   1..6, gated on ranks already bought inside that same branch
//   max    how many times a node can be taken
//   effect per-rank effect, in the systems/stats.js vocabulary
//
// Values for the 161 new nodes are generated from a per-tier scale rather than
// typed one at a time, so the tree stays balanced against itself instead of
// drifting as it grew. The 49 adopted nodes override that with their original
// numbers — a player who bought 5 ranks of Compound Interest keeps all five.

export const TIERS = 6;
export const NODES_PER_TIER = 5;

/** Ranks bought inside a branch before its next tier opens. */
export const TIER_GATES = { 1: 0, 2: 8, 3: 20, 4: 40, 5: 70, 6: 110 };

/** Default rank cap by tier. Deeper nodes are rarer and stronger. */
const TIER_MAX = [5, 5, 4, 4, 3, 3];

/**
 * Essence for the next rank of a node. Rises with both tier and how many ranks
 * you already hold, so finishing a deep node is a real commitment rather than
 * something you tick off on the way past.
 */
export function nodeCost(tier, ownedRanks) {
  return Math.ceil(3 * Math.pow(2.15, tier - 1) * Math.pow(1.55, ownedRanks));
}

// --------------------------------------------------------------- the scales

// Additive effects: the value is added to a running total.
// Multiplicative effects: the value is multiplied in, so it sits around 1.
const SCALE = {
  combatAtk: [0.06, 0.11, 0.18, 0.3, 0.5, 0.85],
  combatDef: [0.06, 0.11, 0.18, 0.3, 0.5, 0.85],
  combatHp: [0.07, 0.13, 0.21, 0.35, 0.58, 1.0],
  combatSpd: [0.05, 0.09, 0.15, 0.25, 0.42, 0.7],
  combatLuck: [10, 20, 40, 80, 160, 320],
  critChance: [0.012, 0.02, 0.032, 0.05, 0.075, 0.11],
  critDamage: [0.15, 0.28, 0.45, 0.75, 1.2, 2.0],
  comboCap: [4, 8, 14, 24, 40, 66],
  comboStep: [0.004, 0.007, 0.011, 0.018, 0.03, 0.05],
  zpsShare: [0.015, 0.03, 0.05, 0.08, 0.13, 0.21],
  goldenChance: [0.05, 0.1, 0.17, 0.28, 0.46, 0.75],
  goldenDuration: [0.05, 0.09, 0.15, 0.25, 0.4, 0.65],
  offlineRate: [0.03, 0.05, 0.08, 0.13, 0.21, 0.34],
  offlineCapHours: [2, 4, 7, 12, 20, 33],
  costDiscount: [0.015, 0.025, 0.04, 0.06, 0.09, 0.13],
  clickFlat: [2, 8, 40, 250, 2000, 20000],
  ticketRate: [0.25, 0.5, 1, 2, 4, 8],
  essenceGain: [0.05, 0.09, 0.15, 0.25, 0.4, 0.65],
  clickMult: [1.05, 1.09, 1.15, 1.24, 1.4, 1.65],
  zpsMult: [1.05, 1.09, 1.15, 1.24, 1.4, 1.65],
  globalMult: [1.03, 1.055, 1.09, 1.15, 1.24, 1.4],
  allBuildingMult: [1.04, 1.07, 1.12, 1.2, 1.33, 1.55],
  buffMult: [1.04, 1.07, 1.12, 1.2, 1.33, 1.55],
};

/** Every effect type the tree is allowed to speak. */
export const TREE_EFFECT_TYPES = Object.keys(SCALE);

/**
 * Plain-language blurb for an effect. Generated rather than hand-written so a
 * node's description can never disagree with the number it actually grants.
 */
export function describeEffect(type, value) {
  const pct = (v) => `${round(v * 100)}%`;
  const mult = (v) => `+${round((v - 1) * 100)}%`;
  switch (type) {
    case 'combatAtk': return `+${pct(value)} ATK per rank.`;
    case 'combatDef': return `+${pct(value)} DEF per rank.`;
    case 'combatHp': return `+${pct(value)} max HP per rank.`;
    case 'combatSpd': return `+${pct(value)} attack speed per rank.`;
    case 'combatLuck': return `+${round(value)} LUCK per rank.`;
    case 'critChance': return `+${pct(value)} crit chance per rank.`;
    case 'critDamage': return `+${round(value, 2)}× crit damage per rank.`;
    case 'comboCap': return `+${round(value)} max combo per rank.`;
    case 'comboStep': return `+${pct(value)} power per combo point, per rank.`;
    case 'zpsShare': return `Taps also grant ${pct(value)} of ZPS per rank.`;
    case 'goldenChance': return `+${pct(value)} golden capybara rate per rank.`;
    case 'goldenDuration': return `+${pct(value)} buff duration per rank.`;
    case 'offlineRate': return `+${pct(value)} offline rate per rank.`;
    case 'offlineCapHours': return `+${round(value)}h offline cap per rank.`;
    case 'costDiscount': return `−${pct(value)} generator prices per rank.`;
    case 'clickFlat': return `+${round(value)} flat tap value per rank.`;
    case 'ticketRate': return `+${round(value, 2)} summon tickets per boss, per rank.`;
    case 'essenceGain': return `+${pct(value)} essence from rebirthing per rank.`;
    case 'clickMult': return `${mult(value)} tap power per rank.`;
    case 'zpsMult': return `${mult(value)} idle income per rank.`;
    case 'globalMult': return `${mult(value)} all income per rank.`;
    case 'allBuildingMult': return `${mult(value)} output from every generator, per rank.`;
    case 'buffMult': return `${mult(value)} buff strength per rank.`;
    default: return '';
  }
}

function round(value, places = 1) {
  const p = Math.pow(10, places);
  return String(Math.round(value * p) / p);
}

// ------------------------------------------------------------- the branches

export const TREE_BRANCHES = [
  { id: 'might', name: 'Might', color: '#e0653f', blurb: 'Hit harder. Hit worse.' },
  { id: 'hide', name: 'Hide', color: '#c99560', blurb: 'Be large. Be unbothered.' },
  { id: 'fortune', name: 'Fortune', color: '#f0c93d', blurb: 'Be standing where the good things land.' },
  { id: 'flow', name: 'Flow', color: '#66d6c0', blurb: 'Never stop moving.' },
  { id: 'commerce', name: 'Commerce', color: '#7fd0e6', blurb: 'Let the pond do the work.' },
  { id: 'instinct', name: 'Instinct', color: '#f0a63d', blurb: 'Tap like you mean it.' },
  { id: 'legacy', name: 'Legacy', color: '#c79ae8', blurb: 'What survives the water.' },
];

export const TREE_BRANCHES_BY_ID = Object.fromEntries(TREE_BRANCHES.map((b) => [b.id, b]));

// Each branch is 30 entries in tier order — five per tier, tier 1 first.
// [id, name, effectType]                → value and max come from the scale
// [id, name, effectType, value, max]    → an adopted v1 node, verbatim
const BRANCH_NODES = {
  might: [
    // tier 1
    ['might1', 'Firm Grip', 'combatAtk'],
    ['might2', 'Bared Teeth', 'critDamage'],
    ['might3', 'Shoulder Weight', 'combatAtk'],
    ['might4', 'Follow Through', 'critDamage'],
    ['might5', 'Standing Charge', 'combatAtk'],
    // tier 2
    ['feral4', 'Savage', 'critDamage', 0.4, 3],
    ['feral6', 'Predator', 'combatAtk', 0.15, 3],
    ['might6', 'Riverstone Fists', 'combatAtk'],
    ['might7', 'Splitting Blow', 'critDamage'],
    ['might8', 'No Warning', 'combatAtk'],
    // tier 3
    ['sharpenedTeeth', 'Sharpened Teeth', 'combatAtk', 0.25, 4],
    ['heavyPaw', 'Heavy Paw', 'critDamage', 0.75, 4],
    ['might9', 'Deep Cut', 'combatAtk'],
    ['might10', 'Bone Reader', 'critDamage'],
    ['might11', 'Weight of Water', 'combatAtk'],
    // tier 4
    ['might12', 'Breaking Point', 'critDamage'],
    ['might13', 'Undertow Strike', 'combatAtk'],
    ['might14', 'The Short Answer', 'combatAtk'],
    ['might15', 'Ruinous', 'critDamage'],
    ["might16", "Hunter's Patience", 'combatAtk'],
    // tier 5
    ['feral8', 'Apex', 'combatAtk', 0.5, 1],
    ['might17', 'Terminal Velocity', 'critDamage'],
    ['might18', 'Everything At Once', 'combatAtk'],
    ['might19', 'Red Water', 'critDamage'],
    ['might20', 'Unanswerable', 'combatAtk'],
    // tier 6
    ['might21', 'The Last Word', 'combatAtk'],
    ['might22', 'Executioner', 'critDamage'],
    ['might23', 'Mountain Falls', 'combatAtk'],
    ['might24', 'Nothing Survives', 'critDamage'],
    ['might25', 'The Whole Weight', 'combatAtk'],
  ],

  hide: [
    ['chonk2', 'Deep Reserves', 'combatHp', 0.08, 5],
    ['chonk3', 'Thick Coat', 'combatDef', 0.08, 5],
    ['hide1', 'Wide Stance', 'combatDef'],
    ['hide2', 'Slow Pulse', 'combatHp'],
    ['hide3', 'Padded Ribs', 'combatHp'],

    ['chonk6', 'Immovable', 'combatDef', 0.18, 3],
    ['hide4', 'Waterlogged', 'combatDef'],
    ['hide5', 'Second Wind', 'combatHp'],
    ['hide6', 'Bark Skin', 'combatDef'],
    ['hide7', 'Full Belly', 'combatHp'],

    ['ironHide', 'Iron Hide', 'combatDef', 0.25, 4],
    ['wellFed', 'Well Fed', 'combatHp', 0.3, 4],
    ['hide8', 'Silt Armour', 'combatDef'],
    ['hide9', 'Long Lungs', 'combatHp'],
    ['hide10', 'Unhurried', 'combatDef'],

    ['hide11', 'Riverbed Bones', 'combatDef'],
    ['hide12', 'Overflow', 'combatHp'],
    ['hide13', 'Cold Tolerance', 'combatDef'],
    ['hide14', 'Deep Keel', 'combatHp'],
    ['hide15', 'Nothing Lands', 'combatDef'],

    ['chonk8', 'Unbothered', 'combatHp', 0.6, 1],
    ['hide16', 'Stone Between', 'combatDef'],
    ['hide17', 'Vast', 'combatHp'],
    ['hide18', 'Tideproof', 'combatDef'],
    ['hide19', 'Still Standing', 'combatHp'],

    ['hide20', 'The Long Shape', 'combatHp'],
    ['hide21', 'Bedrock', 'combatDef'],
    ['hide22', 'Unmoving Water', 'combatDef'],
    ['hide23', 'Weight of Years', 'combatHp'],
    ['hide24', 'Simply There', 'combatDef'],
  ],

  fortune: [
    ['zen3', 'Patient', 'goldenChance', 0.08, 5],
    ['fortune1', 'Bright Eye', 'combatLuck'],
    ['fortune2', 'Lucky Whisker', 'combatLuck'],
    ['fortune3', 'Right Place', 'goldenChance'],
    ['fortune4', 'Warm Current', 'goldenDuration'],

    ['zen5', 'Lingering Steam', 'goldenDuration', 0.15, 3],
    ['zen6', 'Fortune', 'combatLuck', 25, 3],
    ['luckyStreak', 'Lucky Streak', 'critChance', 0.04, 4],
    ['fortune5', 'Finder', 'combatLuck'],
    ['fortune6', 'Golden Hour', 'goldenChance'],

    ['goldenTrail', 'Golden Trail', 'goldenChance', 0.2, 4],
    ['lingering', 'Lingering', 'goldenDuration', 0.2, 4],
    ['fortune7', 'Sharp Nose', 'combatLuck'],
    ['fortune8', 'Turning Card', 'critChance'],
    ['fortune9', 'Loose Change', 'combatLuck'],

    ['foragersEye', "Forager's Eye", 'combatLuck', 60, 4],
    ['fortune10', 'Long Odds', 'critChance'],
    ['fortune11', 'Sunward', 'goldenChance'],
    ['fortune12', 'Slow Bell', 'goldenDuration'],
    ['fortune13', 'Windfall', 'combatLuck'],

    ['fortune14', 'Charmed', 'combatLuck'],
    ['fortune15', 'Gilded', 'goldenChance'],
    ['fortune16', 'Held Breath', 'goldenDuration'],
    ['fortune17', 'The Good Draw', 'critChance'],
    ['fortune18', 'Everything Shines', 'combatLuck'],

    ['fortune19', 'Improbable', 'combatLuck'],
    ['fortune20', 'Midas Pond', 'goldenChance'],
    ['fortune21', 'Time Enough', 'goldenDuration'],
    ['fortune22', 'Fated', 'critChance'],
    ['fortune23', 'The Pond Provides', 'combatLuck'],
  ],

  flow: [
    ['feral3', 'Momentum', 'comboCap', 6, 5],
    ['flow1', 'Light Feet', 'combatSpd'],
    ['flow2', 'Rhythm', 'comboCap'],
    ['flow3', 'Loose Wrist', 'combatSpd'],
    ['flow4', 'Quickening', 'comboStep'],

    ['feral5', 'Relentless', 'comboStep', 0.008, 3],
    ['flow5', 'Running Water', 'combatSpd'],
    ['flow6', 'Chain', 'comboCap'],
    ['flow7', 'Second Nature', 'comboStep'],
    ['flow8', 'No Hesitation', 'combatSpd'],

    ['unbrokenRhythm', 'Unbroken Rhythm', 'comboCap', 15, 4],
    ['flowState', 'Flow State', 'comboStep', 0.01, 3],
    ['flow9', 'Slipstream', 'combatSpd'],
    ['flow10', 'Cadence', 'comboCap'],
    ['flow11', 'Downhill', 'combatSpd'],

    ['flow12', 'Rapids', 'combatSpd'],
    ['flow13', 'Endless Chain', 'comboCap'],
    ['flow14', 'Compounding', 'comboStep'],
    ['flow15', 'Faster Than Thought', 'combatSpd'],
    ['flow16', 'Never Breaks', 'comboCap'],

    ['flow17', 'The Long Run', 'combatSpd'],
    ['flow18', 'Perpetual', 'comboCap'],
    ['flow19', 'Snowballing', 'comboStep'],
    ['flow20', 'Blur', 'combatSpd'],
    ['flow21', 'Unstoppable Line', 'comboCap'],

    ['flow22', 'Time Dilation', 'combatSpd'],
    ['flow23', 'Infinite Chain', 'comboCap'],
    ['flow24', 'Runaway', 'comboStep'],
    ['flow25', 'One Motion', 'combatSpd'],
    ['flow26', 'The River Itself', 'comboCap'],
  ],

  commerce: [
    ['zen1', 'Frugal', 'costDiscount', 0.02, 5],
    ['zen2', 'Still Water', 'globalMult', 1.03, 5],
    ['chonk1', 'Broad Shoulders', 'zpsMult', 1.04, 5],
    ['commerce1', 'Small Savings', 'costDiscount'],
    ['commerce2', 'Steady Trickle', 'zpsMult'],

    ['zen4', 'Deep Pockets', 'costDiscount', 0.05, 3],
    ['chonk4', 'Slow Metabolism', 'offlineRate', 0.05, 3],
    ['chonk5', 'Long Sleeper', 'offlineCapHours', 3, 3],
    ['steadyHand', 'Steady Hand', 'clickMult', 1.2, 5],
    ['commerce3', 'Bulk Buyer', 'costDiscount'],

    ['thriftyPaws', 'Thrifty Paws', 'costDiscount', 0.04, 5],
    ['deepRoots', 'Deep Roots', 'zpsMult', 1.2, 5],
    ['goodMemory', 'Good Memory', 'offlineCapHours', 6, 3],
    ['deepSleeper', 'Deep Sleeper', 'offlineRate', 0.08, 4],
    ['chonk7', 'Absolute Mass', 'zpsMult', 1.15, 3],

    ['zen7', 'The Long View', 'globalMult', 1.12, 3],
    ['commerce4', 'Reinvestment', 'allBuildingMult'],
    ['commerce5', 'Market Nose', 'costDiscount'],
    ['commerce6', 'Night Shift', 'offlineRate'],
    ['commerce7', 'Warehouse', 'offlineCapHours'],

    ['zen8', 'Endless Spring', 'zpsMult', 1.5, 1],
    ['zen9', 'Perfect Stillness', 'offlineRate', 0.25, 1],
    ['commerce8', 'Standing Order', 'allBuildingMult'],
    ['commerce9', 'Wholesale', 'costDiscount'],
    ['commerce10', 'Long Ledger', 'globalMult'],

    ['commerce11', 'The Whole Pond Works', 'zpsMult'],
    ['commerce12', 'Monopoly', 'allBuildingMult'],
    ['commerce13', 'Nothing Wasted', 'costDiscount'],
    ['commerce14', 'Dreaming Profit', 'offlineRate'],
    ['commerce15', 'Compound Pond', 'globalMult'],
  ],

  instinct: [
    ['feral1', 'Quick Paws', 'clickMult', 1.06, 5],
    ['feral2', 'Keen Edge', 'critChance', 0.02, 5],
    ['instinct1', 'Twitch', 'critChance'],
    ['instinct2', 'Heavy Tap', 'clickFlat'],
    ['instinct3', 'Practised Hand', 'clickMult'],

    ['instinct4', 'Weak Point', 'critChance'],
    ['instinct5', 'Knuckle Down', 'clickMult'],
    ['instinct6', 'Borrowed Current', 'zpsShare'],
    ['instinct7', 'Hard Knock', 'clickFlat'],
    ['instinct8', 'Read the Water', 'critChance'],

    ['feral7', 'Osmosis', 'zpsShare', 0.03, 3],
    ['osmoticSkin', 'Osmotic Skin', 'zpsShare', 0.05, 3],
    ['instinct9', 'Precision', 'critChance'],
    ['instinct10', 'Strong Arm', 'clickMult'],
    ['instinct11', 'Dead Weight', 'clickFlat'],

    ['instinct12', 'Instinctive', 'critChance'],
    ['instinct13', 'Siphon', 'zpsShare'],
    ['instinct14', 'Sledge', 'clickMult'],
    ['instinct15', 'Full Force', 'clickFlat'],
    ['instinct16', 'Cold Read', 'critChance'],

    ['feral9', 'The Feral Within', 'clickMult', 2, 1],
    ['instinct17', 'Perfect Strike', 'critChance'],
    ['instinct18', 'Drawing Deep', 'zpsShare'],
    ['instinct19', 'Anvil', 'clickFlat'],
    ['instinct20', 'Without Thinking', 'clickMult'],

    ['instinct21', 'Every Blow Tells', 'critChance'],
    ['instinct22', 'The Whole River', 'zpsShare'],
    ['instinct23', 'Hammerfall', 'clickMult'],
    ['instinct24', 'Absolute Tap', 'clickFlat'],
    ['instinct25', 'Knowing', 'critChance'],
  ],

  legacy: [
    ['warmStone', 'Warm Stone', 'globalMult', 1.1, 1],
    ['firstYuzu', 'The First Yuzu', 'clickMult', 1.5, 1],
    ['legacy1', 'Kept Stone', 'globalMult'],
    ['legacy2', 'Old Habit', 'buffMult'],
    ['legacy3', 'Remembered Warmth', 'essenceGain'],

    ['legacy4', 'Carried Over', 'essenceGain'],
    ['legacy5', 'Longer Steam', 'buffMult'],
    ['legacy6', 'Second Life', 'globalMult'],
    ['legacy7', 'Familiar Water', 'essenceGain'],
    ['legacy8', 'Ancestral Sense', 'buffMult'],

    ['openInvitation', 'Open Invitation', 'ticketRate', 1, 3],
    ['chonk9', 'The Chonk Within', 'globalMult', 1.25, 1],
    ['legacy9', 'Inheritance', 'essenceGain'],
    ['legacy10', 'Deep Well', 'globalMult'],
    ['legacy11', 'Standing Invitation', 'ticketRate'],

    ['theLongBath', 'The Long Bath', 'essenceGain', 0.25, 3],
    ['legacy12', 'Every Life Counts', 'globalMult'],
    ['legacy13', 'Steamed Through', 'buffMult'],
    ['legacy14', 'Word of Mouth', 'ticketRate'],
    ['legacy15', 'Accrual', 'essenceGain'],

    ['compoundInterest', 'Compound Interest', 'globalMult', 1.25, 5],
    ['legacy16', 'The Long Memory', 'essenceGain'],
    ['legacy17', 'Endless Guests', 'ticketRate'],
    ['legacy18', 'Bathed In It', 'buffMult'],
    ['legacy19', 'Rooted Deep', 'globalMult'],

    ['stillnessItself', 'Stillness Itself', 'globalMult', 3, 1],
    ['legacy20', 'All Of It Kept', 'essenceGain'],
    ['legacy21', 'The Unbroken Line', 'globalMult'],
    ['legacy22', 'Every Door Open', 'ticketRate'],
    ['legacy23', 'Nothing Is Lost', 'buffMult'],
  ],
};

function buildTree() {
  const nodes = [];
  for (const branch of TREE_BRANCHES) {
    const rows = BRANCH_NODES[branch.id];
    rows.forEach(([id, name, type, value, max], index) => {
      const tier = Math.floor(index / NODES_PER_TIER) + 1;
      const scale = SCALE[type];
      if (!scale) throw new Error(`${id}: unknown effect type "${type}"`);

      const finalValue = value ?? scale[tier - 1];
      nodes.push({
        id,
        branch: branch.id,
        tier,
        // Position inside the tier, so the UI can lay out a stable 6×5 grid.
        slot: index % NODES_PER_TIER,
        name,
        max: max ?? TIER_MAX[tier - 1],
        adopted: value !== undefined,
        effect: { type, value: finalValue },
        blurb: describeEffect(type, finalValue),
      });
    });
  }
  return nodes;
}

export const TREE_NODES = buildTree();

export const NODES_BY_ID = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));

/**
 * The 49 v1 ids this tree adopted — 27 talents and 22 relics. state.js merges
 * both v1 rank maps straight into `state.tree`, and this is what makes that
 * safe to assert in a test rather than trust.
 */
export const ADOPTED_IDS = TREE_NODES.filter((n) => n.adopted).map((n) => n.id);

/** Branch → tier → nodes, for the panel. */
export function treeLayout() {
  const out = {};
  for (const branch of TREE_BRANCHES) {
    out[branch.id] = { branch, tiers: {} };
    for (let tier = 1; tier <= TIERS; tier++) out[branch.id].tiers[tier] = [];
  }
  for (const node of TREE_NODES) out[node.branch].tiers[node.tier].push(node);
  return out;
}
