// The "while you were away" modal — now a view onto the cache rather than a
// one-shot payout.
//
// The difference matters. The old report handed you the zen and closed, which
// meant the only moment the offline cap was ever mentioned was the moment it
// had already cost you something. Now the report shows the tank: how full it
// got, what spilled, and what the tank holds. Leaving it is a real option —
// the meter in the You panel keeps it, and nothing expires.

import { fmt, fmtTime } from './numbers.js';
import { openModal, el } from './modal.js';
import { iconImg, yuzuIconUrl } from './icons.js';

const MIN_SHOW_MS = 60e3; // under a minute away is not a nap

export function shouldShowNapReport(elapsedMs, zen) {
  return elapsedMs >= MIN_SHOW_MS && zen > 0;
}

export function openNapReport({
  zen,
  elapsedMs,
  creditedMs,
  cappedMs,
  capMs,
  bonusZen,
  onCollect,
  onCollectBonus,
  onLeave,
}) {
  const body = el('div', 'nap');

  const art = el('div', 'nap__art');
  art.appendChild(iconImg(yuzuIconUrl(), '', 'nap__yuzu pixel-icon'));
  body.appendChild(art);

  body.appendChild(el('p', 'nap__lead', `You were away for ${fmtTime(elapsedMs)}.`));

  const amount = el('p', 'nap__amount', fmt(zen));
  amount.appendChild(el('span', 'nap__amount-unit', ' zen'));
  body.appendChild(amount);

  // The tank, drawn at the size it actually is, so "the cap" is a picture
  // before it is ever a complaint.
  const bar = el('div', 'nap__bar');
  const fill = el('div', 'nap__bar-fill');
  fill.style.transform = `scaleX(${capMs > 0 ? Math.min(1, creditedMs / capMs) : 0})`;
  bar.appendChild(fill);
  body.appendChild(bar);

  body.appendChild(
    el('p', 'nap__detail', `${fmtTime(creditedMs)} banked of a ${fmtTime(capMs)} cache.`),
  );

  if (cappedMs > 0) {
    // Say plainly that time was lost to the cap — hiding it just breeds
    // suspicion, and naming it makes the offline-cap upgrades worth wanting.
    body.appendChild(
      el(
        'p',
        'nap__detail nap__detail--warn',
        `${fmtTime(cappedMs)} spilled over the top. Raise the cache to hold more of it.`,
      ),
    );
  }

  const actions = [
    {
      label: `Collect ${fmt(zen)}`,
      variant: 'primary',
      onClick: () => onCollect(zen),
    },
  ];

  if (bonusZen > 0) {
    // A free choice, not a paywall and not an ad — it just rewards reading the
    // report instead of dismissing it.
    actions.unshift({
      label: `Stretch first (+${fmt(bonusZen)})`,
      variant: 'gold',
      onClick: () => onCollectBonus(zen + bonusZen),
    });
  }

  // No variant: the plain button is the quiet one, so "leave it" cannot be
  // mistaken for the thing you are meant to press.
  if (onLeave) actions.push({ label: 'Leave it in the cache', onClick: onLeave });

  openModal({ title: 'Nap Report', bodyNode: body, actions, dismissible: false });
}
