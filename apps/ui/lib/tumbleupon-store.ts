"use client";

/**
 * What TumbleUpon remembers between tumbles.
 *
 * Likes, the apps and categories you have waved away, what the filter is
 * narrowed to, and which inbox messages you have read. All of it is about you
 * rather than about the catalogue, which is why it lives here and not in
 * lib/data — the fixture describes what exists, this describes what you have
 * done with it.
 *
 * Persisted, because the point of a thumbs-down is that the thing does not come
 * back. A dislike that lasted until reload would be a button that agrees with
 * you and then forgets.
 *
 * @see components/apps/browser/tumble-bar.tsx for the toolbar
 */

import { useSyncExternalStore } from "react";
import type { StoreCategory } from "@/lib/data";

const KEY = "nexus.tumbleupon";

export interface TumbleState {
  /** app slugs you said yes to */
  liked: string[];
  /** app slugs that should not come round again */
  blockedApps: string[];
  /** whole categories waved away */
  blockedCategories: StoreCategory[];
  /** categories the filter is narrowed to; empty means everything */
  categories: StoreCategory[];
  /** free text matched against names and descriptions */
  query: string;
  /** inbox ids that have been opened */
  readInbox: string[];
  /** what you have sent, so the details page can show it */
  sent: { toPersonId: string; appSlug: string; message: string }[];
}

const EMPTY: TumbleState = {
  liked: [],
  blockedApps: [],
  blockedCategories: [],
  categories: [],
  query: "",
  readInbox: [],
  sent: [],
};

let state: TumbleState = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* Private mode, or a full disk. Losing the likes is survivable; throwing
         on a thumbs-up is not. */
    }
  }
  for (const listener of listeners) listener();
}

/**
 * Read what was stored, after the first paint.
 *
 * Same shape as `hydrateContentMode`: both sides start from `EMPTY` so the
 * server and the first client render agree, and the stored value arrives in an
 * effect. Reading localStorage during render is the hydration mismatch this
 * codebase has already been bitten by once.
 */
export function hydrateTumble(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Partial<TumbleState>;
    state = { ...EMPTY, ...stored };
    for (const listener of listeners) listener();
  } catch {
    /* Written by an older shape, or by something else entirely. */
  }
}

export function useTumble(): TumbleState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => EMPTY,
  );
}

export function getTumble(): TumbleState {
  return state;
}

function set(next: Partial<TumbleState>): void {
  state = { ...state, ...next };
  emit();
}

/** Liking is a toggle: the second press is how you take it back. */
export function toggleLike(slug: string): void {
  set({
    liked: state.liked.includes(slug)
      ? state.liked.filter((id) => id !== slug)
      : [...state.liked, slug],
    /* Liking something you had blocked un-blocks it. Holding both opinions at
       once would leave a liked app that never appears, which reads as the like
       having failed. */
    blockedApps: state.blockedApps.filter((id) => id !== slug),
  });
}

export function blockApp(slug: string): void {
  set({
    blockedApps: state.blockedApps.includes(slug)
      ? state.blockedApps
      : [...state.blockedApps, slug],
    liked: state.liked.filter((id) => id !== slug),
  });
}

export function blockCategory(category: StoreCategory): void {
  set({
    blockedCategories: state.blockedCategories.includes(category)
      ? state.blockedCategories
      : [...state.blockedCategories, category],
  });
}

export function unblockApp(slug: string): void {
  set({ blockedApps: state.blockedApps.filter((id) => id !== slug) });
}

export function unblockCategory(category: StoreCategory): void {
  set({
    blockedCategories: state.blockedCategories.filter((id) => id !== category),
  });
}

export function setQuery(query: string): void {
  set({ query });
}

export function addCategory(category: StoreCategory): void {
  if (state.categories.includes(category)) return;
  set({ categories: [...state.categories, category] });
}

export function removeCategory(category: StoreCategory): void {
  set({ categories: state.categories.filter((id) => id !== category) });
}

export function markInboxRead(id: string): void {
  if (state.readInbox.includes(id)) return;
  set({ readInbox: [...state.readInbox, id] });
}

export function recordSent(entry: {
  toPersonId: string;
  appSlug: string;
  message: string;
}): void {
  set({ sent: [entry, ...state.sent] });
}
