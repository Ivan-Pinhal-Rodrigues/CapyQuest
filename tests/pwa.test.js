// The installable app: manifest, icons, service worker, updater.
//
// Almost none of this can be checked by running it — a service worker needs a
// secure origin, a real registration and a second page load, and that happens in
// Chromium (see the verification notes in docs/POSTMORTEM.md). What node can
// check is the half that goes wrong silently: paths that only work at the
// repository root, an icon the manifest promises and the repo does not have, a
// worker whose version nobody bumped, and the two lines in sw.js that would
// make an update swap the app out from under a running game.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');
const updater = read('src/systems/updater.js');
const html = read('index.html');
const pkg = JSON.parse(read('package.json'));

/** A PNG's real dimensions, straight out of the IHDR chunk. */
function pngSize(path) {
  const buf = readFileSync(new URL(path, root));
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', `${path} is not a PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ----------------------------------------------------------------- manifest

test('the manifest says enough to be installable', () => {
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name, 'both names are needed');
  assert.ok(manifest.short_name.length <= 12, 'short_name is what fits under a home screen icon');
  assert.ok(/^#[0-9a-f]{6}$/i.test(manifest.theme_color));
  assert.ok(/^#[0-9a-f]{6}$/i.test(manifest.background_color));
  assert.ok(manifest.icons.length >= 2);
});

test('the splash colour matches the boot screen', () => {
  // background_color paints the launch screen before a single byte of the app
  // has run. Any other value means the installed app flashes one colour and
  // then becomes another, which reads as a bug in something.
  assert.ok(
    html.includes(`background: ${manifest.background_color}`),
    `the boot overlay should be painted ${manifest.background_color}`,
  );
});

test('every path in the manifest is relative', () => {
  // The game is served from the repository root under `python3 -m http.server`
  // and from /CapyQuest/ on GitHub Pages. One leading slash and the installed
  // app points at the wrong origin root — and it installs fine, so the first
  // sign of it is a blank screen on somebody's phone.
  const paths = [manifest.start_url, manifest.scope, manifest.id,
    ...manifest.icons.map((i) => i.src)];
  for (const path of paths) {
    assert.ok(path, 'a path is missing entirely');
    assert.ok(!path.startsWith('/'), `"${path}" is absolute`);
    assert.ok(!/^https?:/.test(path), `"${path}" names an origin`);
  }
});

test('every icon the manifest promises exists at the size it claims', () => {
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(icon.src, root)), `${icon.src} is missing`);
    const [w, h] = icon.sizes.split('x').map(Number);
    const real = pngSize(icon.src);
    assert.deepEqual(real, { w, h }, `${icon.src} is ${real.w}x${real.h}, declared ${icon.sizes}`);
  }
});

test('there is a maskable icon and a plain one', () => {
  // A maskable-only set gets padding baked into the browser tab favicon; a
  // plain-only set gets the capybara's ears cropped off by Android's mask.
  const purposes = manifest.icons.map((i) => i.purpose);
  assert.ok(purposes.some((p) => p?.includes('maskable')), 'no maskable icon');
  assert.ok(purposes.some((p) => p?.includes('any')), 'no plain icon');
});

test('iOS gets what it needs, since it reads none of the above', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /name="apple-mobile-web-app-capable"/);
  const touch = html.match(/rel="apple-touch-icon" href="([^"]+)"/)[1];
  assert.ok(existsSync(new URL(touch, root)), `${touch} is missing`);
  assert.deepEqual(pngSize(touch), { w: 180, h: 180 }, 'iOS wants 180x180');
});

// ----------------------------------------------------------- service worker

test('the worker version is the package version', () => {
  // The cache name carries the version, and a new version is the *only* thing
  // that makes a deployed change reach somebody who already has the app. Ship
  // without bumping it and the update pipeline is silently a no-op: no error,
  // no warning, just players on last month's build forever.
  const version = sw.match(/const VERSION = '([^']+)'/)[1];
  assert.equal(version, pkg.version,
    'sw.js VERSION and package.json version have drifted');
});

