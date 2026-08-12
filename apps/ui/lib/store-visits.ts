"use client";

import { getHubApps } from "@/lib/data";

/**
 * What has appeared in the store since you last looked.
 *
 * A dot that tracks the reader rather than the calendar. "Published in the last
 * thirty days" is the same for everybody and never clears, so an app you have
 * opened ten times keeps announcing itself — which is how people learn to stop
 * seeing dots.
 *
 * The mark is computed once when the store opens, from the previous visit, and
 * held for the whole visit: recomputing as you browse would clear the dot you
 * are currently reading. The stamp moves on the way in, so the next visit is
 * measured from this one.
 *
 * Not persisted, like everything else in this prototype. A fresh session is a
 * first visit, which falls back to the last thirty days so the store is not
 * blank of news the first time somebody opens it.
 */
const FIRST_VISIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

let lastVisit: number | null = null;

/**
 * Slugs published since the previous visit.
 *
 * Call once per mount and keep the result — see above. Takes `now` rather than
 * reading the clock so the caller decides when "now" is, and a test can too.
 */
export function newSinceLastVisit(now: number): Set<string> {
  const since = lastVisit ?? now - FIRST_VISIT_WINDOW_MS;
  return new Set(
    getHubApps()
      .filter((app) => new Date(app.createdAt).getTime() > since)
      .map((app) => app.slug),
  );
}

/** Moves the stamp. Safe to call repeatedly; the mark is already captured. */
export function markStoreVisited(now: number): void {
  lastVisit = now;
}
