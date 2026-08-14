/**
 * Which open tabs have reached for the wallet.
 *
 * A site that calls the wallet interface has said something about itself that a
 * favicon cannot: it expects an identity and a balance to be there. That is the
 * only honest basis for offering to pin it to the rail — see docs/DECISIONS.md
 * §10 on why a site joins the rail as `{kind:"site"}` and never as an app slot.
 *
 * The signal already exists and nothing was reading it. `apps/desktop` wraps
 * every substrate handler in `withMessage`, which emits `tab.message` on the
 * host→chrome event channel for each call — including ones that throw, so an
 * *attempt* counts, which is what we want. A site that asks and is refused has
 * still told us what it is.
 *
 * Two ids, and they are not the same id. The shell names its native tabs; the
 * chrome names its own rows, out of fixtures or its own state. Nothing
 * correlated them, because until now nothing needed to: the shell's id lived in
 * a ref inside SiteFrame and died there. SiteFrame registers the pair here now,
 * and this module answers in the chrome's ids so callers never see the shell's.
 *
 * No fallback to "the active tab". It would be right almost always — one
 * SiteFrame is mounted at a time — and wrong in exactly the case that matters,
 * attributing a background call to whatever the user happened to be looking at.
 * An unmatched message is dropped instead.
 */
import { useSyncExternalStore } from "react";

/** shell tab id -> the chrome's own id for that row */
const shellToChrome = new Map<string, string>();
/** chrome tab ids whose site has called the wallet interface at least once */
const reached = new Set<string>();

const listeners = new Set<() => void>();

/*
 * Rebuilt on change rather than read live, because useSyncExternalStore compares
 * snapshots by identity: handing out the live Set would make every render look
 * like a change and loop.
 */
const EMPTY: ReadonlySet<string> = new Set();
let snapshot: ReadonlySet<string> = EMPTY;

function notify(): void {
  snapshot = new Set(reached);
  for (const listener of listeners) listener();
}

type TabMessage = { id?: unknown };

type EventHost = {
  on?: (name: string, cb: (payload: unknown) => void) => () => void;
};

let attached = false;

/** Attach to the host's event channel. Safe to call repeatedly. */
function attach(): boolean {
  if (attached) return true;
  if (typeof window === "undefined") return false;
  const host = (window as unknown as { nexusHost?: EventHost }).nexusHost;
  if (!host?.on) return false;
  attached = true;
  host.on("tab.message", (payload) => {
    const shellId = (payload as TabMessage | null)?.id;
    if (typeof shellId !== "string") return;
    const chromeId = shellToChrome.get(shellId);
    // Not ours, or registered after the call — either way there is no row to
    // put a button on, and guessing one is worse than missing it.
    if (!chromeId || reached.has(chromeId)) return;
    reached.add(chromeId);
    notify();
  });
  return true;
}

/**
 * Tie a shell tab to the chrome row that owns it.
 *
 * Called by SiteFrame once the shell has answered `tabs.create`. Check then
 * subscribe, in that order: Android's WebView injects the host client
 * asynchronously, so `nexusHost` can appear after this runs — the same race
 * ShellVersion documents, and both shells fire `nexushost:ready` for it.
 */
export function noteShellTab(shellId: string, chromeTabId: string): void {
  shellToChrome.set(shellId, chromeTabId);
  if (attach()) return;
  window.addEventListener("nexushost:ready", () => void attach(), {
    once: true,
  });
}

/** Forget a shell tab. Its reached-for-wallet mark stays with the chrome row. */
export function forgetShellTab(shellId: string): void {
  shellToChrome.delete(shellId);
}

/**
 * Forget a chrome row entirely — it closed, so the offer goes with it.
 *
 * Not wired to tab close yet: a reopened row gets a new id, so the set only
 * grows by one per site per session and never lies. Exported because the day a
 * row keeps its id across a close, this is the missing call.
 */
export function forgetChromeTab(chromeTabId: string): void {
  if (!reached.delete(chromeTabId)) return;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  attach();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Chrome tab ids whose site has reached for the wallet.
 *
 * One hook for the whole set rather than one per row: the caller renders these
 * inside a `.map`, where a hook per tab would change the hook count with the
 * tab count.
 */
export function useTabsThatReachedForWallet(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
