"use client";

/**
 * A request, from anywhere, for the Roadmap's feedback sheet to be open.
 *
 * The help menu offers "Submit feedback" and "Report abuse", and both mean
 * "put me in the Roadmap with that sheet up". `openApp` takes a slug and
 * nothing else — reasonably, since an app is not obliged to have somewhere for
 * a caller's intent to go — so the intent is left here instead and the sheet
 * picks it up when it mounts.
 *
 * One-shot. The sheet clears it as it opens, so navigating back to the Roadmap
 * later does not reopen a sheet somebody already closed.
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

/** Ask for the feedback sheet the next time the Roadmap is on screen. */
export function requestFeedback(): void {
  pending = true;
  emit();
}

/** Taken by the sheet as it opens, so the request fires exactly once. */
export function consumeFeedbackRequest(): void {
  if (!pending) return;
  pending = false;
  emit();
}

export function useFeedbackRequested(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
