// A QR encoder, in about three hundred lines and no dependencies.
//
// WHY THIS EXISTS RATHER THAN A PNG. The whole premise of this project is that
// its art is data — sprites are character grids, backdrops are 16×16 tiles,
// the app icons are generated from the capybara. A QR code is a grid of black
// and white squares, which is exactly that. Committing one as an image would
// also freeze the URL into a binary nobody can review, and it would be wrong
// the moment the game moved to a custom domain.
//
// Encoding it at runtime means the code points at wherever the page is
// ACTUALLY being served from — github.io today, a custom domain tomorrow, an
// itch.io iframe after that — with nothing to regenerate and nothing to forget.
//
// WHAT IT SUPPORTS. Byte mode, error-correction level M, versions 1–6. That
// tops out at 106 bytes, which is a long URL and far more than this needs. It
// is not a general QR library and should not become one: anything it cannot
// encode is a URL that is too long to be scanned comfortably anyway.
//
// Level M corrects about 15% damage. L would fit more and survive less; a code
// on a screen being photographed at an angle in bad light wants the margin.

/** Data codewords, EC codewords per block, and block count, for level M. */
const VERSIONS = [
  // version, totalCodewords, ecPerBlock, blocks
  { version: 1, total: 26, ecPerBlock: 10, blocks: 1 },
  { version: 2, total: 44, ecPerBlock: 16, blocks: 1 },
  { version: 3, total: 70, ecPerBlock: 26, blocks: 1 },
  { version: 4, total: 100, ecPerBlock: 18, blocks: 2 },
  { version: 5, total: 134, ecPerBlock: 24, blocks: 2 },
  { version: 6, total: 172, ecPerBlock: 16, blocks: 4 },
];

/** Alignment pattern centres, by version. Version 1 has none. */
const ALIGNMENT = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

/** Format information, level M, one per mask. Pre-computed BCH(15,5) values. */
const FORMAT_BITS = [
  0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
];

// ------------------------------------------------------------ GF(256) tables

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // The QR generator polynomial, x^8 + x^4 + x^3 + x^2 + 1.
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The Reed-Solomon generator polynomial of the given degree. */
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Error-correction codewords for one block. */
function ecCodewords(data, count) {
  const gen = generator(count);
  const out = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    for (let i = 0; i < count; i++) out[i] ^= mul(gen[i + 1], factor);
  }
  return out;
}

// ------------------------------------------------------------------ encoding

/**
 * Encode `text` as a QR module grid.
 *
 * Returns `{ size, modules }` where `modules` is a size×size array of booleans,
 * true meaning dark. Throws only when the text is too long for version 6 —
 * callers that cannot handle that should check the length first.
 */
export function encodeQr(text) {
  const bytes = new TextEncoder().encode(String(text));

  const spec = VERSIONS.find((v) => capacity(v) >= bytes.length + 2);
  if (!spec) {
    throw new Error(`"${text.slice(0, 24)}…" is ${bytes.length} bytes — too long for version 6`);
  }

  const dataCodewords = capacity(spec);
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // versions 1-9 use an 8-bit count in byte mode
  for (const byte of bytes) push(byte, 8);

  // Terminator, then pad to a byte boundary, then the two alternating pad
  // bytes the spec names.
  push(0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  for (let i = 0; words.length < dataCodewords; i++) words.push(i % 2 ? 0x11 : 0xec);

  // Split into blocks, error-correct each, then interleave — the spec's
  // ordering, which is what spreads a burst of damage across every block.
  const perBlock = Math.floor(dataCodewords / spec.blocks);
  const longBlocks = dataCodewords % spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  let at = 0;
  for (let b = 0; b < spec.blocks; b++) {
    const length = perBlock + (b >= spec.blocks - longBlocks ? 1 : 0);
    const block = words.slice(at, at + length);
    at += length;
    dataBlocks.push(block);
    ecBlocks.push(ecCodewords(block, spec.ecPerBlock));
  }

  const interleaved = [];
  for (let i = 0; i < Math.max(...dataBlocks.map((b) => b.length)); i++) {
    for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  return place(spec, interleaved);
}

const capacity = (spec) => spec.total - spec.ecPerBlock * spec.blocks;

// ------------------------------------------------------------------ the grid

function place(spec, codewords) {
  const size = spec.version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  // Which cells are structure rather than data — masking must skip them.
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (r, c, dark) => {
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finder patterns, one in each corner but the bottom-right, plus separators.
  for (const [row, col] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = inner && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = inner && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(rr, cc, ring || core);
      }
    }
  }

  // Timing patterns: the alternating row and column that let a scanner work
  // out the module pitch.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centres = ALIGNMENT[spec.version];
  for (const r of centres) {
    for (const c of centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === centres.at(-1))
          || (r === centres.at(-1) && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // The dark module, and the format-info area (filled in after masking).
  set(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) set(8, size - 1 - i, false);
    if (!reserved[size - 1 - i][8]) set(size - 1 - i, 8, false);
  }

  // Data, in the spec's boustrophedon: two columns at a time, right to left,
  // alternating up and down, skipping the timing column.
  const bitAt = (i) => (codewords[i >> 3] >> (7 - (i & 7))) & 1;
  let bit = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern is not a data column
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        if (bit < codewords.length * 8) modules[row][col] = bitAt(bit) === 1;
        bit++;
      }
    }
    upward = !upward;
  }

  // Try every mask and keep the least ugly, which is what the spec asks for
  // and what makes the difference between a code that scans first time and one
  // that needs three tries.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(modules, reserved, mask, size);
    writeFormat(candidate, size, mask);
    const score = penalty(candidate, size);
    if (!best || score < best.score) best = { score, modules: candidate };
  }

  return { size, modules: best.modules, version: spec.version };
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(modules, reserved, mask, size) {
  const out = modules.map((row) => [...row]);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && MASKS[mask](r, c)) out[r][c] = !out[r][c];
    }
  }
  return out;
}

