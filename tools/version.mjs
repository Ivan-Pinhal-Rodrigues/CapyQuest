#!/usr/bin/env node
// The version, in the two places that have to agree.
//
// `package.json`'s `version` and `sw.js`'s `VERSION` are the same number. The
// service worker's cache is named after it, and a new name is the ONLY thing
// that makes a deployed change reach somebody who already has the app
// installed. Ship without bumping and the update pipeline is silently a no-op:
// no error, no warning, just players on last month's build forever.
//
// tests/pwa.test.js fails when the two drift. This is the other half — the
// thing that moves them, so that CI can do it and a human never has to
// remember. Both run this same code, because two implementations of "bump the
// version" is how they come to disagree.
//
//   node tools/version.mjs              # print the current version
//   node tools/version.mjs --check      # exit 1 if the two files disagree
//   node tools/version.mjs patch|minor|major
//   node tools/version.mjs 4.0.0        # set exactly

import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const PKG = new URL('package.json', ROOT);
const SW = new URL('sw.js', ROOT);

// The one place the shape of the constant is written down. Both read and write
// go through it, so a change to sw.js's formatting cannot silently break the
// bump while leaving the check passing.
const SW_PATTERN = /(const VERSION = ')([^']+)(')/;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function readVersions() {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  const sw = readFileSync(SW, 'utf8');
  const match = sw.match(SW_PATTERN);
  if (!match) throw new Error('sw.js has no `const VERSION = \'…\'` to read');
  return { pkg: pkg.version, sw: match[2] };
}

/** Bump one part of a semver string. Pre-release suffixes are dropped. */
export function bump(version, part) {
  const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
  if ([major, minor, patch].some((n) => !Number.isInteger(n))) {
    throw new Error(`"${version}" is not a version this can bump`);
  }
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`unknown part "${part}"`);
}

/** Write `next` into both files. Returns what changed. */
export function setVersion(next) {
  if (!SEMVER.test(next)) throw new Error(`"${next}" is not a semver version`);
  const before = readVersions();

  // Rewritten rather than re-serialised: JSON.stringify would reformat the
  // whole file and bury the one line that changed in a diff nobody can read.
  const pkgRaw = readFileSync(PKG, 'utf8');
  const pkgOut = pkgRaw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
  if (pkgOut === pkgRaw && before.pkg !== next) {
    throw new Error('could not find "version" in package.json');
  }

  const swRaw = readFileSync(SW, 'utf8');
  const swOut = swRaw.replace(SW_PATTERN, `$1${next}$3`);
  if (swOut === swRaw && before.sw !== next) {
    throw new Error('could not find VERSION in sw.js');
  }

  writeFileSync(PKG, pkgOut);
  writeFileSync(SW, swOut);
  return { from: before, to: next };
}

// ------------------------------------------------------------------- the CLI

// Only when run directly, so the tests can import the functions above without
// the module bumping anything on the way in.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const arg = process.argv[2];
  const current = readVersions();

  if (!arg) {
    console.log(current.pkg);
  } else if (arg === '--check') {
    if (current.pkg !== current.sw) {
      console.error(`version drift: package.json is ${current.pkg}, sw.js is ${current.sw}`);
      console.error('run `node tools/version.mjs patch` to move them together');
      process.exit(1);
    }
    console.log(`ok — both are ${current.pkg}`);
  } else {
    if (current.pkg !== current.sw) {
      console.error(`refusing to bump while the two disagree (${current.pkg} vs ${current.sw})`);
      console.error(`run \`node tools/version.mjs ${current.pkg}\` first to resettle them`);
      process.exit(1);
    }
    const next = ['major', 'minor', 'patch'].includes(arg) ? bump(current.pkg, arg) : arg;
    const result = setVersion(next);
    console.log(`${result.from.pkg} → ${result.to}`);
  }
}
