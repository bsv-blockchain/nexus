"use client";

/**
 * A request for the Workspaces view to bring its "+" into sight.
 *
 * The title bar's "+" cannot scroll that view itself: it does not know where
 * the circle ended up, and measuring another screen's layout from a strip
 * above it is the kind of coupling that breaks the moment either moves. So the
 * bar asks, the view answers.
 *
 * One-shot. Consumed as the view scrolls, so arriving at Workspaces some other
 * way later does not yank the scroll position about.
 */

import { useSyncExternalStore } from "react";

let pending = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return pending;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Ask the Workspaces view to scroll its "+" into view and light it up. */
export function requestNewWorkspace(): void {
  pending = true;
  emit();
}

export function consumeNewWorkspaceRequest(): void {
  if (!pending) return;
  pending = false;
  emit();
}

export function useNewWorkspaceRequested(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
