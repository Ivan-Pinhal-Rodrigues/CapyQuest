// A coach mark: a callout pointing at something that is actually on screen.
//
// The alternative — a modal that describes a button you cannot see while you
// are reading about it — is how tutorials get skipped. This points at the real
// element, leaves it clickable, and gets out of the way the moment you do the
// thing.
//
// It reposositions on scroll and resize because the panels behind it scroll, and
// a callout pointing three inches below its button is worse than none.

let active = null;

export function closeCoachmark() {
  if (!active) return;
  active.dispose();
  active = null;
}

export function coachmarkOpen() {
  return !!active;
}

/**
 * Point at `selector`. `onDismiss` fires whether it was followed or waved away,
 * because either is the player deciding they are done with it.
 */
export function showCoachmark({ selector, title, body, onDismiss }) {
  closeCoachmark();

  const target = document.querySelector(selector);
  if (!target) return null;

  const el = document.createElement('div');
  el.className = 'coach';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);

  const h = document.createElement('strong');
  h.className = 'coach__title';
  h.textContent = title;

  const p = document.createElement('p');
  p.className = 'coach__body';
  p.textContent = body;

  const got = document.createElement('button');
  got.type = 'button';
  got.className = 'btn btn--small coach__ok';
  got.textContent = 'Got it';

  el.append(h, p, got);
  document.body.appendChild(el);

  const ring = document.createElement('div');
  ring.className = 'coach__ring';
  document.body.appendChild(ring);

  const place = () => {
    const box = target.getBoundingClientRect();
    // A target scrolled out of its panel has a zero-ish box; stop pointing at
    // nothing rather than parking the callout in the corner.
    if (box.width < 2 || box.height < 2) {
      el.hidden = true;
      ring.hidden = true;
      return;
    }
    el.hidden = false;
    ring.hidden = false;

    Object.assign(ring.style, {
      left: `${box.left - 4}px`,
      top: `${box.top - 4}px`,
      width: `${box.width + 8}px`,
      height: `${box.height + 8}px`,
    });

    const w = Math.min(260, window.innerWidth - 24);
    el.style.width = `${w}px`;
    const height = el.offsetHeight;

    // Below by default, above when there is no room — the common case on a
    // phone, where the tab bar sits near the bottom.
    const below = box.bottom + 10 + height < window.innerHeight - 8;
    el.style.top = `${below ? box.bottom + 10 : Math.max(8, box.top - height - 10)}px`;
    el.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, box.left + box.width / 2 - w / 2))}px`;
    el.classList.toggle('is-above', !below);
  };

  const dispose = () => {
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    clearInterval(tick);
    el.remove();
    ring.remove();
  };

  const done = () => {
    closeCoachmark();
    onDismiss?.();
  };

  got.addEventListener('click', done);
  // Following the advice counts as reading it.
  target.addEventListener('click', done, { once: true });

  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  // The panels behind this animate and reflow; polling is cheap and steadier
  // than trying to catch every layout change that could move the target.
  const tick = setInterval(place, 250);

  place();
  active = { dispose, selector };
  return { close: done };
}
