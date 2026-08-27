// The QR encoder.
//
// A QR encoder you cannot decode is an encoder verified by nothing — the grid
// looks plausible whether it is right or wrong, and "it has finder patterns in
// the corners" is not the same as "a phone can read it".
//
// So this decodes every code with jsqr, an independent implementation. That is
// the second and last devDependency in the project, and it exists for exactly
// this: checking our encoder against somebody else's decoder rather than
// against our own assumptions. Chromium's BarcodeDetector would have done the
// job without it, but the Shape Detection API has no backend on Linux.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';

import { encodeQr, drawQr } from '../src/render/qr.js';

/**
 * The smallest canvas `drawQr` can be satisfied with.
 *
 * Testing `encodeQr` alone leaves the half that ships untested: the module
 * grid can be perfect and still reach the screen as a picture nothing scans,
 * because the drawing chose a scale, a quiet zone or a colour that ruined it.
 * So this records the fills and hands the result to the same decoder.
 */
function fakeCanvas() {
  const fills = [];
  let style = '#000';
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      set fillStyle(v) { style = v; },
      get fillStyle() { return style; },
      imageSmoothingEnabled: true,
      fillRect: (x, y, w, h) => fills.push({ x, y, w, h, style }),
    }),
    fills,
  };
}

/** Replay the fills into RGBA, so a decoder sees what a screen would. */
function paint(canvas) {
  const { width } = canvas;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const f of canvas.fills) {
    const dark = f.style !== '#ffffff';
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        const at = (y * width + x) * 4;
        const v = dark ? 0 : 255;
        data[at] = v; data[at + 1] = v; data[at + 2] = v;
      }
    }
  }
  return { data, width };
}

/**
 * Render a code to the RGBA buffer jsqr wants.
 *
 * With the quiet zone, because a code without one does not scan — and a test
 * that omits it would pass while the real thing failed against the game's dark
 * background.
 */
function rasterise(text, { scale = 4, quiet = 4 } = {}) {
  const { size, modules } = encodeQr(text);
  const width = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (c + quiet) * scale + dx;
          const y = (r + quiet) * scale + dy;
          const at = (y * width + x) * 4;
          data[at] = 0; data[at + 1] = 0; data[at + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

const roundTrip = (text) => {
  const { data, width } = rasterise(text);
  return jsQR(data, width, width)?.data ?? null;
};

test('a real decoder reads back what we encoded', () => {
  // The URLs this is actually for, plus the awkward shapes.
  const cases = [
    'https://ivan-pinhal-rodrigues.github.io/CapyQuest/',
    'https://capyquest.example/',
    'https://ivan-pinhal-rodrigues.github.io/CapyQuest/?utm_source=phone',
    'HELLO',
    'a',
  ];
  for (const text of cases) {
    assert.equal(roundTrip(text), text, `failed to round-trip ${JSON.stringify(text)}`);
  }
});

test('it survives the longest URL it claims to support', () => {
  // Version 6 at level M holds 106 bytes. The two reserved for the mode
  // indicator and length mean 104 of payload.
  const long = `https://example.com/${'a'.repeat(80)}`;
  assert.ok(long.length <= 104);
  assert.equal(roundTrip(long), long);
});

test('too long is a clear error rather than a broken code', () => {
  // The failure that matters: a code that encodes SOMETHING and scans to the
  // wrong thing would be far worse than one that refuses.
  assert.throws(() => encodeQr('x'.repeat(200)), /too long/);
});

test('non-ascii survives, because a URL can carry it', () => {
  const text = 'https://example.com/カピバラ';
  assert.equal(roundTrip(text), text);
});

test('the version grows only as far as the data needs', () => {
  // A version bigger than necessary is a denser code for no reason, which
  // scans worse from a phone camera across a room.
  assert.equal(encodeQr('hi').version, 1);
  assert.ok(encodeQr('https://ivan-pinhal-rodrigues.github.io/CapyQuest/').version <= 4);
});

test('the grid is square, sized to its version, and has its finders', () => {
  const { size, modules, version } = encodeQr('https://example.com');
  assert.equal(size, version * 4 + 17);
  assert.equal(modules.length, size);
  for (const row of modules) assert.equal(row.length, size);

  // Three finder patterns: dark ring, light gap, dark core.
  for (const [r, c] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    assert.equal(modules[r][c], true, 'finder corner should be dark');
    assert.equal(modules[r + 1][c + 1], false, 'finder ring should have a light gap');
    assert.equal(modules[r + 3][c + 3], true, 'finder core should be dark');
  }

  // The timing pattern alternates, which is how a scanner finds the pitch.
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6][i], i % 2 === 0, `horizontal timing wrong at ${i}`);
    assert.equal(modules[i][6], i % 2 === 0, `vertical timing wrong at ${i}`);
  }

  // The dark module is mandatory and always set.
  assert.equal(modules[size - 8][8], true);
});

test('what gets drawn to a canvas is what a phone reads', () => {
  const url = 'https://ivan-pinhal-rodrigues.github.io/CapyQuest/';
  const canvas = fakeCanvas();
  drawQr(canvas, url, { target: 180 });

  const { data, width } = paint(canvas);
  assert.equal(width, canvas.height, 'the canvas should be square');
  assert.equal(jsQR(data, width, width)?.data, url);
});

test('a target size picks a whole number of pixels per module', () => {
  // The bug this blocks: a canvas sized by CSS instead of by the grid. 25
  // modules in a 168px box is 6.72px each, the browser resamples, and half the
  // modules come out grey — a code that photographs beautifully and scans as
  // nothing. Every drawn size has to divide exactly.
  for (const text of ['hi', 'https://example.com', `https://example.com/${'a'.repeat(60)}`]) {
    const canvas = fakeCanvas();
    drawQr(canvas, text, { target: 180 });

    const span = encodeQr(text).size + 8; // the four-module quiet zone, both sides
    assert.equal(canvas.width % span, 0, `${text}: ${canvas.width}px does not divide by ${span}`);

    const scale = canvas.width / span;
    assert.ok(scale >= 2, `${text}: ${scale}px per module is too fine to scan`);
    assert.ok(canvas.width <= 180, `${text}: ${canvas.width}px overshoots the 180px it was asked for`);
  }
});

test('the same text encodes identically every time', () => {
  // Mask selection scores eight candidates and takes the best. A tie broken by
  // iteration order is fine; a tie broken by anything non-deterministic would
  // make this whole test file flaky.
  const a = encodeQr('https://example.com/stable');
  const b = encodeQr('https://example.com/stable');
  assert.deepEqual(a.modules, b.modules);
});
