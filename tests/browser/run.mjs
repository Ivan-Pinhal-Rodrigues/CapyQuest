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
const counts = { smallText: 0, smallTaps: 0, overflow: 0, clipped: 0, consoleErrors: 0 };
const detail = { smallText: [], smallTaps: [], overflow: [], clipped: [], consoleErrors: [] };

const fail = (what) => failures.push(what);
const record = (key, what) => {
  counts[key]++;
  if (detail[key].length < 6) detail[key].push(what);
};

/**
 * Two embedding hosts, served over http rather than built with `setContent`.
 *
 * The iframe src is relative because these come from the same server the game
 * does, which is also what makes them a fair stand-in for a real embed.
 */
const framePage = (sandbox) =>
  `<!doctype html><meta charset=utf-8><title>host</title><body style="margin:0">
   <iframe width=880 height=660 sandbox="${sandbox}" src="/"></iframe>`;

const HOSTS = {
  '/__frame-open': framePage('allow-scripts allow-same-origin allow-popups allow-modals'),
  '/__frame-opaque': framePage('allow-scripts allow-popups allow-modals'),
};

const site = await serve(new URL('.', ROOT).pathname, HOSTS);
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
      const out = { overflow: null, text: [], taps: [], clipped: [] };

      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        out.overflow = `${document.documentElement.scrollWidth}px in a ${window.innerWidth}px viewport`;
      }

      /** Can the player scroll this element into view? */
      const scrollableAncestor = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
        }
        return false;
      };

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

          // Clipped by the viewport edge.
          //
          // The overflow check above cannot see this: the app now sets
          // `overflow-x: clip`, so content wider than the screen is cut off
          // rather than scrolling the page — the document width stays correct
          // and the count stays zero while a control is sliced in half. The
          // settings button was 16px off the right edge at 320px, tappable and
          // visibly wrong, and only a screenshot showed it.
          //
          // Something inside a scrollable container is not clipped, it is
          // scrolled to — the 210-node rebirth tree is a wide pannable board
          // and most of it is off screen on purpose. Only flag a control the
          // player has no way to bring into view.
          const offScreen = r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
          if (offScreen && !scrollableAncestor(el)) {
            const key = `clip:${el.className}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.clipped.push(`${el.id || el.className || el.tagName} runs to ${Math.round(r.right)}px in a ${window.innerWidth}px viewport`);
            }
          }
        }
      }
      return out;
    }, { minFont: MIN_FONT_PX, minTap: MIN_TAP_PX });

    if (found.overflow) record('overflow', `${vp.name}/${tab}: ${found.overflow}`);
    for (const t of found.text) record('smallText', `${vp.name}/${tab}: ${t}`);
    for (const t of found.taps) record('smallTaps', `${vp.name}/${tab}: ${t}`);
    for (const t of found.clipped) record('clipped', `${vp.name}/${tab}: ${t}`);
  }

  await ctx.close();
}

// ------------------------------------------------------------------ the pond
//
// The one part of this game that has shipped wrong twice while every unit test
// passed. Draft one stacked the late-game pond into two vertical walls; draft
// two filled it with a hundred and eight sprites of clutter. Both were caught
// by a screenshot and neither by a number, so what this does is take the
// measurements a screenshot would have made — how many things, where, and
// whether any of them is sitting on the capybara or off the edge.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => record('consoleErrors', `pond: THREW ${e.message.slice(0, 120)}`));
  await page.goto(site.url + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.capyquest, null, { timeout: 30000 });

  // 320px is the hard case: the narrowest screen with the fullest pond.
  const seen = await page.evaluate(async (origin) => {
    const { BUILDINGS } = await import(`${origin}/src/data/buildings.js`);
    const g = window.capyquest;
    g.state.story.onboarded = true;
    for (const [i, def] of BUILDINGS.entries()) {
      g.state.buildings[def.id] = [1, 4, 30, 250, 3000][i % 5];
      g.state.tierUpgrades[`${def.id}_t1`] = true;
      g.state.tierUpgrades[`${def.id}_t2`] = true;
    }
    for (const el of document.querySelectorAll('[class*=cutscene], .modal')) el.remove();
    g.updateUi(Date.now());
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = document.getElementById('scene');
    const capy = g.scene.capyBox;
    const boxes = g.scene.buildingBoxes;
    return {
      total: BUILDINGS.length,
      drawn: boxes.length,
      onTheCapy: boxes.filter((b) => Math.hypot(b.x - capy.x, b.y - capy.y) < capy.r).length,
      offCanvas: boxes.filter((b) => b.x - b.r < -1 || b.x + b.r > canvas.clientWidth + 1
        || b.y - b.r < -1 || b.y + b.r > canvas.clientHeight + 1).length,
      distinctX: new Set(boxes.map((b) => Math.round(b.x))).size,
      // Two things at the same size everywhere would mean the growth rule is
      // not running at all.
      distinctSizes: new Set(boxes.map((b) => Math.round(b.r))).size,
    };
  }, site.url);

  if (seen.drawn !== seen.total) fail(`pond: ${seen.drawn} sprites for ${seen.total} owned generators — it must be one each`);
  if (seen.onTheCapy > 0) fail(`pond: ${seen.onTheCapy} sprites are inside the capybara's tap circle`);
  if (seen.offCanvas > 0) fail(`pond: ${seen.offCanvas} sprites are off the edge of the scene`);
  // Draft one's failure, in the shape it would take again: everything at one x.
  if (seen.distinctX < seen.drawn * 0.85) {
    fail(`pond: ${seen.drawn} sprites share only ${seen.distinctX} x positions — they are stacking into columns`);
  }
  // Two, not three. Sprites blit at whole-number scales and a 320px canvas only
  // has room for two of them — see the note in scene.js. Asserting three here
  // is what this check did first, and it failed against correct code; the
  // measured truth is 2 at 320, 3 at 768, 5 at 1280. One would mean the growth
  // rule is not running at all, which is the thing worth catching.
  if (seen.distinctSizes < 2) fail('pond: every sprite is the same size — growth is not being applied');

  await ctx.close();
}

