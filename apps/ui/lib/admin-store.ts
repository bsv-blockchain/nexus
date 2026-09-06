"use client";

/**
 * The Store Admin app's own state: the mutable overlay on Discover's featured
 * banners and collections.
 *
 * Same module-store shape as {@link file://./settings-store.ts} — a value
 * read through `useSyncExternalStore`, a server snapshot that matches the
 * prerender, written to `localStorage` so an edit survives a reload. Split
 * into its own file rather than folded into settings because this is not a
 * user preference: nobody outside Nexus staff ever opens the app that writes
 * it, and burying an admin-only shape inside the settings a whole rail reads
 * from is how the two end up entangled by accident.
 *
 * Fixture-backed, like the rest of this build: there is no ad-sales backend
 * behind `sponsored` / `advertiser` / `priceLabel`, only a label an admin can
 * set and Discover can read. Real money never moves — see the Monetization
 * group in the admin app for why that is a deliberate stop rather than a gap.
 */

import { storageKeys } from "@/lib/config";
import {
  featuredBanners,
  featuredCollections,
} from "@/lib/data/discover-promos";
import { useSyncExternalStore } from "react";

export interface PromoAdminFields {
  enabled: boolean;
  sponsored: boolean;
  /** who bought the placement, blank when `sponsored` is false */
  advertiser: string;
  /** shown on the admin's own campaign row, e.g. "$400/mo" — a label, not a charge */
  priceLabel: string;
}

const BLANK_FIELDS: PromoAdminFields = {
  enabled: true,
  sponsored: false,
  advertiser: "",
  priceLabel: "",
};

export interface AdminPromoState {
  banners: Record<string, PromoAdminFields>;
  collections: Record<string, PromoAdminFields>;
}

function seed(): AdminPromoState {
  const banners: Record<string, PromoAdminFields> = {};
  for (const banner of featuredBanners) banners[banner.id] = { ...BLANK_FIELDS };
  const collections: Record<string, PromoAdminFields> = {};
  for (const collection of featuredCollections) {
    collections[collection.id] = { ...BLANK_FIELDS };
  }
  return { banners, collections };
}

const INITIAL = seed();

function restore(saved: Partial<AdminPromoState>): AdminPromoState {
  const merge = (
    defaults: Record<string, PromoAdminFields>,
    over?: Record<string, PromoAdminFields>
  ): Record<string, PromoAdminFields> => {
    const out: Record<string, PromoAdminFields> = {};
    for (const [id, fields] of Object.entries(defaults)) {
      out[id] = { ...fields, ...(over?.[id] ?? {}) };
    }
    return out;
  };
  return {
    banners: merge(INITIAL.banners, saved.banners),
    collections: merge(INITIAL.collections, saved.collections),
  };
}

let snapshot: AdminPromoState | null = null;
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

function load(): AdminPromoState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(storageKeys.discoverPromos);
    if (!raw) return INITIAL;
    return restore(JSON.parse(raw) as Partial<AdminPromoState>);
  } catch {
    return INITIAL;
  }
}

function write(value: AdminPromoState): void {
  snapshot = value;
  try {
    window.localStorage.setItem(storageKeys.discoverPromos, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep the in-memory value for this session */
  }
  emit();
}

function getSnapshot(): AdminPromoState {
  snapshot ??= load();
  return snapshot;
}

function getServerSnapshot(): AdminPromoState {
  return INITIAL;
}

export function useAdminPromoState(): AdminPromoState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read outside React — Discover's rows need this without subscribing. */
export function getAdminPromoSnapshot(): AdminPromoState {
  return getSnapshot();
}

export function setBannerFields(id: string, patch: Partial<PromoAdminFields>): void {
  const current = getSnapshot();
  write({
    ...current,
    banners: {
      ...current.banners,
      [id]: { ...(current.banners[id] ?? BLANK_FIELDS), ...patch },
    },
  });
}

export function setCollectionFields(
  id: string,
  patch: Partial<PromoAdminFields>
): void {
  const current = getSnapshot();
  write({
    ...current,
    collections: {
      ...current.collections,
      [id]: { ...(current.collections[id] ?? BLANK_FIELDS), ...patch },
    },
  });
}