test('the worker never takes over on its own', () => {
  // skipWaiting() outside the message handler swaps the module graph under a
  // running game — a save written by one version and read by another. The page
  // asks for it; the worker never decides.
  const calls = [...sw.matchAll(/self\.skipWaiting\(\)/g)];
  assert.equal(calls.length, 1, 'there should be exactly one skipWaiting()');

  const handler = sw.slice(sw.indexOf("addEventListener('message'"));
  assert.ok(handler.includes('self.skipWaiting()'),
    'the only skipWaiting() must be the one the page asks for');
});

test('the worker deletes old caches when it activates', () => {
  const activate = sw.slice(sw.indexOf("addEventListener('activate'"),
    sw.indexOf("addEventListener('message'"));
  assert.ok(activate.includes('caches.delete'), 'an old cache is never cleaned up');
  assert.ok(activate.includes('!== CACHE'), 'it would delete the cache it just made');
});

test('the content pack is fetched from the network first', () => {
  // The promise of docs/CONTENT.md is that an admin commits a change to the
  // pack and sees it. Cache-first would put that behind a worker version bump,
  // which defeats the point of having a pack.
  assert.ok(sw.includes('packFirst'), 'no network-first path for the pack');
  const fn = sw.slice(sw.indexOf('async function packFirst'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.indexOf('await fetch(request)') < body.indexOf('cache.match'),
    'the pack must hit the network before the cache');
});

test('the worker pulls the whole app in at install', () => {
  // The first draft cached only the three shell entries and left the rest to
  // the fetch handler. Chromium said what that was worth: three entries, no
  // JavaScript, no CSS. The visit that *installs* a worker is not controlled by
  // it, so that visit's modules never touch the fetch handler — and someone who
  // opens the game once and then goes offline has an app that cannot start,
  // which is the whole case this file exists for.
  const install = sw.slice(sw.indexOf("addEventListener('install'"),
    sw.indexOf("addEventListener('activate'"));
  assert.ok(install.includes('warm(cache)'), 'install must warm the cache');
  assert.ok(sw.includes('async function crawl'), 'and discover the module graph');
});

test('the warm-up survives one missing file', () => {
  // addAll is atomic, which is right for the three entries that must exist and
  // catastrophic for a hundred and twenty that merely should — one stale path
  // and nobody gets an offline app at all.
  const warm = sw.slice(sw.indexOf('async function warm'));
  assert.ok(warm.includes('Promise.allSettled'), 'the bulk fetch must not be all-or-nothing');
  assert.ok(warm.includes('catch'), 'and the whole warm-up must not fail the install');
});

test('nothing in src/ is loaded dynamically', () => {
  // The crawl follows static `from '…'` specifiers, so a dynamic import()
  // would be invisible to it: the module would be missing from the cache and
  // the feature that needs it would fail, offline, only for some people. If
  // this ever has to change, the crawl has to learn about it first.
  const dir = new URL('../src/', import.meta.url);
  const walk = (at) => readdirSync(at, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(new URL(`${e.name}/`, at)) : [new URL(e.name, at)]);

  for (const file of walk(dir)) {
    if (!file.pathname.endsWith('.js')) continue;
    const source = readFileSync(file, 'utf8');
    // `import(` with a paren, as opposed to `import x from`. Ignore the word
    // inside comments, which several files use to explain this very rule.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/[^.\w]import\s*\(/.test(code),
      `${file.pathname.split('/src/')[1]} uses a dynamic import — sw.js's crawl cannot see it`);
  }
});

test('the worker leaves other origins alone', () => {
  // The font CDN. It is already loaded non-blocking and the game is designed to
  // run in fallback faces, so caching an opaque response buys nothing and hides
  // whether it worked.
  assert.ok(sw.includes('url.origin !== self.location.origin'),
    'cross-origin requests should fall straight through');
});

