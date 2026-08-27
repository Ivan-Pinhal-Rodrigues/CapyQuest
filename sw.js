// CapyQuest service worker.
//
// What it is for: the game runs offline once you have opened it, and opens
// instantly on a phone that has it installed. What it is emphatically not for
// is being clever — a service worker that gets caching wrong serves people a
// half-updated app and there is no way for them to fix it from their end.
//
// Three rules it follows.
//
//   ONE CACHE PER VERSION, DELETED WHOLE. `CACHE` carries the version; when a
//   new worker activates it deletes every other cache. There is no partial
//   upgrade and no possibility of a page loading half the old modules and half
//   the new ones, which is the failure this whole design exists to prevent.
//
//   IT NEVER TAKES OVER ON ITS OWN. `skipWaiting()` is called only when the page
//   asks for it. A worker that activates itself mid-session swaps the module
//   graph under a running game, and that is exactly how you get a save written
//   by one version of the code and read by another.
//
//   IT CANNOT MAKE THE GAME WORSE. Anything it does not understand — a POST,
//   another origin, a request it has no cached answer for and no network for —
//   falls through to the browser doing what it would have done anyway.
//
// There is no build step, so there is nothing to generate a file list from and
// no content hashes in the filenames. Both of those shape what follows.

// Keep in step with package.json's version. tests/pwa.test.js fails if they
// drift, because "I forgot to bump the worker" ships an app that never updates
// and gives no sign of it.
const VERSION = '4.0.0';
const CACHE = `capyquest-${VERSION}`;

// The pack is content, not code: an admin commits a change to it and expects to
// see it, so it is the one thing fetched from the network first.
const PACK = 'content/pack.json';

/**
 * The entry points. Everything else is discovered from them — see `warm()`.
 *
 * These three must exist, so they are fetched with `addAll`, which is atomic:
 * one 404 and the install fails rather than half-succeeding.
 */
const SHELL = ['./', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Everything else, best-effort, before this worker is considered
      // installed — so the first visit is enough to make the app work offline.
      await warm(cache);
    })(),
  );
  // No skipWaiting() here. See the rules at the top: the page decides.
});

/**
 * Pull the whole app into the cache at install time.
 *
 * The first draft did not do this. It cached only the three entries above and
 * left the other 119 files to the fetch handler, on the reasoning that one
 * online visit would pull the lot through. That reasoning was wrong, and the
 * browser said so: after a first visit the cache held three entries, no
 * JavaScript and no CSS.
 *
 * The visit that *installs* a worker is not controlled by it. Its stylesheets
 * and modules were requested before the worker existed, so they never touch the
 * fetch handler and never reach the cache. Someone who opens the game once and
 * then gets on a train has an app that cannot start — which is the exact case
 * this whole file exists for. (It appeared to work in testing only because the
 * ordinary HTTP cache answered, and that is evictable and guaranteed by
 * nobody.)
 *
 * So the list has to be known at install. With no build step there is nothing
 * to generate one, and hand-writing 120 paths means the list is wrong the first
 * time somebody adds a file — silently, showing up weeks later as a blank
 * screen for somebody offline. Instead it is discovered the same way the
 * browser discovers it: read index.html for the stylesheets and the entry
 * module, then follow the import graph.
 *
 * Best-effort throughout. A file that 404s is skipped rather than failing the
 * install, because a cache missing one module is worth having and no cache at
 * all is not.
 */
async function warm(cache) {
  try {
    const html = await (await fetch('index.html', { cache: 'reload' })).text();
    const urls = new Set();
    // Absolute throughout. The worker sits next to index.html, so its own
    // location is the right base — and keeping full URLs is what makes this
    // work unchanged at the repository root and under /CapyQuest/ on Pages,
    // where a path relative to the *origin* would gain the subdirectory twice.
    const at = (spec) => new URL(spec, self.location.href).href;

    // Stylesheets, in document order. Cross-origin ones (the font CDN) are
    // skipped for the same reason the fetch handler skips them.
    for (const [, href] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
      if (!/^https?:/.test(href)) urls.add(at(href));
    }
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      if (!/^https?:/.test(src)) urls.add(at(src));
    }

    // The module graph, followed from whatever index.html loads.
    for (const entry of [...urls].filter((u) => u.endsWith('.js'))) {
      for (const found of await crawl(entry)) urls.add(found);
    }

    // The icons, so an installed app has its own tile offline.
    const manifest = await (await fetch('manifest.webmanifest')).json();
    for (const icon of manifest.icons || []) urls.add(at(icon.src));

    // Individually, not addAll: one missing file must not throw away the other
    // hundred and nineteen.
    await Promise.allSettled(
      [...urls].map(async (url) => {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      }),
    );
  } catch (err) {
    // An install that cached only the shell still leaves a working online game,
    // and the fetch handler will fill the rest in on later visits.
    console.warn('[capyquest sw] could not warm the cache', err);
  }
}

