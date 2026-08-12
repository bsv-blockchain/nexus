"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `md`, which is where this app stops drawing mobile chrome. */
const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the viewport is wide enough for the desktop layout.
 *
 * There were four private copies of this before it was a file, all identical
 * and all written the same afternoon. It is here so the fifth is an import.
 *
 * `useSyncExternalStore` rather than an effect that sets state on mount: the
 * effect version renders `false` first and corrects itself, which on a wide
 * screen means one frame of the mobile branch before the right one arrives.
 * The server snapshot is `false` because a server has no viewport, and mobile
 * markup is the safer thing to send when you cannot know.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
