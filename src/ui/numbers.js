// Number formatting for very large idle-game values.
// Pure functions only — no DOM, no state. Unit-tested in tests/numbers.test.js.

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T',
  'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
  'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg',
];

/**
 * Format a number for display. Small values keep decimals, large values get a
 * short-scale suffix, and anything past the suffix table falls back to
 * scientific notation so the HUD never overflows.
 */
export function fmt(value, decimals = 2) {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '0';
  const neg = value < 0;
  let n = Math.abs(value);

  if (n < 1000) {
    // Whole numbers stay whole; fractions show just enough precision to move.
    let out;
    if (n === 0) out = '0';
    else if (Number.isInteger(n)) out = String(n);
    else if (n < 0.01) out = n.toFixed(4);
    else if (n < 1) out = n.toFixed(3);
    else if (n < 100) out = trimZeros(n.toFixed(decimals));
    else out = trimZeros(n.toFixed(1));
    return neg ? `-${out}` : out;
  }

  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) {
    const out = n.toExponential(decimals).replace('e+', 'e');
    return neg ? `-${out}` : out;
  }

  const scaled = n / Math.pow(1000, tier);
  // Guard against float error pushing 999.999... into the next tier's range.
  const shown = scaled >= 999.995 ? '1' : trimZeros(scaled.toFixed(decimals));
  const suffix = scaled >= 999.995 ? SUFFIXES[tier + 1] ?? 'e' : SUFFIXES[tier];
  return `${neg ? '-' : ''}${shown}${suffix}`;
}

/** Compact variant for tight spaces (buttons, badges). */
export function fmtShort(value) {
  return fmt(value, 1);
}

/** Whole-number formatting with thousands separators, for counts. */
export function fmtInt(value) {
  if (!Number.isFinite(value)) return '∞';
  if (Math.abs(value) >= 1e6) return fmt(value, 2);
  return Math.floor(value).toLocaleString('en-US');
}

/** Percentage from a 0..1 ratio. */
export function fmtPct(ratio, decimals = 1) {
  return `${trimZeros((ratio * 100).toFixed(decimals))}%`;
}

/** Multiplier badge, e.g. 2.5 -> "×2.5". */
export function fmtMult(value, decimals = 2) {
  return `×${fmt(value, decimals)}`;
}

const YEAR_SEC = 365 * 86400;

/**
 * Duration in ms -> "1h 04m", "3m 20s", "12s".
 *
 * Idle-game durations can be genuinely astronomical — the wall detector asks
 * how long a boss would take to kill, and at depth the honest answer is 10^41
 * days. Rolling into scientific notation there reads as a bug, so anything past
 * a year becomes plain language instead.
 */
export function fmtTime(ms) {
  if (Number.isNaN(ms) || ms < 0) ms = 0;
  // Infinity is a real answer here — an enemy you cannot hurt at all.
  if (!Number.isFinite(ms)) return 'longer than there has been a pond';
  const totalSec = Math.floor(ms / 1000);

  if (totalSec >= YEAR_SEC * 1000) return 'longer than there has been a pond';
  if (totalSec >= YEAR_SEC) {
    const years = totalSec / YEAR_SEC;
    return `${fmt(years, 1)} year${Math.abs(years - 1) < 0.05 ? '' : 's'}`;
  }

  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/** Short countdown for timers: "04:31". */
export function fmtClock(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function trimZeros(str) {
  return str.includes('.') ? str.replace(/\.?0+$/, '') : str;
}

/** Roman numerals for upgrade tiers (I..XX). */
export function roman(n) {
  const table = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [val, sym] of table) {
    while (rest >= val) {
      out += sym;
      rest -= val;
    }
  }
  return out || 'I';
}
