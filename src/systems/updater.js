// Registering the service worker, and deciding what an update looks like.
//
// The worker never activates itself (see sw.js). That decision lands here, and
// it comes down to one question: is there a session to disturb?
//
//   AT BOOT there is not. The game is not constructed, nothing is unsaved, and
//   a reload costs nobody anything — so a waiting build is taken immediately,
//   the boot screen says "Updating…", and the page reloads into the new
//   version. The player sees a loading screen for slightly longer.
//
//   MID-SESSION there is. Someone is three taps into a boss with a full combo
//   meter. Reloading out from under them to deliver a shop-price change is
//   indefensible, so it becomes a toast they can act on when they like, and
//   the update applies on their next visit regardless.
//
// Everything here is optional. No service worker, an insecure origin, a browser
// that refuses to register one, a registration that throws — all of them leave
// a game that works exactly as it did before, online.

/** How often to ask whether a new build has been deployed. */
const CHECK_INTERVAL_MS = 30 * 60e3;

let registration = null;
let reloading = false;

/**
 * Register the worker and report a waiting build.
 *
 * `onWaiting` is called with a function that applies the update. It may be
 * called at registration (a build was already waiting from a previous visit) or
 * later, when one finishes downloading mid-session.
 */
export function registerUpdates({ onWaiting } = {}) {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  // file:// has no service workers and never will. Saying so once is more use
  // than a SecurityError in the console.
  if (location.protocol === 'file:') {
    console.info('[capyquest] no offline support over file:// — serve the folder over http');
    return Promise.resolve(null);
  }

  // Relative, so it works at the repo root under `python3 -m http.server` and
  // under /CapyQuest/ on GitHub Pages without either knowing about the other.
  // The scope follows the script's own location for the same reason.
  return navigator.serviceWorker
    .register('sw.js', { scope: './' })
    .then((reg) => {
      registration = reg;

      // A build that finished downloading on a previous visit and has been
      // waiting ever since.
      if (reg.waiting && navigator.serviceWorker.controller) {
        onWaiting?.(applyUpdate);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state !== 'installed') return;
          // No controller means this is the first install on this device, not
          // an update. Announcing "a new version is ready" to somebody who has
          // been playing for four seconds is nonsense.
          if (!navigator.serviceWorker.controller) return;
          onWaiting?.(applyUpdate);
        });
      });

      watchForUpdates(reg);
      return reg;
    })
    .catch((err) => {
      // Registration failing is not the game failing.
      console.warn('[capyquest] offline support is unavailable', err);
      return null;
    });
}

/**
 * Ask the waiting worker to take over, and reload when it has.
 *
 * The reload is driven off `controllerchange` rather than fired straight after
 * the message: the new worker has to actually be in control before the page
 * reloads, or the reload is served by the old one and nothing changes.
 */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) return false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Chrome can fire this more than once. Reloading twice is a loop nobody
    // can get out of, so it happens at most once per page.
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Whether a build is downloaded and waiting to be taken. */
export function updateWaiting() {
  return Boolean(registration?.waiting);
}

/**
 * Look for a new build periodically and on the way back to the tab.
 *
 * An idle game is left open for hours or days — on a phone it is an installed
 * app that is never really closed — so waiting for a page load to notice a
 * deploy could mean waiting a week.
 */
function watchForUpdates(reg) {
  const check = () => {
    // Nothing to gain from asking while offline, and it logs a failed fetch.
    if (navigator.onLine === false) return;
    reg.update().catch(() => {});
  };

  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
}
