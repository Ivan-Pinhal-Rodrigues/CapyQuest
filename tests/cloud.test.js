// The optional backend, both halves.
//
// The worker is a pure `Request -> Response` over one `env.DB`, so it runs
// here against a fake D1 — the real handler, the real SQL branching, the real
// validation. What that cannot cover is Cloudflare actually executing it, and
// docs/CONTENT.md says so rather than this file implying otherwise.
//
// The client half is tested against a stub `fetch`, because the property that
// matters is not "it parses JSON" but "every failure is survivable", and the
// only way to see that is to fail it in every way there is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import worker from '../server/worker.js';
import {
  setEndpoint, configured, identity, forgetIdentity,
  pushSave, pullSave, pushScore, fetchBoard,
} from '../src/systems/cloud.js';
import { createState } from '../src/state.js';
import { exportSave } from '../src/save.js';
import { realEntries, rank, rivalScore } from '../src/systems/leaderboard.js';
import { validatePack } from '../src/content/schema.js';

// --------------------------------------------------------------- a fake D1
//
// Enough of D1's shape for the queries the worker actually runs: an in-memory
// table per statement kind. Not a SQL engine — it recognises the handful of
// statements in worker.js and does what they mean.

function fakeDb() {
  const saves = new Map();
  const scores = new Map(); // `${id}:${season}`

  return {
    saves,
    scores,
    prepare(sql) {
      const args = [];
      const api = {
        bind(...values) { args.push(...values); return api; },

        async first() {
          if (sql.includes('FROM saves')) return saves.get(args[0]) || null;
          if (sql.includes('FROM scores') && sql.includes('secret')) {
            return scores.get(`${args[0]}:${args[1]}`) || null;
          }
          return null;
        },

        async all() {
          const season = args[0];
          const rows = [...scores.values()]
            .filter((r) => r.season === season)
            .sort((a, b) => b.depth - a.depth || b.rebirths - a.rebirths || b.pass_level - a.pass_level)
            .slice(0, args[1])
            .map((r) => ({
              name: r.name, depth: r.depth, rebirths: r.rebirths,
              passLevel: r.pass_level, updatedAt: r.updated_at,
            }));
          return { results: rows };
        },

        async run() {
          if (sql.includes('INTO saves')) {
            const [id, secret, code, updated_at, client_at, bytes] = args;
            saves.set(id, { id, secret, code, updated_at, client_at, bytes });
          } else if (sql.includes('INTO scores')) {
            const [id, secret, season, name, depth, rebirths, pass_level, updated_at] = args;
            const key = `${id}:${season}`;
            const old = scores.get(key);
            scores.set(key, {
              id, secret, season, name, updated_at,
              // MAX(), as the real statement does — a score never goes down.
              depth: Math.max(old?.depth ?? 0, depth),
              rebirths: Math.max(old?.rebirths ?? 0, rebirths),
              pass_level: Math.max(old?.pass_level ?? 0, pass_level),
            });
          }
          return { success: true };
        },
      };
      return api;
    },
  };
}

