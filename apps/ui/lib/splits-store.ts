"use client";

/**
 * Splits you raised, splits you owe a share of, and who has settled.
 *
 * Kept apart from `lib/data` rather than appended to it, the same way payment
 * links are: the fixtures are a seeded history somebody wrote, these are the
 * user's own, and merging them inside the accessor would make it impossible to
 * tell afterwards which rows were invented. The view concatenates them at the
 * point of render, which is where the distinction stops mattering.
 *
 * Unlike payment links, this IS written to disk. A link that survived a restart
 * would be a promise this build cannot keep — there is no service behind
 * `nexus.pay/<code>` to honour it. A split promises nothing external: it is a
 * note about who owes whom, and a note that forgets itself the moment you close
 * the app is a scratchpad rather than a record.
 *
 * Two things are stored, and they are different:
 *
 *   - `raised`, the splits made here. Whole rows.
 *   - `settled`, a status per share keyed by split and person. This applies to
 *     the fixtures as well, which is why it cannot live on the row: the
 *     fixtures are compiled in and a build can replace them, so an override has
 *     to survive one being rewritten rather than be lost with it.
 *
 * @see lib/payment-links-store.ts — the same shape, without the disk
 */

import { storageKeys } from "@/lib/config";
import type { SplitBill } from "@/lib/data/types";
import { useSyncExternalStore } from "react";

export type ShareStatus = "paid" | "pending" | "failed";

/** What the form collects. Everything else about a split is derived. */
export interface SplitDraft {
  description: string;
  tokenId: string;
  /** person id to units; the total is their sum */
  shares: { personId: string; units: number }[];
}

interface Stored {
  v: number;
  raised: SplitBill[];
  /** `${splitId}:${personId}` to status */
  settled: Record<string, ShareStatus>;
}

const STORE_VERSION = 1;

let raised: SplitBill[] = [];
let settled: Record<string, ShareStatus> = {};
const listeners = new Set<() => void>();

const EMPTY: readonly SplitBill[] = [];
let raisedSnapshot: readonly SplitBill[] = EMPTY;
let settledSnapshot: Readonly<Record<string, ShareStatus>> = {};

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { v: STORE_VERSION, raised, settled };
    window.localStorage.setItem(storageKeys.splits, JSON.stringify(payload));
  } catch {
    /* Private browsing, or a full quota. The session still works. */
  }
}

function load(): void {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(storageKeys.splits);
    if (!stored) return;
    const saved = JSON.parse(stored) as Partial<Stored>;
    if (saved.v !== STORE_VERSION) return;
    if (Array.isArray(saved.raised)) raised = saved.raised;
    if (saved.settled && typeof saved.settled === "object") {
      settled = { ...saved.settled };
    }
  } catch {
    /* Corrupt, or storage that refuses to be read. An empty list is always a
       valid answer, and a store that throws takes the wallet with it. */
  }
}

load();
raisedSnapshot = [...raised];
settledSnapshot = { ...settled };

function notify(): void {
  raisedSnapshot = [...raised];
  settledSnapshot = { ...settled };
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Enough to tell two splits apart, and deliberately not a real id.
 *
 * Seeded from the clock so a split raised today does not collide with one
 * raised in an earlier session and restored from storage.
 */
function nextId(): string {
  return `sb-own-${Date.now().toString(36)}-${raised.length}`;
}

/** Raise a split. Newest first, like the links list. */
export function createSplit(
  draft: SplitDraft,
  now: string,
  /* The wallet the shares settle into; see the note on createPaymentLink. */
  accountId: string,
): SplitBill {
  const split: SplitBill = {
    id: nextId(),
    accountId,
    description: draft.description.trim(),
    tokenId: draft.tokenId,
    totalUnits: draft.shares.reduce((sum, share) => sum + share.units, 0),
    createdAt: now,
    shares: draft.shares.map((share) => ({ ...share, status: "pending" })),
  };
  raised = [split, ...raised];
  notify();
  return split;
}

/** Drop one you raised. Fixtures are not yours to remove. */
export function removeSplit(id: string): void {
  const next = raised.filter((split) => split.id !== id);
  if (next.length === raised.length) return;
  raised = next;
  /* Take its overrides with it, or a later split reusing the id would inherit
     somebody else's settlement. */
  settled = Object.fromEntries(
    Object.entries(settled).filter(([key]) => !key.startsWith(`${id}:`))
  );
  notify();
}

const shareKey = (splitId: string, personId: string): string =>
  `${splitId}:${personId}`;

/** Record what a share is doing. Applies to fixtures as well as your own. */
export function setShareStatus(
  splitId: string,
  personId: string,
  status: ShareStatus
): void {
  settled = { ...settled, [shareKey(splitId, personId)]: status };
  notify();
}

/** The status a share is actually in, override first. */
export function statusOf(
  splitId: string,
  personId: string,
  fallback: ShareStatus
): ShareStatus {
  return settled[shareKey(splitId, personId)] ?? fallback;
}

function getRaised(): readonly SplitBill[] {
  return raisedSnapshot;
}

function getServerRaised(): readonly SplitBill[] {
  return EMPTY;
}

function getSettled(): Readonly<Record<string, ShareStatus>> {
  return settledSnapshot;
}

const NO_OVERRIDES: Readonly<Record<string, ShareStatus>> = {};

function getServerSettled(): Readonly<Record<string, ShareStatus>> {
  return NO_OVERRIDES;
}

/** Splits raised in this app, newest first. */
export function useRaisedSplits(): readonly SplitBill[] {
  return useSyncExternalStore(subscribe, getRaised, getServerRaised);
}

/**
 * Every share status that has been set, so a component re-renders when one
 * changes. Read through `statusOf` rather than indexed directly.
 */
export function useShareStatuses(): Readonly<Record<string, ShareStatus>> {
  return useSyncExternalStore(subscribe, getSettled, getServerSettled);
}
