// Seasons and the two-track pass.
//
// Two things carry the weight here.
//
// A season is computed from the clock, not stored — there is no server to
// announce a rollover, so every device has to reach the same answer from the
// same epoch. That means the arithmetic has to hold at the boundaries, and the
// tests walk them deliberately rather than sampling the middle of a season and
// hoping.
//
// And a rollover must never take back a look. Losing a season's pass level is
// the deal you signed up for; losing the skin that pass gave you is a betrayal,
// and it is the single most resented thing a live-service game does.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { grantReward } from '../src/systems/rewards.js';
import { owns } from '../src/systems/cosmetics.js';
import {
  SEASON_DAYS, SEASON_MS, SEASON_EPOCH, seasonAt, seasonIndex, seasonName,
} from '../src/data/seasons.js';
import {
  PASS_LEVELS, PASS_XP_PER_LEVEL, PREMIUM_LEAFS, PREMIUM_PRICE, TRACKS, passReward,
} from '../src/data/pass.js';
import {
  season, checkRollover, passLevel, passProgress, addPassXp, passXpForClear,
  canClaim, claimPassLevel, isClaimed, passTrack, unclaimedPassLevels,
  unlockPremium, premiumBacklog,
} from '../src/systems/season.js';

/** A state sitting inside season 0, so rollover is not lurking in every test. */
function inSeason(index = 0) {
  const s = createState();
  s.pass.season = index;
  return s;
}

function midSeason(index = 0) {
  return SEASON_EPOCH + index * SEASON_MS + SEASON_MS / 2;
}

// ------------------------------------------------------------------ the clock

test('a season is 45 days and the index is a pure function of the clock', () => {
  assert.equal(SEASON_DAYS, 45);
  assert.equal(SEASON_MS, 45 * 86400e3);

  assert.equal(seasonIndex(SEASON_EPOCH), 0);
  assert.equal(seasonIndex(SEASON_EPOCH + SEASON_MS - 1), 0);
  assert.equal(seasonIndex(SEASON_EPOCH + SEASON_MS), 1);
  assert.equal(seasonIndex(SEASON_EPOCH + SEASON_MS * 7.5), 7);
});

test('a clock before the epoch lands on season 0 rather than a negative one', () => {
  assert.equal(seasonIndex(SEASON_EPOCH - 1), 0);
  assert.equal(seasonIndex(0), 0);
  assert.equal(seasonAt(SEASON_EPOCH - 86400e3).index, 0);
});

test('the season boundaries line up exactly, with no gap and no overlap', () => {
  for (const index of [0, 1, 9, 40]) {
    const first = seasonAt(SEASON_EPOCH + index * SEASON_MS);
    const last = seasonAt(SEASON_EPOCH + (index + 1) * SEASON_MS - 1);
    const next = seasonAt(SEASON_EPOCH + (index + 1) * SEASON_MS);

    assert.equal(first.index, index);
    assert.equal(last.index, index);
    assert.equal(next.index, index + 1);
    assert.equal(first.endsAt, next.startsAt, 'a season must end exactly where the next begins');
  }
});

test('day and remaining time read as a person would count them', () => {
  const start = seasonAt(SEASON_EPOCH);
  assert.equal(start.day, 1, 'the first day of a season is day 1, not day 0');
  assert.equal(start.msLeft, SEASON_MS);
  assert.equal(start.ratio, 0);

  const end = seasonAt(SEASON_EPOCH + SEASON_MS - 1000);
  assert.equal(end.day, SEASON_DAYS);
  assert.ok(end.ratio > 0.999);
  assert.ok(end.msLeft > 0, 'the last second of a season is still in it');
});

test('season names cycle with a numeral rather than running out', () => {
  const names = new Set();
  for (let i = 0; i < 40; i++) {
    const name = seasonName(i);
    assert.ok(name.length > 0, `season ${i} is nameless`);
    assert.ok(!names.has(name), `duplicate season name "${name}"`);
    names.add(name);
  }
  assert.equal(seasonName(0), seasonName(0));
  assert.match(seasonName(8), / II$/);
  assert.ok(seasonName(500).length > 0, 'the numerals must not run out either');
});

// ---------------------------------------------------------------- rollover

test('a save that has never seen a season adopts the current one quietly', () => {
  const s = createState();
  assert.equal(s.pass.season, null);
  assert.equal(checkRollover(s, midSeason(3)), null, 'this is not a rollover the player lived');
  assert.equal(s.pass.season, 3);
});

test('nothing happens while the season has not changed', () => {
  const s = inSeason(2);
  s.pass.xp = 900;
  assert.equal(checkRollover(s, midSeason(2)), null);
  assert.equal(checkRollover(s, midSeason(2) + 86400e3), null);
  assert.equal(s.pass.xp, 900, 'the pass must not reset mid-season');
});

