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

test('a module never uses an exported constant it forgot to import', () => {
  // Two bugs of exactly this shape have shipped: a duplicate import that took
  // the game down at boot, and KEYSTONE_COST used in main.js and never
  // imported. Neither is catchable by the parse check above, and nothing in the
  // suite imports main.js because it needs a DOM.
  //
  // The check is deliberately narrow rather than a general undefined-identifier
  // hunt, which would be a linter. It only flags a SCREAMING_CASE name that is
  // *exported by some module in src/* and used in a file that does not import
  // it — which is precisely the mistake, and cannot fire on a word that merely
  // appears in a blurb, because no module exports a constant called LUCK.
  const exported = new Set();
  for (const file of MODULES) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]{2,})\b/g)) exported.add(m[1]);
  }
  assert.ok(exported.size > 10, 'found almost no exported constants — the scan is broken');

  const problems = [];
  for (const file of MODULES) {
    const src = readFileSync(file, 'utf8');
    const code = stripCommentsAndStrings(src);

    const available = new Set();
    for (const m of code.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]{2,})\b/g)) {
      available.add(m[1]);
    }
    for (const m of code.matchAll(/import\s+\{([^}]*)\}\s+from/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) available.add(name);
      }
    }
    // `import * as B from ...` makes B.THING legal for any THING.
    const namespaced = /import\s+\*\s+as\s+\w+\s+from/.test(code);

    for (const m of code.matchAll(/(?<![.\w$])([A-Z][A-Z0-9_]{2,})\b/g)) {
      const name = m[1];
      if (!exported.has(name) || available.has(name)) continue;
      if (namespaced) continue;
      problems.push(`${file.split('/src/')[1]}: uses ${name} without importing it`);
    }
  }

  assert.deepEqual([...new Set(problems)], []);
});

/** Comments and string bodies removed, so prose cannot look like code. */
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
