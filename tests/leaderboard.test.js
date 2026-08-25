// The seasonal leaderboard and the event framework.
//
// The board is simulated, and the thing worth testing about a simulation is
// that it is *consistent*: the same season must produce the same sixty rivals
// on every device and after every reload, because nothing about them is stored.
// A board that reshuffles when you refresh is worse than no board.
//
// For events the load-bearing rule is expiry. Petals belong to one occurrence
// and are gone when it closes — on the clock, not on a visit. A player who shuts
// the tab mid-event and comes back a month later must not find a wallet full of
// a currency nothing accepts.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { owns } from '../src/systems/cosmetics.js';
import { addToInventory, equip } from '../src/systems/loot.js';
import { SEASON_EPOCH, SEASON_MS, SEASON_DAYS, seasonAt } from '../src/data/seasons.js';
import { ARCHETYPES, RIVAL_COUNT } from '../src/data/rivals.js';
import { EVENTS, LIVE_EVENTS, WINDOWS, PETALS_PER_BOSS, PETALS_PER_CLEAR } from '../src/data/events.js';
import {
  leaderboard, rivalsFor, rank, rivalScore, playerEntry, playerRank, SIMULATED_NOTICE,
} from '../src/systems/leaderboard.js';
import {
  activeEvent, nextEvent, syncEvent, addPetals, petalsForClear,
  exchange, canExchange, exchangeRows, windowForDay,
} from '../src/systems/events.js';
import { MAX_TIER, MAX_STARS } from '../src/data/rarities.js';

/** A moment on a given day of a given season. */
function at(seasonIndex, day) {
  return SEASON_EPOCH + seasonIndex * SEASON_MS + (day - 1) * 86400e3 + 3600e3;
}

// ------------------------------------------------------------- the rivals

test('the board says out loud that nobody else is playing', () => {
  assert.match(SIMULATED_NOTICE, /simulated/i);
  assert.match(SIMULATED_NOTICE, /no server|no one else/i);
});

test('sixty rivals, all complete', () => {
  const { rows } = rivalsFor(at(3, 20));
  assert.equal(rows.length, RIVAL_COUNT);

  const ids = new Set();
  for (const r of rows) {
    assert.ok(!ids.has(r.id), `duplicate rival "${r.id}"`);
    ids.add(r.id);
    assert.ok(r.name && r.name.length > 2, `${r.id}: no name`);
    assert.ok(ARCHETYPES.includes(r.archetype), `${r.id}: unknown archetype`);
    assert.ok(Number.isFinite(r.depth) && r.depth >= 0, `${r.id}: bad depth`);
    assert.ok(Number.isFinite(r.power) && r.power >= 0, `${r.id}: bad power`);
    assert.ok(r.passLevel >= 1 && r.passLevel <= 100, `${r.id}: pass level ${r.passLevel}`);
    assert.equal(r.you, false);
  }
});

test('the same season and day always produce the same board', () => {
  // Nothing about a rival is stored, so this is the only thing that makes the
  // board survive a reload.
  const a = rivalsFor(at(4, 12));
  const b = rivalsFor(at(4, 12));
  assert.deepEqual(a.rows.map((r) => [r.name, r.depth, r.power]), b.rows.map((r) => [r.name, r.depth, r.power]));
});

test('a new season is a completely different set of rivals', () => {
  const a = rivalsFor(at(4, 12)).rows.map((r) => r.name);
  const b = rivalsFor(at(5, 12)).rows.map((r) => r.name);
  const shared = a.filter((n) => b.includes(n)).length;
  assert.ok(shared < RIVAL_COUNT * 0.5, `${shared} of ${RIVAL_COUNT} names carried over`);
});

test('rivals advance across a season rather than sitting still', () => {
  const early = rivalsFor(at(2, 2)).rows;
  const late = rivalsFor(at(2, SEASON_DAYS)).rows;

  const earlyTotal = early.reduce((a, r) => a + r.depth, 0);
  const lateTotal = late.reduce((a, r) => a + r.depth, 0);
  assert.ok(lateTotal > earlyTotal * 2, 'the board should be visibly deeper by the end');

  // And each individual rival only ever moves forwards.
  for (let day = 1; day < SEASON_DAYS; day++) {
    const today = rivalsFor(at(2, day)).rows;
    const tomorrow = rivalsFor(at(2, day + 1)).rows;
    today.forEach((r, i) => {
      assert.ok(tomorrow[i].depth >= r.depth, `${r.name} went backwards on day ${day}`);
    });
  }
});

