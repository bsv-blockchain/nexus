"use client";

/**
 * How many times *this reader* has already been shown a given promo today.
 *
 * Its own store, and its own storage key, deliberately kept apart from the
 * impression counts in lib/admin-store.ts even though a single-install
 * prototype makes the two numbers agree. They are different facts about
 * different things: the admin store holds what the placement has served,
 * which in a real deployment is the ad server's ledger, and this holds what
 * one person's browser has already put in front of them, which never leaves
 * that browser. A frequency cap is a promise made to a reader — "you will
 * not see this six times before lunch" — so it is answered from the reader's
 * own record, not from a total that in production would be somebody else's.
 *
 * Trimmed to today on every write: a view log is only ever asked about the
 * current day, and a year of them is a year of dead keys.
 */

import { storageKeys } from "@/lib/config";

type ViewLog = { day: string; counts: Record<string, number> };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

let cache: ViewLog | null = null;

function read(): ViewLog {
  const day = today();
  if (cache && cache.day === day) return cache;
  if (typeof window === "undefined") return { day, counts: {} };
  try {
    const raw = window.localStorage.getItem(storageKeys.promoViews);
    const saved = raw ? (JSON.parse(raw) as Partial<ViewLog>) : null;
    cache =
      saved && saved.day === day && saved.counts
        ? { day, counts: saved.counts }
        : { day, counts: {} };
  } catch {
    cache = { day, counts: {} };
  }
  return cache;
}

/** Views this reader has had of `id` today. Zero on the server, which never shows anything. */
export function readerViewsToday(id: string): number {
  if (typeof window === "undefined") return 0;
  return read().counts[id] ?? 0;
}

/** Called from the same place the impression is counted, and only from there. */
export function recordReaderView(id: string): void {
  if (typeof window === "undefined") return;
  const log = read();
  log.counts[id] = (log.counts[id] ?? 0) + 1;
  cache = log;
  try {
    window.localStorage.setItem(storageKeys.promoViews, JSON.stringify(log));
  } catch {
    /* storage unavailable — the cap still holds for this session */
  }
}

/** For the admin's own "show me what a fresh reader sees" control. */
export function clearReaderViews(): void {
  cache = { day: today(), counts: {} };
  try {
    window.localStorage.removeItem(storageKeys.promoViews);
  } catch {
    /* nothing to clear */
  }
}