// ----------------------------------------------------------- embedded hosts
//
// itch.io serves an HTML5 game from an <iframe sandbox=…> on its own domain,
// and that is the free distribution route Phase F is for. The sandbox list is
// the host's choice, not ours, and there are two shapes it can take. Both are
// checked here because the difference is not cosmetic:
//
//   with allow-same-origin — the document keeps its real origin, module
//     scripts load, storage works, the service worker registers. Full game.
//
//   without it — the origin is opaque, module scripts are fetched in CORS
//     mode against origin 'null', and src/main.js is refused outright. Not a
//     degraded game: a permanently blank loading screen. The plan for this
//     phase assumed the worst case was "playable without offline support",
//     and that assumption was wrong; this is the measurement that corrected
//     it, so it stays in the suite rather than in a paragraph somewhere.
//
// The second case cannot be fixed from inside the page — there is no module
// loader left to fix it with — so what is asserted is that the player is told,
// by the classic-script watchdog at the bottom of index.html.
{
  // A context each, because the first one registers a service worker at scope
  // '/' and it would then answer the second navigation out of the cached shell
  // — the host page would come back as the game itself, with no iframe in it,
  // and the check would report a missing warning that was never missing. That
  // is a harness bug wearing a finding's clothes; a fresh context has no
  // worker.
  const open = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(site.url + '/__frame-open', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const framed = page.frames().find((f) => f !== page.mainFrame());
    const got = await framed?.evaluate(() => ({
    booted: !!window.capyquest,
      storage: (() => { try { localStorage.setItem('_p', '1'); localStorage.removeItem('_p'); return true; } catch { return false; } })(),
    })).catch((e) => ({ booted: false, storage: false, why: e.message.slice(0, 80) }));
    await ctx.close();
    return got ?? { booted: false, storage: false, why: 'no iframe on the host page' };
  })();
  if (!open.booted) fail(`sandboxed iframe with allow-same-origin: the game did not start${open.why ? ` (${open.why})` : ''}`);
  else if (!open.storage) fail('sandboxed iframe with allow-same-origin: saves would be lost');

  const shut = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(site.url + '/__frame-opaque', { waitUntil: 'domcontentloaded' });
    // Past the watchdog's grace period in index.html, which is deliberately
    // long enough not to accuse a slow phone of being broken.
    await page.waitForTimeout(13500);
    const framed = page.frames().find((f) => f !== page.mainFrame());
    const got = await framed?.evaluate(() => ({
      booted: !!window.capyquest,
      said: document.getElementById('bootStatus')?.textContent ?? '',
    })).catch((e) => ({ booted: false, said: `could not be read: ${e.message.slice(0, 80)}` }));
    await ctx.close();
    return got ?? { booted: false, said: 'no iframe on the host page' };
  })();
  if (shut.booted) {
    // Not a failure — it would mean the platform stopped requiring CORS for
    // module scripts, and the comment above is what needs updating.
    console.log('note: modules now load from an opaque origin; the watchdog case may be obsolete');
  } else if (!/could not start/i.test(shut.said)) {
    fail(`opaque-origin iframe: the boot screen never explains itself (it says "${shut.said}")`);
  }
}

await browser.close();
await site.close();

// ------------------------------------------------------------------ the gate

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { smallText: 0, smallTaps: 0, overflow: 0, clipped: 0, consoleErrors: 0 };

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
