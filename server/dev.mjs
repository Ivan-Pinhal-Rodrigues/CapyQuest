// Run the worker locally, without a Cloudflare account.
//
//   node server/dev.mjs          # http://127.0.0.1:8125
//
// This is the REAL server/worker.js — not a reimplementation — over an
// in-memory SQLite standing in for D1. It exists so the backend can be
// exercised end to end by anybody, including in CI, without deploying
// anything or signing up for anything.
//
// The D1 shim below covers the handful of statements worker.js actually runs.
// It is not a general D1 emulator and should not grow into one: the moment it
// needs a feature the worker does not use, that is a sign the test is testing
// the shim.
//
// Data lives in memory and is gone when the process stops. That is deliberate
// — a dev server that accumulates state is a dev server whose next run behaves
// differently from its last.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const db = new DatabaseSync(':memory:');
// Strip comment lines BEFORE splitting. A statement preceded by a comment
// block starts with `--` after the split and was being skipped whole, so the
// database came up with no `scores` table and every board request 500'd.
const schema = readFileSync(new URL('schema.sql', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
for (const stmt of schema.split(';')) {
  const sql = stmt.trim();
  if (sql) db.exec(sql + ';');
}

// The D1 shape, over real SQLite.
const DB = {
  prepare(sql) {
    const args = [];
    const api = {
      bind(...v) { args.push(...v); return api; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { db.prepare(sql).run(...args); return { success: true }; },
    };
    return api;
  },
};

const PORT = Number(process.env.PORT) || 8125;

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://127.0.0.1:8125${req.url}`, {
    method: req.method, headers: req.headers, body,
  });
  const out = await worker.fetch(request, { DB });
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`capyquest worker on http://127.0.0.1:${PORT}`));
