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
 * set and Discover can read. Real money never moves. `impressions` and
 * `clicks` are the one exception worth calling out — those are not invented,
 * they are counted for real every time Discover actually renders or a reader
 * actually presses one of these cards. A number a sales conversation could
 * stand behind is worth the small bit of bookkeeping; a fake one is not.
 */

import { storageKeys } from "@/lib/config";
import { featuredBanners, featuredCollections } from "@/lib/data/discover-promos";
import { useSyncExternalStore } from "react";

export interface PromoAdminFields {
  enabled: boolean;
  sponsored: boolean;
  /** who bought the placement, blank when `sponsored` is false */
  advertiser: string;
  /** shown on the admin's own campaign row, e.g. "$400/mo" — a label, not a charge */
  priceLabel: string;
  /** which of SLOT_COUNT positions this competes for */
  slot: number;
  /** lower wins the slot when more than one campaign is active for it at once */
  priority: number;
  /** ISO date the campaign starts showing; blank means no lower bound */
  startDate: string;
  /** ISO date the campaign stops showing; blank means no upper bound */
  endDate: string;
  /** real counts — see recordImpression / recordClick */
  impressions: number;
  clicks: number;
}

const DEFAULT_FIELDS: Omit<PromoAdminFields, "slot"> = {
  enabled: true,
  sponsored: false,
  advertiser: "",
  priceLabel: "",
  priority: 1,
  startDate: "",
  endDate: "",
  impressions: 0,
  clicks: 0,
};

export interface AdminPromoState {
  banners: Record<string, PromoAdminFields>;
  collections: Record<string, PromoAdminFields>;
}

function seed(): AdminPromoState {
  const banners: Record<string, PromoAdminFields> = {};
  for (const banner of featuredBanners) {
    banners[banner.id] = { ...DEFAULT_FIELDS, slot: banner.slot };
  }
  const collections: Record<string, PromoAdminFields> = {};
  for (const collection of featuredCollections) {
    collections[collection.id] = { ...DEFAULT_FIELDS, slot: collection.slot };
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
      [id]: { ...(current.banners[id] ?? INITIAL.banners[id]!), ...patch },
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
      [id]: { ...(current.collections[id] ?? INITIAL.collections[id]!), ...patch },
    },
  });
}

type PromoKind = "banners" | "collections";

function bump(kind: PromoKind, id: string, field: "impressions" | "clicks"): void {
  const current = getSnapshot();
  const bucket = current[kind];
  const fields = bucket[id];
  if (!fields) return;
  write({
    ...current,
    [kind]: { ...bucket, [id]: { ...fields, [field]: fields[field] + 1 } },
  });
}

/** Discover calls this once per card it actually renders — see the row components. */
export function recordImpression(kind: PromoKind, id: string): void {
  bump(kind, id, "impressions");
}

/** Discover calls this once per press of a card's own primary action. */
export function recordClick(kind: PromoKind, id: string): void {
  bump(kind, id, "clicks");
}

/**
 * Whether `fields` is live right now — enabled, and inside whatever date
 * window it was given. Blank dates mean no bound on that side, so a campaign
 * with neither is simply always in-window once enabled.
 */
function isLive(fields: PromoAdminFields, now: number): boolean {
  if (!fields.enabled) return false;
  if (fields.startDate && now < new Date(fields.startDate).getTime()) return false;
  if (fields.endDate) {
    // The end date's own day still counts — a campaign ending "today" should
    // still show today, not vanish at midnight the night before.
    const endOfDay = new Date(fields.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (now > endOfDay) return false;
  }
  return true;
}

/**
 * One winner per slot, out of however many campaigns are live and assigned
 * to it — lowest `priority` wins, ties broken by array order. A slot nobody
 * live is assigned to is simply absent from the result, not padded with a
 * placeholder; see DiscoverBannerRow / DiscoverCollectionRow for how an empty
 * result collapses the whole section.
 */
export function winningCampaigns<T extends { id: string }>(
  entries: T[],
  fieldsById: Record<string, PromoAdminFields>,
  slotCount: number,
  now: number = Date.now(),
): T[] {
  const live = entries.filter((entry) => {
    const fields = fieldsById[entry.id];
    return fields ? isLive(fields, now) : false;
  });
  const winners: T[] = [];
  for (let slot = 1; slot <= slotCount; slot++) {
    const candidates = live
      .filter((entry) => fieldsById[entry.id]!.slot === slot)
      .sort((a, b) => fieldsById[a.id]!.priority - fieldsById[b.id]!.priority);
    if (candidates.length > 0) winners.push(candidates[0]!);
  }
  return winners;
}