test('a rollover resets the pass and keeps every look it ever gave', () => {
  const s = inSeason(4);
  s.pass.xp = 5000;
  s.pass.premium = true;
  claimPassLevel(s, 1, 'premium'); // the exclusive skin
  s.pass.claimed.free[3] = true;

  assert.equal(owns(s, 'skin', 'seasonal'), true);

  const rolled = checkRollover(s, midSeason(5));
  assert.ok(rolled, 'the season moved, so something should have rolled');
  assert.equal(rolled.from.index, 4);
  assert.equal(rolled.to.index, 5);

  // reset
  assert.equal(s.pass.xp, 0);
  assert.equal(s.pass.premium, false);
  assert.deepEqual(s.pass.claimed, { free: {}, premium: {} });
  assert.equal(s.pass.season, 5);

  // kept — this is the one that matters
  assert.equal(owns(s, 'skin', 'seasonal'), true, 'a season ending must never take back a look');
});

test('a rollover records what the season was worth', () => {
  const s = inSeason(0);
  s.pass.xp = PASS_XP_PER_LEVEL * 30;
  s.pass.premium = true;
  claimPassLevel(s, 2, 'free');

  checkRollover(s, midSeason(1));
  assert.equal(s.pass.history.length, 1);
  assert.equal(s.pass.history[0].index, 0);
  assert.equal(s.pass.history[0].level, 31);
  assert.equal(s.pass.history[0].premium, true);
  assert.equal(s.pass.history[0].claimed, 1);
  assert.equal(s.pass.bestLevel, 31);
});

test('skipping several seasons rolls over exactly once', () => {
  const s = inSeason(1);
  s.pass.xp = 400;
  const rolled = checkRollover(s, midSeason(9));

  assert.equal(rolled.from.index, 1);
  assert.equal(s.pass.season, 9, 'it lands on the season it is actually in');
  assert.equal(s.pass.history.length, 1, 'a long absence is one rollover, not eight');
  assert.equal(checkRollover(s, midSeason(9)), null, 'and it is idempotent afterwards');
});

test('the history is kept short rather than growing forever', () => {
  const s = inSeason(0);
  for (let i = 1; i <= 20; i++) {
    s.pass.xp = i * PASS_XP_PER_LEVEL;
    checkRollover(s, midSeason(i));
  }
  assert.ok(s.pass.history.length <= 8, `history grew to ${s.pass.history.length}`);
  assert.equal(s.pass.history[0].index, 19, 'newest first');
});

test('season() reports the live season alongside what the save last saw', () => {
  const s = inSeason(3);
  const info = season(s, midSeason(3));
  assert.equal(info.index, 3);
  assert.equal(info.isNew, false);

  const stale = season(s, midSeason(6));
  assert.equal(stale.index, 6);
  assert.equal(stale.seen, 3);
  assert.equal(stale.isNew, true);
});

// -------------------------------------------------------------------- levels

test('the pass runs to a hundred and stops there', () => {
  assert.equal(PASS_LEVELS, 100);
  assert.equal(passLevel(0), 1);
  assert.equal(passLevel(PASS_XP_PER_LEVEL - 1), 1);
  assert.equal(passLevel(PASS_XP_PER_LEVEL), 2);
  assert.equal(passLevel(1e12), PASS_LEVELS);
  assert.equal(passLevel(-500), 1, 'a corrupt negative xp must not produce level 0');
});

test('progress reports the fraction into the level', () => {
  const s = inSeason();
  s.pass.xp = PASS_XP_PER_LEVEL * 2 + PASS_XP_PER_LEVEL / 2;
  const p = passProgress(s);
  assert.equal(p.level, 3);
  assert.equal(p.levels, PASS_LEVELS);
  assert.ok(Math.abs(p.ratio - 0.5) < 1e-9);
  assert.equal(p.maxed, false);

  s.pass.xp = 1e9;
  assert.equal(passProgress(s).maxed, true);
  assert.equal(passProgress(s).ratio, 1);
});

test('the pass moves while you play, and a boss moves it more', () => {
  assert.ok(passXpForClear(true) > passXpForClear(false));
  assert.ok(passXpForClear(false) > 0, 'an ordinary clear should count for something');

  const s = inSeason();
  assert.equal(addPassXp(s, PASS_XP_PER_LEVEL - 1).levelled, false);
  const up = addPassXp(s, 1);
  assert.equal(up.levelled, true);
  assert.equal(up.from, 1);
  assert.equal(up.to, 2);
});

// -------------------------------------------------------------------- claims

