"use client";

/**
 * Everything Store Admin owns: the campaigns behind Discover's promotional
 * surfaces, the surfaces themselves, what the catalogue is allowed to show,
 * and a log of who changed what.
 *
 * Same module-store shape as {@link file://./settings-store.ts} — a value
 * read through `useSyncExternalStore`, a server snapshot that matches the
 * prerender, written to `localStorage` so an edit survives a reload. Split
 * into its own file rather than folded into settings because this is not a
 * user preference: nobody outside Nexus staff ever opens the app that writes
 * it, and burying an admin-only shape inside the settings a whole rail reads
 * from is how the two end up entangled by accident.
 *
 * ## What is real and what is a label
 *
 * `sponsored` / `advertiser` / `priceMonthly` are labels. Nothing here moves
 * money, and the rate card is a reference an admin quotes from, not a
 * checkout. `impressions` and `clicks` are not labels: they are counted once
 * per card a reader actually sees (see components/hub/use-promo-impression.ts
 * for what "actually sees" means now — a card three screens down is not an
 * impression) and once per press of its primary action, bucketed by day so
 * Analytics has a history rather than one running total.
 *
 * ## Versioned, and normalised on the way in
 *
 * `STORE_VERSION` follows the convention settings-store and splits-store
 * already set: a payload written by an older shape is discarded rather than
 * trusted. Everything that survives that check still goes through
 * `normalizeCampaign`, because the version stamp only proves the shape was
 * ours — it does not prove a hand-edited entry still has a `daily` bucket to
 * add a count to. Every read path here can assume a complete campaign.
 *
 * ## Choosing what shows
 *
 * A slot is won, not assigned. `priority` decides who is even in the running
 * (lower wins); campaigns tied on the lowest priority *share* the slot,
 * split by `weight`, which is what makes two sponsors in one slot possible
 * at all — before weights existed the second campaign in a slot showed
 * exactly never. Caps take a campaign out of the running once it has served
 * what was sold: `capTotal` for the whole flight, `capDaily` for a day, and
 * `frequencyCap` for one reader, answered from that reader's own log in
 * lib/promo-frequency.ts rather than from the totals here.
 */

import { storageKeys } from "@/lib/config";
import { getIdentityKeys, setCatalogueOverrides } from "@/lib/data";
import {
  rateCard,
  seedBanners,
  seedCollections,
  type PlacementType,
} from "@/lib/data/discover-promos";
import { discoverCategoryPages, discoverHero } from "@/lib/data/discover";
import { readerViewsToday, recordReaderView } from "@/lib/promo-frequency";
import { useSyncExternalStore } from "react";

/** Bumped whenever the shape below changes; an older payload is dropped, not migrated. */
const STORE_VERSION = 1;

/** One day's real counts for one campaign. Keyed by `YYYY-MM-DD`. */
export type DailyStats = Record<string, { impressions: number; clicks: number }>;

export interface CampaignBase {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  /**
   * Hero art for a banner. Empty means the gradient fallback; collections
   * ignore it entirely, drawing their own apps' icons instead. It lives on
   * the shared shape rather than only on `BannerCampaign` so every function
   * that edits, copies or normalises a campaign can stay one function.
   */
  art: string;
  slot: number;
  /** lower wins the slot outright; equal priorities share it by `weight` */
  priority: number;
  /** relative share of a slot among campaigns tied on `priority` */
  weight: number;
  enabled: boolean;
  sponsored: boolean;
  /** who bought the placement, blank when `sponsored` is false */
  advertiser: string;
  /** what it was sold for, per month — a number so Analytics can add it up; 0 means unpriced */
  priceMonthly: number;
  /** ISO date the campaign starts showing; blank means no lower bound */
  startDate: string;
  /** ISO date the campaign stops showing; blank means no upper bound */
  endDate: string;
  /** stop after this many impressions in total; 0 means no cap */
  capTotal: number;
  /** stop after this many impressions in a day; 0 means no cap */
  capDaily: number;
  /** show one reader at most this many times a day; 0 means no cap */
  frequencyCap: number;
  /** running totals — the sum of `daily`, kept alongside it so a reader does not have to */
  impressions: number;
  clicks: number;
  daily: DailyStats;
  createdAt: string;
  updatedAt: string;
}

export type BannerCampaign = CampaignBase;
export type CollectionCampaign = CampaignBase;

/** Discover's own top card, which is a placement like any other now. */
export interface HeroConfig {
  enabled: boolean;
  eyebrow: string;
  title: string;
  hint: string;
  sponsored: boolean;
  advertiser: string;
  priceMonthly: number;
  impressions: number;
  clicks: number;
  daily: DailyStats;
}

/** One of Discover's three editorial rows — Work Smarter, Be Creative, Developer Corner. */
export interface EditorialConfig {
  id: string;
  /** the editorial line over the row; the sidebar keeps the short label */
  title: string;
  enabled: boolean;
}

/**
 * What the catalogue is allowed to show. The other half of a store admin's
 * job: a promo tool decides what is pushed, this decides what exists.
 */
