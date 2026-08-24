"use client";

/**
 * Whether this session has somebody else's history in it.
 *
 * Separate from {@link file://./data-mode.ts}, which answers a different
 * question. `DataMode` is about the SOURCE — fixtures, or a wallet that can
 * actually answer. This is about the CONTENT of the fixtures: a demo build can
 * legitimately want to show a full inbox and a full ledger, and it can just as
 * legitimately want to show what somebody who installed this an hour ago
 * actually sees. Folding the two together would mean "empty" implied "no shell
 * present", which is not true and would take the wallet down with it.
 *
 * Empty is the default, and that is the important half. Everything about this
 * product's first impression — the welcome, the presets, the guided tour — is
 * written for somebody arriving with nothing, and it was being shown to them
 * over the top of a stranger's twenty-nine unread messages, four wallets and
 * eighteen collectibles. Seeded is now the thing you turn ON, for a screenshot
 * or a walkthrough.
 *
 * What stays populated in either mode is anything that is not YOURS: the app
 * catalogue, the token list, the ecosystems, and the Timeline. A new account on
 * any social product has a feed on day one — it is other people's posts, which
 * is exactly what makes it a feed rather than a void — so emptying it would be
 * modelling a product nobody ships. What empties is the six things that could
 * only have come from having used the app: messages, contacts, balances,
 * activity, the vault, and what you have connected.
 *
 * @see lib/data/index.ts — the accessors that read this
 */

const KEY = "nexus.contentMode";

export type ContentMode = "empty" | "seeded";

function read(): ContentMode {
  if (typeof window === "undefined") return "empty";
  try {
    return window.localStorage.getItem(KEY) === "seeded" ? "seeded" : "empty";
  } catch {
    /* Storage refused. Empty is the honest answer for anybody this build has
       never met, which is who a session with no readable preference is. */
    return "empty";
  }
}

let mode: ContentMode = read();
const listeners = new Set<() => void>();

export function getContentMode(): ContentMode {
  return mode;
}

/** True when a personal surface should have nothing in it. */
export function isEmptyContent(): boolean {
  return mode === "empty";
}

export function setContentMode(next: ContentMode): void {
  if (next === mode) return;
  mode = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* In-memory only, which lasts the session. */
  }
  for (const listener of listeners) listener();
}

export function subscribeContentMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getContentModeServerSnapshot(): ContentMode {
  return "empty";
}