test('the order reshuffles over a season, so the board is worth checking', () => {
  // A sprinter should lead early and be passed; if the ranking never changed,
  // the leaderboard would be a static list with a clock on it.
  const early = rivalsFor(at(6, 3)).rows;
  const late = rivalsFor(at(6, 40)).rows;
  const order = (rows) => rank([...rows]).map((r) => r.name);

  const a = order(early);
  const b = order(late);
  const moved = a.filter((name, i) => b[i] !== name).length;
  assert.ok(moved > 5, `only ${moved} rivals changed position across a whole season`);
});

test('every rival wears gear the game could actually have dropped them', () => {
  for (const r of rivalsFor(at(7, 44)).rows) {
    for (const item of r.gear) {
      assert.ok(item.tier >= 0 && item.tier <= MAX_TIER, `${r.name}: rung ${item.tier}`);
      assert.ok(item.stars >= 1 && item.stars <= MAX_STARS, `${r.name}: ${item.stars} stars`);
      assert.ok(item.forge >= 0 && item.forge <= 15, `${r.name}: +${item.forge}`);
      assert.ok(item.rarity?.name, `${r.name}: unresolved rarity`);
      assert.ok(item.score > 0, `${r.name}: weightless gear`);
    }
    const slots = r.gear.map((g) => g.slot);
    assert.equal(new Set(slots).size, slots.length, `${r.name}: two pieces in one slot`);
  }
});

// -------------------------------------------------------------- the ranking

test('the player is ranked by exactly the same function as the rivals', () => {
  const s = createState();
  s.combat.bestDepth = 500;
  s.rebirthCount = 9;

  const board = leaderboard(s, at(1, 5));
  assert.equal(board.rows.length, RIVAL_COUNT + 1);
  assert.ok(board.you.you);
  assert.equal(board.you.rank, 1, 'a depth of 500 on day 5 should be top of the board');
  assert.equal(rivalScore(board.you), 500 * 1e6 + 9 * 1e3 + board.you.passLevel);
});

test('a fresh save is last, and that is not a crash', () => {
  const board = leaderboard(createState(), at(1, 30));
  assert.equal(board.you.depth, 0);
  assert.equal(board.you.power, 0);
  assert.deepEqual(board.you.gear, []);
  assert.equal(board.you.rank, board.rows.length, 'nothing done yet means bottom');
});

test('ranks are dense, ordered, and never skip a place they should not', () => {
  const board = leaderboard(createState(), at(2, 18));
  let previous = 0;
  board.rows.forEach((row, i) => {
    assert.ok(row.rank >= previous, 'ranks must not go backwards down the list');
    assert.ok(row.rank <= i + 1, 'a rank can never be worse than the row index');
    previous = row.rank;
  });
  assert.equal(board.rows[0].rank, 1);
});

test('a tie shares a rank rather than being broken arbitrarily', () => {
  const rows = [
    { id: 'a', name: 'Alpha', depth: 100, rebirths: 2, passLevel: 5 },
    { id: 'b', name: 'Beta', depth: 100, rebirths: 2, passLevel: 5 },
    { id: 'c', name: 'Gamma', depth: 50, rebirths: 1, passLevel: 3 },
  ];
  const ranked = rank(rows);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 1, 'an identical score is an identical rank');
  assert.equal(ranked[2].rank, 3, 'and the next one down skips a place');
});

test("the player's gear is read from what they are actually wearing", () => {
  const s = createState();
  const entry = addToInventory(s, 'geodeCrown', { tier: 14, stars: 3 });
  equip(s, entry.uid);

  const you = playerEntry(s);
  assert.equal(you.gear.length, 1);
  assert.equal(you.gear[0].tier, 14);
  assert.ok(you.power > 0);
  assert.equal(playerRank(s, at(1, 1)).id, 'you');
});

test('caching the rivals does not change the answer', () => {
  const s = createState();
  s.combat.bestDepth = 90;
  const now = at(3, 22);
  const cached = rivalsFor(now);

  const a = leaderboard(s, now);
  const b = leaderboard(s, now, cached);
  assert.deepEqual(a.rows.map((r) => [r.id, r.rank]), b.rows.map((r) => [r.id, r.rank]));
});

// --------------------------------------------------------------- the events

test('ten events are designed and the built ones are marked as such', () => {
  assert.equal(EVENTS.length, 10);
  assert.equal(LIVE_EVENTS.length, 3);

  const ids = new Set();
  for (const e of EVENTS) {
    assert.ok(!ids.has(e.id), `duplicate event "${e.id}"`);
    ids.add(e.id);
    assert.ok(e.name && e.blurb && e.icon && e.color, `${e.id}: incomplete`);
    if (e.live) {
      assert.ok(e.hook, `${e.id}: live with no hook`);
      assert.ok(e.exchange.length >= 3, `${e.id}: an exchange worth opening needs rows`);
    }
  }
});