/**
 * Every module reachable from `entry`, by reading the import statements.
 *
 * Regex rather than a parser, which is normally a bad idea and is fine here for
 * one reason: over-matching is harmless. A path picked out of a comment or a
 * string 404s and is skipped. Under-matching is what would hurt, and
 * `from '…'` covers static imports and re-exports alike, across line breaks.
 *
 * There is not one dynamic import in src/, so following the static graph
 * follows all of it. A test asserts that stays true.
 */
async function crawl(entry) {
  const seen = new Set();
  const queue = [new URL(entry, self.location.href).href];

  while (queue.length) {
    const url = queue.pop();
    if (seen.has(url) || !url.startsWith(self.location.origin)) continue;
    seen.add(url);

    let source;
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) continue;
      source = await res.text();
    } catch {
      continue;
    }

    for (const [, spec] of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue; // bare = not ours
      queue.push(new URL(spec, url).href);
    }
  }

  return [...seen];
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('capyquest-') && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      // Take over open tabs immediately. Safe here and not at install: by this
      // point the old cache is gone and every request will be served by this
      // version, so there is nothing left to mix.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  // Sent by src/systems/updater.js when the player agrees to the update, or at
  // boot when there is no session to disturb.
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Answering "which build is actually serving me" — used by the verification
  // pass, and the only way to tell an update that worked from one that looked
  // like it did. Replies down the port when the asker supplied one, and to the
  // client otherwise.
  if (event.data?.type === 'VERSION') {
    const reply = { type: 'VERSION', version: VERSION };
    if (event.ports?.[0]) event.ports[0].postMessage(reply);
    else event.source?.postMessage(reply);
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Another origin means the font CDN, which is deliberately not cached: it is
  // already loaded non-blocking and the game is designed to run in its fallback
  // faces. Caching somebody else's opaque response buys nothing and hides
  // whether it worked.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith(PACK)) {
    event.respondWith(packFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

/**
 * The content pack: network first, cache as a fallback.
 *
 * The whole promise of docs/CONTENT.md is that an admin edits the JSON, commits
 * it, and the change is live. Serving it cache-first would mean a shop price
 * was stuck behind a worker version bump, which is the opposite of the point of
 * having a pack at all.
 *
 * loadContent() already treats a failure as "use the built-in defaults", so the
 * worst case here is a game that boots on its defaults rather than one that
 * does not boot.
 */
async function packFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    // Offline and never fetched. A 404 is the honest answer and the loader
    // reads it as "no pack", which is a state it is built to handle.
    return new Response('{}', {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * A navigation. Cache first, because opening the app should not wait on a
 * network round trip, and offline it has to work at all.
 *
 * Matched with `ignoreSearch` so `?admin=1` — and any other query somebody
 * arrives with — still finds the one cached copy of the page rather than
 * missing and going to a network that may not be there.
 */
async function navigation(request) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(request, { ignoreSearch: true }))
    || (await cache.match('./'));
  if (hit) return hit;

  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put('./', fresh.clone());
    return fresh;
  } catch {
    // Nothing cached and no network. Better than the browser's dinosaur only
    // in that it says which app failed and why.
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>CapyQuest is offline</title>'
      + '<body style="background:#150f1c;color:#b3a3c0;font:16px system-ui;'
      + 'display:grid;place-items:center;height:100vh;margin:0;text-align:center">'
      + '<p>CapyQuest has not finished downloading yet.<br>Reconnect once and it '
      + 'will work offline after that.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/**
 * Everything else: modules, stylesheets, icons.
 *
 * Cache first with no revalidation, which is only correct because the cache is
 * versioned and deleted whole — a file is never updated in place, so a page
 * load is always entirely one version of the app. Freshness is the update
 * flow's job, not this function's.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const fresh = await fetch(request);
  // Only store a real, complete, same-origin success. A 404 in the cache would
  // be served forever, and an opaque cross-origin response cannot be inspected
  // to know whether it is even worth keeping.
  if (fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone());
  return fresh;
}
