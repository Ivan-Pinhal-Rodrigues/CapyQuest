// Toast queue for achievements, buffs and purchases.
//
// Toasts are queued rather than stacked without limit — during a frenzy the
// game can unlock several things a second, and a wall of cards would cover the
// capybara, which is the one thing that must stay clickable.

const DEFAULT_MS = 3800;

/** Phones get a shorter stack — the strip shares the screen with the capybara. */
function maxVisible() {
  return typeof window !== 'undefined' && window.innerWidth <= 900 ? 2 : 4;
}

export class Toaster {
  constructor(root) {
    this.root = root;
    this.queue = [];
    this.visible = 0;
  }

  /**
   * kind: 'achievement' | 'buff' | 'info' | 'warn'
   *
   * `onClick` turns the card into something you can act on rather than only
   * dismiss — the update notice needs it, since "a new version is ready" with
   * no way to take it is just an interruption. `ms: 0` keeps it up until it is
   * clicked, which is right for the same reason: an update that scrolls past in
   * four seconds may as well not have been announced.
   */
  show({ title, body = '', kind = 'info', icon = '', ms = DEFAULT_MS, onClick = null }) {
    this.queue.push({ title, body, kind, icon, ms, onClick });
    this.pump();
  }

  pump() {
    const limit = maxVisible();
    while (this.visible < limit && this.queue.length) {
      this.render(this.queue.shift());
    }
    // A long unlock cascade should not become a five-minute backlog of stale
    // cards — keep the most recent and drop the rest.
    if (this.queue.length > 8) this.queue.splice(0, this.queue.length - 8);
  }

  render({ title, body, kind, icon, ms, onClick }) {
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.setAttribute('role', 'status');
    if (onClick) el.classList.add('toast--action');

    const iconEl = document.createElement('span');
    iconEl.className = 'toast__icon';
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');

    const textEl = document.createElement('div');
    textEl.className = 'toast__text';

    const titleEl = document.createElement('strong');
    titleEl.className = 'toast__title';
    titleEl.textContent = title;
    textEl.appendChild(titleEl);

    if (body) {
      const bodyEl = document.createElement('span');
      bodyEl.className = 'toast__body';
      bodyEl.textContent = body;
      textEl.appendChild(bodyEl);
    }

    if (icon) el.appendChild(iconEl);
    el.appendChild(textEl);
    this.root.appendChild(el);
    this.visible++;

    // Force a reflow so the enter transition actually plays.
    void el.offsetWidth;
    el.classList.add('is-in');

    const dismiss = () => {
      if (el.dataset.dismissed) return;
      el.dataset.dismissed = '1';
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        this.visible--;
        this.pump();
      }, 260);
    };

    el.addEventListener('click', () => {
      // The action runs before the dismissal, not instead of it — a card whose
      // click does something should still go away afterwards.
      onClick?.();
      dismiss();
    });
    // ms: 0 means it waits. Only used for things that need a decision.
    if (ms > 0) setTimeout(dismiss, ms);
  }
}