test('every level on both tracks pays something real', () => {
  for (const track of TRACKS) {
    for (let level = 1; level <= PASS_LEVELS; level++) {
      const reward = passReward(level, track);
      assert.ok(reward.text, `${track} ${level}: no description`);
      assert.ok(Object.keys(reward).length > 1, `${track} ${level}: nothing but text`);
    }
  }
});

test('the premium track pays more than the free one, without paying for itself', () => {
  // The point of a two-track pass is that the paid side is a bigger version of
  // the free side, not a different game. But a pass that returns more of the
  // currency it was bought with is a loop that eats the store — so premium pays
  // more of everything *except* enough leafs to buy next season's premium.
  const totals = (track) => {
    const out = { leafs: 0, tickets: 0, shards: 0 };
    for (let level = 1; level <= PASS_LEVELS; level++) {
      const reward = passReward(level, track);
      for (const key of Object.keys(out)) out[key] += reward[key] || 0;
    }
    return out;
  };

  const free = totals('free');
  const premium = totals('premium');

  assert.ok(premium.tickets > free.tickets, `premium pays ${premium.tickets} tickets, free pays ${free.tickets}`);
  assert.ok(premium.shards > free.shards, 'premium should pay more shards');
  assert.ok(premium.leafs > free.leafs, 'premium should pay more leafs');
  assert.ok(
    premium.leafs < PREMIUM_LEAFS,
    `premium returns ${premium.leafs} of the ${PREMIUM_LEAFS} it costs — at or above that it buys itself forever`,
  );
});

test('the free track alone gives leafs and looks', () => {
  // The promise is that the free track is a complete pass on its own — not that
  // it holds any particular number of looks. That count went from two to six
  // when the wardrobe landed. What has to stay true is that it pays real leafs
  // and hands out cosmetics nobody spent anything for, each of them once.
  const cosmetics = [];
  let leafs = 0;
  for (let level = 1; level <= PASS_LEVELS; level++) {
    const reward = passReward(level, 'free');
    if (reward.cosmetic) cosmetics.push(reward.cosmetic);
    leafs += reward.leafs || 0;
  }
  assert.ok(cosmetics.length >= 2, `the free track gives only ${cosmetics.length} looks`);
  assert.ok(leafs >= 400, `the free track only pays ${leafs} leafs across a season`);
  assert.equal(new Set(cosmetics).size, cosmetics.length, 'the free track pays a look twice');
});

test('a level claims once, on the track you own', () => {
  const s = inSeason();
  assert.equal(canClaim(s, 5, 'free').reason, 'locked');

  s.pass.xp = PASS_XP_PER_LEVEL * 10;
  assert.equal(canClaim(s, 5, 'premium').reason, 'premium', 'the premium side needs unlocking');

  assert.equal(claimPassLevel(s, 5, 'free').ok, true);
  assert.equal(isClaimed(s, 5, 'free'), true);
  assert.equal(claimPassLevel(s, 5, 'free').reason, 'claimed');
  assert.equal(isClaimed(s, 5, 'premium'), false, 'the two tracks claim separately');

  assert.equal(canClaim(s, 0, 'free').reason, 'unknown');
  assert.equal(canClaim(s, 999, 'free').reason, 'unknown');
});

test('claiming a cosmetic level actually hands the cosmetic over', () => {
  const s = inSeason();
  s.pass.xp = 1e9;
  assert.equal(owns(s, 'pond', 'lantern'), false);
  claimPassLevel(s, 40, 'free');
  assert.equal(owns(s, 'pond', 'lantern'), true);

  unlockPremium(s, { leafs: false });
  claimPassLevel(s, 1, 'premium');
  assert.equal(owns(s, 'skin', 'seasonal'), true);
});

test('a claimed reward pays through the one reward path', () => {
  const s = inSeason();
  s.pass.xp = PASS_XP_PER_LEVEL * 20;
  const derived = recomputeDerived(s);

  const result = claimPassLevel(s, 10, 'free');
  const grant = grantReward(s, result.reward, derived);
  assert.ok(grant.tickets > 0 || grant.shards > 0 || grant.zen > 0);
  assert.equal(s.gacha.tickets, grant.tickets);
  assert.equal(s.combat.shards, grant.shards);
});

test('the badge counts both tracks, and only what is actually claimable', () => {
  const s = inSeason();
  assert.equal(unclaimedPassLevels(s), 1, 'level 1 free is there from the start');

  s.pass.xp = PASS_XP_PER_LEVEL * 4; // level 5
  assert.equal(unclaimedPassLevels(s), 5, 'premium is locked, so it does not count');

  unlockPremium(s, { leafs: false });
  assert.equal(unclaimedPassLevels(s), 10, 'both tracks now');

  claimPassLevel(s, 1, 'free');
  assert.equal(unclaimedPassLevels(s), 9);
});