function writeFormat(modules, size, mask) {
  const bits = FORMAT_BITS[mask];
  for (let i = 0; i < 15; i++) {
    // MSB first: position 0 in the table below takes bit 14, not bit 0.
    //
    // Getting this backwards produced a code that was internally perfect and
    // universally unreadable — every structural check passed, the Reed-Solomon
    // matched the spec's own worked example, and a decoder written against
    // this same file read "HELLO" straight back out. It could not have done
    // otherwise: it shared the mistake. A real decoder read the format field
    // reversed, unmasked with the wrong mask, and got noise.
    //
    // That is what the jsqr devDependency is for, and it is the whole argument
    // for checking your own work with somebody else's implementation.
    const dark = ((bits >> (14 - i)) & 1) === 1;
    // The format information is written twice, in two L-shapes, so losing one
    // corner does not lose the code.
    if (i < 6) modules[8][i] = dark;
    else if (i === 6) modules[8][7] = dark;
    else if (i === 7) modules[8][8] = dark;
    else if (i === 8) modules[7][8] = dark;
    else modules[14 - i][8] = dark;

    // Seven bits down the column, eight along the row — NOT eight and seven.
    // The eighth cell down that column is the dark module, so writing a format
    // bit there both loses the bit and destroys the module. It produced codes
    // that looked perfectly well-formed and decoded to nothing at all; jsqr
    // reading back an empty string is what caught it.
    if (i < 7) modules[size - 1 - i][8] = dark;
    else modules[8][size - 15 + i] = dark;
  }
  modules[size - 8][8] = true; // the dark module, always
}

/** The spec's four penalty rules. Lower is better. */
function penalty(modules, size) {
  let score = 0;

  // Rule 1: runs of five or more of the same colour, in rows and in columns.
  for (const transposed of [false, true]) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        const prev = transposed ? modules[b - 1][a] : modules[a][b - 1];
        const cur = transposed ? modules[b][a] : modules[a][b];
        if (cur === prev) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: 2×2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: the finder-like pattern 1:1:3:1:1 with four light modules beside
  // it, which a scanner can mistake for a real finder.
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  for (const transposed of [false, true]) {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b + pattern.length <= size; b++) {
        let hit = true;
        for (let i = 0; i < pattern.length && hit; i++) {
          const v = transposed ? modules[b + i][a] : modules[a][b + i];
          if (v !== pattern[i]) hit = false;
        }
        if (hit) score += 40;
      }
    }
  }

  // Rule 4: an imbalance between dark and light overall.
  let dark = 0;
  for (const row of modules) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// -------------------------------------------------------------------- to DOM

/**
 * Draw a code onto a canvas at an integer module size.
 *
 * `quiet` is the mandatory light border — four modules is the spec's minimum
 * and a code without it fails to scan against a dark page, which is exactly
 * what this game is.
 *
 * `target` is the width you would LIKE, in CSS pixels, and the reason this
 * option exists rather than a fixed `width` in the stylesheet. The grid is 21
 * modules wide at version 1 and 41 at version 6, so a canvas pinned to one
 * size in CSS is resampled by whatever ratio happens to fall out — and a
 * fractional module is a module a camera reads as half dark. Choosing the
 * scale here instead keeps every module an exact whole number of pixels and
 * lets the drawing come out at whatever size that implies.
 */
export function drawQr(canvas, text, { scale, target, quiet = 4, dark = '#150f1c', light = '#ffffff' } = {}) {
  const { size, modules } = encodeQr(text);

  const span = size + quiet * 2;
  // Two pixels per module is the floor a phone camera can still resolve; past
  // twelve the code is just large.
  if (!scale) scale = target ? Math.min(12, Math.max(2, Math.floor(target / span))) : 4;

  const total = span * scale;

  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // The quiet zone is part of the code, not a margin around it — it has to be
  // the light colour rather than whatever the page is behind it.
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, total, total);

  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }
  return canvas;
}
