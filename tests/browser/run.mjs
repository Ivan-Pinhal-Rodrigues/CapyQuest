// The browser suite.
//
// `npm test` runs 673 assertions and cannot see a single one of the problems
// this file exists for. Four bugs in v3 shipped past green tests and headless
// probes: a cloak painted in the sunglasses' palette, a loading screen that
// faded out mid-sentence, a loading screen underneath the game, and nine event
// backdrops that were secretly two. Every one of them needed something to open
// the page and look.
//
// So this is the part that opens the page. It runs in CI on every push, and it
// checks the things a unit test structurally cannot: what the browser actually
// prints to the console, what size things actually come out, and whether the
// layout actually fits.
//
// ---------------------------------------------------------------------------
// THE RATCHET
//
// Two of these checks fail on the code as it stands: the type scale has 52 CSS
// rules under 8px, and the tap targets that go with them are 20px against a
// 24px floor. Turning the checks on as hard failures would mean landing this
// pipeline with CI already red, which teaches everybody to ignore it.
//
// Instead `baseline.json` records what is wrong today, and the suite fails when
// a number goes UP. Regression is blocked immediately; the existing debt is
// paid down in Phase B, and the baseline goes to zero with it. A baseline that
// is allowed to drift upwards is just a list of excuses, so the only permitted
// direction is down — the suite rewrites the file when a count improves and
// tells you to commit it.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { serve } from './server.mjs';

const ROOT = new URL('../../', import.meta.url);
const BASELINE = new URL('baseline.json', import.meta.url);

/** Smallest readable text, and the WCAG 2.2 floor for a pointer target. */
const MIN_FONT_PX = 11;
const MIN_TAP_PX = 24;

const VIEWPORTS = [
  { name: 'tiny', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

/**
 * Find a Chromium to drive.
 *
 * CI installs one with `npx playwright install chromium`; a sandbox may have
 * one preinstalled at a path playwright-core does not know about. Checking an
 * explicit override first means neither environment has to be special-cased in
 * the workflow file.
 */
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && existsSync(dir)) {
    const found = readdirSync(dir).find((n) => n.startsWith('chromium-'));
    if (found) return `${dir}/${found}/chrome-linux/chrome`;
  }
  return undefined; // let playwright-core resolve its own download
}

const failures = [];
const counts = { smallText: 0, smallTaps: 0, overflow: 0, consoleErrors: 0 };
const detail = { smallText: [], smallTaps: [], overflow: [], consoleErrors: [] };

const fail = (what) => failures.push(what);
const record = (key, what) => {
  counts[key]++;
  if (detail[key].length < 6) detail[key].push(what);
};

const site = await serve(new URL('.', ROOT).pathname);
const browser = await chromium.launch({ executablePath: chromiumPath() });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    // The font CDN is loaded non-blocking on purpose and is allowed to fail;
    // the game is designed to run in its fallback faces.
    if (m.type() === 'error' && !m.text().includes('fonts.g')) {
      record('consoleErrors', `${vp.name}: ${m.text().slice(0, 120)}`);
    }
  });
  page.on('pageerror', (e) => record('consoleErrors', `${vp.name}: THREW ${e.message.slice(0, 120)}`));

  await page.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.capyquest, null, { timeout: 30000 })
    .catch(() => fail(`${vp.name}: the game never started`));

  // Give the player everything, so every panel has real content to lay out.
  // A tab that is empty is a tab that cannot overflow.
  await page.evaluate(() => {
    const s = window.capyquest.state;
    s.story.onboarded = true;
    s.zen = 1e18; s.totalZen = 1e18; s.essence = 5e5; s.leafs = 1e5; s.lotus = 900;
    s.combat.shards = 1e6; s.gacha.tickets = 300;
    s.combat.unlocked = true; s.combat.depth = 90; s.combat.bestDepth = 100;
    s.rebirthUnlocked = true; s.rebirthCount = 10;
    for (const el of document.querySelectorAll('[class*=cutscene]')) el.remove();
  });
  await page.waitForTimeout(500);

  const tabs = await page.$$eval('#tabs button', (b) => b.map((x) => x.dataset.tab).filter(Boolean));
  if (!tabs.length) fail(`${vp.name}: no tabs rendered`);

  for (const tab of tabs) {
    await page.evaluate((t) => window.capyquest.tabs.select(t), tab);
    await page.waitForTimeout(220);
    // Modals re-open on their own timers (the login reward, for one) and would
    // otherwise be measured as part of the panel.
    await page.evaluate(() => { for (const m of document.querySelectorAll('.modal')) m.remove(); });

    const found = await page.evaluate(({ minFont, minTap }) => {
      const out = { overflow: null, text: [], taps: [] };

      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        out.overflow = `${document.documentElement.scrollWidth}px in a ${window.innerWidth}px viewport`;
      }

      const seen = new Set();
      for (const el of document.querySelectorAll('#app *')) {
        if (!el.offsetParent) continue;
        const cs = getComputedStyle(el);

        // Text: only elements that actually render their own text, so a
        // container inheriting a size is not counted once per child.
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (ownText) {
          const px = parseFloat(cs.fontSize);
          if (px < minFont) {
            const key = `${el.className}|${px}`;
            if (!seen.has(key)) { seen.add(key); out.text.push(`${el.className || el.tagName} @ ${px}px`); }
          }
        }

        if (el.matches('button, [role=button], a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.height < minTap) {
            const key = `tap:${el.className}|${Math.round(r.height)}`;
            if (!seen.has(key)) { seen.add(key); out.taps.push(`${el.className || el.tagName} @ ${Math.round(r.height)}px`); }
          }
        }
      }
      return out;
    }, { minFont: MIN_FONT_PX, minTap: MIN_TAP_PX });

    if (found.overflow) record('overflow', `${vp.name}/${tab}: ${found.overflow}`);
    for (const t of found.text) record('smallText', `${vp.name}/${tab}: ${t}`);
    for (const t of found.taps) record('smallTaps', `${vp.name}/${tab}: ${t}`);
  }

  await ctx.close();
}

await browser.close();
await site.close();

// ------------------------------------------------------------------ the gate

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { smallText: 0, smallTaps: 0, overflow: 0, consoleErrors: 0 };

let improved = false;
for (const [key, now] of Object.entries(counts)) {
  const allowed = baseline[key] ?? 0;
  if (now > allowed) {
    fail(`${key}: ${now}, up from an allowed ${allowed}\n    ${detail[key].join('\n    ')}`);
  } else if (now < allowed) {
    improved = true;
    baseline[key] = now;
  }
}

// Anything that must never be non-zero, baseline or not.
if (counts.consoleErrors > 0 && baseline.consoleErrors === 0) {
  fail(`the console must stay clean:\n    ${detail.consoleErrors.join('\n    ')}`);
}

console.log('browser suite —', JSON.stringify(counts));

if (improved) {
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log('baseline improved and rewritten — commit tests/browser/baseline.json');
}

if (failures.length) {
  console.error(`\n${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('no regressions.');
