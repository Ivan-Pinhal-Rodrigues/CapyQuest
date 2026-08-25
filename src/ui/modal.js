// Modal dialogs — the Nap Report, settings, confirmations.
//
// Focus is trapped while a modal is open and restored on close, and Escape
// always dismisses, so keyboard players never get stranded behind a dialog.

let activeModal = null;

export function openModal({ title, bodyNode, actions = [], dismissible = true, wide = false }) {
  closeModal();

  const previousFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const dialog = document.createElement('div');
  dialog.className = `modal${wide ? ' modal--wide' : ''}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', title);

  const header = document.createElement('header');
  header.className = 'modal__header';
  const h = document.createElement('h2');
  h.className = 'modal__title';
  h.textContent = title;
  header.appendChild(h);

  if (dismissible) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal__close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '✕';
    close.addEventListener('click', () => closeModal());
    header.appendChild(close);
  }

  const body = document.createElement('div');
  body.className = 'modal__body';
  if (bodyNode) body.appendChild(bodyNode);

  const footer = document.createElement('footer');
  footer.className = 'modal__footer';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${action.variant ? `btn--${action.variant}` : ''}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      const keepOpen = action.onClick?.();
      if (!keepOpen) closeModal();
    });
    footer.appendChild(btn);
  }

  dialog.append(header, body);
  if (actions.length) dialog.appendChild(footer);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== 'Tab') return;
    // Cycle focus inside the dialog.
    const focusables = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  if (dismissible) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  activeModal = { backdrop, onKey, previousFocus };

  void backdrop.offsetWidth;
  backdrop.classList.add('is-in');
  (dialog.querySelector('.btn') || dialog.querySelector('button') || dialog).focus?.();

  return { close: closeModal, body };
}

export function closeModal() {
  if (!activeModal) return;
  const { backdrop, onKey, previousFocus } = activeModal;
  activeModal = null;
  document.removeEventListener('keydown', onKey);
  backdrop.classList.remove('is-in');
  backdrop.classList.add('is-out');
  setTimeout(() => backdrop.remove(), 200);
  previousFocus?.focus?.();
}

export function isModalOpen() {
  return activeModal !== null;
}

/** Small helper for building modal bodies without innerHTML. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
