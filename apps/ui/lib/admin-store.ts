"use client";

/**
 * The Store Admin app's own state — every campaign behind Discover's two
 * promotional rows, in full, not just the switches on top of a fixed list.
 *
 * Same module-store shape as {@link file://./settings-store.ts} — a value
 * read through `useSyncExternalStore`, a server snapshot that matches the
 * prerender, written to `localStorage` so an edit survives a reload. Split
 * into its own file rather than folded into settings because this is not a
 * user preference: nobody outside Nexus staff ever opens the app that writes
 * it, and burying an admin-only shape inside the settings a whole rail reads
 * from is how the two end up entangled by accident.
 *
 * The campaigns themselves live here now, seeded once from
 * lib/data/discover-promos.ts and mutable from then on — added to, removed
 * from, duplicated — rather than a fixed fixture list with switches bolted
 * on. A headline and subhead are editable here too, which reverses what an
 * earlier pass of this file said about them: that was written when a
 * campaign could only ever be one of three fixed sources, and "content is
 * decided in code" stops being true the moment an admin can add a fourth one
 * without a deploy. What is still true either way: nothing here moves real
 * money. `sponsored` / `advertiser` / `priceLabel` are a label, not a
 * transaction. `impressions` and `clicks` are the one field that is not a
 * label — those are counted for real, once per card Discover actually
 * renders and once per press of its primary action, bucketed by the day they
 * happened so Analytics has a real history to chart rather than one running
 * total.
 */

import { storageKeys } from "@/lib/config";
import {
  rateCard,
  seedBanners,
  seedCollections,
  type PlacementType,
} from "@/lib/data/discover-promos";
import { useSyncExternalStore } from "react";

/** One day's real counts for one campaign. Keyed by `YYYY-MM-DD`. */
export type DailyStats = Record<string, { impressions: number; clicks: number }>;

export interface CampaignBase {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  slot: number;
  priority: number;
  enabled: boolean;
  sponsored: boolean;
  /** who bought the placement, blank when `sponsored` is false */
  advertiser: string;
  /** shown on the admin's own campaign row, e.g. "$400/mo" — a label, not a charge */
  priceLabel: string;
  /** ISO date the campaign starts showing; blank means no lower bound */
  startDate: string;
  /** ISO date the campaign stops showing; blank means no upper bound */
  endDate: string;
  /** running totals — the sum of `daily`, kept alongside it so a reader does not have to */
  impressions: number;
  clicks: number;
  daily: DailyStats;
  createdAt: string;
  updatedAt: string;
}

export interface BannerCampaign extends CampaignBase {
  /** hero art; absent falls back to a gradient */
  art?: string;
}

export type CollectionCampaign = CampaignBase;

export interface AdminPromoState {
  banners: BannerCampaign[];
  collections: CollectionCampaign[];
}

type PromoKind = "banners" | "collections";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function seed(): AdminPromoState {
  const now = new Date().toISOString();
  const banners: BannerCampaign[] = seedBanners.map((seedItem) => ({
    id: seedItem.id,
    repoId: seedItem.repoId,
    headline: seedItem.headline,
    subhead: seedItem.subhead,
    // Spread rather than assigned, so a seed with no art omits the key
    // entirely — exactOptionalPropertyTypes treats `art: undefined` as a
    // different (invalid) thing from art simply not being there.
    ...(seedItem.art ? { art: seedItem.art } : {}),
    slot: seedItem.slot,
    priority: 1,
    enabled: true,
    sponsored: false,
    advertiser: "",
    priceLabel: "",
    startDate: "",
    endDate: "",
    impressions: 0,
    clicks: 0,
    daily: {},
    createdAt: now,
    updatedAt: now,
  }));
  const collections: CollectionCampaign[] = seedCollections.map((seedItem) => ({
    id: seedItem.id,
    repoId: seedItem.repoId,
    headline: seedItem.headline,
    subhead: seedItem.subhead,
    slot: seedItem.slot,
    priority: 1,
    enabled: true,
    sponsored: false,
    advertiser: "",
    priceLabel: "",
    startDate: "",
    endDate: "",
    impressions: 0,
    clicks: 0,
    daily: {},
    createdAt: now,
    updatedAt: now,
  }));
  return { banners, collections };
}

const INITIAL = seed();