export interface CatalogueConfig {
  /** a whole source taken down — its apps leave the catalogue entirely */
  suspendedRepoIds: string[];
  /** one listing taken down, without touching the rest of its source */
  hiddenAppSlugs: string[];
  /** pinned to the front of its category's editorial row */
  featuredAppSlugs: string[];
}

/**
 * One identity that may open Store Admin.
 *
 * Real, within what this build can be honest about. There is no server to ask
 * and no signature to check, so this is not authentication — what it is, is
 * an access list that this install actually obeys: an identity that holds no
 * grant does not get the app in its catalogue at all (see `getHubApps`), on
 * top of the developer-mode gate that was already there.
 *
 * Two things it will not let you do, both for the same reason — an admin
 * screen you can lock yourself out of is a screen somebody eventually locks
 * themselves out of: you cannot remove your own identity, and you cannot take
 * away the last owner's role.
 */
export interface AccessGrant {
  id: string;
  /** compressed secp256k1 public key, hex */
  publicKey: string;
  label: string;
  /** an owner can change this list; an editor can change everything else */
  role: AccessRole;
  addedAt: string;
}

export type AccessRole = "owner" | "editor";

export interface AuditEntry {
  id: string;
  /** ISO timestamp */
  at: string;
  area: "campaign" | "surface" | "catalogue" | "store";
  /** what happened, in the admin's own words: "Enabled", "Headline", "Removed" */
  action: string;
  /** which thing it happened to */
  subject: string;
  /** the new value, or a short description of the change */
  detail: string;
}

export interface AdminPromoState {
  banners: BannerCampaign[];
  collections: CollectionCampaign[];
  hero: HeroConfig;
  editorial: EditorialConfig[];
  catalogue: CatalogueConfig;
  access: AccessGrant[];
  log: AuditEntry[];
}

export type PromoKind = "banners" | "collections";

/** How many audit entries are kept before the oldest fall off the end. */
const LOG_LIMIT = 200;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------------------------------------------------------------------- *
 * Dates
 * ---------------------------------------------------------------------- */

/**
 * `YYYY-MM-DD` as midnight *here*, not midnight UTC.
 *
 * `new Date("2026-09-06")` is UTC midnight, which put a campaign starting
 * "today" out of window until mid-morning for anybody east of Greenwich —
 * a schedule that reads in local dates and is enforced in UTC ones is a
 * schedule that is wrong for most of the planet.
 */
export function parseLocalDate(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return new Date(year, month - 1, day).getTime();
}

/** The last millisecond of `iso`, locally — an end date's own day still counts. */
function endOfLocalDay(iso: string): number {
  const start = parseLocalDate(iso);
  return Number.isNaN(start) ? Number.NaN : start + 24 * 60 * 60 * 1000 - 1;
}

/* ---------------------------------------------------------------------- *
 * Seeding and normalising
 * ---------------------------------------------------------------------- */

function blankCounts(): Pick<CampaignBase, "impressions" | "clicks" | "daily"> {
  return { impressions: 0, clicks: 0, daily: {} };
}