test('every live exchange sells the staples and exactly one thing of its own', () => {
  for (const e of LIVE_EVENTS) {
    const exclusive = e.exchange.filter((r) => r.reward.cosmetic);
    assert.equal(exclusive.length, 1, `${e.id}: should have one exclusive, has ${exclusive.length}`);
    assert.equal(exclusive[0].once, true, 'an exclusive must be buyable once');
    for (const row of e.exchange) {
      assert.ok(row.petals > 0 && row.text, `${e.id}/${row.id}: incomplete row`);
    }
  }
});

test('three windows a season, with real gaps between them', () => {
  assert.equal(WINDOWS.length, 3);
  for (let i = 0; i < WINDOWS.length; i++) {
    const w = WINDOWS[i];
    assert.ok(w.startDay >= 1 && w.endDay <= SEASON_DAYS, `window ${i} runs off the season`);
    assert.ok(w.endDay > w.startDay, `window ${i} is inverted`);
    if (i > 0) assert.ok(w.startDay > WINDOWS[i - 1].endDay + 1, `window ${i} touches the last one`);
  }
  assert.equal(windowForDay(WINDOWS[0].startDay).index, 0);
  assert.equal(windowForDay(WINDOWS[0].endDay).index, 0);
  assert.equal(windowForDay(WINDOWS[0].endDay + 1), null, 'the gap is a real gap');
});

test('an event opens and closes on the clock', () => {
  // The second window, not the first: window 0 starts on day 1, so there is no
  // "the day before it opens" inside the season to test against.
  const w = WINDOWS[1];
  assert.equal(activeEvent(at(0, w.startDay - 1)), null, 'shut the day before it opens');
  assert.ok(activeEvent(at(0, w.startDay)), 'open on the first day');
  assert.ok(activeEvent(at(0, w.endDay)), 'still open on the last day');
  assert.equal(activeEvent(at(0, w.endDay + 1)), null, 'shut the day after');

  // And the first window is open from the very first moment of a season.
  assert.ok(activeEvent(at(0, WINDOWS[0].startDay)), 'day one of a season should have an event on');
});

test('which event fills a window rotates between seasons', () => {
  const first = activeEvent(at(0, WINDOWS[0].startDay)).id;
  const next = activeEvent(at(1, WINDOWS[0].startDay)).id;
  assert.notEqual(first, next, 'the same season slot should not always be the same event');

  // And within one season the three windows are three different events.
  const ids = WINDOWS.map((w) => activeEvent(at(0, w.startDay)).id);
  assert.equal(new Set(ids).size, LIVE_EVENTS.length);
});

test('an occurrence key names the season, the window and the event', () => {
  const e = activeEvent(at(5, WINDOWS[1].startDay));
  assert.equal(e.key, `5:1:${e.id}`);
  assert.equal(e.day, 1);
  assert.equal(e.days, WINDOWS[1].endDay - WINDOWS[1].startDay + 1);
  assert.ok(e.msLeft > 0);
});

test('between events the game says what is next rather than nothing', () => {
  const gap = at(0, WINDOWS[0].endDay + 2);
  assert.equal(activeEvent(gap), null);
  const next = nextEvent(gap);
  assert.ok(next.name && next.inMs > 0, 'there is always a next event');
  assert.ok(next.startsAt > gap);
});

// ---------------------------------------------------------------- petals

test('petals are earned only while an event is running', () => {
  const open = at(0, WINDOWS[0].startDay + 1);
  const shut = at(0, WINDOWS[0].endDay + 2);

  assert.ok(petalsForClear(false, open) > 0);
  assert.ok(petalsForClear(true, open) > petalsForClear(false, open), 'a boss should pay more');
  assert.equal(petalsForClear(true, shut), 0, 'nothing running means nothing earned');

  const s = createState();
  assert.equal(addPetals(s, 50, shut), 0);
  assert.equal(s.events.petals, 0);
});

test('the rush event really does pay double', () => {
  // Find the moment Reed Rush is the live one, and compare against another.
  let rushAt = null;
  let plainAt = null;
  for (let season = 0; season < 3 && (!rushAt || !plainAt); season++) {
    for (const w of WINDOWS) {
      const when = at(season, w.startDay);
      const live = activeEvent(when);
      if (live.id === 'reedRush') rushAt ??= when;
      else plainAt ??= when;
    }
  }
  assert.ok(rushAt && plainAt, 'both kinds of event should turn up within three seasons');
  assert.equal(petalsForClear(false, rushAt), PETALS_PER_CLEAR * 2);
  assert.equal(petalsForClear(false, plainAt), PETALS_PER_CLEAR);
  assert.equal(petalsForClear(true, rushAt), PETALS_PER_BOSS * 2);
});

