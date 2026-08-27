// CapyQuest's optional backend: a Cloudflare Worker over one D1 database.
//
// WHAT IT IS FOR. Two things the game cannot do from a static file: keep a save
// somewhere that is not one browser profile, and put real players on the
// leaderboard next to the sixty simulated ones.
//
// WHAT IT IS NOT. Authoritative. This server does not run the game, validate
// progress, or decide anything. It stores a blob the client gave it and hands
// it back. Somebody who wants to edit their save can already do it in devtools
// — this is single-player, and treating a player's own save as something to
// defend against them would cost real players a great deal to inconvenience
// cheaters slightly.
//
// THE RULE THE WHOLE DESIGN HANGS ON: **the game must work perfectly with this
// worker down, unreachable, misconfigured, or never deployed at all.** Every
// call from the client is fire-and-forget with a short timeout, and there is no
// code path in the game that waits on a response. If this file did not exist,
// CapyQuest would lose cloud save and a handful of leaderboard rows and nothing
// else.
//
// NO PERSONAL DATA. No email, no account, no password. A device generates a
// random id and a random secret; the secret is the only thing that authorises
// writing to that id. Losing both means losing the cloud copy, which is exactly
// the same failure mode as losing the browser profile — and the save code the
// game already has is the answer to both.
//
// D1 RATHER THAN KV, which was a measured decision rather than a preference:
// Workers KV's free tier allows 1,000 writes a day. At one save every five
// minutes that is about eighty player-hours a day across everybody, so it would
// break at roughly thirty players. D1's free tier allows 100,000 row writes a
// day and 5GB — about a hundred times the headroom for the same nothing.

const MAX_SAVE_BYTES = 256 * 1024; // a full save is ~20KB; this is generous
const BOARD_SIZE = 100;
const ID_PATTERN = /^[a-z0-9]{16,40}$/;
const SECRET_PATTERN = /^[a-z0-9]{16,64}$/;

/** Names are shown to other players, so they are the one thing to be strict about. */
const MAX_NAME = 24;

const CORS = {
  // The game is served from GitHub Pages and may be served from a custom domain
  // or itch.io. Locking this to one origin would break the others for no gain:
  // there is nothing here worth stealing that the requester does not already
  // have to know a secret to reach.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });

const bad = (message, status = 400) => json({ error: message }, status);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    try {
      // `await` on every branch, and it is load-bearing. Returning the promise
      // instead lets an async failure — a D1 error, a malformed row — escape
      // this try/catch entirely and surface as an unhandled rejection, so the
      // catch below never runs and the client gets a generic edge error rather
      // than a clean 500. Found by running the real worker against a real
      // SQLite and giving it a database with no tables in it.
      switch (`${request.method} ${url.pathname}`) {
        case 'GET /v1/health': return json({ ok: true });
        case 'GET /v1/save': return await getSave(url, env);
        case 'POST /v1/save': return await putSave(request, env);
        case 'GET /v1/board': return await getBoard(url, env);
        case 'POST /v1/board': return await putScore(request, env);
        default: return bad('no such endpoint', 404);
      }
    } catch (err) {
      // Never leak a stack to a game client. The client treats any failure the
      // same way regardless, so the message is for the operator's logs.
      console.error('[capyquest]', err);
      return bad('server error', 500);
    }
  },
};

// ------------------------------------------------------------------ cloud save

async function getSave(url, env) {
  const id = url.searchParams.get('id');
  const secret = url.searchParams.get('secret');
  if (!ID_PATTERN.test(id || '') || !SECRET_PATTERN.test(secret || '')) {
    return bad('bad id or secret');
  }

  const row = await env.DB.prepare('SELECT code, updated_at, secret FROM saves WHERE id = ?')
    .bind(id).first();
  if (!row) return bad('no save for that id', 404);
  // Compared here rather than in the WHERE clause so a wrong secret and a
  // missing row are distinguishable to the operator but not to the caller —
  // both come back as a plain refusal.
  if (!timingSafeEqual(row.secret, secret)) return bad('no save for that id', 404);

  return json({ code: row.code, updatedAt: row.updated_at });
}

