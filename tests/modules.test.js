// Every module parses, and every import resolves.
//
// This exists because of a bug that got all the way to the browser: a duplicate
// `import { equipCosmetic }` in main.js, which is a *parse* error and took the
// whole game down at boot. 375 tests stayed green through it, because none of
// them import main.js — it needs a DOM, so nothing in the suite had ever loaded
// it.
//
// So: parse every file, and separately resolve every relative import in the
// tree. Neither needs a DOM, and between them they catch the class of mistake
// that only shows up when you actually open the page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { SourceTextModule } from 'node:vm';
import path from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;

function allModules(dir = SRC, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allModules(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const MODULES = allModules();

test('there is a src tree to check', () => {
  assert.ok(MODULES.length > 40, `only found ${MODULES.length} modules`);
  assert.ok(MODULES.some((m) => m.endsWith('main.js')), 'main.js must be in the set — it is the one nothing else loads');
});

test('every module parses, main.js included', () => {
  for (const file of MODULES) {
    const source = readFileSync(file, 'utf8');
    const name = path.relative(SRC, file);
    try {
      // Parsing alone catches duplicate declarations, bad syntax and malformed
      // imports without needing a DOM to evaluate against.
      new SourceTextModule(source, { identifier: name });
    } catch (err) {
      assert.fail(`${name} does not parse: ${err.message}`);
    }
  }
});

test('every relative import points at a file that exists', () => {
  const pattern = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s+['"](\.[^'"]+)['"]/g;
  for (const file of MODULES) {
    const source = readFileSync(file, 'utf8');
    const name = path.relative(SRC, file);
    for (const [, spec] of source.matchAll(pattern)) {
      const target = path.resolve(path.dirname(file), spec);
      assert.ok(existsSync(target), `${name} imports "${spec}", which is not there`);
    }
  }
});

test('no module imports the same name twice', () => {
  // The exact bug this file was written for. A parse check already catches it,
  // but naming it makes the failure say what went wrong rather than "unexpected
  // token".
  for (const file of MODULES) {
    const source = readFileSync(file, 'utf8');
    const name = path.relative(SRC, file);
    const bound = new Map();

    for (const [, clause] of source.matchAll(/(?:^|\n)import\s+([^'"]+?)\s+from\s+['"][^'"]+['"]/g)) {
      const braces = clause.match(/\{([^}]*)\}/);
      const names = [];

      const bare = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
      if (bare && !bare.startsWith('*')) names.push(bare);
      if (braces) {
        for (const part of braces[1].split(',')) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          names.push(trimmed.includes(' as ') ? trimmed.split(' as ')[1].trim() : trimmed);
        }
      }

      for (const bindingName of names) {
        assert.ok(
          !bound.has(bindingName),
          `${name} imports "${bindingName}" twice — the second one is a parse error`,
        );
        bound.set(bindingName, true);
      }
    }
  }
});
