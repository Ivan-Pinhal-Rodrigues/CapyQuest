// Achievements are not badges — every one of them pays. That is what makes the
// list worth grinding instead of worth ignoring.
//
// There are 232 of them and they span every system in the game, so the matching
// half of this file is a flat counter table rather than a conditional the length
// of a novel — see counters() at the bottom.

import { LEVELS_PER_STAGE } from '../balance.js';
import { NODES_BY_ID } from './rebirthTree.js';

// Payout bands.
//
// These exist because the obvious way to write this table is wrong. Each entry
// used to carry a hand-picked value somewhere between +2% and +25%, which reads
// fine one line at a time. Then the table tripled in size and those same values
// compounded to a factor of eight million, which would have made every other
// system in the game decorative. Two hundred small things multiplied together
// is not a small thing.
//
// So every entry now pays on one of four bands rather than on a number chosen
// by feel, and the bands were picked from the total instead of from how any
// single line looked. A full clear of all 232 is worth x68 to global income, or
// x184 once the idle and generator bands fold in — against x38 for the original
// 71. That is the right shape: three times the entries, five times the payout,
// and requirements that now run out to stage 500, a hundred rebirths, every
// node on the tree and eight seasons of showing up.
//
// tests/achievements.test.js holds both the ceiling and the rule that a later
// rung of a ladder never pays less than an earlier one — which is not
// hypothetical, since banding a table that already had hand-picked values in it
// inverted four ladders on the first attempt.
const SMALL = 1.005;
const STEP = 1.02;
const BIG = 1.04;
const CAPSTONE = 1.09;