async function putSave(request, env) {
  const body = await readJson(request);
  if (!body) return bad('body must be JSON');

  const { id, secret, code, updatedAt } = body;
  if (!ID_PATTERN.test(id || '') || !SECRET_PATTERN.test(secret || '')) {
    return bad('bad id or secret');
  }
  if (typeof code !== 'string' || !code.startsWith('CAPY1.')) {
    return bad('code must be a CAPY1 save blob');
  }
  if (code.length > MAX_SAVE_BYTES) return bad('save too large', 413);

  const now = Date.now();
  // A device clock can be wrong by years in either direction. Trusting it would
  // let one badly-set phone pin `updated_at` in the future forever and make
  // every later save look older than what is stored. The client's timestamp is
  // recorded for its own comparison; the server's own clock is what orders
  // writes.
  const claimed = Number.isFinite(updatedAt) ? Number(updatedAt) : now;

  const existing = await env.DB.prepare('SELECT secret FROM saves WHERE id = ?').bind(id).first();
  if (existing && !timingSafeEqual(existing.secret, secret)) {
    return bad('that id belongs to somebody else', 403);
  }

  await env.DB.prepare(
    `INSERT INTO saves (id, secret, code, updated_at, client_at, bytes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       code = excluded.code,
       updated_at = excluded.updated_at,
       client_at = excluded.client_at,
       bytes = excluded.bytes`,
  ).bind(id, secret, code, now, claimed, code.length).run();

  return json({ ok: true, updatedAt: now });
}

// ------------------------------------------------------------------ the board

async function getBoard(url, env) {
  const season = Number(url.searchParams.get('season'));
  if (!Number.isInteger(season) || season < 0) return bad('bad season');

  const { results } = await env.DB.prepare(
    `SELECT name, depth, rebirths, pass_level AS passLevel, updated_at AS updatedAt
       FROM scores WHERE season = ?
       ORDER BY depth DESC, rebirths DESC, pass_level DESC
       LIMIT ?`,
  ).bind(season, BOARD_SIZE).all();

  return json({ season, rows: results || [] });
}

async function putScore(request, env) {
  const body = await readJson(request);
  if (!body) return bad('body must be JSON');

  const { id, secret, season } = body;
  if (!ID_PATTERN.test(id || '') || !SECRET_PATTERN.test(secret || '')) {
    return bad('bad id or secret');
  }
  if (!Number.isInteger(season) || season < 0) return bad('bad season');

  const existing = await env.DB.prepare('SELECT secret FROM scores WHERE id = ? AND season = ?')
    .bind(id, season).first();
  if (existing && !timingSafeEqual(existing.secret, secret)) {
    return bad('that id belongs to somebody else', 403);
  }

  const row = {
    // Clamped rather than rejected: a client sending nonsense gets a nonsense
    // row, not a broken board. The ceilings are far past anything reachable.
    depth: clampInt(body.depth, 0, 1e6),
    rebirths: clampInt(body.rebirths, 0, 1e5),
    passLevel: clampInt(body.passLevel, 0, 999),
    name: cleanName(body.name),
  };

  await env.DB.prepare(
    `INSERT INTO scores (id, secret, season, name, depth, rebirths, pass_level, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id, season) DO UPDATE SET
       name = excluded.name,
       depth = MAX(scores.depth, excluded.depth),
       rebirths = MAX(scores.rebirths, excluded.rebirths),
       pass_level = MAX(scores.pass_level, excluded.pass_level),
       updated_at = excluded.updated_at`,
  ).bind(id, secret, season, row.name, row.depth, row.rebirths, row.passLevel, Date.now()).run();

  return getBoard(new URL(`https://x/?season=${season}`), env);
}

// ------------------------------------------------------------------- plumbing

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * A display name other players will see.
 *
 * Control characters are stripped because they can wreck a line of text in a
 * terminal or a log, and the length is capped because the board has a column
 * width. It is NOT filtered for content: this is a small game, there is no
 * moderation queue behind it, and a profanity list is a thing that fails in
 * both directions. If a board ever needs moderating, that is a decision to take
 * with real users rather than a regex to guess at now.
 */
function cleanName(value) {
  const name = String(value ?? '')
    // Control characters, escaped rather than typed: a literal one in source
    // makes the file binary to every tool that reads it.
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim();
  return (name || 'A capybara').slice(0, MAX_NAME);
}

/**
 * Constant-time string compare.
 *
 * The secrets here guard one player's save slot, not a bank, and a timing
 * attack over the public internet against a Worker is not a realistic route in.
 * It costs four lines, so there is no reason to leave the obvious version in
 * and have to argue about it.
 */
function timingSafeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
