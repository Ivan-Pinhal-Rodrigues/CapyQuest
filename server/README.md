# server/

CapyQuest's optional backend. Two things a static file cannot do: keep a save
somewhere that is not one browser profile, and put real players on the
leaderboard beside the sixty simulated ones.

**The game does not need this.** With no backend deployed — which is the default
— CapyQuest works exactly as it always has: offline, installable, saved locally,
with a sixty-rival board. Nothing here is on the critical path of anything.

| File | |
|---|---|
| `worker.js` | The whole server. One Cloudflare Worker, five endpoints. |
| `schema.sql` | Two D1 tables. |
| `wrangler.toml` | Deploy config, with the steps in a comment at the top. |
| `dev.mjs` | Runs `worker.js` locally over SQLite, so you can test it without an account. |

## Running it locally

```sh
node server/dev.mjs        # http://127.0.0.1:8125
curl http://127.0.0.1:8125/v1/health
```

That is the *real* worker, not a stand-in — `dev.mjs` only swaps D1 for an
in-memory SQLite. It is how `tests/cloud.test.js` and the end-to-end browser
pass exercise the backend, and it is how the async-error bug described below was
found.

## Deploying it

```sh
npm i -g wrangler
wrangler login
wrangler d1 create capyquest                 # paste the id into wrangler.toml
wrangler d1 execute capyquest --remote --file=server/schema.sql
wrangler deploy --config server/wrangler.toml
```

Then point the game at it by adding one section to `content/pack.json`:

```json
{ "cloud": { "endpoint": "https://capyquest-api.<you>.workers.dev" } }
```

Commit that and you are done — the pack is fetched network-first, so the next
load picks it up with no rebuild and no deploy of the game itself. Leave the
section out and the whole backend stays dormant: no requests, and no Cloud save
switch in Settings, because a toggle that cannot do anything is worse than no
toggle.

**https only.** The schema refuses anything else, because a save blob over plain
http is a save blob anybody on the network can read and replace.

## What it will and will not do

**It is not authoritative.** It stores a blob the client gave it and hands it
back. It does not run the game, validate progress, or decide anything. Somebody
determined to edit their own save can already do it in devtools; this is
single-player, and defending a player's save against that player would cost real
people a great deal to inconvenience cheaters slightly.

**No personal data.** No email, no account, no password. A device generates a
random id and a random secret; the secret is the only thing that authorises a
write to that id. Lose both and you lose the cloud copy — the same failure as
losing the browser profile, and the save code in Settings is the answer to both.

**The board carries reached-depth, not loadouts.** A real row is a name, a
depth, a rebirth count and a pass level. Shipping gear across the network would
mean trusting a server to describe items the client then renders, which is a far
larger surface for something nobody asked for. Real rows are marked `real: true`
so the panel can say which is which — the game has said "these rivals are
simulated" since they were added, and that promise does not get quietly weakened
now some of them are not.

## Cost

The free tier, deliberately. Workers gives 100,000 requests a day; D1 gives
100,000 row writes a day and 5GB.

**D1 rather than KV**, and that was measured rather than preferred: KV's free
tier allows **1,000 writes a day**. At one save per five minutes of play that is
roughly eighty player-hours a day *in total*, so it would break at about thirty
players. D1 has about a hundred times the headroom for the same nothing.

The client rate-limits itself to one sync a minute per device on top of that.

## A bug worth recording

The first version of `fetch()` in `worker.js` did this:

```js
try {
  switch (route) {
    case 'POST /v1/save': return putSave(request, env);
```

Returning the promise rather than awaiting it means an async failure — a D1
error, a malformed row — escapes the `try` entirely. The `catch` never runs, the
careful 500 never happens, and the client gets a generic edge error instead.

It was invisible to the unit tests, which use a fake D1 that never fails. It
turned up the moment the real worker ran against a real SQLite with an empty
database: instead of a clean 500, the process died. Every branch is `await`ed
now.
