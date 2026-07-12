/**
 * pwaInstall — install-prompt plumbing for the PWA.
 *
 * Why this exists: desktop Chrome shows an install icon in the address bar on
 * its own, but MOBILE browsers do not. Android Chrome only fires a
 * `beforeinstallprompt` event that the app must capture and re-surface with
 * its own UI, and iOS Safari has no prompt at all — users must be shown the
 * manual "Share → Add to Home Screen" steps. This module captures the event
 * at bundle-eval time (it fires early) and exposes a tiny store the mobile
 * shell subscribes to.
 */

type Listener = () => void;

let deferredPrompt: any = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach(f => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();          // suppress Chrome's mini-infobar; we present our own UI
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Already running as an installed app (home-screen launch). */
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

/** iOS (incl. iPadOS masquerading as macOS): no install prompt, manual steps only. */
export const isIos = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Android/Chromium path: a captured prompt we can trigger from our own button. */
export const canPromptInstall = (): boolean => !!deferredPrompt;

/** Show ANY install UI? (not installed + either promptable or iOS-manual). */
export const showInstallUi = (): boolean => !isStandalone() && (canPromptInstall() || isIos());

/** Trigger the native install dialog (Android/Chromium). Resolves true on accept. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;
  notify();
  p.prompt();
  const choice = await p.userChoice.catch(() => ({ outcome: 'dismissed' }));
  return choice.outcome === 'accepted';
}

/** Subscribe to prompt-availability changes (returns unsubscribe). */
export function onInstallStateChange(f: Listener): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
