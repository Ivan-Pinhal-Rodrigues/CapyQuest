// The version tool, and the pipeline that uses it.
//
// tests/pwa.test.js asserts package.json and sw.js carry the same version.
// This is the tool that moves them, and the workflow that calls it — the half
// that makes "somebody forgot to bump" impossible rather than merely detected.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { bump, readVersions } from '../tools/version.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const versionYml = read('../.github/workflows/version.yml');
const ciYml = read('../.github/workflows/ci.yml');

// ------------------------------------------------------------------ the tool

test('bump moves the part it is asked for and zeroes the rest', () => {
  assert.equal(bump('3.0.0', 'patch'), '3.0.1');
  assert.equal(bump('3.4.9', 'minor'), '3.5.0');
  assert.equal(bump('3.4.9', 'major'), '4.0.0');
  // A pre-release suffix is dropped rather than carried into the next version.
  assert.equal(bump('4.0.0-rc.2', 'patch'), '4.0.1');
});

test('bump refuses what it cannot parse', () => {
  assert.throws(() => bump('not-a-version', 'patch'));
  assert.throws(() => bump('3.0.0', 'sideways'));
});

test('the tool reads the same version tests/pwa.test.js checks', () => {
  const { pkg, sw } = readVersions();
  assert.equal(pkg, sw, 'package.json and sw.js have drifted');
});

test('importing the tool does not bump anything', () => {
  // The CLI block at the bottom of version.mjs runs on `node tools/version.mjs`.
  // If its guard were wrong, importing it here — or anywhere — would rewrite
  // two tracked files as a side effect of running the test suite.
  const before = readVersions();
  assert.deepEqual(readVersions(), before);
  const source = read('../tools/version.mjs');
  assert.ok(source.includes('import.meta.url.endsWith'),
    'the CLI must be guarded so an import cannot trigger it');
});

// -------------------------------------------------------------- the pipeline

test('only one workflow may write to the repository', () => {
  // A read-only CI job cannot be tricked into pushing. The bump is the single
  // exception and says so.
  assert.match(ciYml, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(versionYml, /permissions:\s*\n\s*contents:\s*write/);
});

test('the bump cannot loop', () => {
  // Two independent stops, deliberately. The bot commit changes sw.js — which
  // is on the watched list — so without a guard it would trigger a run that
  // bumps again, forever.
  assert.ok(versionYml.includes("github.actor != 'github-actions[bot]'"),
    'the actor guard is missing');
  assert.ok(/already changed in this push/.test(versionYml),
    'the version-already-moved guard is missing');
});

test('the bump only fires for files a player receives', () => {
  // A README fix must not invalidate every installed cache and make every
  // player re-download the app.
  const watched = versionYml.match(/grep -qE '\^\(([^']+)\)'/)[1];
  for (const path of ['src/', 'styles/', 'content/', 'index\\.html', 'sw\\.js', 'manifest\\.webmanifest']) {
    assert.ok(watched.includes(path), `${path} should invalidate the cache`);
  }
  for (const path of ['README', 'docs/', 'tests/', 'tools/']) {
    assert.ok(!watched.includes(path), `${path} should NOT invalidate the cache`);
  }
});

test('CI checks the version before it runs anything expensive', () => {
  assert.ok(ciYml.includes('node tools/version.mjs --check'));
  assert.ok(ciYml.indexOf('version.mjs --check') < ciYml.indexOf('tests/browser/run.mjs'),
    'checking the version is instant; do it before spending a browser on it');
});

test('the browser suite runs in CI and can find a browser', () => {
  assert.ok(ciYml.includes('node tests/browser/run.mjs'), 'the browser suite must run in CI');
  assert.ok(ciYml.includes('CHROMIUM_PATH'),
    'CI must tell the suite which browser to drive');
  assert.match(ciYml, /::error::.*Chrome|Chromium/,
    'a missing browser should fail with a sentence, not a launch stack trace');
});

test('the browser suite is a harness, not a runtime dependency', () => {
  // The game's whole premise is that it is static files with nothing to build.
  // playwright-core may live in devDependencies; it may never be imported by
  // anything the browser loads.
  const pkg = JSON.parse(read('../package.json'));
  assert.deepEqual(pkg.dependencies, undefined, 'the game must have no runtime dependencies');
  assert.ok(pkg.devDependencies['playwright-core'], 'the suite needs playwright-core');
});
