"use client";

/**
 * The current minute, as an external system.
 *
 * The clock is not React state — nothing in the app owns it or can change it —
 * so it is subscribed to rather than copied into a `useState` on mount. That is
 * what `useSyncExternalStore` is for, and it is also what stops an effect from
 * calling `setState` synchronously just to have a first value.
 *
 * Ticks on the MINUTE, twice over: the interval is aligned to the next real
 * minute rather than to whenever the first component happened to mount, so the
 * figure turns over when the clock does. One timer for the whole app however
 * many things are showing the time — the Focus stage and its column both are.
 *
 * The server snapshot is a fixed epoch, not `new Date()`: a server and a client
 * disagreeing about the time is the one hydration mismatch guaranteed to be
 * visible, because it is rendered at 72px. Callers check `ready` and draw a dash
 * until the first client tick.
 */

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let stamp = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule(): void {
  /* To the next minute boundary, then every minute after it. Re-scheduled each
     time rather than left as an interval, so drift never accumulates. */
  timer = setTimeout(
    () => {
      stamp = Date.now();
      for (const listener of listeners) listener();
      schedule();
    },
    60_000 - (Date.now() % 60_000),
  );
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    stamp = Date.now();
    schedule();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** Milliseconds, changing once a minute. Zero until the first client tick. */
export function useMinute(): number {
  return useSyncExternalStore(
    subscribe,
    () => stamp,
    () => 0,
  );
}