test('petals expire with the event that paid them', () => {
  const open = at(0, WINDOWS[0].startDay + 2);
  const s = createState();
  syncEvent(s, open);
  addPetals(s, 400, open);
  assert.equal(s.events.petals, 400);

  // The tab was closed here and reopened well after the window shut.
  const expired = syncEvent(s, at(0, WINDOWS[0].endDay + 3));
  assert.ok(expired, 'expiry must be announced, not silent');
  assert.equal(expired.petals, 400);
  assert.equal(s.events.petals, 0);
  assert.equal(s.events.key, null);
});

test('a month away does not leave a wallet of a dead currency', () => {
  const s = createState();
  syncEvent(s, at(0, WINDOWS[0].startDay));
  addPetals(s, 900, at(0, WINDOWS[0].startDay));

  // Two whole seasons later.
  syncEvent(s, at(2, WINDOWS[1].startDay));
  assert.equal(s.events.petals, 0);
  assert.deepEqual(s.events.claimed, {});
});

test('syncing repeatedly inside one event changes nothing', () => {
  const when = at(1, WINDOWS[2].startDay + 1);
  const s = createState();
  syncEvent(s, when);
  addPetals(s, 120, when);

  assert.equal(syncEvent(s, when), null);
  assert.equal(syncEvent(s, when + 3600e3), null);
  assert.equal(s.events.petals, 120, 'the same event must not reset its own petals');
});

// --------------------------------------------------------------- exchange

test('the exchange spends petals and refuses when they are short', () => {
  const when = at(0, WINDOWS[0].startDay);
  const s = createState();
  syncEvent(s, when);

  const rows = exchangeRows(s, when);
  assert.ok(rows.length >= 3);
  assert.equal(rows.every((r) => !r.affordable), true, 'nothing is affordable at zero petals');

  const shards = rows.find((r) => r.id === 'shards');
  assert.equal(canExchange(s, 'shards', when).reason, 'petals');

  addPetals(s, shards.petals, when);
  const result = exchange(s, 'shards', when);
  assert.equal(result.ok, true);
  assert.equal(s.events.petals, 0);
  assert.equal(s.events.claimed.shards, 1);
  assert.equal(canExchange(s, 'nope', when).reason, 'unknown');
});

test('the exclusive is bought once and it is a real cosmetic', () => {
  const when = at(0, WINDOWS[0].startDay);
  const s = createState();
  syncEvent(s, when);
  addPetals(s, 100000, when);

  const live = activeEvent(when);
  const exclusive = live.exchange.find((r) => r.reward.cosmetic);
  const [kind, id] = exclusive.reward.cosmetic.split(':');

  assert.equal(owns(s, kind, id), false);
  assert.equal(exchange(s, exclusive.id, when).ok, true);
  assert.equal(owns(s, kind, id), true, 'the exchange must actually hand it over');
  assert.equal(canExchange(s, exclusive.id, when).reason, 'soldOut');
});

test('nothing can be exchanged once the window shuts', () => {
  const s = createState();
  s.events = { key: 'whatever', petals: 99999, claimed: {} };
  const shut = at(0, WINDOWS[0].endDay + 2);
  assert.equal(canExchange(s, 'shards', shut).reason, 'closed');
  assert.equal(exchange(s, 'shards', shut).ok, false);
});

// ------------------------------------------------------------ persistence

test('a mangled event block is repaired, not fatal', () => {
  const s = reconcileState({
    version: 2,
    events: { key: 42, petals: 'lots', claimed: 'no' },
  });
  assert.equal(s.events.key, null);
  assert.equal(s.events.petals, 0);
  assert.deepEqual(s.events.claimed, {});
});

test('petals survive a reload inside the same event', () => {
  const when = at(3, WINDOWS[0].startDay + 4);
  const s = createState();
  syncEvent(s, when);
  addPetals(s, 260, when);

  const reloaded = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.events.petals, 260);
  assert.equal(reloaded.events.key, s.events.key);
  assert.equal(syncEvent(reloaded, when), null, 'and it is still the same event');
});

test('the season the board reports is the season the clock is in', () => {
  const when = at(9, 30);
  assert.equal(leaderboard(createState(), when).season.index, seasonAt(when).index);
  assert.equal(rivalsFor(when).season.day, 30);
});
