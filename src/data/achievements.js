// Achievements are not badges — every one of them pays. That is what makes the
// list worth grinding instead of worth ignoring.
// This table grows as later systems land (combat, gacha, prestige).

export const ACHIEVEMENTS = [
  // ------------------------------------------------------------------ taps
  { id: 'firstTap', name: 'First Contact', blurb: 'You tapped the capybara. It did not mind.', req: { clicks: 1 }, reward: { type: 'globalMult', value: 1.01 } },
  { id: 'tap100', name: 'Getting Comfortable', blurb: '100 taps. A rhythm is forming.', req: { clicks: 100 }, reward: { type: 'clickMult', value: 1.05 } },
  { id: 'tap1k', name: 'Dedicated Petter', blurb: 'A thousand taps and counting.', req: { clicks: 1e3 }, reward: { type: 'clickMult', value: 1.1 } },
  { id: 'tap10k', name: 'Repetitive Strain', blurb: 'Ten thousand. Consider stretching.', req: { clicks: 10e3 }, reward: { type: 'clickMult', value: 1.15 } },
  { id: 'tap100k', name: 'Paw Legend', blurb: 'A hundred thousand taps. The pond knows your name.', req: { clicks: 100e3 }, reward: { type: 'clickMult', value: 1.25 } },
  { id: 'tap1m', name: 'The Tapping', blurb: 'One million. There is no going back now.', req: { clicks: 1e6 }, reward: { type: 'clickMult', value: 1.5 } },

  // ------------------------------------------------------------------- zen
  { id: 'zen1k', name: 'Pocket Change', blurb: 'Earned 1,000 zen.', req: { lifetimeZen: 1e3 }, reward: { type: 'globalMult', value: 1.01 } },
  { id: 'zen1m', name: 'Comfortably Off', blurb: 'Earned a million zen.', req: { lifetimeZen: 1e6 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'zen1b', name: 'Bath Baron', blurb: 'Earned a billion zen.', req: { lifetimeZen: 1e9 }, reward: { type: 'globalMult', value: 1.03 } },
  { id: 'zen1t', name: 'Onsen Tycoon', blurb: 'Earned a trillion zen.', req: { lifetimeZen: 1e12 }, reward: { type: 'globalMult', value: 1.04 } },
  { id: 'zen1qa', name: 'Absurdly Serene', blurb: 'Earned a quadrillion zen.', req: { lifetimeZen: 1e15 }, reward: { type: 'globalMult', value: 1.06 } },
  { id: 'zen1qi', name: 'Beyond Counting', blurb: 'Earned a quintillion zen.', req: { lifetimeZen: 1e18 }, reward: { type: 'globalMult', value: 1.08 } },

  // ------------------------------------------------------------ generators
  { id: 'firstBuild', name: 'Landlord', blurb: 'Bought your first generator.', req: { buildings: 1 }, reward: { type: 'zpsMult', value: 1.02 } },
  { id: 'build25', name: 'Small Estate', blurb: '25 generators owned.', req: { buildings: 25 }, reward: { type: 'zpsMult', value: 1.03 } },
  { id: 'build100', name: 'Pond Developer', blurb: '100 generators owned.', req: { buildings: 100 }, reward: { type: 'zpsMult', value: 1.05 } },
  { id: 'build250', name: 'Regional Authority', blurb: '250 generators owned.', req: { buildings: 250 }, reward: { type: 'zpsMult', value: 1.08 } },
  { id: 'build500', name: 'Bath Empire', blurb: '500 generators owned.', req: { buildings: 500 }, reward: { type: 'zpsMult', value: 1.12 } },
  { id: 'build1000', name: 'Continental Soak', blurb: '1,000 generators owned.', req: { buildings: 1000 }, reward: { type: 'zpsMult', value: 1.2 } },
  { id: 'lily50', name: 'Pad Life', blurb: 'Own 50 Lily Pads.', req: { building: { id: 'lilypad', count: 50 } }, reward: { type: 'buildingMult', id: 'lilypad', value: 1.5 } },
  { id: 'onsen50', name: 'Full House', blurb: 'Own 50 Onsen Basins.', req: { building: { id: 'onsenBasin', count: 50 } }, reward: { type: 'buildingMult', id: 'onsenBasin', value: 1.5 } },
  { id: 'diversified', name: 'Diversified', blurb: 'Own at least one of every generator.', req: { everyBuilding: 1 }, reward: { type: 'globalMult', value: 1.1 } },

  // ---------------------------------------------------------------- combos
  { id: 'combo10', name: 'In The Groove', blurb: 'Reached a 10× combo.', req: { combo: 10 }, reward: { type: 'comboCap', value: 5 } },
  { id: 'combo25', name: 'Unbroken', blurb: 'Reached a 25× combo.', req: { combo: 25 }, reward: { type: 'comboStep', value: 0.005 } },
  { id: 'combo50', name: 'Trance State', blurb: 'Reached a 50× combo.', req: { combo: 50 }, reward: { type: 'comboStep', value: 0.005 } },

  // ------------------------------------------------------------------ crit
  { id: 'firstCrit', name: 'Lucky Strike', blurb: 'Landed your first critical tap.', req: { crits: 1 }, reward: { type: 'critChance', value: 0.01 } },
  { id: 'crit1k', name: 'Sharp All Over', blurb: 'Landed 1,000 critical taps.', req: { crits: 1e3 }, reward: { type: 'critDamage', value: 0.25 } },

  // ---------------------------------------------------------------- golden
  { id: 'firstGolden', name: 'Caught One', blurb: 'Clicked a Golden Capybara.', req: { goldens: 1 }, reward: { type: 'goldenChance', value: 0.1 } },
  { id: 'golden25', name: 'Sharp Eyed', blurb: 'Clicked 25 Golden Capybaras.', req: { goldens: 25 }, reward: { type: 'goldenDuration', value: 0.25 } },
  { id: 'golden100', name: 'They Come To You Now', blurb: 'Clicked 100 Golden Capybaras.', req: { goldens: 100 }, reward: { type: 'goldenChance', value: 0.25 } },

  // --------------------------------------------------------------- offline
  { id: 'firstNap', name: 'Well Rested', blurb: 'Collected your first Nap Report.', req: { naps: 1 }, reward: { type: 'offlineRate', value: 0.05 } },
  { id: 'nap10', name: 'Professional Sleeper', blurb: 'Collected 10 Nap Reports.', req: { naps: 10 }, reward: { type: 'offlineCapHours', value: 2 } },

  // --------------------------------------------------------------- upgrades
  { id: 'upgrade10', name: 'Shopper', blurb: 'Bought 10 upgrades.', req: { upgrades: 10 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'upgrade40', name: 'Completionist Streak', blurb: 'Bought 40 upgrades.', req: { upgrades: 40 }, reward: { type: 'globalMult', value: 1.05 } },

  // ----------------------------------------------------------------- combat
  { id: 'firstFight', name: 'Picked A Fight', blurb: 'Cleared your first stage.', req: { clears: 1 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'clear50', name: 'Getting Handy', blurb: 'Cleared 50 stages.', req: { clears: 50 }, reward: { type: 'globalMult', value: 1.03 } },
  { id: 'clear500', name: 'Veteran Bather', blurb: 'Cleared 500 stages.', req: { clears: 500 }, reward: { type: 'globalMult', value: 1.06 } },
  { id: 'clear2500', name: 'Nothing Left To Prove', blurb: 'Cleared 2,500 stages.', req: { clears: 2500 }, reward: { type: 'globalMult', value: 1.12 } },
  { id: 'firstBoss', name: 'Regicide', blurb: 'Beat the Reed King.', req: { bossKills: 1 }, reward: { type: 'clickMult', value: 1.1 } },
  { id: 'boss5', name: 'Serial Deposer', blurb: 'Beat 5 bosses.', req: { bossKills: 5 }, reward: { type: 'zpsMult', value: 1.1 } },
  { id: 'boss12', name: 'The Whole Pond', blurb: 'Beat every boss in the game.', req: { bossKills: 12 }, reward: { type: 'globalMult', value: 1.25 } },
  { id: 'stage25', name: 'Downstream', blurb: 'Reached stage 25.', req: { stage: 3 }, reward: { type: 'globalMult', value: 1.03 } },
  { id: 'stage60', name: 'Deep Water', blurb: 'Reached stage 60.', req: { stage: 8 }, reward: { type: 'globalMult', value: 1.06 } },
  { id: 'stage100', name: 'The Still Point', blurb: 'Reached stage 100.', req: { stage: 14 }, reward: { type: 'globalMult', value: 1.15 } },
  { id: 'level10', name: 'Growing Up', blurb: 'Reached level 10.', req: { level: 10 }, reward: { type: 'clickMult', value: 1.08 } },
  { id: 'level30', name: 'Full Grown', blurb: 'Reached level 30.', req: { level: 30 }, reward: { type: 'clickMult', value: 1.15 } },
  { id: 'level60', name: 'Absolute Unit', blurb: 'Reached level 60.', req: { level: 60 }, reward: { type: 'globalMult', value: 1.2 } },

  // ------------------------------------------------------------------- gear
  { id: 'firstDrop', name: 'Finders Keepers', blurb: 'Picked up your first piece of gear.', req: { drops: 1 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'drop100', name: 'Hoarder', blurb: 'Picked up 100 pieces of gear.', req: { drops: 100 }, reward: { type: 'globalMult', value: 1.05 } },
  { id: 'fullKit', name: 'Dressed For It', blurb: 'Filled all six equipment slots.', req: { slotsFilled: 6 }, reward: { type: 'globalMult', value: 1.06 } },
  { id: 'firstForge', name: 'Sparks', blurb: 'Enhanced a piece of gear.', req: { forges: 1 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'forge100', name: 'Smith', blurb: 'Enhanced gear 100 times.', req: { forges: 100 }, reward: { type: 'globalMult', value: 1.06 } },
  { id: 'maxForge', name: 'Plus Fifteen', blurb: 'Took a piece to +15.', req: { maxForge: 1 }, reward: { type: 'globalMult', value: 1.1 } },
  { id: 'legendary', name: 'It Glows', blurb: 'Found a legendary piece.', req: { rarityFound: 'legendary' }, reward: { type: 'globalMult', value: 1.08 } },
  { id: 'mythic', name: 'Genuinely Rare', blurb: 'Found a mythic piece.', req: { rarityFound: 'mythic' }, reward: { type: 'globalMult', value: 1.12 } },
  { id: 'capybaric', name: 'Capybaric', blurb: 'Found a Capybaric piece. There are two.', req: { rarityFound: 'capybaric' }, reward: { type: 'globalMult', value: 1.2 } },

  // ----------------------------------------------------------------- skills
  { id: 'firstSkill', name: 'A Move', blurb: 'Slotted your first skill.', req: { skillsSlotted: 1 }, reward: { type: 'globalMult', value: 1.02 } },
  { id: 'fullLoadout', name: 'Full Loadout', blurb: 'Slotted three skills at once.', req: { skillsSlotted: 3 }, reward: { type: 'globalMult', value: 1.05 } },

  // ------------------------------------------------------------------ zones
  { id: 'zone3', name: 'Three Ponds Over', blurb: 'Reached the Scalding Springs.', req: { stage: 2 }, reward: { type: 'zpsMult', value: 1.04 } },
  { id: 'zone6', name: 'Halfway Down', blurb: 'Reached the Night Market.', req: { stage: 6 }, reward: { type: 'zpsMult', value: 1.08 } },
  { id: 'zone9', name: 'Above The Clouds', blurb: 'Reached the Sky Terrace.', req: { stage: 11 }, reward: { type: 'zpsMult', value: 1.12 } },
  { id: 'shards10k', name: 'Well Supplied', blurb: 'Banked 10,000 forge shards.', req: { shards: 10e3 }, reward: { type: 'globalMult', value: 1.05 } },
  { id: 'richPaws', name: 'Rich Paws', blurb: 'Held a billion zen at one time.', req: { heldZen: 1e9 }, reward: { type: 'clickMult', value: 1.12 } },

  // ---------------------------------------------------------------- secret
  { id: 'patient', name: 'The Long Soak', blurb: 'Played for two hours in one sitting.', req: { sessionMs: 2 * 3600e3 }, reward: { type: 'globalMult', value: 1.05 }, secret: true },
  { id: 'idleHands', name: 'Idle Hands', blurb: 'Went five minutes without tapping once.', req: { idleMs: 5 * 60e3 }, reward: { type: 'zpsMult', value: 1.05 }, secret: true },
  { id: 'pacifist', name: 'Words Not Fists', blurb: 'Reached a million zen before winning a single fight.', req: { pacifist: true }, reward: { type: 'zpsMult', value: 1.1 }, secret: true },
  { id: 'elementalist', name: 'Elementalist', blurb: 'Fought in all five elemental stances.', req: { stances: 5 }, reward: { type: 'globalMult', value: 1.08 }, secret: true },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/**
 * Achievement conditions reach into counters that ordinary unlock requirements
 * do not, so they get their own evaluator.
 */
export function achievementMet(ach, state) {
  const r = ach.req;
  const s = state.stats || {};

  if (r.clicks != null && state.lifetimeClicks < r.clicks) return false;
  if (r.lifetimeZen != null && state.totalZen < r.lifetimeZen) return false;
  if (r.crits != null && (s.crits || 0) < r.crits) return false;
  if (r.goldens != null && (s.goldens || 0) < r.goldens) return false;
  if (r.naps != null && (s.naps || 0) < r.naps) return false;
  if (r.combo != null && (s.bestCombo || 0) < r.combo) return false;
  if (r.sessionMs != null && (s.sessionMs || 0) < r.sessionMs) return false;
  if (r.idleMs != null && (s.bestIdleMs || 0) < r.idleMs) return false;

  // --- combat and gear
  const c = state.combat || {};
  if (r.clears != null && (c.clears || 0) < r.clears) return false;
  if (r.bossKills != null && (c.bossKills || 0) < r.bossKills) return false;
  if (r.stage != null && Math.floor((c.bestDepth || 0) / 10) < r.stage) return false;
  if (r.level != null && (s.bestLevel || 0) < r.level) return false;
  if (r.drops != null && (s.drops || 0) < r.drops) return false;
  if (r.forges != null && (s.forges || 0) < r.forges) return false;
  if (r.maxForge != null && (s.maxForges || 0) < r.maxForge) return false;
  if (r.slotsFilled != null && Object.keys(c.equipped || {}).length < r.slotsFilled) return false;
  if (r.skillsSlotted != null && (c.skills || []).length < r.skillsSlotted) return false;
  if (r.stances != null && (s.stancesUsed || []).length < r.stances) return false;
  if (r.shards != null && (c.shards || 0) < r.shards) return false;
  if (r.heldZen != null && state.zen < r.heldZen) return false;
  if (r.rarityFound != null && !(s.raritiesFound || []).includes(r.rarityFound)) return false;
  // Reaching a million zen while still 0-for-0 in the arena.
  if (r.pacifist && !(state.totalZen >= 1e6 && (c.clears || 0) === 0)) return false;

  if (r.buildings != null) {
    const total = Object.values(state.buildings).reduce((a, b) => a + b, 0);
    if (total < r.buildings) return false;
  }
  if (r.building && (state.buildings[r.building.id] || 0) < r.building.count) return false;
  if (r.everyBuilding != null) {
    const counts = Object.values(state.buildings);
    if (counts.length === 0 || counts.some((c) => c < r.everyBuilding)) return false;
  }
  if (r.upgrades != null) {
    const owned =
      Object.keys(state.clickUpgrades || {}).length + Object.keys(state.tierUpgrades || {}).length;
    if (owned < r.upgrades) return false;
  }

  return true;
}
