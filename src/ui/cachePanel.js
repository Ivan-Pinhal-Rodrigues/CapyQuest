// The offline cache meter.
//
// Visible whether or not there is anything in it. An empty tank still tells you
// how big it is and what an hour in it is worth, which is the only way the two
// offline numbers ever become something a player plans around rather than
// something they find out about in a receipt.

import { fmt, fmtShort, fmtTime } from './numbers.js';
import { cacheInfo } from '../systems/cache.js';

export class CachePanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.build();
  }

  build() {
    const r = this.root;
    r.className = 'cache';

    const head = el('div', 'cache__head');
    el('strong', 'cache__title', 'The pond keeps running', head);
    this.capLabel = el('span', 'cache__cap', '', head);
    r.appendChild(head);

    this.bar = el('div', 'cache__bar');
    this.fill = el('div', 'cache__fill', '', this.bar);
    this.spill = el('div', 'cache__spill', '', this.bar);
    r.appendChild(this.bar);

    this.amount = el('p', 'cache__amount', '', r);
    this.detail = el('p', 'cache__detail', '', r);

    this.collectBtn = document.createElement('button');
    this.collectBtn.type = 'button';
    this.collectBtn.className = 'btn btn--primary cache__collect';
    this.collectBtn.addEventListener('click', () => this.h.onCollect());
    r.appendChild(this.collectBtn);

    this.rateLabel = el('p', 'cache__rate', '', r);
  }

  update(state, derived) {
    const info = cacheInfo(state, derived);

    setText(this.capLabel, `holds ${fmtTime(info.capMs)}`);
    this.fill.style.transform = `scaleX(${info.ratio})`;
    this.bar.classList.toggle('is-full', info.full);

    if (info.zen > 0) {
      setText(this.amount, `${fmt(info.zen)} zen waiting`);
      setText(this.detail, `${fmtTime(info.ms)} of income banked. It will keep until you take it.`);
    } else {
      setText(this.amount, 'Empty');
      setText(this.detail, 'Close the tab and it starts filling. Come back and it is here.');
    }

    // The spill marker only appears once time has actually been lost, and it
    // says how much. A cap you have never hit is not worth shouting about.
    this.spill.hidden = info.lostMs <= 0;
    if (info.lostMs > 0) {
      setText(this.detail, `${fmtTime(info.ms)} banked · ${fmtTime(info.lostMs)} spilled over the top.`);
    }

    this.collectBtn.hidden = info.zen <= 0;
    setText(this.collectBtn, `Collect ${fmt(info.zen)}`);

    setText(
      this.rateLabel,
      `Filling at ${Math.round(info.rate * 100)}% of live income — about ${fmtShort(info.perHour)} an hour.`,
    );
  }
}

function el(tag, className, text, parent) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}