/** A blank campaign an admin can immediately start editing. Off, so it never appears live by accident. */
function blankCampaign(repoId: string, placement: PlacementType): CampaignBase {
  const now = new Date().toISOString();
  return {
    id: newId("campaign"),
    repoId,
    headline: "New campaign",
    subhead: "",
    art: "",
    slot: 1,
    priority: 1,
    weight: 1,
    enabled: false,
    sponsored: false,
    advertiser: "",
    priceMonthly: rateCard[placement].monthly,
    startDate: "",
    endDate: "",
    capTotal: 0,
    capDaily: 0,
    frequencyCap: 0,
    ...blankCounts(),
    createdAt: now,
    updatedAt: now,
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeDaily(value: unknown): DailyStats {
  if (!value || typeof value !== "object") return {};
  const out: DailyStats = {};
  for (const [day, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { impressions?: unknown; clicks?: unknown };
    out[day] = {
      impressions: Math.max(0, num(row.impressions, 0)),
      clicks: Math.max(0, num(row.clicks, 0)),
    };
  }
  return out;
}

/**
 * A complete campaign out of whatever was on disk.
 *
 * Every read path downstream — `campaignWarnings` calling `.trim()`, `bump`
 * writing into `daily[day]` — assumes a field is there. One place that
 * guarantees it is cheaper than a null check at each of them, and it is the
 * only thing standing between a hand-edited localStorage entry and a blank
 * screen.
 */
function normalizeCampaign(raw: unknown, placement: PlacementType): CampaignBase | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const id = str(c.id);
  const repoId = str(c.repoId);
  if (!id || !repoId) return null;
  const now = new Date().toISOString();
  const daily = normalizeDaily(c.daily);
  const summed = Object.values(daily).reduce(
    (acc, day) => ({
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
    }),
    { impressions: 0, clicks: 0 },
  );
  return {
    id,
    repoId,
    headline: str(c.headline, "Untitled campaign"),
    subhead: str(c.subhead),
    art: str(c.art),
    slot: Math.max(1, Math.round(num(c.slot, 1))),
    priority: Math.max(1, Math.round(num(c.priority, 1))),
    weight: Math.max(1, Math.round(num(c.weight, 1))),
    enabled: bool(c.enabled, false),
    sponsored: bool(c.sponsored, false),
    advertiser: str(c.advertiser),
    priceMonthly: Math.max(0, num(c.priceMonthly, rateCard[placement].monthly)),
    startDate: str(c.startDate),
    endDate: str(c.endDate),
    capTotal: Math.max(0, Math.round(num(c.capTotal, 0))),
    capDaily: Math.max(0, Math.round(num(c.capDaily, 0))),
    frequencyCap: Math.max(0, Math.round(num(c.frequencyCap, 0))),
    /* Never lower than what the buckets themselves add up to. A saved total
       that disagreed with its own history would put a number in a sponsor's
       report that nothing on the chart under it accounts for; a total that
       is *higher* is the honest answer once old buckets age out. */
    impressions: Math.max(summed.impressions, num(c.impressions, 0)),
    clicks: Math.max(summed.clicks, num(c.clicks, 0)),
    daily,
    createdAt: str(c.createdAt, now),
    updatedAt: str(c.updatedAt, now),
  };
}

function seedHero(): HeroConfig {
  return {
    enabled: true,
    eyebrow: discoverHero.eyebrow,
    title: discoverHero.title,
    hint: discoverHero.hint,
    sponsored: false,
    advertiser: "",
    priceMonthly: rateCard.hero.monthly,
    ...blankCounts(),
  };
}

function seedEditorial(): EditorialConfig[] {
  return discoverCategoryPages.map((page) => ({
    id: page.id,
    title: page.sectionTitle,
    enabled: true,
  }));
}

/**
 * The identity this install is using, which is the primary identity key.
 *
 * "Mine", in other words. A build with several identities still has one that
 * everything else here treats as the person at the keyboard, and inventing a
 * second notion of that for one admin screen would be inventing a second
 * answer that could disagree with the first.
 */
export function currentIdentityKey(): { publicKey: string; label: string } {
  const keys = getIdentityKeys();
  const primary = keys.find((key) => key.primary) ?? keys[0];
  return {
    publicKey: primary?.publicKey ?? "",
    label: primary?.label ?? "This device",
  };
}

/** A compressed secp256k1 public key: 02 or 03, then 64 hex characters. */
export function isPublicKey(value: string): boolean {
  return /^0[23][0-9a-fA-F]{64}$/.test(value.trim());
}

function seedAccess(): AccessGrant[] {
  const me = currentIdentityKey();
  if (!me.publicKey) return [];
  return [
    {
      id: "access-owner",
      publicKey: me.publicKey,
      label: me.label,
      role: "owner",
      addedAt: new Date().toISOString(),
    },
  ];
}

function seed(): AdminPromoState {
  const now = new Date().toISOString();
  const fromSeed = (
    item: { id: string; repoId: string; headline: string; subhead: string; art?: string; slot: number },
    placement: PlacementType,
  ): CampaignBase => ({
    ...blankCampaign(item.repoId, placement),
    id: item.id,
    headline: item.headline,
    subhead: item.subhead,
    art: item.art ?? "",
    slot: item.slot,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return {
    banners: seedBanners.map((item) => fromSeed(item, "banner")),
    collections: seedCollections.map((item) => fromSeed(item, "collection")),
    hero: seedHero(),
    editorial: seedEditorial(),
    catalogue: { suspendedRepoIds: [], hiddenAppSlugs: [], featuredAppSlugs: [] },
    access: seedAccess(),
    log: [],
  };
}

const INITIAL = seed();

function normalizeList(value: unknown, placement: PlacementType, fallback: CampaignBase[]): CampaignBase[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((entry) => normalizeCampaign(entry, placement))
    .filter((entry): entry is CampaignBase => entry !== null);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function restore(saved: unknown): AdminPromoState {
  if (!saved || typeof saved !== "object") return INITIAL;
  const s = saved as Record<string, unknown>;
  const heroRaw = (s.hero ?? {}) as Record<string, unknown>;
  const hero = seedHero();
  const editorialRaw = Array.isArray(s.editorial) ? (s.editorial as Record<string, unknown>[]) : [];
  const catalogueRaw = (s.catalogue ?? {}) as Record<string, unknown>;
  return {
    banners: normalizeList(s.banners, "banner", INITIAL.banners),
    collections: normalizeList(s.collections, "collection", INITIAL.collections),
    hero: {
      enabled: bool(heroRaw.enabled, hero.enabled),
      eyebrow: str(heroRaw.eyebrow, hero.eyebrow),
      title: str(heroRaw.title, hero.title),
      hint: str(heroRaw.hint, hero.hint),
      sponsored: bool(heroRaw.sponsored, false),
      advertiser: str(heroRaw.advertiser),
      priceMonthly: Math.max(0, num(heroRaw.priceMonthly, hero.priceMonthly)),
      impressions: Math.max(0, num(heroRaw.impressions, 0)),
      clicks: Math.max(0, num(heroRaw.clicks, 0)),
      daily: normalizeDaily(heroRaw.daily),
    },
    /* Driven by the fixture, not by what was saved: a row that no longer
       exists in lib/data/discover.ts is not a row an admin can still switch
       on, and one added there should appear here without a migration. */
    editorial: seedEditorial().map((row) => {
      const savedRow = editorialRaw.find((entry) => str(entry.id) === row.id);
      return savedRow
        ? { id: row.id, title: str(savedRow.title, row.title), enabled: bool(savedRow.enabled, true) }
        : row;
    }),
    catalogue: {
      suspendedRepoIds: strings(catalogueRaw.suspendedRepoIds),
      hiddenAppSlugs: strings(catalogueRaw.hiddenAppSlugs),
      featuredAppSlugs: strings(catalogueRaw.featuredAppSlugs),
    },
    /* Seeded again if a saved list has nothing in it. An empty access list
       would take the app out of its own catalogue with no screen left to fix
       it from, so "nobody" is a state this store does not have. */
    access: (() => {
      const raw = Array.isArray(s.access) ? (s.access as Record<string, unknown>[]) : [];
      const grants = raw
        .filter((entry) => isPublicKey(str(entry.publicKey)))
        .map((entry) => ({
          id: str(entry.id, newId("access")),
          publicKey: str(entry.publicKey).trim(),
          label: str(entry.label, "Unnamed"),
          role: str(entry.role) === "editor" ? ("editor" as const) : ("owner" as const),
          addedAt: str(entry.addedAt, new Date().toISOString()),
        }));
      return grants.length > 0 ? grants : seedAccess();
    })(),
    log: Array.isArray(s.log)
      ? (s.log as Record<string, unknown>[])
          .filter((entry) => typeof entry.id === "string" && typeof entry.at === "string")
          .map((entry) => ({
            id: str(entry.id),
            at: str(entry.at),
            area: (["campaign", "surface", "catalogue", "store"] as const).includes(
              entry.area as AuditEntry["area"],
            )
              ? (entry.area as AuditEntry["area"])
              : "campaign",
            action: str(entry.action, "Changed"),
            subject: str(entry.subject),
            detail: str(entry.detail),
          }))
          .slice(0, LOG_LIMIT)
      : [],
  };
}

/* ---------------------------------------------------------------------- *
 * The store itself
 * ---------------------------------------------------------------------- */

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
    const saved = JSON.parse(raw) as { v?: number; state?: unknown };
    if (saved.v !== STORE_VERSION) return INITIAL;
    return restore(saved.state);
  } catch {
    return INITIAL;
  }
}

/**
 * The catalogue is a plain module of fixtures with nothing to subscribe to,
 * so it is told rather than asked — the same shape, and the same reason, as
 * `setTimelineListed` in lib/settings-store.ts.
 */
function pushCatalogue(value: AdminPromoState): void {
  setCatalogueOverrides({
    suspendedRepoIds: value.catalogue.suspendedRepoIds,
    hiddenAppSlugs: value.catalogue.hiddenAppSlugs,
    storeAdminAllowed: holdsGrant(value.access, currentIdentityKey().publicKey),
  });
}

/** Whether `publicKey` appears in `grants` at all, whatever its role. */
export function holdsGrant(grants: AccessGrant[], publicKey: string): boolean {
  return grants.some((grant) => grant.publicKey === publicKey);
}

/** The role this identity holds, or null when it holds none. */
export function roleFor(grants: AccessGrant[], publicKey: string): AccessRole | null {
  return grants.find((grant) => grant.publicKey === publicKey)?.role ?? null;
}

function write(value: AdminPromoState): void {
  snapshot = value;
  pushCatalogue(value);
  try {
    window.localStorage.setItem(
      storageKeys.discoverPromos,
      JSON.stringify({ v: STORE_VERSION, state: value }),
    );
  } catch {
    /* storage unavailable — keep the in-memory value for this session */
  }
  emit();
}

function getSnapshot(): AdminPromoState {
  if (snapshot === null) {
    snapshot = load();
    pushCatalogue(snapshot);
  }
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
        const saved = JSON.parse(event.newValue) as { v?: number; state?: unknown };
        snapshot = saved.v === STORE_VERSION ? restore(saved.state) : INITIAL;
      } catch {
        return;
      }
    }
    pushCatalogue(snapshot);
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

/* ---------------------------------------------------------------------- *
 * The audit log
 * ---------------------------------------------------------------------- */

/**
 * Rapid edits to the same field collapse into one entry.
 *
 * Typing a headline is one change to a person and forty to a `onChange`
 * handler, and a log that records the forty is a log nobody reads. The
 * window is generous on purpose: what matters is that the final value is
 * what the entry says, not that every keystroke has a timestamp.
 */
const COALESCE_MS = 45_000;
let lastLog: { key: string; at: number } | null = null;

function appendLog(
  state: AdminPromoState,
  area: AuditEntry["area"],
  action: string,
  subject: string,
  detail: string,
  coalesceKey?: string,
): AuditEntry[] {
  const now = Date.now();
  const entry: AuditEntry = {
    id: newId("log"),
    at: new Date(now).toISOString(),
    area,
    action,
    subject,
    detail,
  };
  if (
    coalesceKey &&
    lastLog &&
    lastLog.key === coalesceKey &&
    now - lastLog.at < COALESCE_MS &&
    state.log.length > 0
  ) {
    lastLog = { key: coalesceKey, at: now };
    return [entry, ...state.log.slice(1)];
  }
  lastLog = coalesceKey ? { key: coalesceKey, at: now } : null;
  return [entry, ...state.log].slice(0, LOG_LIMIT);
}

export function clearLog(): void {
  const current = getSnapshot();
  write({ ...current, log: [] });
}

/** Back to the seeded three-and-three, with every count and override dropped. */
export function resetAdminState(): void {
  lastLog = null;
  write({ ...seed(), log: [] });
}

/* ---------------------------------------------------------------------- *
 * Editing campaigns
 * ---------------------------------------------------------------------- */

/** The one place a field name becomes the words an audit entry uses. */
const FIELD_LABELS: Partial<Record<keyof CampaignBase, string>> = {
  headline: "Headline",
  subhead: "Subhead",
  art: "Art",
  slot: "Slot",
  priority: "Priority",
  weight: "Weight",
  enabled: "Enabled",
  sponsored: "Sponsored",
  advertiser: "Advertiser",
  priceMonthly: "Price",
  startDate: "Start date",
  endDate: "End date",
  capTotal: "Total cap",
  capDaily: "Daily cap",
  frequencyCap: "Frequency cap",
  repoId: "Source",
};

function describePatch(patch: Partial<CampaignBase>): { action: string; detail: string; key: string } {
  const entries = Object.entries(patch) as [keyof CampaignBase, unknown][];
  const first = entries[0];
  if (!first) return { action: "Changed", detail: "", key: "none" };
  const [field, value] = first;
  const label = FIELD_LABELS[field] ?? String(field);
  const detail =
    typeof value === "boolean" ? (value ? "on" : "off") : String(value ?? "").slice(0, 80) || "(blank)";
  return { action: label, detail, key: String(field) };
}

function updateOne(list: CampaignBase[], id: string, patch: Partial<CampaignBase>): CampaignBase[] {
  return list.map((campaign) =>
    campaign.id === id
      ? { ...campaign, ...patch, updatedAt: new Date().toISOString() }
      : campaign,
  );
}

export function setCampaignFields(
  kind: PromoKind,
  id: string,
  patch: Partial<CampaignBase>,
): void {
  const current = getSnapshot();
  const before = current[kind].find((campaign) => campaign.id === id);
  if (!before) return;
  const next = { ...current, [kind]: updateOne(current[kind], id, patch) };
  const { action, detail, key } = describePatch(patch);
  write({
    ...next,
    log: appendLog(next, "campaign", action, before.headline, detail, `${id}:${key}`),
  });
}

/** A new campaign, off by default so it never appears live by accident. */
export function addCampaign(kind: PromoKind, repoId: string): string {
  const campaign = blankCampaign(repoId, kind === "banners" ? "banner" : "collection");
  const current = getSnapshot();
  const next = { ...current, [kind]: [campaign, ...current[kind]] };
  write({
    ...next,
    log: appendLog(next, "campaign", "Created", campaign.headline, kind === "banners" ? "banner" : "collection"),
  });
  return campaign.id;
}

export function removeCampaign(kind: PromoKind, id: string): { campaign: CampaignBase; index: number } | null {
  const current = getSnapshot();
  const index = current[kind].findIndex((campaign) => campaign.id === id);
  if (index === -1) return null;
  const campaign = current[kind][index]!;
  const next = { ...current, [kind]: current[kind].filter((entry) => entry.id !== id) };
  write({ ...next, log: appendLog(next, "campaign", "Removed", campaign.headline, "") });
  return { campaign, index };
}

/** Puts a removed campaign back exactly where it was — what Undo calls. */
export function restoreCampaign(kind: PromoKind, campaign: CampaignBase, index: number): void {
  const current = getSnapshot();
  const list = [...current[kind]];
  list.splice(Math.min(index, list.length), 0, campaign);
  const next = { ...current, [kind]: list };
  write({ ...next, log: appendLog(next, "campaign", "Restored", campaign.headline, "") });
}

/** A copy, off by default, sitting right beside the original. */
export function duplicateCampaign(kind: PromoKind, id: string): string | null {
  const current = getSnapshot();
  const index = current[kind].findIndex((campaign) => campaign.id === id);
  if (index === -1) return null;
  const source = current[kind][index]!;
  const now = new Date().toISOString();
  const copy: CampaignBase = {
    ...source,
    id: newId(kind === "banners" ? "banner" : "collection"),
    headline: `${source.headline} (copy)`,
    enabled: false,
    ...blankCounts(),
    createdAt: now,
    updatedAt: now,
  };
  const list = [...current[kind]];
  list.splice(index + 1, 0, copy);
  const next = { ...current, [kind]: list };
  write({ ...next, log: appendLog(next, "campaign", "Duplicated", source.headline, copy.headline) });
  return copy.id;
}

/* ---------------------------------------------------------------------- *
 * Editing the other surfaces
 * ---------------------------------------------------------------------- */

export function setHeroFields(patch: Partial<HeroConfig>): void {
  const current = getSnapshot();
  const next = { ...current, hero: { ...current.hero, ...patch } };
  const entries = Object.entries(patch);
  const [field, value] = entries[0] ?? ["hero", ""];
  const detail = typeof value === "boolean" ? (value ? "on" : "off") : String(value ?? "").slice(0, 80);
  write({
    ...next,
    log: appendLog(next, "surface", String(field), "Discover hero", detail, `hero:${field}`),
  });
}

export function setEditorialFields(id: string, patch: Partial<EditorialConfig>): void {
  const current = getSnapshot();
  const row = current.editorial.find((entry) => entry.id === id);
  if (!row) return;
  const next = {
    ...current,
    editorial: current.editorial.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  };
  const [field, value] = Object.entries(patch)[0] ?? ["row", ""];
  const detail = typeof value === "boolean" ? (value ? "on" : "off") : String(value ?? "");
  write({
    ...next,
    log: appendLog(next, "surface", String(field), row.title, detail, `editorial:${id}:${field}`),
  });
}

/* ---------------------------------------------------------------------- *
 * The catalogue
 * ---------------------------------------------------------------------- */

function toggleIn(list: string[], value: string, on: boolean): string[] {
  const without = list.filter((entry) => entry !== value);
  return on ? [...without, value] : without;
}

export function setRepoSuspended(repoId: string, suspended: boolean, name: string): void {
  const current = getSnapshot();
  const next = {
    ...current,
    catalogue: {
      ...current.catalogue,
      suspendedRepoIds: toggleIn(current.catalogue.suspendedRepoIds, repoId, suspended),
    },
  };
  write({
    ...next,
    log: appendLog(next, "catalogue", suspended ? "Suspended source" : "Restored source", name, ""),
  });
}

export function setAppHidden(slug: string, hidden: boolean, name: string): void {
  const current = getSnapshot();
  const next = {
    ...current,
    catalogue: {
      ...current.catalogue,
      hiddenAppSlugs: toggleIn(current.catalogue.hiddenAppSlugs, slug, hidden),
      /* A hidden listing cannot also be a featured one — the row would have
         a card pointing at an app the catalogue no longer returns. */
      featuredAppSlugs: hidden
        ? current.catalogue.featuredAppSlugs.filter((entry) => entry !== slug)
        : current.catalogue.featuredAppSlugs,
    },
  };
  write({
    ...next,
    log: appendLog(next, "catalogue", hidden ? "Hid listing" : "Restored listing", name, ""),
  });
}

/**
 * Featured listings first, everything else in the order it arrived.
 *
 * Featuring puts an app at the front of the editorial row its category
 * already feeds rather than inventing a "Featured" row to hold it: a store
 * admin's pick is an editorial decision about an existing shelf, and a new
 * shelf that only ever holds whatever was pinned last is a section that
 * describes the tool rather than the store.
 */
export function orderByFeatured<T extends { slug: string }>(
  apps: T[],
  featured: string[],
): T[] {
  if (featured.length === 0) return apps;
  const rank = (app: T): number => (featured.includes(app.slug) ? 0 : 1);
  return [...apps].sort((a, b) => rank(a) - rank(b));
}

export function setAppFeatured(slug: string, featured: boolean, name: string): void {
  const current = getSnapshot();
  const next = {
    ...current,
    catalogue: {
      ...current.catalogue,
      featuredAppSlugs: toggleIn(current.catalogue.featuredAppSlugs, slug, featured),
    },
  };
  write({
    ...next,
    log: appendLog(next, "catalogue", featured ? "Featured" : "Unfeatured", name, ""),
  });
}

/* ---------------------------------------------------------------------- *
 * Access
 * ---------------------------------------------------------------------- */

/** Refused, with a reason, or granted — the caller decides what to say. */
export type AccessResult = { ok: true } | { ok: false; reason: string };

export function addAccess(publicKey: string, label: string, role: AccessRole): AccessResult {
  const key = publicKey.trim();
  if (!isPublicKey(key)) {
    return { ok: false, reason: "That is not a compressed public key: 02 or 03, then 64 hex characters." };
  }
  const current = getSnapshot();
  if (holdsGrant(current.access, key)) {
    return { ok: false, reason: "That identity already has access." };
  }
  const grant: AccessGrant = {
    id: newId("access"),
    publicKey: key,
    label: label.trim() || "Unnamed",
    role,
    addedAt: new Date().toISOString(),
  };
  const next = { ...current, access: [...current.access, grant] };
  write({ ...next, log: appendLog(next, "store", "Granted access", grant.label, role) });
  return { ok: true };
}

export function removeAccess(id: string): AccessResult {
  const current = getSnapshot();
  const grant = current.access.find((entry) => entry.id === id);
  if (!grant) return { ok: false, reason: "That grant is already gone." };
  if (grant.publicKey === currentIdentityKey().publicKey) {
    return { ok: false, reason: "You cannot remove your own access, only somebody else's." };
  }
  const next = { ...current, access: current.access.filter((entry) => entry.id !== id) };
  write({ ...next, log: appendLog(next, "store", "Removed access", grant.label, "") });
  return { ok: true };
}

export function setAccessRole(id: string, role: AccessRole): AccessResult {
  const current = getSnapshot();
  const grant = current.access.find((entry) => entry.id === id);
  if (!grant) return { ok: false, reason: "That grant is already gone." };
  const owners = current.access.filter((entry) => entry.role === "owner");
  if (role !== "owner" && grant.role === "owner" && owners.length === 1) {
    return { ok: false, reason: "Somebody has to be able to manage this list. Add another owner first." };
  }
  const next = {
    ...current,
    access: current.access.map((entry) => (entry.id === id ? { ...entry, role } : entry)),
  };
  write({ ...next, log: appendLog(next, "store", "Changed role", grant.label, role) });
  return { ok: true };
}

/* ---------------------------------------------------------------------- *
 * Counting
 * ---------------------------------------------------------------------- */

function bumpDaily(daily: DailyStats, field: "impressions" | "clicks"): DailyStats {
  const day = today();
  return {
    ...daily,
    [day]: {
      impressions: (daily[day]?.impressions ?? 0) + (field === "impressions" ? 1 : 0),
      clicks: (daily[day]?.clicks ?? 0) + (field === "clicks" ? 1 : 0),
    },
  };
}

function bump(kind: PromoKind, id: string, field: "impressions" | "clicks"): void {
  const current = getSnapshot();
  const list = current[kind];
  const campaign = list.find((c) => c.id === id);
  if (!campaign) return;
  /* Counting is not editing: it must never write an audit entry, or a busy
     Discover would push every real change off the end of the log. */
  write({
    ...current,
    [kind]: list.map((entry) =>
      entry.id === id
        ? { ...entry, [field]: entry[field] + 1, daily: bumpDaily(entry.daily, field) }
        : entry,
    ),
  });
}

/**
 * Discover calls this once per card a reader actually sees — see
 * use-promo-impression.ts for what "sees" means.
 *
 * The reader's own view log is written here rather than at the call site,
 * because the two facts are the same event seen from two sides: the
 * placement served one impression, and this reader was shown it once more
 * today. A caller that could record one without the other would eventually
 * record one without the other, and a frequency cap that has quietly stopped
 * counting is worse than no frequency cap at all.
 */
export function recordImpression(kind: PromoKind, id: string): void {
  recordReaderView(id);
  bump(kind, id, "impressions");
}

/** Discover calls this once per press of a card's own primary action. */
export function recordClick(kind: PromoKind, id: string): void {
  bump(kind, id, "clicks");
}

export function recordHeroImpression(): void {
  recordReaderView("hero");
  const current = getSnapshot();
  write({
    ...current,
    hero: {
      ...current.hero,
      impressions: current.hero.impressions + 1,
      daily: bumpDaily(current.hero.daily, "impressions"),
    },
  });
}

/*
 * There is deliberately no `recordHeroClick`. The hero's only control is the
 * play button over a clip that does not exist yet (see discover-hero.tsx), so
 * a click counter for it would be a function nothing calls and a CTR that is
 * always zero — a number that looks like a measurement and is not one. The
 * `clicks` field stays on the config because a report needs the same shape
 * from every surface, and because the day that clip arrives is the day this
 * has one honest caller.
 */

/* ---------------------------------------------------------------------- *
 * Who wins a slot
 * ---------------------------------------------------------------------- */

export type CapReason = "total" | "daily" | "frequency";

/** Which cap, if any, has taken this campaign out of the running right now. */
export function capReached(campaign: CampaignBase): CapReason | null {
  if (campaign.capTotal > 0 && campaign.impressions >= campaign.capTotal) return "total";
  const day = campaign.daily[today()]?.impressions ?? 0;
  if (campaign.capDaily > 0 && day >= campaign.capDaily) return "daily";
  if (campaign.frequencyCap > 0 && readerViewsToday(campaign.id) >= campaign.frequencyCap) {
    return "frequency";
  }
  return null;
}

/**
 * Whether `campaign` could show right now, judged by its own switch,
 * schedule and caps — not by whether it beats anything else.
 */
function isEligible(campaign: CampaignBase, now: number): boolean {
  if (!campaign.enabled) return false;
  if (campaign.startDate) {
    const start = parseLocalDate(campaign.startDate);
    if (Number.isFinite(start) && now < start) return false;
  }
  if (campaign.endDate) {
    const end = endOfLocalDay(campaign.endDate);
    if (Number.isFinite(end) && now > end) return false;
  }
  return capReached(campaign) === null;
}

/**
 * The campaigns actually competing for `slot`: everything eligible, tied on
 * the lowest priority present. Anything at a higher number is not in the
 * running at all, which is what "priority" has always meant here; what is
 * new is that the tie is a share rather than an accident of array order.
 */
export function contendersForSlot(all: CampaignBase[], slot: number, now: number = Date.now()): CampaignBase[] {
  const eligible = all.filter((c) => c.slot === slot && isEligible(c, now));
  if (eligible.length === 0) return [];
  const best = Math.min(...eligible.map((c) => c.priority));
  return eligible.filter((c) => c.priority === best);
}

/**
 * One of the contenders, chosen by weight.
 *
 * `pick` is a number in [0, 1) the caller supplies — Discover draws a fresh
 * one per mount (see lib/promo-rotation.ts), and everything that only needs
 * a stable answer, the admin's own status line included, leaves it at 0 and
 * gets the first contender every time. Rotation that changed under a status
 * badge while an admin read it would be a status badge nobody could trust.
 */
function pickByWeight(contenders: CampaignBase[], pick: number): CampaignBase | undefined {
  if (contenders.length <= 1) return contenders[0];
  const total = contenders.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
  let cursor = Math.min(Math.max(pick, 0), 0.999999) * total;
  for (const contender of contenders) {
    cursor -= Math.max(1, contender.weight);
    if (cursor < 0) return contender;
  }
  return contenders[contenders.length - 1];
}

/**
 * One winner per slot, out of however many campaigns are live and assigned
 * to it. A slot nobody live is assigned to is simply absent from the
 * result, not padded with a placeholder; see DiscoverBannerRow /
 * DiscoverCollectionRow for how an empty result collapses the whole section.
 */
export function winningCampaigns<T extends CampaignBase>(
  all: T[],
  slotCount: number,
  options: { now?: number; pick?: number } = {},
): T[] {
  /* `now` is read here rather than taken as a positional argument with a
     default, so a component can call this without `Date.now()` appearing in
     its own render — the React compiler's purity rule is right that a clock
     read during render is unstable, and it is this module's business anyway. */
  const now = options.now ?? Date.now();
  const pick = options.pick ?? 0;
  const winners: T[] = [];
  for (let slot = 1; slot <= slotCount; slot++) {
    const winner = pickByWeight(contendersForSlot(all, slot, now), pick) as T | undefined;
    if (winner) winners.push(winner);
  }
  return winners;
}

export type CampaignStatus =
  | { kind: "disabled" }
  | { kind: "scheduled"; startsAt: string }
  | { kind: "expired"; endedAt: string }
  | { kind: "capped"; reason: CapReason }
  | { kind: "losing"; to: string }
  | { kind: "sharing"; share: number; others: number }
  | { kind: "live" };

/**
 * What an admin actually needs to know at a glance: is this campaign
 * showing on Discover right now, and if not, why not. Reuses
 * `contendersForSlot` rather than re-deriving the rule, so the status line
 * can never say "live" about a campaign Discover itself is not drawing.
 */
export function campaignStatus(
  campaign: CampaignBase,
  siblings: CampaignBase[],
  now: number = Date.now(),
): CampaignStatus {
  if (!campaign.enabled) return { kind: "disabled" };
  if (campaign.startDate) {
    const start = parseLocalDate(campaign.startDate);
    if (Number.isFinite(start) && now < start) {
      return { kind: "scheduled", startsAt: campaign.startDate };
    }
  }
  if (campaign.endDate) {
    const end = endOfLocalDay(campaign.endDate);
    if (Number.isFinite(end) && now > end) return { kind: "expired", endedAt: campaign.endDate };
  }
  const cap = capReached(campaign);
  if (cap) return { kind: "capped", reason: cap };
  const contenders = contendersForSlot(siblings, campaign.slot, now);
  const inRunning = contenders.some((c) => c.id === campaign.id);
  if (!inRunning) {
    return { kind: "losing", to: contenders[0]?.headline ?? "another campaign" };
  }
  if (contenders.length > 1) {
    const total = contenders.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
    return {
      kind: "sharing",
      share: Math.max(1, campaign.weight) / total,
      others: contenders.length - 1,
    };
  }
  return { kind: "live" };
}

/**
 * Plain-language problems worth flagging before they cost a sponsor money —
 * soft warnings, not blocks. This is a fixture editor, not a form with a
 * submit button to refuse; the honest move is to say what looks wrong where
 * the admin is already looking.
 */
export function campaignWarnings(
  campaign: CampaignBase,
  context?: { suspendedRepo?: boolean },
): string[] {
  const warnings: string[] = [];
  if (campaign.startDate && campaign.endDate && campaign.endDate < campaign.startDate) {
    warnings.push("End date is before the start date — this campaign will never be live.");
  }
  if (campaign.sponsored && !campaign.advertiser.trim()) {
    warnings.push("Marked sponsored with no advertiser set.");
  }
  if (campaign.sponsored && campaign.priceMonthly <= 0) {
    warnings.push("Sold but unpriced — it will not appear in booked revenue.");
  }
  if (!campaign.headline.trim()) {
    warnings.push("No headline — the card would draw an empty title.");
  }
  if (campaign.capTotal > 0 && campaign.capDaily > campaign.capTotal) {
    warnings.push("Daily cap is higher than the total cap, so it can never bite.");
  }
  if (context?.suspendedRepo) {
    warnings.push("This campaign's source is suspended, so nothing it promotes is in the catalogue.");
  }
  return warnings;
}
