"use client";

/**
 * What the App Store is showing, shared between the canvas and its column.
 *
 * Discover and Manage are two different products wearing one tab row: Manage
 * is the searchable grid this screen has always been, and Discover is a
 * curated front page with its own drill-downs — a category's full list, the
 * genre grid, what has updated recently, one app's own story. Both the canvas
 * (AppStore) and the column beside it (DiscoverSidebar) need to agree on which
 * of those is open, and they are siblings in the tree — neither is the
 * other's parent — so this is a store rather than lifted state.
 *
 * Session-only, deliberately. Leaving the store on somebody's half-read
 * "Work" page is a smaller failure than a bookmark that can point at content
 * this build has since reshuffled.
 */

import { useSyncExternalStore } from "react";
import type { AppCategory, HubAppSlug } from "@/lib/data";

export type StoreTab = "discover" | "manage";

/** The three groupings the reference calls Work / Create / Develop. */
export type StoreCategoryPage = "work" | "create" | "develop";

export type StoreView =
  | { kind: "grid" }
  | { kind: "category"; category: StoreCategoryPage }
  | { kind: "categories" }
  /** One genre, drilled into from the Categories grid — carries its own
   *  label so the page doesn't have to re-derive it from `categoryLabel`. */
  | { kind: "category-detail"; category: AppCategory; label: string }
  | { kind: "updates" }
  | { kind: "story"; slug: HubAppSlug }
  /** "See All" off the Top Free/Paid tab group. */
  | { kind: "ranked"; tier: "free" | "paid" }
  /** What the sidebar's search field is typed into. */
  | { kind: "search"; query: string };

interface State {
  tab: StoreTab;
  view: StoreView;
}

let state: State = { tab: "discover", view: { kind: "grid" } };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStoreTab(): StoreTab {
  return useSyncExternalStore(
    subscribe,
    () => state.tab,
    () => "discover",
  );
}

export function useStoreView(): StoreView {
  return useSyncExternalStore(
    subscribe,
    () => state.view,
    () => ({ kind: "grid" }) as StoreView,
  );
}

/**
 * Switch tabs, and land on each one's own front page rather than wherever the
 * other tab happened to leave the view.
 *
 * Manage has no drill-downs to remember, so it is always the grid. Discover's
 * own state is reset to the grid too — arriving on Manage and coming straight
 * back should not be indistinguishable from having stayed on a category page
 * the whole time.
 */
export function setStoreTab(next: StoreTab): void {
  state = { tab: next, view: { kind: "grid" } };
  emit();
}

export function openStoreView(next: StoreView): void {
  state = { ...state, view: next };
  emit();
}

/** Back to Discover's own front page, from any drill-down. */
export function closeStoreView(): void {
  openStoreView({ kind: "grid" });
}
