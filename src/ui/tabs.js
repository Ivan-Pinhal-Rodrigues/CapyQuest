// Tab bar for the side panel.
//
// Twelve tabs was too many. A new player met a 6×2 grid of nouns before they
// had done anything, several of which were near-duplicates — Generators and
// Upgrades are both "spend zen", and Daily, Season and Rivals are all "timed
// stuff that resets". A grid of twelve is a menu you have to learn rather than
// a place you can look.
//
// So there are now eight tabs, and three of them are groups holding the
// sections that always belonged together. A group shows a small strip of
// sub-navigation; a tab with one section shows none, so most of the game looks
// exactly as it did.
//
// One thing kept deliberately: `current` is still the id of the visible
// *section*, not of the group. Everything outside this file asks questions like
// "are we on the quest tab" to decide whether to play a combat sound or repaint
// a panel, and those questions are about the section. Making `current` mean the
// group would have quietly broken every one of them in a way no test could see.

export class Tabs {
  constructor(nav, panels, { onChange, subnav } = {}) {
    this.nav = nav;
    this.panels = panels;
    this.onChange = onChange;
    this.subnav = subnav;
    this.buttons = Array.from(nav.querySelectorAll('[data-tab]'));

    // group id -> section ids, in the order the strip should show them.
    this.groups = new Map();
    for (const btn of this.buttons) {
      const sections = (btn.dataset.sections || btn.dataset.tab).split(/\s+/).filter(Boolean);
      this.groups.set(btn.dataset.tab, sections);
    }

    /** Which section each group was last left on, so returning feels like returning. */
    this.remembered = new Map();
    this.subButtons = [];

    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.select(btn.dataset.tab));
      btn.addEventListener('keydown', (e) => this.onKey(e));
    });

    this.group = this.buttons[0]?.dataset.tab;
    this.current = this.groups.get(this.group)?.[0];
    this.select(this.group, true);
  }

  /** The group a section belongs to. */
  groupOf(section) {
    for (const [group, sections] of this.groups) {
      if (sections.includes(section)) return group;
    }
    return null;
  }

  onKey(e) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const index = this.buttons.findIndex((b) => b.dataset.tab === this.group);
    const next = this.buttons[(index + dir + this.buttons.length) % this.buttons.length];
    this.select(next.dataset.tab);
    next.focus();
  }

  /**
   * Open a tab. Accepts a group id or a section id, because callers outside
   * this file think in sections — `tabs.select('rivals')` should land you on
   * the rivals board without needing to know it lives under Live now.
   */
  select(name, silent = false) {
    if (!name) return;
    const group = this.groups.has(name) ? name : this.groupOf(name);
    if (!group) return;

    const sections = this.groups.get(group);
    const section = this.groups.has(name)
      ? this.remembered.get(group) || sections[0]
      : name;

    this.group = group;
    this.current = section;
    this.remembered.set(group, section);

    for (const btn of this.buttons) {
      const active = btn.dataset.tab === group;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
      // Set here rather than in the markup: a group tab does not control one
      // fixed panel, it controls whichever of its sections is showing, so a
      // static id in the HTML would point at something that does not exist.
      const shown = btn.dataset.tab === group ? section : this.remembered.get(btn.dataset.tab);
      const panelId = this.panels[shown || this.groups.get(btn.dataset.tab)?.[0]]?.id;
      if (panelId) btn.setAttribute('aria-controls', panelId);
    }
    // Opening a group clears every badge inside it: you are looking at it now,
    // even if the thing that was waiting is on the sibling section.
    if (this.badges) for (const id of sections) this.badges.delete(id);
    this.repaintBadges();

    for (const [id, panel] of Object.entries(this.panels)) {
      panel.hidden = id !== section;
    }

    this.buildSubnav(group, section);
    if (!silent) this.onChange?.(section, group);
  }

  /**
   * The strip inside a group. Hidden entirely for a group of one, so the eight
   * single-section tabs look exactly as they always did.
   */
  buildSubnav(group, active) {
    if (!this.subnav) return;
    const sections = this.groups.get(group) || [];

    if (sections.length < 2) {
      this.subnav.hidden = true;
      this.subnav.textContent = '';
      this.subButtons = [];
      return;
    }

    this.subnav.hidden = false;
    this.subnav.textContent = '';
    this.subButtons = sections.map((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subtab';
      btn.dataset.section = id;
      btn.textContent = this.panels[id]?.dataset.label || id;
      btn.setAttribute('role', 'tab');
      if (this.panels[id]?.id) btn.setAttribute('aria-controls', this.panels[id].id);
      const on = id === active;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.addEventListener('click', () => this.select(id));
      this.subnav.appendChild(btn);
      return btn;
    });
    this.paintSubBadges();
  }

  /**
   * Mark a section as having something waiting.
   *
   * A badge is stored against the section and shown on the group, so "something
   * is waiting under Live" is visible without opening it — and once you are in
   * the group, the strip says which of the three it was.
   *
   * It is a dot rather than a number on purpose: a "9+" pill eats enough of a
   * narrow tab to truncate the label under it, and "Seaso 9+" tells you less
   * than "Season" plus a dot does. The count is on hover, and the panel itself
   * always shows the real figure.
   */
  badge(section, count) {
    if (!this.badges) this.badges = new Map();
    const group = this.groupOf(section);
    if (!group) return;

    if (count > 0 && group !== this.group) this.badges.set(section, count);
    else this.badges.delete(section);

    this.repaintBadges();
    this.paintSubBadges();
  }

  repaintBadges() {
    if (!this.badges) this.badges = new Map();
    for (const btn of this.buttons) {
      const sections = this.groups.get(btn.dataset.tab) || [];
      const total = sections.reduce((sum, id) => sum + (this.badges.get(id) || 0), 0);
      let dot = btn.querySelector('.tab__badge');

      if (total > 0 && btn.dataset.tab !== this.group) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'tab__badge';
          dot.setAttribute('aria-hidden', 'true');
          btn.appendChild(dot);
        }
        const label = `${total} waiting`;
        if (btn.title !== label) btn.title = label;
      } else {
        if (dot) dot.remove();
        btn.removeAttribute('title');
      }
    }
  }

  paintSubBadges() {
    if (!this.badges) return;
    for (const btn of this.subButtons) {
      const count = this.badges.get(btn.dataset.section) || 0;
      btn.classList.toggle('has-badge', count > 0 && btn.dataset.section !== this.current);
    }
  }
}
