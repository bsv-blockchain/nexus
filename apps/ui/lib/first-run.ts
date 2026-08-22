/**
 * Whether this browser has been shown the first-run experience.
 *
 * The one piece of chrome state that has to outlive a reload. Everything in
 * settings-store is deliberately in-memory — it is all demo preference, and a
 * refresh putting it back is the right behaviour there. This is the opposite:
 * a welcome that returns every time you refresh is not a welcome, it is a
 * modal you cannot dismiss.
 *
 * localStorage, keyed like `nexus.dataMode` in lib/data-mode, because that is
 * the one persistence convention the chrome already has and a second one would
 * be a second place to look. Wrapped in try/catch for the same reason it is
 * there: private mode and sandboxed WebViews can refuse storage, and a missing
 * preference is not worth failing over — it just means the welcome shows again.
 */
import { useSyncExternalStore } from "react";

const KEY = "nexus.firstRun.seen";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    /* Storage refused. Treat it as "not seen": showing a welcome twice is a
       smaller failure than never showing it at all. */
    return false;
  }
}

/** Remember that it has been through. Called when the last card is finished. */
export function markFirstRunSeen(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Nothing to do. It will show again next time, which is survivable.
  }
  emit();
}

/** Forget it, so the next mount plays it again. The Settings control. */
export function resetFirstRun(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Has it been seen?
 *
 * The server snapshot is `true` — seen — on purpose. It is the answer that
 * renders nothing, and a welcome screen briefly painted into the server's HTML
 * and then removed on hydration is a flash of the loudest thing in the app.
 */
export function useFirstRunSeen(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