test('the track shows the premium side even while it is locked', () => {
  const s = inSeason();
  s.pass.xp = PASS_XP_PER_LEVEL * 9;
  const row = passTrack(s).find((r) => r.level === 5);

  assert.equal(row.unlocked, true);
  assert.ok(row.premium.reward.text, 'a locked premium reward must still be readable');
  assert.equal(row.premium.claimable, false);
  assert.equal(row.free.claimable, true);
});

// ------------------------------------------------------------------ premium

test('premium unlocks with leafs, once, and refuses when short', () => {
  const s = inSeason();
  s.leafs = PREMIUM_LEAFS - 1;
  assert.equal(unlockPremium(s).reason, 'leafs');
  assert.equal(s.pass.premium, false);
  assert.equal(s.leafs, PREMIUM_LEAFS - 1, 'a refused unlock must not charge');

  s.leafs = PREMIUM_LEAFS + 40;
  const result = unlockPremium(s);
  assert.equal(result.ok, true);
  assert.equal(s.leafs, 40);
  assert.equal(s.pass.premium, true);
  assert.equal(unlockPremium(s).reason, 'owned');
});

test('the simulated route charges nothing at all', () => {
  const s = inSeason();
  s.leafs = 0;
  const result = unlockPremium(s, { leafs: false });
  assert.equal(result.ok, true);
  assert.equal(result.paidLeafs, 0);
  assert.equal(s.leafs, 0);
  assert.equal(s.pass.premium, true);
  assert.match(PREMIUM_PRICE, /^£/, 'the price tag is a tag, and it is quoted as one');
});

test('unlocking premium late still pays out everything already passed', () => {
  const s = inSeason();
  s.pass.xp = PASS_XP_PER_LEVEL * 29; // level 30

  const backlog = premiumBacklog(s);
  assert.equal(backlog.levels, 30, 'every level so far is waiting');
  assert.ok(backlog.tickets > 0);

  unlockPremium(s, { leafs: false });
  for (let level = 1; level <= 30; level++) {
    assert.equal(canClaim(s, level, 'premium').ok, true, `level ${level} should be claimable`);
  }
});

test('the backlog shrinks as it is claimed', () => {
  const s = inSeason();
  s.pass.xp = PASS_XP_PER_LEVEL * 9;
  unlockPremium(s, { leafs: false });

  const before = premiumBacklog(s).levels;
  claimPassLevel(s, 3, 'premium');
  assert.equal(premiumBacklog(s).levels, before - 1);
});

// --------------------------------------------------------------- persistence

test('a one-track save moves onto the free track without losing a claim', () => {
  // v1's pass had no premium side, so `claimed` was a flat level -> true map.
  // Those claims were all free-track ones, and dropping them would hand the
  // player rewards they already took.
  const s = reconcileState({
    version: 2,
    pass: { xp: 640, claimed: { 1: true, 2: true, 5: true } },
  });

  assert.equal(s.pass.xp, 640);
  assert.equal(s.pass.premium, false);
  assert.deepEqual(Object.keys(s.pass.claimed).sort(), ['free', 'premium']);
  assert.equal(isClaimed(s, 1, 'free'), true);
  assert.equal(isClaimed(s, 5, 'free'), true);
  assert.equal(isClaimed(s, 5, 'premium'), false);
});

test('a mangled pass block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 2,
    pass: {
      xp: 'lots', premium: 'yes', season: -3, bestLevel: NaN,
      claimed: null, history: 'not a list',
    },
  });

  assert.equal(s.pass.xp, 0);
  assert.equal(s.pass.premium, true, 'a truthy value is a yes, but a boolean one');
  assert.equal(s.pass.season, null, 'a nonsense season adopts the live one on the next tick');
  assert.equal(s.pass.bestLevel, 0);
  assert.deepEqual(s.pass.claimed, { free: {}, premium: {} });
  assert.deepEqual(s.pass.history, []);
  assert.equal(passLevel(s.pass.xp), 1);
});

test('a season round-trips through a save', () => {
  const s = inSeason(6);
  s.leafs = PREMIUM_LEAFS;
  s.pass.xp = PASS_XP_PER_LEVEL * 12;
  unlockPremium(s);
  claimPassLevel(s, 1, 'premium');
  claimPassLevel(s, 4, 'free');

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.pass.season, 6);
  assert.equal(reloaded.pass.xp, s.pass.xp);
  assert.equal(reloaded.pass.premium, true);
  assert.equal(isClaimed(reloaded, 1, 'premium'), true);
  assert.equal(isClaimed(reloaded, 4, 'free'), true);
  assert.equal(owns(reloaded, 'skin', 'seasonal'), true);
});