const ID = 'a'.repeat(24);
const SECRET = 'b'.repeat(40);
const call = (db, method, path, body) =>
  worker.fetch(new Request(`https://api.test${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db });

// ------------------------------------------------------------------- worker

test('a save round-trips', async () => {
  const db = fakeDb();
  const code = exportSave(createState());

  const put = await call(db, 'POST', '/v1/save', { id: ID, secret: SECRET, code, updatedAt: 1000 });
  assert.equal(put.status, 200);

  const got = await call(db, 'GET', `/v1/save?id=${ID}&secret=${SECRET}`);
  assert.equal(got.status, 200);
  assert.equal((await got.json()).code, code);
});

test('the secret is the only thing guarding an id', async () => {
  const db = fakeDb();
  await call(db, 'POST', '/v1/save', { id: ID, secret: SECRET, code: exportSave(createState()) });

  const wrong = 'c'.repeat(40);
  const read = await call(db, 'GET', `/v1/save?id=${ID}&secret=${wrong}`);
  assert.equal(read.status, 404, 'a wrong secret must not read somebody else\'s save');

  const write = await call(db, 'POST', '/v1/save', { id: ID, secret: wrong, code: exportSave(createState()) });
  assert.equal(write.status, 403, 'and must not overwrite it either');
});

test('the worker refuses what it should refuse', async () => {
  const db = fakeDb();
  const cases = [
    [{ id: 'short', secret: SECRET, code: 'CAPY1.x' }, 'a too-short id'],
    [{ id: ID, secret: 'nope', code: 'CAPY1.x' }, 'a bad secret'],
    [{ id: ID, secret: SECRET, code: 'not a save' }, 'a blob that is not CAPY1'],
    [{ id: ID, secret: SECRET, code: `CAPY1.${'x'.repeat(300_000)}` }, 'a save over the size cap'],
  ];
  for (const [body, what] of cases) {
    const res = await call(db, 'POST', '/v1/save', body);
    assert.ok(res.status >= 400, `${what} should be refused`);
  }
});

test('the server clock orders writes, not the device clock', async () => {
  // A phone with its clock set to 2031 must not pin updated_at in the future
  // and make every later save from every device look older than what is
  // stored. The client's own timestamp is kept separately.
  const db = fakeDb();
  await call(db, 'POST', '/v1/save', {
    id: ID, secret: SECRET, code: exportSave(createState()),
    updatedAt: Date.now() + 5 * 365 * 24 * 3600e3,
  });
  const row = db.saves.get(ID);
  assert.ok(row.updated_at <= Date.now() + 1000, 'updated_at came from the device clock');
  assert.ok(row.client_at > Date.now(), 'and the device claim was still recorded');
});

test('a score goes up and never down', async () => {
  const db = fakeDb();
  const base = { id: ID, secret: SECRET, season: 3, name: 'Ivan' };
  await call(db, 'POST', '/v1/board', { ...base, depth: 90, rebirths: 4, passLevel: 30 });
  await call(db, 'POST', '/v1/board', { ...base, depth: 10, rebirths: 0, passLevel: 1 });

  const row = db.scores.get(`${ID}:3`);
  assert.equal(row.depth, 90, 'a later, worse report must not erase the best');
  assert.equal(row.rebirths, 4);
});

test('posting a score returns the board', async () => {
  const db = fakeDb();
  for (const [i, depth] of [40, 120, 80].entries()) {
    await call(db, 'POST', '/v1/board', {
      id: String(i).repeat(24), secret: SECRET, season: 1, name: `P${i}`, depth,
    });
  }
  const res = await call(db, 'POST', '/v1/board', {
    id: ID, secret: SECRET, season: 1, name: 'Me', depth: 100,
  });
  const { rows } = await res.json();
  assert.deepEqual(rows.map((r) => r.depth), [120, 100, 80, 40], 'the board comes back sorted');
});

test('names are cleaned but not censored', async () => {
  const db = fakeDb();
  await call(db, 'POST', '/v1/board', {
    id: ID, secret: SECRET, season: 0, depth: 1,
    name: `bad\u001b[31mname\u0000 that is far too long to fit in a single column`,
  });
  const row = db.scores.get(`${ID}:0`);
  assert.ok(!/[\u0000-\u001f]/.test(row.name), 'control characters are stripped');
  assert.ok(row.name.length <= 24, 'and the length is capped');
});

test('an unknown route is a 404, not a crash', async () => {
  const res = await call(fakeDb(), 'GET', '/v1/whatever');
  assert.equal(res.status, 404);
});

test('CORS is answered so a browser can reach it at all', async () => {
  const res = await worker.fetch(new Request('https://api.test/v1/save', { method: 'OPTIONS' }), {});
  assert.equal(res.status, 204);
  assert.ok(res.headers.get('Access-Control-Allow-Origin'));
});

// ------------------------------------------------------------------- client

test('with no endpoint the client does nothing at all', async () => {
  setEndpoint(null);
  assert.equal(configured(), false);

  // The important property: not that these fail, but that they RESOLVE. A
  // rejected promise here would reach an unhandled rejection in the game.
  for (const call of [
    () => pushSave(createState()),
    () => pullSave(),
    () => pushScore({ season: 1, name: 'x', depth: 1, rebirths: 0, passLevel: 0 }),
    () => fetchBoard(1),
  ]) {
    const res = await call();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'off');
  }
});

test('the endpoint must be https', () => {
  assert.equal(setEndpoint('http://example.com'), null, 'plain http would ship saves in the clear');
  assert.equal(setEndpoint('/relative'), null, 'a relative path resolves somewhere nobody intended');
  assert.equal(setEndpoint('nonsense'), null);
  assert.equal(setEndpoint('https://api.test/'), 'https://api.test', 'and the trailing slash goes');
  setEndpoint(null);
});

test('every kind of network failure resolves rather than throws', async () => {
  const original = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  // Node has no localStorage, and with none at all the client has no identity
  // and stays off — which is the right behaviour (see the note on identity())
  // and means the network path needs a browser-like environment to reach.
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  setEndpoint('https://api.test');
  try {
    const failures = [
      [() => { throw new TypeError('failed to fetch'); }, 'network'],
      [() => Promise.resolve({ ok: false, status: 500 }), 'http 500'],
      [() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }), 'network'],
    ];
    for (const [impl, expected] of failures) {
      globalThis.fetch = impl;
      const res = await pushSave(createState());
      assert.equal(res.ok, false);
      assert.equal(res.reason, expected);
    }
  } finally {
    globalThis.fetch = original;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
    setEndpoint(null);
  }
});

test('an identity is made once and reused', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  const first = identity(storage);
  assert.match(first.id, /^[a-z0-9]{16,40}$/, 'the id must match what the worker accepts');
  assert.match(first.secret, /^[a-z0-9]{16,64}$/);
  assert.deepEqual(identity(storage), first, 'a second call must not mint a new one');

  forgetIdentity(storage);
  assert.notDeepEqual(identity(storage), first, 'forgetting it means a genuinely new identity');
});

test('identity survives storage being unavailable', () => {
  // Safari private mode. The identity is still usable for this session; it is
  // just not remembered — a degradation, not a crash.
  const blocked = {
    getItem: () => { throw new Error('nope'); },
    setItem: () => { throw new Error('nope'); },
    removeItem: () => {},
  };
  const who = identity(blocked);
  assert.ok(who?.id && who?.secret);
});

// ------------------------------------------------------------- the board mix

test('real players rank by the same function as everybody else', () => {
  const real = realEntries([
    { name: 'Ivan', depth: 120, rebirths: 8, passLevel: 40 },
    { name: 'Someone', depth: 30, rebirths: 1, passLevel: 5 },
  ]);
  assert.equal(real.length, 2);
  assert.ok(real.every((r) => r.real === true), 'a real row must be marked as real');

  const fake = { id: 'r', name: 'Rival', depth: 70, rebirths: 3, passLevel: 20 };
  const ranked = rank([...real, fake]);
  assert.deepEqual(ranked.map((r) => r.name), ['Ivan', 'Rival', 'Someone'],
    'they interleave with the simulated rivals rather than sitting in their own list');
  assert.ok(rivalScore(real[0]) > rivalScore(fake));
});

test('the board survives a hostile response', () => {
  // These rows crossed a network from a server the client is told not to
  // trust. Nothing here may throw, and nothing malformed may reach a sort.
  assert.deepEqual(realEntries(null), []);
  assert.deepEqual(realEntries('not a list'), []);
  assert.deepEqual(realEntries([null, 42, 'x']), []);

  const rows = realEntries([
    { name: null, depth: -5 },
    { name: 'ok', depth: 'lots' },
    { name: 'fine', depth: 1e30, rebirths: -1, passLevel: 99999 },
  ]);
  for (const row of rows) {
    assert.ok(Number.isFinite(row.depth) && row.depth >= 0, 'depth must be a real number');
    assert.ok(Number.isFinite(row.rebirths) && row.rebirths >= 0);
    assert.ok(row.passLevel <= 999);
    assert.ok(typeof row.name === 'string' && row.name.length > 0 && row.name.length <= 24);
  }
});

test('real rows never carry gear across the network', () => {
  // The board shows what somebody reached, not what they are wearing. Shipping
  // loadouts would mean trusting a server to describe items the client then
  // renders — a much larger surface for nothing anybody asked for.
  const rows = realEntries([{ name: 'x', depth: 10, gear: [{ id: 'anything' }], power: 999 }]);
  assert.deepEqual(rows[0].gear, []);
  assert.equal(rows[0].power, 0);
});

// ------------------------------------------------------------------ the pack

test('the endpoint is configured by the pack, https only', () => {
  const good = validatePack({ cloud: { endpoint: 'https://api.example.com/' } });
  assert.equal(good.pack.cloud.endpoint, 'https://api.example.com');
  assert.deepEqual(good.warnings, []);

  const bad = validatePack({ cloud: { endpoint: 'http://api.example.com' } });
  assert.equal(bad.pack.cloud, undefined, 'plain http must not configure a backend');
  assert.equal(bad.warnings.length, 1);

  assert.equal(validatePack({ cloud: {} }).pack.cloud, undefined, 'an empty section means no backend');
  assert.equal(validatePack({ cloud: 'nope' }).pack.cloud, undefined);
  assert.equal(validatePack({}).pack.cloud, undefined, 'and no section at all is the normal case');
});

test('every route awaits, so an async failure becomes a 500 and not a crash', () => {
  // The first version returned handler promises out of the try block, so a D1
  // error escaped the catch entirely: no clean 500, an unhandled rejection, and
  // in the local harness a dead process. Invisible to every test above, because
  // the fake D1 never fails. It took running the real worker against a real
  // SQLite with an empty database to see it.
  const source = readFileSync(new URL('../server/worker.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('switch (`${request.method}'), source.indexOf('} catch (err)'));

  // `json()` and `bad()` build a Response synchronously and are fine bare; it
  // is the async handlers that must be awaited.
  const SYNCHRONOUS = new Set(['json', 'bad']);
  for (const [, called] of block.matchAll(/case '[^']+': return (\w+)\(/g)) {
    assert.ok(SYNCHRONOUS.has(called),
      `the ${called}() branch returns without awaiting — its errors escape the try`);
  }
  assert.ok(block.includes('return await getSave('), 'sanity: the awaited form should be present');
});

test('a failing database is a 500, not an exception', async () => {
  const exploding = {
    prepare() {
      return { bind() { return this; },
               first() { return Promise.reject(new Error('D1 is down')); },
               all() { return Promise.reject(new Error('D1 is down')); },
               run() { return Promise.reject(new Error('D1 is down')); } };
    },
  };
  const res = await call(exploding, 'GET', '/v1/board?season=1');
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'server error', 'and never a stack trace');
});
