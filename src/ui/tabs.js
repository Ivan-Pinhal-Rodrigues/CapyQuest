// Tab bar for the side panel. Plain ARIA tabs with arrow-key navigation, plus
// a badge channel so a tab can advertise that something new is waiting in it.

export class Tabs {
  constructor(nav, panels, { onChange } = {}) {
    this.nav = nav;
    this.panels = panels;
    this.onChange = onChange;
    this.buttons = Array.from(nav.querySelectorAll('[data-tab]'));
    this.current = this.buttons[0]?.dataset.tab;

    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.select(btn.dataset.tab));
      btn.addEventListener('keydown', (e) => this.onKey(e));
    });

    this.select(this.current, true);
  }

  onKey(e) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const index = this.buttons.findIndex((b) => b.dataset.tab === this.current);
    const next = this.buttons[(index + dir + this.buttons.length) % this.buttons.length];
    this.select(next.dataset.tab);
    next.focus();
  }

  select(tab, silent = false) {
    if (!tab) return;
    this.current = tab;

    for (const btn of this.buttons) {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
      if (active) this.badge(tab, 0);
    }

    for (const [name, panel] of Object.entries(this.panels)) {
      panel.hidden = name !== tab;
    }

    if (!silent) this.onChange?.(tab);
  }

  /**
   * Mark a tab as having something waiting. Zero clears it; the active tab never
   * shows one, because you are already looking at it.
   *
   * It is a dot rather than a number on purpose. Twelve tabs share the width of
   * one panel, and a "9+" pill eats enough of a 63px tab to truncate the label
   * under it — "Seaso 9+" tells you less than "Season" plus a dot does. The
   * count is still available on hover, and the panel itself always shows the
   * real figure.
   */
  badge(tab, count) {
    const btn = this.buttons.find((b) => b.dataset.tab === tab);
    if (!btn) return;
    let dot = btn.querySelector('.tab__badge');
    if (count > 0 && tab !== this.current) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'tab__badge';
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
      }
      const label = `${count} waiting`;
      if (btn.title !== label) btn.title = label;
    } else {
      if (dot) dot.remove();
      btn.removeAttribute('title');
    }
  }
}