test('the worker only ever caches successful same-origin responses', () => {
  // A cached 404 is served forever, and there is no way for a player to clear it.
  assert.ok(sw.includes('fresh.ok && fresh.type === \'basic\''),
    'cacheFirst should refuse anything that is not a complete same-origin success');
});

test('nothing in the worker is an absolute path', () => {
  // Same subpath problem as the manifest: an absolute path in the shell list
  // installs a worker that caches the wrong origin's root.
  const shell = sw.match(/const SHELL = \[([^\]]+)\]/)[1];
  for (const entry of shell.split(',').map((s) => s.trim().replace(/'/g, ''))) {
    if (!entry) continue;
    assert.ok(!entry.startsWith('/'), `SHELL entry "${entry}" is absolute`);
  }
});

// ------------------------------------------------------------------ updater

test('the updater registers relatively, and scoped to the app', () => {
  assert.match(updater, /register\('sw\.js', \{ scope: '\.\/' \}\)/);
});

test('a first install is never announced as an update', () => {
  // No controller means this device has never had the worker — the "install"
  // event is the first one, not a new version. Telling somebody four seconds
  // into their first session that a new version is ready is nonsense, and
  // taking it would reload them out of the opening cutscene.
  assert.ok(updater.includes('if (!navigator.serviceWorker.controller) return;'),
    'the updater must distinguish a first install from an update');
});

test('the reload waits for the new worker to actually be in control', () => {
  // Reloading straight after postMessage races the activation: the reload gets
  // served by the old worker and nothing changes, which looks like an update
  // button that does not work.
  const fn = updater.slice(updater.indexOf('export function applyUpdate'));
  assert.ok(fn.indexOf('controllerchange') < fn.indexOf('postMessage'),
    'the controllerchange listener has to be attached before the message is sent');
  assert.ok(fn.includes('if (reloading) return;'),
    'controllerchange can fire twice, and two reloads is a loop');
});

test('no service worker is not an error', () => {
  // Insecure origin, file://, a browser that refuses, a registration that
  // throws. All of them leave a game that works exactly as it did before.
  assert.ok(updater.includes("if (!('serviceWorker' in navigator))"));
  assert.ok(updater.includes("location.protocol === 'file:'"));
  assert.ok(updater.includes('.catch('), 'a failed registration must not propagate');
});

// The boot sequence is at the end of main.js, and both names below also appear
// in the comments above it — anchor on the statement, at the start of a line,
// rather than on the first mention of the word.
const MAIN = read('src/main.js');
const BOOT_CALL = MAIN.indexOf('\nloadContent()');

test('the game does not wait on the updater to start', () => {
  // registerUpdates() returns a promise nobody awaits, and it must stay that
  // way: a slow or hanging registration cannot be allowed to hold the boot
  // sequence, which is the one thing standing between a player and the game.
  assert.ok(BOOT_CALL > -1, 'the boot sequence should call loadContent()');
  const call = MAIN.slice(MAIN.indexOf('registerUpdates({'));
  assert.ok(!/^\s*await/.test(call), 'registerUpdates must not be awaited');
  assert.ok(MAIN.indexOf('registerUpdates({') < BOOT_CALL,
    'it should be kicked off alongside the content fetch, not after it');
});

test('an update at boot reloads, and mid-session it asks', () => {
  const main = MAIN;
  const handler = main.slice(main.indexOf('onWaiting: (apply)'), BOOT_CALL);

  assert.ok(handler.includes("boot.step('updating')"),
    'a boot-time update should say so on the loading screen');
  assert.ok(handler.includes('ms: 0'),
    'the mid-session notice must wait for a decision rather than scroll past');
  assert.ok(handler.includes('.save()'),
    'reloading mid-session without saving first would cost the player their last few minutes');
});
