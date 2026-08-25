// The "while you were away" modal.
//
// Shown once per return, and only when there is something worth showing. The
// collect button is deliberately the last thing you do before the game starts,
// so coming back always opens with a reward rather than with a chore.

import { fmt, fmtTime } from './numbers.js';
import { openModal, el } from './modal.js';
import { iconImg, yuzuIconUrl } from './icons.js';

const MIN_SHOW_MS = 60e3; // under a minute away is not a nap

export function shouldShowNapReport(elapsedMs, zen) {
  return elapsedMs >= MIN_SHOW_MS && zen > 0;
}

export function openNapReport({ zen, elapsedMs, creditedMs, cappedMs, bonusZen, onCollect, onCollectBonus }) {
  const body = el('div', 'nap');

  const art = el('div', 'nap__art');
  art.appendChild(iconImg(yuzuIconUrl(), '', 'nap__yuzu pixel-icon'));
  body.appendChild(art);

  body.appendChild(el('p', 'nap__lead', `You were away for ${fmtTime(elapsedMs)}.`));

  const amount = el('p', 'nap__amount', fmt(zen));
  amount.appendChild(el('span', 'nap__amount-unit', ' zen'));
  body.appendChild(amount);

  body.appendChild(
    el('p', 'nap__detail', `The pond kept running for ${fmtTime(creditedMs)} of that.`),
  );

  if (cappedMs > 0) {
    // Say plainly that time was lost to the cap — hiding it just breeds
    // suspicion, and naming it makes the offline-cap relics worth wanting.
    body.appendChild(
      el(
        'p',
        'nap__detail nap__detail--warn',
        `${fmtTime(cappedMs)} went uncounted — the pond can only hold so much. Raise the cap to keep more.`,
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
    actions.unshift({
      label: `Stretch first (+${fmt(bonusZen)})`,
      variant: 'gold',
      onClick: () => onCollectBonus(zen + bonusZen),
    });
  }

  openModal({ title: 'Nap Report', bodyNode: body, actions, dismissible: false });
}