/** A blank campaign an admin can immediately start editing. */
function blankCampaign(repoId: string): CampaignBase {
  const now = new Date().toISOString();
  return {
    id: newId("campaign"),
    repoId,
    headline: "New campaign",
    subhead: "",
    slot: 1,
    priority: 1,
    enabled: false,
    sponsored: false,
    advertiser: "",
    priceLabel: "",
    startDate: "",
    endDate: "",
    impressions: 0,
    clicks: 0,
    daily: {},
    createdAt: now,
    updatedAt: now,
  };
}

function restore(saved: Partial<AdminPromoState>): AdminPromoState {
  return {
    banners: Array.isArray(saved.banners) ? saved.banners : INITIAL.banners,
    collections: Array.isArray(saved.collections)
      ? saved.collections
      : INITIAL.collections,
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

/*
 * Another window's edit, not this one's — `write` above already emits for
 * every change made through this tab. A second Store Admin window open on
 * the same profile writes through the same key, and without this the first
 * window would keep showing what it last read until somebody reloaded it,
 * which reads as data loss the moment two windows disagree.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKeys.discoverPromos) return;
    if (event.newValue === null) {
      snapshot = INITIAL;
    } else {
      try {
        snapshot = restore(JSON.parse(event.newValue) as Partial<AdminPromoState>);
      } catch {
        return;
      }
    }
    emit();
  });
}

export function useAdminPromoState(): AdminPromoState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read outside React — Discover's rows need this without subscribing. */
export function getAdminPromoSnapshot(): AdminPromoState {
  return getSnapshot();
}

function updateOne<T extends CampaignBase>(
  list: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return list.map((campaign) =>
    campaign.id === id
      ? { ...campaign, ...patch, updatedAt: new Date().toISOString() }
      : campaign,
  );
}

export function setBannerFields(id: string, patch: Partial<BannerCampaign>): void {
  const current = getSnapshot();
  write({ ...current, banners: updateOne(current.banners, id, patch) });
}

export function setCollectionFields(
  id: string,
  patch: Partial<CollectionCampaign>,
): void {
  const current = getSnapshot();
  write({ ...current, collections: updateOne(current.collections, id, patch) });
}

/** A new banner, off by default so it never appears live by accident. */
export function addBanner(repoId: string): string {
  const campaign = blankCampaign(repoId) as BannerCampaign;
  const current = getSnapshot();
  write({ ...current, banners: [campaign, ...current.banners] });
  return campaign.id;
}

export function addCollection(repoId: string): string {
  const campaign = blankCampaign(repoId);
  const current = getSnapshot();
  write({ ...current, collections: [campaign, ...current.collections] });
  return campaign.id;
}

export function removeBanner(id: string): void {
  const current = getSnapshot();
  write({ ...current, banners: current.banners.filter((c) => c.id !== id) });
}

export function removeCollection(id: string): void {
  const current = getSnapshot();
  write({ ...current, collections: current.collections.filter((c) => c.id !== id) });
}

/** A copy, off by default, sitting right beside the original. */
export function duplicateBanner(id: string): string | null {
  const current = getSnapshot();
  const source = current.banners.find((c) => c.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: BannerCampaign = {
    ...source,
    id: newId("banner"),
    headline: `${source.headline} (copy)`,
    enabled: false,
    impressions: 0,
    clicks: 0,
    daily: {},
    createdAt: now,
    updatedAt: now,
  };
  const index = current.banners.findIndex((c) => c.id === id);
  const banners = [...current.banners];
  banners.splice(index + 1, 0, copy);
  write({ ...current, banners });
  return copy.id;
}

export function duplicateCollection(id: string): string | null {
  const current = getSnapshot();
  const source = current.collections.find((c) => c.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: CollectionCampaign = {
    ...source,
    id: newId("collection"),
    headline: `${source.headline} (copy)`,
    enabled: false,
    impressions: 0,
    clicks: 0,
    daily: {},
    createdAt: now,
    updatedAt: now,
  };
  const index = current.collections.findIndex((c) => c.id === id);
  const collections = [...current.collections];
  collections.splice(index + 1, 0, copy);
  write({ ...current, collections });
  return copy.id;
}

function bump(kind: PromoKind, id: string, field: "impressions" | "clicks"): void {
  const current = getSnapshot();
  const list = current[kind];
  const campaign = list.find((c) => c.id === id);
  if (!campaign) return;
  const day = today();
  const daily: DailyStats = {
    ...campaign.daily,
    [day]: {
      impressions: (campaign.daily[day]?.impressions ?? 0) + (field === "impressions" ? 1 : 0),
      clicks: (campaign.daily[day]?.clicks ?? 0) + (field === "clicks" ? 1 : 0),
    },
  };
  write({
    ...current,
    [kind]: updateOne(list, id, { [field]: campaign[field] + 1, daily }),
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
 * Whether `campaign` is live right now, judged only by its own switch and
 * schedule — not whether it is winning a slot. Blank dates mean no bound on
 * that side, so a campaign with neither is simply always in-window once
 * enabled.
 */
function isScheduledLive(campaign: CampaignBase, now: number): boolean {
  if (!campaign.enabled) return false;
  if (campaign.startDate && now < new Date(campaign.startDate).getTime()) return false;
  if (campaign.endDate) {
    // The end date's own day still counts — a campaign ending "today" should
    // still show today, not vanish at midnight the night before.
    const endOfDay = new Date(campaign.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (now > endOfDay) return false;
  }
  return true;
}

/** Whichever schedule-live campaign in `slot` has the lowest priority, ties broken by array order. */
function winnerForSlot<T extends CampaignBase>(
  all: T[],
  slot: number,
  now: number,
): T | undefined {
  return all
    .filter((c) => c.slot === slot && isScheduledLive(c, now))
    .sort((a, b) => a.priority - b.priority)[0];
}

/**
 * One winner per slot, out of however many campaigns are live and assigned
 * to it. A slot nobody live is assigned to is simply absent from the
 * result, not padded with a placeholder; see DiscoverBannerRow /
 * DiscoverCollectionRow for how an empty result collapses the whole
 * section.
 */
export function winningCampaigns<T extends CampaignBase>(
  all: T[],
  slotCount: number,
  now: number = Date.now(),
): T[] {
  const winners: T[] = [];
  for (let slot = 1; slot <= slotCount; slot++) {
    const winner = winnerForSlot(all, slot, now);
    if (winner) winners.push(winner);
  }
  return winners;
}

export type CampaignStatus =
  | { kind: "disabled" }
  | { kind: "scheduled"; startsAt: string }
  | { kind: "expired"; endedAt: string }
  | { kind: "losing"; to: string }
  | { kind: "live" };

/**
 * What an admin actually needs to know at a glance: is this campaign
 * showing on Discover right now, and if not, why not. Reuses
 * `winnerForSlot` rather than re-deriving the rule, so the status line can
 * never say "live" about a campaign Discover itself is not drawing.
 */
export function campaignStatus<T extends CampaignBase>(
  campaign: T,
  siblings: T[],
  now: number = Date.now(),
): CampaignStatus {
  if (!campaign.enabled) return { kind: "disabled" };
  if (campaign.startDate && now < new Date(campaign.startDate).getTime()) {
    return { kind: "scheduled", startsAt: campaign.startDate };
  }
  if (campaign.endDate) {
    const endOfDay = new Date(campaign.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (now > endOfDay) return { kind: "expired", endedAt: campaign.endDate };
  }
  const winner = winnerForSlot(siblings, campaign.slot, now);
  if (winner && winner.id !== campaign.id) {
    return { kind: "losing", to: winner.headline };
  }
  return { kind: "live" };
}

/**
 * Plain-language problems worth flagging before they cost a sponsor money —
 * soft warnings, not blocks. This is a fixture editor, not a form with a
 * submit button to refuse; the honest move is to say what looks wrong where
 * the admin is already looking; the input just holds it in.
 */
export function campaignWarnings(campaign: CampaignBase): string[] {
  const warnings: string[] = [];
  if (campaign.startDate && campaign.endDate && campaign.endDate < campaign.startDate) {
    warnings.push("End date is before the start date — this campaign will never be live.");
  }
  if (campaign.sponsored && !campaign.advertiser.trim()) {
    warnings.push("Marked sponsored with no advertiser set.");
  }
  return warnings;
}

export function priceHintFor(placement: PlacementType): string {
  return rateCard[placement].priceLabel;
}
