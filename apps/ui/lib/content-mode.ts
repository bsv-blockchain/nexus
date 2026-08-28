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
 * It is a preference of DEMO mode only, and that is what keeps the two from
 * drifting. Live means nothing invented anywhere, so it is empty by
 * construction rather than by a second switch somebody has to remember to set —
 * see `effective` below. The stored answer is parked while a session is live
 * and is waiting where it was left when one comes back to demo, so the pair can
 * never be in a combination the controls cannot express.
 *
 * @see lib/data/index.ts — the accessors that read this
 */

import { resolveDataMode } from "./data-mode";

const KEY = "nexus.contentMode";

const listeners = new Set<() => void>();

export type ContentMode = "empty" | "seeded";

function stored(): ContentMode {
  if (typeof window === "undefined") return "empty";
  try {
    return window.localStorage.getItem(KEY) === "seeded" ? "seeded" : "empty";
  } catch {
    /* Storage refused. Empty is the honest answer for anybody this build has
       never met, which is who a session with no readable preference is. */
    return "empty";
  }
}

/**
 * The answer that actually applies, which is not always the stored one.
 *
 * Live is empty whatever is in storage. A live session reads real services for
 * the wallet and the browser, and the fifteen surfaces with no service behind
 * them have nothing to show — filling those with a stranger's inbox while the
 * wallet reports a real balance is the one combination that could not be true
 * of any install, and it was reachable in two clicks.
 */
function effective(): ContentMode {
  return resolveDataMode() === "live" ? "empty" : stored();
}

/**
 * Empty until hydration says otherwise, on the client as well as the server.
 *
 * This is read INSIDE the data accessors, which means it decides what the very
 * first render produces — and the server has no localStorage to read, so it
 * always renders the empty version. Starting the client from the stored value
 * instead made the two disagree the moment anybody had ever chosen "seeded":
 * React rendered a rail with an unread pill over a server tree that had none,
 * and threw out the whole subtree to recover.
 *
 * So both sides start empty and the stored answer is applied once, after the
 * first paint, by `hydrateContentMode`. The cost is a frame of empty screens
 * for somebody in seeded mode; the alternative is a hydration mismatch on every
 * load, which costs the entire tree.
 */
let mode: ContentMode = "empty";

/**
 * Adopt the stored answer, now that there is a DOM to compare against.
 *
 * Called once from the shell. Notifies rather than reloading: the subscriber is
 * the shell itself, so one state change re-renders everything below it and
 * every accessor is asked again.
 */
export function hydrateContentMode(): void {
  const next = effective();
  if (next === mode) return;
  mode = next;
  for (const listener of listeners) listener();
}
export function getContentMode(): ContentMode {
  return mode;
}

/** True when a personal surface should have nothing in it. */
export function isEmptyContent(): boolean {
  return mode === "empty";
}

/**
 * Record the demo preference, and apply it if this session can honour it.
 *
 * The write happens either way. It is the answer for demo mode, and a live
 * session is not a reason to forget it — `effective` is what decides whether it
 * is in force right now, so there is one rule rather than a stored value and a
 * separate memory of what it should have been.
 */
export function setContentMode(next: ContentMode): void {
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* In-memory only, which lasts the session. */
  }
  const applied = effective();
  if (applied === mode) return;
  mode = applied;
  for (const listener of listeners) listener();
}

/** The demo preference as stored, which is what the checkbox shows. */
export function getStoredContentMode(): ContentMode {
  return stored();
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
