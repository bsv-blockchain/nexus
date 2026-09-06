"use client";

/**
 * Which of a slot's contenders this visit to Discover gets.
 *
 * Two campaigns tied on priority share a slot by weight, and something has
 * to decide which one a given reader sees. This is that decision: one number
 * in [0, 1), held outside React and read through `useSyncExternalStore` like
 * every other store in this build, so the banner row and the collection row
 * cannot disagree about which draw they are on.
 *
 * Redrawn when Discover's front page mounts rather than once per page load.
 * A browser window that stays open for a week is normal here, and a rotation
 * that only changed on a full reload would make a 70/30 split land at 100/0
 * for whoever happened to keep the tab open — which is the same bug weights
 * were added to fix, one level up.
 *
 * Zero on the server, for the same reason every store here hands the server
 * its seed value: a random number chosen during a prerender is a different
 * number in the browser, and React would tear the page down over the
 * difference. The first paint shows the first contender; the rotation lands
 * a frame later, alongside the campaigns themselves arriving from
 * localStorage.
 */

import { useEffect, useSyncExternalStore } from "react";

let pick: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  pick ??= Math.random();
  return pick;
}

function getServerSnapshot(): number {
  return 0;
}

/** The current draw. Stable for as long as the page is showing one. */
export function useRotationPick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** A fresh draw, for the next reader to arrive on Discover. */
export function refreshRotationPick(): void {
  pick = Math.random();
  for (const listener of listeners) listener();
}

/** Called by whatever counts as "somebody just opened Discover" — see DiscoverFrontPage. */
export function useFreshRotation(): void {
  useEffect(() => {
    refreshRotationPick();
  }, []);
}