export const ACHIEVEMENTS = [
  // ------------------------------------------------------------------ taps
  { id: 'firstTap', name: 'First Contact', blurb: 'You tapped the capybara. It did not mind.', group: 'Tapping', req: { clicks: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'tap100', name: 'Getting Comfortable', blurb: '100 taps. A rhythm is forming.', group: 'Tapping', req: { clicks: 100 }, reward: { type: 'clickMult', value: SMALL } },
  { id: 'tap1k', name: 'Dedicated Petter', blurb: 'A thousand taps and counting.', group: 'Tapping', req: { clicks: 1e3 }, reward: { type: 'clickMult', value: STEP } },
  { id: 'tap10k', name: 'Repetitive Strain', blurb: 'Ten thousand. Consider stretching.', group: 'Tapping', req: { clicks: 10e3 }, reward: { type: 'clickMult', value: BIG } },
  { id: 'tap100k', name: 'Paw Legend', blurb: 'A hundred thousand taps. The pond knows your name.', group: 'Tapping', req: { clicks: 100e3 }, reward: { type: 'clickMult', value: CAPSTONE } },
  { id: 'tap1m', name: 'The Tapping', blurb: 'One million. There is no going back now.', group: 'Tapping', req: { clicks: 1e6 }, reward: { type: 'clickMult', value: CAPSTONE } },

  // ------------------------------------------------------------------- zen
  { id: 'zen1k', name: 'Pocket Change', blurb: 'Earned 1,000 zen.', group: 'Tapping', req: { lifetimeZen: 1e3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'zen1m', name: 'Comfortably Off', blurb: 'Earned a million zen.', group: 'Tapping', req: { lifetimeZen: 1e6 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'zen1b', name: 'Bath Baron', blurb: 'Earned a billion zen.', group: 'Tapping', req: { lifetimeZen: 1e9 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'zen1t', name: 'Onsen Tycoon', blurb: 'Earned a trillion zen.', group: 'Tapping', req: { lifetimeZen: 1e12 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'zen1qa', name: 'Absurdly Serene', blurb: 'Earned a quadrillion zen.', group: 'Tapping', req: { lifetimeZen: 1e15 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'zen1qi', name: 'Beyond Counting', blurb: 'Earned a quintillion zen.', group: 'Tapping', req: { lifetimeZen: 1e18 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------ generators
  { id: 'firstBuild', name: 'Landlord', blurb: 'Bought your first generator.', group: 'The Pond', req: { buildings: 1 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'build25', name: 'Small Estate', blurb: '25 generators owned.', group: 'The Pond', req: { buildings: 25 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'build100', name: 'Pond Developer', blurb: '100 generators owned.', group: 'The Pond', req: { buildings: 100 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'build250', name: 'Regional Authority', blurb: '250 generators owned.', group: 'The Pond', req: { buildings: 250 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'build500', name: 'Bath Empire', blurb: '500 generators owned.', group: 'The Pond', req: { buildings: 500 }, reward: { type: 'zpsMult', value: STEP } },
  { id: 'build1000', name: 'Continental Soak', blurb: '1,000 generators owned.', group: 'The Pond', req: { buildings: 1000 }, reward: { type: 'zpsMult', value: CAPSTONE } },
  { id: 'lily50', name: 'Pad Life', blurb: 'Own 50 Lily Pads.', group: 'The Pond', req: { building: { id: 'lilypad', count: 50 } }, reward: { type: 'buildingMult', id: 'lilypad', value: 1.5 } },
  { id: 'onsen50', name: 'Full House', blurb: 'Own 50 Onsen Basins.', group: 'The Pond', req: { building: { id: 'onsenBasin', count: 50 } }, reward: { type: 'buildingMult', id: 'onsenBasin', value: 1.5 } },
  { id: 'diversified', name: 'Diversified', blurb: 'Own at least one of every generator.', group: 'The Pond', req: { everyBuilding: 1 }, reward: { type: 'globalMult', value: STEP } },

  // ---------------------------------------------------------------- combos
  { id: 'combo10', name: 'In The Groove', blurb: 'Reached a 10× combo.', group: 'Tapping', req: { combo: 10 }, reward: { type: 'comboCap', value: 5 } },
  { id: 'combo25', name: 'Unbroken', blurb: 'Reached a 25× combo.', group: 'Tapping', req: { combo: 25 }, reward: { type: 'comboStep', value: 0.005 } },
  { id: 'combo50', name: 'Trance State', blurb: 'Reached a 50× combo.', group: 'Tapping', req: { combo: 50 }, reward: { type: 'comboStep', value: 0.005 } },

  // ------------------------------------------------------------------ crit
  { id: 'firstCrit', name: 'Lucky Strike', blurb: 'Landed your first critical tap.', group: 'Tapping', req: { crits: 1 }, reward: { type: 'critChance', value: 0.01 } },
  { id: 'crit1k', name: 'Sharp All Over', blurb: 'Landed 1,000 critical taps.', group: 'Tapping', req: { crits: 1e3 }, reward: { type: 'critDamage', value: 0.25 } },

  // ---------------------------------------------------------------- golden
  { id: 'firstGolden', name: 'Caught One', blurb: 'Clicked a Golden Capybara.', group: 'Tapping', req: { goldens: 1 }, reward: { type: 'goldenChance', value: 0.1 } },
  { id: 'golden25', name: 'Sharp Eyed', blurb: 'Clicked 25 Golden Capybaras.', group: 'Tapping', req: { goldens: 25 }, reward: { type: 'goldenDuration', value: 0.25 } },
  { id: 'golden100', name: 'They Come To You Now', blurb: 'Clicked 100 Golden Capybaras.', group: 'Tapping', req: { goldens: 100 }, reward: { type: 'goldenChance', value: 0.25 } },

  // --------------------------------------------------------------- offline
  { id: 'firstNap', name: 'Well Rested', blurb: 'Collected your first Nap Report.', group: 'The Cache', req: { naps: 1 }, reward: { type: 'offlineRate', value: 0.05 } },
  { id: 'nap10', name: 'Professional Sleeper', blurb: 'Collected 10 Nap Reports.', group: 'The Cache', req: { naps: 10 }, reward: { type: 'offlineCapHours', value: 2 } },

  // --------------------------------------------------------------- upgrades
  { id: 'upgrade10', name: 'Shopper', blurb: 'Bought 10 upgrades.', group: 'The Pond', req: { upgrades: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'upgrade40', name: 'Completionist Streak', blurb: 'Bought 40 upgrades.', group: 'The Pond', req: { upgrades: 40 }, reward: { type: 'globalMult', value: SMALL } },

  // ----------------------------------------------------------------- combat
  { id: 'firstFight', name: 'Picked A Fight', blurb: 'Cleared your first stage.', group: 'The Run', req: { clears: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'clear50', name: 'Getting Handy', blurb: 'Cleared 50 stages.', group: 'The Run', req: { clears: 50 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'clear500', name: 'Veteran Bather', blurb: 'Cleared 500 stages.', group: 'The Run', req: { clears: 500 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'clear2500', name: 'Nothing Left To Prove', blurb: 'Cleared 2,500 stages.', group: 'The Run', req: { clears: 2500 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'firstBoss', name: 'Regicide', blurb: 'Beat the Reed King.', group: 'The Run', req: { bossKills: 1 }, reward: { type: 'clickMult', value: STEP } },
  { id: 'boss5', name: 'Serial Deposer', blurb: 'Beat 5 bosses.', group: 'The Run', req: { bossKills: 5 }, reward: { type: 'zpsMult', value: STEP } },
  { id: 'boss12', name: 'The Whole Pond', blurb: 'Beat every boss in the game.', group: 'The Run', req: { bossKills: 12 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'stage25', name: 'Downstream', blurb: 'Reached stage 25.', group: 'The Run', req: { stage: 3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'stage60', name: 'Deep Water', blurb: 'Reached stage 60.', group: 'The Run', req: { stage: 8 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'stage100', name: 'The Still Point', blurb: 'Reached stage 100.', group: 'The Run', req: { stage: 14 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'level10', name: 'Growing Up', blurb: 'Reached level 10.', group: 'The Run', req: { level: 10 }, reward: { type: 'clickMult', value: SMALL } },
  { id: 'level30', name: 'Full Grown', blurb: 'Reached level 30.', group: 'The Run', req: { level: 30 }, reward: { type: 'clickMult', value: BIG } },
  { id: 'level60', name: 'Absolute Unit', blurb: 'Reached level 60.', group: 'The Run', req: { level: 60 }, reward: { type: 'globalMult', value: CAPSTONE } },

  // ------------------------------------------------------------------- gear
  { id: 'firstDrop', name: 'Finders Keepers', blurb: 'Picked up your first piece of gear.', group: 'The Kit', req: { drops: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'drop100', name: 'Hoarder', blurb: 'Picked up 100 pieces of gear.', group: 'The Kit', req: { drops: 100 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fullKit', name: 'Dressed For It', blurb: 'Filled all six equipment slots.', group: 'The Kit', req: { slotsFilled: 6 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'firstForge', name: 'Sparks', blurb: 'Enhanced a piece of gear.', group: 'The Kit', req: { forges: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'forge100', name: 'Smith', blurb: 'Enhanced gear 100 times.', group: 'The Kit', req: { forges: 100 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'maxForge', name: 'Plus Fifteen', blurb: 'Took a piece to +15.', group: 'The Kit', req: { maxForge: 1 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'legendary', name: 'It Glows', blurb: 'Found a Legendary piece.', group: 'The Kit', req: { rarityFound: 'Legendary' }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'mythic', name: 'Genuinely Rare', blurb: 'Found a Mythic piece.', group: 'The Kit', req: { rarityFound: 'Mythic' }, reward: { type: 'globalMult', value: STEP } },
  { id: 'celestial', name: 'Above The Weather', blurb: 'Found a Celestial piece.', group: 'The Kit', req: { rarityFound: 'Celestial' }, reward: { type: 'globalMult', value: BIG } },
  { id: 'capybaric', name: 'Capybaric', blurb: 'Reached the top rung of the ladder.', group: 'The Kit', req: { rarityFound: 'Capybaric' }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'twoStar', name: 'Second Star', blurb: 'Refined a piece to two stars.', group: 'The Kit', req: { stars: 2 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fiveStar', name: 'The Full Five', blurb: 'Refined a piece to five stars.', group: 'The Kit', req: { stars: 5 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'firstFuse', name: 'Three Into One', blurb: 'Fused a piece up a rung.', group: 'The Kit', req: { fuses: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fuse25', name: 'The Furnace', blurb: 'Fused 25 times.', group: 'The Kit', req: { fuses: 25 }, reward: { type: 'globalMult', value: STEP } },

  // ----------------------------------------------------------------- skills
  { id: 'firstSkill', name: 'A Move', blurb: 'Slotted your first skill.', group: 'The Kit', req: { skillsSlotted: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fullLoadout', name: 'Full Loadout', blurb: 'Slotted three skills at once.', group: 'The Kit', req: { skillsSlotted: 3 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------------ zones
  { id: 'zone3', name: 'Three Ponds Over', blurb: 'Reached the Scalding Springs.', group: 'The Run', req: { stage: 2 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'zone6', name: 'Halfway Down', blurb: 'Reached the Night Market.', group: 'The Run', req: { stage: 6 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'zone9', name: 'Above The Clouds', blurb: 'Reached the Sky Terrace.', group: 'The Run', req: { stage: 11 }, reward: { type: 'zpsMult', value: STEP } },
  { id: 'shards10k', name: 'Well Supplied', blurb: 'Banked 10,000 forge shards.', group: 'The Run', req: { shards: 10e3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'richPaws', name: 'Rich Paws', blurb: 'Held a billion zen at one time.', group: 'The Run', req: { heldZen: 1e9 }, reward: { type: 'clickMult', value: STEP } },

  // ------------------------------------------------------- further taps/zen
  { id: 'tap10m', name: 'Ten Million', blurb: 'Ten million taps. The capybara has stopped reacting.', group: 'Tapping', req: { clicks: 10e6 }, reward: { type: 'clickMult', value: CAPSTONE } },
  { id: 'handmade1m', name: 'By Hand', blurb: 'Earned a million zen by tapping alone.', group: 'Tapping', req: { handmade: 1e6 }, reward: { type: 'clickMult', value: SMALL } },
  { id: 'handmade1b', name: 'Artisanal', blurb: 'A billion zen, tapped rather than generated.', group: 'Tapping', req: { handmade: 1e9 }, reward: { type: 'clickMult', value: BIG } },
  { id: 'handmade1t', name: 'Hand Made', blurb: 'A trillion zen, one tap at a time.', group: 'Tapping', req: { handmade: 1e12 }, reward: { type: 'clickMult', value: CAPSTONE } },
  { id: 'zen1sx', name: 'Sextillionaire', blurb: 'Earned a sextillion zen.', group: 'Tapping', req: { lifetimeZen: 1e21 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'zen1sp', name: 'Numbers Stopped Helping', blurb: 'Earned a septillion zen.', group: 'Tapping', req: { lifetimeZen: 1e24 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'zen1e30', name: 'A Nonillion', blurb: 'Earned 1e30 zen. The suffix table is running out.', group: 'Tapping', req: { lifetimeZen: 1e30 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'zen1e45', name: 'Past Naming', blurb: 'Earned 1e45 zen.', group: 'Tapping', req: { lifetimeZen: 1e45 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'zps1m', name: 'Hands Free', blurb: 'Reached a million zen per second.', group: 'Tapping', req: { bestZps: 1e6 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'zps1b', name: 'It Runs Itself', blurb: 'Reached a billion zen per second.', group: 'Tapping', req: { bestZps: 1e9 }, reward: { type: 'zpsMult', value: SMALL } },
  { id: 'zps1t', name: 'Torrent', blurb: 'Reached a trillion zen per second.', group: 'Tapping', req: { bestZps: 1e12 }, reward: { type: 'zpsMult', value: STEP } },
  { id: 'zps1e18', name: 'The Pond Is Full', blurb: 'Reached a quintillion zen per second.', group: 'Tapping', req: { bestZps: 1e18 }, reward: { type: 'zpsMult', value: BIG } },
  { id: 'rich1t', name: 'Liquid', blurb: 'Held a trillion zen at one time.', group: 'Tapping', req: { heldZen: 1e12 }, reward: { type: 'clickMult', value: BIG } },
  { id: 'played10h', name: 'Ten Hours In', blurb: 'Played for ten hours in total.', group: 'Tapping', req: { playMs: 10 * 3600e3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'played100h', name: 'A Hundred Hours', blurb: 'Played for a hundred hours in total.', group: 'Tapping', req: { playMs: 100 * 3600e3 }, reward: { type: 'globalMult', value: STEP } },

  // ----------------------------------------------------- further generators
  { id: 'build2500', name: 'Watershed', blurb: '2,500 generators owned.', group: 'The Pond', req: { buildings: 2500 }, reward: { type: 'zpsMult', value: CAPSTONE } },
  { id: 'build5000', name: 'The Whole Valley', blurb: '5,000 generators owned.', group: 'The Pond', req: { buildings: 5000 }, reward: { type: 'zpsMult', value: CAPSTONE } },
  { id: 'everyTen', name: 'Ten Of Each', blurb: 'Own at least ten of every generator.', group: 'The Pond', req: { everyBuilding: 10 }, reward: { type: 'allBuildingMult', value: 1.06 } },
  { id: 'everyFifty', name: 'Fifty Of Each', blurb: 'Own at least fifty of every generator.', group: 'The Pond', req: { everyBuilding: 50 }, reward: { type: 'allBuildingMult', value: 1.12 } },
  { id: 'everyHundred', name: 'A Hundred Of Each', blurb: 'Own at least a hundred of every generator.', group: 'The Pond', req: { everyBuilding: 100 }, reward: { type: 'allBuildingMult', value: 1.2 } },
  { id: 'lily200', name: 'Pad Empire', blurb: 'Own 200 Lily Pads.', group: 'The Pond', req: { building: { id: 'lilypad', count: 200 } }, reward: { type: 'buildingMult', id: 'lilypad', value: 2 } },
  { id: 'onsen200', name: 'Never Cold Again', blurb: 'Own 200 Onsen Basins.', group: 'The Pond', req: { building: { id: 'onsenBasin', count: 200 } }, reward: { type: 'buildingMult', id: 'onsenBasin', value: 2 } },
  { id: 'tier10', name: 'Reading The Fine Print', blurb: 'Bought 10 generator tier upgrades.', group: 'The Pond', req: { tierUpgrades: 10 }, reward: { type: 'allBuildingMult', value: 1.04 } },
  { id: 'tier30', name: 'All Upgraded', blurb: 'Bought 30 generator tier upgrades.', group: 'The Pond', req: { tierUpgrades: 30 }, reward: { type: 'allBuildingMult', value: 1.1 } },
  { id: 'upgrade100', name: 'Bought The Lot', blurb: 'Bought 100 upgrades.', group: 'The Pond', req: { upgrades: 100 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'costCutter', name: 'Bulk Discount', blurb: 'Bought 500 generators in one lifetime.', group: 'The Pond', req: { buildings: 500 }, reward: { type: 'costDiscount', value: 0.02 } },

  // --------------------------------------------------------- further combat
  { id: 'stage20', name: 'Twenty Down', blurb: 'Reached stage 20.', group: 'The Run', req: { stage: 20 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'stage40', name: 'Past The Shallows', blurb: 'Reached stage 40.', group: 'The Run', req: { stage: 40 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'stage75', name: 'Seventy-Five', blurb: 'Reached stage 75.', group: 'The Run', req: { stage: 75 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'stage150', name: 'A Hundred And Fifty', blurb: 'Reached stage 150.', group: 'The Run', req: { stage: 150 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'stage250', name: 'Deeper Than Sense', blurb: 'Reached stage 250.', group: 'The Run', req: { stage: 250 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'stage500', name: 'Five Hundred', blurb: 'Reached stage 500. There is still no bottom.', group: 'The Run', req: { stage: 500 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'clear10k', name: 'Ten Thousand Fights', blurb: 'Cleared 10,000 levels.', group: 'The Run', req: { clears: 10e3 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'clear50k', name: 'Nothing Personal', blurb: 'Cleared 50,000 levels.', group: 'The Run', req: { clears: 50e3 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'boss50', name: 'Fifty Crowns', blurb: 'Beat 50 bosses.', group: 'The Run', req: { bossKills: 50 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'boss250', name: 'Nobody Left In Charge', blurb: 'Beat 250 bosses.', group: 'The Run', req: { bossKills: 250 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'boss1000', name: 'A Thousand Crowns', blurb: 'Beat 1,000 bosses.', group: 'The Run', req: { bossKills: 1000 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'level100', name: 'Triple Digits', blurb: 'Reached level 100.', group: 'The Run', req: { level: 100 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'level200', name: 'Two Hundred', blurb: 'Reached level 200.', group: 'The Run', req: { level: 200 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'capyFight', name: 'One Of Us', blurb: 'Fought another capybara. Nobody enjoyed it.', group: 'The Run', req: { metCapybara: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'shards1m', name: 'Shard Vault', blurb: 'Banked a million forge shards.', group: 'The Run', req: { shards: 1e6 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------ further kit
  { id: 'drop1k', name: 'Serious Hoarder', blurb: 'Picked up 1,000 pieces of gear.', group: 'The Kit', req: { drops: 1000 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'drop10k', name: 'The Bag Is Full', blurb: 'Picked up 10,000 pieces of gear.', group: 'The Kit', req: { drops: 10e3 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'forge1k', name: 'Master Smith', blurb: 'Enhanced gear 1,000 times.', group: 'The Kit', req: { forges: 1000 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'maxForge6', name: 'Six Times Fifteen', blurb: 'Took six pieces to +15.', group: 'The Kit', req: { maxForge: 6 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'forgeTotal60', name: 'Fully Kitted', blurb: '60 forge levels across the bag.', group: 'The Kit', req: { forgeTotal: 60 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'ancient', name: 'Older Than The Pond', blurb: 'Found an Ancient piece.', group: 'The Kit', req: { rarityFound: 'Ancient' }, reward: { type: 'globalMult', value: BIG } },
  { id: 'astral', name: 'Astral', blurb: 'Found an Astral piece.', group: 'The Kit', req: { rarityFound: 'Astral' }, reward: { type: 'globalMult', value: BIG } },
  { id: 'primordial', name: 'Primordial', blurb: 'Found a Primordial piece.', group: 'The Kit', req: { rarityFound: 'Primordial' }, reward: { type: 'globalMult', value: BIG } },
  { id: 'eternal', name: 'Eternal', blurb: 'Found an Eternal piece.', group: 'The Kit', req: { rarityFound: 'Eternal' }, reward: { type: 'globalMult', value: BIG } },
  { id: 'transcendent', name: 'Transcendent', blurb: 'Found a Transcendent piece.', group: 'The Kit', req: { rarityFound: 'Transcendent' }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'rarity10', name: 'Half The Ladder', blurb: 'Seen ten different rungs of the rarity ladder.', group: 'The Kit', req: { rarities: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'rarity20', name: 'Every Rung', blurb: 'Seen all twenty rungs of the rarity ladder.', group: 'The Kit', req: { rarities: 20 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'threeStar', name: 'Three Stars', blurb: 'Refined a piece to three stars.', group: 'The Kit', req: { stars: 3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fourStar', name: 'Four Stars', blurb: 'Refined a piece to four stars.', group: 'The Kit', req: { stars: 4 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'refine50', name: 'Patient At The Anvil', blurb: 'Attempted 50 refines. Some of them worked.', group: 'The Kit', req: { refines: 50 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fuse100', name: 'The Whole Furnace', blurb: 'Fused 100 times.', group: 'The Kit', req: { fuses: 100 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'tier15held', name: 'Celestial In Hand', blurb: 'Held a rung-16 piece or better.', group: 'The Kit', req: { bestTier: 15 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'tier19held', name: 'Top Of The Ladder', blurb: 'Held a Capybaric piece.', group: 'The Kit', req: { bestTier: 19 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'bag200', name: 'Storage Problem', blurb: 'Carried 200 pieces at once.', group: 'The Kit', req: { bag: 200 }, reward: { type: 'globalMult', value: SMALL } },

  // ---------------------------------------------------------------- rebirth
  { id: 'firstRebirth', name: 'Back To The Water', blurb: 'Rebirthed for the first time.', group: 'Rebirth', req: { rebirths: 1 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'rebirth5', name: 'Round Five', blurb: 'Rebirthed five times.', group: 'Rebirth', req: { rebirths: 5 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'rebirth10', name: 'Ten Lives', blurb: 'Rebirthed ten times.', group: 'Rebirth', req: { rebirths: 10 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'rebirth25', name: 'It Gets Easier', blurb: 'Rebirthed twenty-five times.', group: 'Rebirth', req: { rebirths: 25 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'rebirth50', name: 'Fifty Times Round', blurb: 'Rebirthed fifty times.', group: 'Rebirth', req: { rebirths: 50 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'rebirth100', name: 'A Hundred Ponds', blurb: 'Rebirthed a hundred times.', group: 'Rebirth', req: { rebirths: 100 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'essence1k', name: 'Distilled', blurb: 'Earned 1,000 lifetime Essence.', group: 'Rebirth', req: { lifetimeEssence: 1e3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'essence100k', name: 'Concentrated', blurb: 'Earned 100,000 lifetime Essence.', group: 'Rebirth', req: { lifetimeEssence: 1e5 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'essence10m', name: 'Undiluted', blurb: 'Earned ten million lifetime Essence.', group: 'Rebirth', req: { lifetimeEssence: 1e7 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'tree10', name: 'Taking Root', blurb: 'Bought ten nodes on the tree.', group: 'Rebirth', req: { treeNodes: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'tree50', name: 'Branching Out', blurb: 'Bought fifty nodes on the tree.', group: 'Rebirth', req: { treeNodes: 50 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'tree120', name: 'Well Grown', blurb: 'Bought a hundred and twenty nodes.', group: 'Rebirth', req: { treeNodes: 120 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'tree210', name: 'Every Node', blurb: 'Bought all two hundred and ten nodes.', group: 'Rebirth', req: { treeNodes: 210 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'treeRanks500', name: 'Five Hundred Ranks', blurb: 'Five hundred ranks bought across the tree.', group: 'Rebirth', req: { treeRanks: 500 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'allBranches', name: 'Nothing Left Untouched', blurb: 'Spent Essence in all seven branches.', group: 'Rebirth', req: { branches: 7 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'branchMight', name: 'Might', blurb: 'Sixty ranks in Might.', group: 'Rebirth', req: { branch: { id: 'might', count: 60 } }, reward: { type: 'critDamage', value: 0.4 } },
  { id: 'branchHide', name: 'Hide', blurb: 'Sixty ranks in Hide.', group: 'Rebirth', req: { branch: { id: 'hide', count: 60 } }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'branchFortune', name: 'Fortune', blurb: 'Sixty ranks in Fortune.', group: 'Rebirth', req: { branch: { id: 'fortune', count: 60 } }, reward: { type: 'goldenChance', value: 0.2 } },
  { id: 'branchFlow', name: 'Flow', blurb: 'Sixty ranks in Flow.', group: 'Rebirth', req: { branch: { id: 'flow', count: 60 } }, reward: { type: 'comboStep', value: 0.01 } },
  { id: 'branchCommerce', name: 'Commerce', blurb: 'Sixty ranks in Commerce.', group: 'Rebirth', req: { branch: { id: 'commerce', count: 60 } }, reward: { type: 'zpsMult', value: BIG } },
  { id: 'branchInstinct', name: 'Instinct', blurb: 'Sixty ranks in Instinct.', group: 'Rebirth', req: { branch: { id: 'instinct', count: 60 } }, reward: { type: 'clickMult', value: CAPSTONE } },
  { id: 'branchLegacy', name: 'Legacy', blurb: 'Sixty ranks in Legacy.', group: 'Rebirth', req: { branch: { id: 'legacy', count: 60 } }, reward: { type: 'globalMult', value: BIG } },
  { id: 'deepBranch150', name: 'Specialist', blurb: 'A hundred and fifty ranks in a single branch.', group: 'Rebirth', req: { deepestBranch: 150 }, reward: { type: 'globalMult', value: BIG } },

  // -------------------------------------------------------------- ascension
  { id: 'firstAscend', name: 'The Still Point', blurb: 'Ascended for the first time.', group: 'Ascension', req: { ascensions: 1 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'ascend5', name: 'Five Times Still', blurb: 'Ascended five times.', group: 'Ascension', req: { ascensions: 5 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'ascend20', name: 'Twenty Times Still', blurb: 'Ascended twenty times.', group: 'Ascension', req: { ascensions: 20 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'lotus100', name: 'A Hundred Lotus', blurb: 'Earned a hundred lifetime Lotus.', group: 'Ascension', req: { lifetimeLotus: 100 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'constellation12', name: 'The Whole Sky', blurb: 'Bought a rank in all twelve constellations.', group: 'Ascension', req: { constellations: 12 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'constellation60', name: 'Star Charted', blurb: 'Sixty constellation ranks.', group: 'Ascension', req: { constellations: 60 }, reward: { type: 'globalMult', value: CAPSTONE } },

  // ------------------------------------------------------------- the leafs
  { id: 'firstLeaf', name: 'One Leaf', blurb: 'Earned your first leaf. It cost nothing, like all of them.', group: 'The Store', req: { lifetimeLeafs: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'leaf1k', name: 'A Thousand Leafs', blurb: 'Earned a thousand leafs.', group: 'The Store', req: { lifetimeLeafs: 1000 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'leaf10k', name: 'Ten Thousand Leafs', blurb: 'Earned ten thousand leafs.', group: 'The Store', req: { lifetimeLeafs: 10e3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'leaf50k', name: 'Leaf Pile', blurb: 'Earned fifty thousand leafs.', group: 'The Store', req: { lifetimeLeafs: 50e3 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'spent5k', name: 'Spent It', blurb: 'Spent five thousand leafs.', group: 'The Store', req: { leafsSpent: 5000 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'hoardLeafs', name: 'Saving Up', blurb: 'Held five thousand leafs at once.', group: 'The Store', req: { leafs: 5000 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------- the cases
  { id: 'firstCase', name: 'Opened One', blurb: 'Opened your first case.', group: 'The Store', req: { cases: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'reed10', name: 'Reed Regular', blurb: 'Opened ten Reed Cases.', group: 'The Store', req: { case: { id: 'reed', count: 10 } }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'reed100', name: 'Reed Devotee', blurb: 'Opened a hundred Reed Cases.', group: 'The Store', req: { case: { id: 'reed', count: 100 } }, reward: { type: 'globalMult', value: STEP } },
  { id: 'onsen10', name: 'Onsen Regular', blurb: 'Opened ten Onsen Cases.', group: 'The Store', req: { case: { id: 'onsen', count: 10 } }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'onsenCase50', name: 'Onsen Devotee', blurb: 'Opened fifty Onsen Cases.', group: 'The Store', req: { case: { id: 'onsen', count: 50 } }, reward: { type: 'globalMult', value: STEP } },
  { id: 'astral10', name: 'Astral Regular', blurb: 'Opened ten Astral Cases.', group: 'The Store', req: { case: { id: 'astral', count: 10 } }, reward: { type: 'globalMult', value: STEP } },
  { id: 'astral50', name: 'Astral Devotee', blurb: 'Opened fifty Astral Cases.', group: 'The Store', req: { case: { id: 'astral', count: 50 } }, reward: { type: 'globalMult', value: BIG } },
  { id: 'allCases', name: 'Tried Them All', blurb: 'Opened at least one of every case.', group: 'The Store', req: { caseKinds: 3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'case250', name: 'Two Hundred And Fifty', blurb: 'Opened 250 cases in total.', group: 'The Store', req: { cases: 250 }, reward: { type: 'globalMult', value: BIG } },

  // ------------------------------------------------------------ the looks
  { id: 'firstLook', name: 'Dressed Up', blurb: 'Owned your first cosmetic.', group: 'The Store', req: { cosmetics: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'looks10', name: 'A Wardrobe', blurb: 'Owned ten cosmetics.', group: 'The Store', req: { cosmetics: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'looks24', name: 'Every Look', blurb: 'Owned twenty-four cosmetics.', group: 'The Store', req: { cosmetics: 24 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'firstBoost', name: 'A Little Help', blurb: 'Bought your first boost.', group: 'The Store', req: { boosts: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'boost50', name: 'Boosted', blurb: 'Bought fifty boosts.', group: 'The Store', req: { boosts: 50 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------ the season
  { id: 'pass10', name: 'Ten Levels In', blurb: 'Reached pass level 10.', group: 'The Season', req: { passLevel: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'pass50', name: 'Halfway Up', blurb: 'Reached pass level 50.', group: 'The Season', req: { passLevel: 50 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'pass100', name: 'Topped Out', blurb: 'Reached pass level 100.', group: 'The Season', req: { passLevel: 100 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'premium', name: 'Both Tracks', blurb: 'Unlocked a premium track. It cost leafs, not money.', group: 'The Season', req: { passPremium: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'season2', name: 'Second Season', blurb: 'Played through a season rollover.', group: 'The Season', req: { passSeasons: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'season5', name: 'Five Seasons', blurb: 'Been here for five seasons.', group: 'The Season', req: { passSeasons: 5 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'season8', name: 'A Regular', blurb: 'Been here for eight seasons.', group: 'The Season', req: { passSeasons: 8 }, reward: { type: 'globalMult', value: CAPSTONE } },

  // ------------------------------------------------------------- the events
  { id: 'firstPetal', name: 'In Season', blurb: 'Earned your first petal.', group: 'The Season', req: { petals: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'petal1k', name: 'Petal Gatherer', blurb: 'Earned a thousand petals.', group: 'The Season', req: { petals: 1000 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'petal10k', name: 'Festival Fixture', blurb: 'Earned ten thousand petals.', group: 'The Season', req: { petals: 10e3 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'firstExchange', name: 'Traded Up', blurb: 'Spent petals at an event exchange.', group: 'The Season', req: { eventBuys: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'exchange10', name: 'Cleared The Stall', blurb: 'Bought ten things from event exchanges.', group: 'The Season', req: { eventBuys: 10 }, reward: { type: 'globalMult', value: SMALL } },

  // ---------------------------------------------------------- coming back
  { id: 'streak3', name: 'Three Days', blurb: 'A three-day login streak.', group: 'Coming Back', req: { streak: 3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'streak7', name: 'A Full Week', blurb: 'A seven-day login streak.', group: 'Coming Back', req: { streak: 7 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'streak30', name: 'A Month Of Mornings', blurb: 'A thirty-day login streak.', group: 'Coming Back', req: { streak: 30 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'logins50', name: 'Fifty Visits', blurb: 'Logged in on fifty separate days.', group: 'Coming Back', req: { logins: 50 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'logins200', name: 'Two Hundred Visits', blurb: 'Logged in on two hundred separate days.', group: 'Coming Back', req: { logins: 200 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'quest10', name: 'Errand Runner', blurb: 'Finished ten quests.', group: 'Coming Back', req: { quests: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'quest100', name: 'Odd Jobs', blurb: 'Finished a hundred quests.', group: 'Coming Back', req: { quests: 100 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'quest500', name: 'Ask Anyone', blurb: 'Finished five hundred quests.', group: 'Coming Back', req: { quests: 500 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'chest10', name: 'Opened Ten', blurb: 'Opened ten timed chests.', group: 'Coming Back', req: { chests: 10 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'chest100', name: 'Opened A Hundred', blurb: 'Opened a hundred timed chests.', group: 'Coming Back', req: { chests: 100 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'code1', name: 'Somebody Told You', blurb: 'Redeemed a secret code.', group: 'Coming Back', req: { codes: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'codeAll', name: 'Read Everything', blurb: 'Redeemed all eight secret codes.', group: 'Coming Back', req: { codes: 8 }, reward: { type: 'globalMult', value: STEP }, secret: true },

  // ------------------------------------------------------------- the cache
  { id: 'cache1', name: 'It Kept Running', blurb: 'Collected the cache for the first time.', group: 'The Cache', req: { cacheZen: 1 }, reward: { type: 'offlineRate', value: 0.02 } },
  { id: 'cache1b', name: 'Absent Landlord', blurb: 'Collected a billion zen from the cache.', group: 'The Cache', req: { cacheZen: 1e9 }, reward: { type: 'offlineRate', value: 0.03 } },
  { id: 'cache1t', name: 'Sleeps Well', blurb: 'Collected a trillion zen from the cache.', group: 'The Cache', req: { cacheZen: 1e12 }, reward: { type: 'offlineCapHours', value: 1 } },
  { id: 'cache1e18', name: 'The Pond Manages', blurb: 'Collected a quintillion zen from the cache.', group: 'The Cache', req: { cacheZen: 1e18 }, reward: { type: 'offlineCapHours', value: 2 } },
  { id: 'nap50', name: 'Fifty Naps', blurb: 'Collected fifty naps.', group: 'The Cache', req: { naps: 50 }, reward: { type: 'offlineRate', value: 0.03 } },
  { id: 'nap250', name: 'Chronically Rested', blurb: 'Collected two hundred and fifty naps.', group: 'The Cache', req: { naps: 250 }, reward: { type: 'offlineCapHours', value: 2 } },
  { id: 'overflowed', name: 'It Spilled', blurb: 'Filled the cache to the brim and lost the rest.', group: 'The Cache', req: { spilled: 1 }, reward: { type: 'offlineCapHours', value: 1 }, secret: true },

  // ----------------------------------------------------------- the summons
  { id: 'firstPull', name: 'Someone Came', blurb: 'Summoned your first capybara.', group: 'Summoning', req: { pulls: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'pull100', name: 'A Hundred Summons', blurb: 'Pulled a hundred times.', group: 'Summoning', req: { pulls: 100 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'pull500', name: 'Five Hundred Summons', blurb: 'Pulled five hundred times.', group: 'Summoning', req: { pulls: 500 }, reward: { type: 'globalMult', value: BIG } },
  { id: 'firstFive', name: 'Five Stars', blurb: 'Summoned a five-star capybara.', group: 'Summoning', req: { fiveStars: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'fiveStars5', name: 'Lucky Streak', blurb: 'Summoned five five-star capybaras.', group: 'Summoning', req: { fiveStars: 5 }, reward: { type: 'globalMult', value: STEP } },
  { id: 'fullParty', name: 'A Party', blurb: 'Filled all three party slots.', group: 'Summoning', req: { party: 3 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'friends12', name: 'Twelve Friends', blurb: 'Twelve different capybaras have turned up.', group: 'Summoning', req: { companions: 12 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'friends24', name: 'Everyone', blurb: 'All twenty-four capybaras have turned up.', group: 'Summoning', req: { companions: 24 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'companion20', name: 'Well Fed', blurb: 'Raised a companion to level 20.', group: 'Summoning', req: { bestCompanion: 20 }, reward: { type: 'globalMult', value: SMALL } },

  // ------------------------------------------------------------- the story
  { id: 'firstBeat', name: 'Someone Spoke', blurb: 'Heard your first story beat.', group: 'The Story', req: { beats: 1 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'actOne', name: 'The Cold Pond', blurb: 'Heard five story beats.', group: 'The Story', req: { beats: 5 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'actTwo', name: 'Downstream', blurb: 'Heard twelve story beats.', group: 'The Story', req: { beats: 12 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'storyDone', name: 'What Happened Upstream', blurb: 'Heard all twenty story beats.', group: 'The Story', req: { beats: 20 }, reward: { type: 'globalMult', value: CAPSTONE } },
  { id: 'taughtUp', name: 'Shown The Ropes', blurb: 'Finished every tutorial step.', group: 'The Story', req: { tutorial: 6 }, reward: { type: 'globalMult', value: SMALL } },
  { id: 'namedYourself', name: 'Your Own Name', blurb: 'Chose a name instead of keeping the one you were given.', group: 'The Story', req: { named: 1 }, reward: { type: 'globalMult', value: SMALL } },

  // ---------------------------------------------------------------- secret
  { id: 'patient', name: 'The Long Soak', blurb: 'Played for two hours in one sitting.', group: 'Secret', req: { sessionMs: 2 * 3600e3 }, reward: { type: 'globalMult', value: SMALL }, secret: true },
  { id: 'idleHands', name: 'Idle Hands', blurb: 'Went five minutes without tapping once.', group: 'Secret', req: { idleMs: 5 * 60e3 }, reward: { type: 'zpsMult', value: SMALL }, secret: true },
  { id: 'pacifist', name: 'Words Not Fists', blurb: 'Reached a million zen before winning a single fight.', group: 'Secret', req: { pacifist: true }, reward: { type: 'zpsMult', value: STEP }, secret: true },
  { id: 'elementalist', name: 'Elementalist', blurb: 'Fought in all five elemental stances.', group: 'Secret', req: { stances: 5 }, reward: { type: 'globalMult', value: SMALL }, secret: true },
  { id: 'marathon', name: 'The Very Long Soak', blurb: 'Played for six hours in one sitting. Please drink something.', group: 'Secret', req: { sessionMs: 6 * 3600e3 }, reward: { type: 'globalMult', value: SMALL }, secret: true },
  { id: 'trulyIdle', name: 'Gone Fishing', blurb: 'Went an hour without tapping once.', group: 'Secret', req: { idleMs: 3600e3 }, reward: { type: 'zpsMult', value: STEP }, secret: true },
  { id: 'unarmed', name: 'Bare Paws', blurb: 'Reached stage 10 without filling a single gear slot.', group: 'Secret', req: { unarmed: true }, reward: { type: 'globalMult', value: STEP }, secret: true },
  { id: 'loyalist', name: 'Free Rider', blurb: 'Reached pass level 60 without ever unlocking a premium track.', group: 'Secret', req: { loyalist: true }, reward: { type: 'globalMult', value: STEP }, secret: true },
  { id: 'noSpend', name: 'Thrifty', blurb: 'Banked 3,000 leafs without ever having spent one.', group: 'Secret', req: { thrifty: true }, reward: { type: 'globalMult', value: SMALL }, secret: true },
  { id: 'listener', name: 'Listener', blurb: 'Heard every story beat without ever skipping one.', group: 'Secret', req: { listener: true }, reward: { type: 'globalMult', value: STEP }, secret: true },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ---------------------------------------------------------------- counters

/**
 * Every scalar an achievement is allowed to test, in one flat read.
 *
 * The table above passed two hundred entries, and a two-hundred-branch if-chain
 * is somewhere bugs go to live quietly. So requirements are now almost all
 * `{ counterName: threshold }` against this map, and a test asserts that every
 * key any requirement names actually exists here — which means a typo fails the
 * suite rather than producing an achievement nobody can ever earn.
 *
 * Anything genuinely not a "how many" — own one of every generator, have you
 * ever seen a Mythic, did you get there without wearing anything — stays a
 * named predicate below.
 */
export function counters(state) {
  const s = state.stats || {};
  const c = state.combat || {};
  const g = state.gacha || {};
  const inventory = c.inventory || [];
  const buildingCounts = Object.values(state.buildings || {});

  const treeRanks = Object.values(state.tree || {});
  const branchSpend = branchRanks(state);
  const casesOpened = Object.values(state.cases || {}).map((entry) => entry.opened || 0);
  const companionLevels = Object.values(g.companions || {}).map((entry) => entry.level || 1);

  return {
    // --- the clicker
    clicks: state.lifetimeClicks,
    lifetimeZen: state.totalZen,
    heldZen: state.zen,
    handmade: s.handmadeZen,
    bestZps: s.bestZps,
    playMs: s.playMs,
    sessionMs: s.sessionMs,
    idleMs: s.bestIdleMs,
    crits: s.crits,
    goldens: s.goldens,
    naps: s.naps,
    combo: s.bestCombo,

    // --- the pond
    buildings: buildingCounts.reduce((a, b) => a + b, 0),
    everyBuildingMin: buildingCounts.length ? Math.min(...buildingCounts) : 0,
    upgrades: Object.keys(state.clickUpgrades || {}).length + Object.keys(state.tierUpgrades || {}).length,
    tierUpgrades: Object.keys(state.tierUpgrades || {}).length,

    // --- the run
    clears: c.clears,
    bossKills: c.bossKills,
    stage: Math.floor((c.bestDepth || 0) / LEVELS_PER_STAGE),
    depth: c.bestDepth,
    level: s.bestLevel,
    shards: c.shards,
    stances: (s.stancesUsed || []).length,
    skillsSlotted: (c.skills || []).length,
    metCapybara: s.metCapybara,

    // --- the kit
    drops: s.drops,
    forges: s.forges,
    maxForge: s.maxForges,
    fuses: s.fuses,
    refines: s.refines,
    stars: s.bestStars,
    rarities: (s.raritiesFound || []).length,
    slotsFilled: Object.keys(c.equipped || {}).length,
    bag: inventory.length,
    bestTier: inventory.reduce((best, item) => Math.max(best, item.tier || 0), 0),
    forgeTotal: inventory.reduce((sum, item) => sum + (item.forge || 0), 0),

    // --- the resets
    essence: state.essence,
    lifetimeEssence: state.lifetimeEssence,
    rebirths: state.rebirthCount,
    treeNodes: treeRanks.length,
    treeRanks: treeRanks.reduce((a, b) => a + b, 0),
    branches: Object.keys(branchSpend).length,
    deepestBranch: Object.values(branchSpend).reduce((a, b) => Math.max(a, b), 0),
    lotus: state.lotus,
    lifetimeLotus: state.lifetimeLotus,
    ascensions: state.ascendCount,
    constellations: Object.values(state.constellations || {}).reduce((a, b) => a + b, 0),

    // --- the economy
    leafs: state.leafs,
    lifetimeLeafs: state.lifetimeLeafs,
    // Leafs only enter by being earned and only leave by being spent, so the
    // difference is the lifetime spend without needing a counter of its own.
    leafsSpent: Math.max(0, (state.lifetimeLeafs || 0) - (state.leafs || 0)),
    cases: casesOpened.reduce((a, b) => a + b, 0),
    caseKinds: casesOpened.filter((n) => n > 0).length,
    boosts: s.boosts,
    cosmetics: (state.cosmetics?.owned || []).length,

    // --- the season
    passLevel: state.pass?.bestLevel || 0,
    passSeasons: (state.pass?.history || []).length,
    passPremium: state.pass?.premium ? 1 : 0,
    petals: s.petals,
    eventBuys: Object.keys(state.events?.claimed || {}).length,

    // --- coming back
    quests: s.questsDone,
    streak: state.login?.best || 0,
    logins: state.login?.total || 0,
    chests: state.chest?.opened || 0,
    codes: Object.keys(state.codes || {}).length,

    // --- the wrapping
    beats: Object.keys(state.story?.seen || {}).length,
    tutorial: Object.keys(state.story?.tutorial || {}).length,
    named: state.profile?.name ? 1 : 0,

    // --- the cache
    cacheZen: s.cacheZen,
    bestCache: s.bestCache,
    spilled: (state.cache?.lostMs || 0) > 0 ? 1 : 0,

    // --- summoning
    pulls: g.pulls,
    fiveStars: g.fiveStars,
    companions: Object.keys(g.companions || {}).length,
    party: (g.party || []).length,
    bestCompanion: companionLevels.length ? Math.max(...companionLevels) : 0,
  };
}

/** branch id -> ranks bought in it. */
function branchRanks(state) {
  const out = {};
  for (const [id, ranks] of Object.entries(state.tree || {})) {
    const branch = NODES_BY_ID[id]?.branch;
    if (branch) out[branch] = (out[branch] || 0) + ranks;
  }
  return out;
}

/**
 * The requirements that are not a threshold. Each is a predicate, so adding one
 * is adding a named function rather than another arm of a growing conditional.
 */
const PREDICATES = {
  building: (state, want) => (state.buildings?.[want.id] || 0) >= want.count,
  everyBuilding: (state, want) => counters(state).everyBuildingMin >= want,
  rarityFound: (state, want) => (state.stats?.raritiesFound || []).includes(want),
  case: (state, want) => (state.cases?.[want.id]?.opened || 0) >= want.count,
  branch: (state, want) => (branchRanks(state)[want.id] || 0) >= want.count,

  // Reaching a million zen while still 0-for-0 in the arena.
  pacifist: (state) => state.totalZen >= 1e6 && (state.combat?.clears || 0) === 0,
  // Ten stages deep with every slot still empty.
  unarmed: (state) =>
    Math.floor((state.combat?.bestDepth || 0) / LEVELS_PER_STAGE) >= 10 &&
    Object.keys(state.combat?.equipped || {}).length === 0,
  // Sixty levels of pass without ever having taken the premium track — on any
  // season, which is why it reads history as well as the live flag.
  loyalist: (state) =>
    (state.pass?.bestLevel || 0) >= 60 &&
    !state.pass?.premium &&
    !(state.pass?.history || []).some((h) => h.premium),
  thrifty: (state) => (state.leafs || 0) >= 3000 && (state.lifetimeLeafs || 0) <= (state.leafs || 0),
  // Every beat heard, with the skip toggle never turned on.
  listener: (state) => Object.keys(state.story?.seen || {}).length >= 20 && !state.story?.skip,
};

/** Requirement keys that name a predicate rather than a counter. */
export const PREDICATE_KEYS = new Set(Object.keys(PREDICATES));

/** Every counter name a requirement is allowed to use. */
export const COUNTER_KEYS = new Set(Object.keys(counters({})));

/**
 * Achievement conditions reach into counters that ordinary unlock requirements
 * do not, so they get their own evaluator.
 */
export function achievementMet(ach, state) {
  for (const [key, want] of Object.entries(ach.req)) {
    const predicate = PREDICATES[key];
    if (predicate) {
      if (!predicate(state, want)) return false;
      continue;
    }
    if (!((counters(state)[key] || 0) >= want)) return false;
  }
  return true;
}
