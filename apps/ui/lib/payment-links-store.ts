/**
 * Payment links made in this session.
 *
 * Kept apart from `lib/data` rather than appended to it. The fixtures are a
 * seeded history someone wrote; these are the user's own, and merging the two
 * inside the accessor would make it impossible to tell afterwards which rows
 * were invented. The links view concatenates them at the point of render, which
 * is where the distinction stops mattering.
 *
 * In memory only, like settings-store: a reload clears them. A link that
 * survived a restart would be a promise this build cannot keep — there is no
 * service behind `nexus.pay/<code>` to honour it.
 */
import { useSyncExternalStore } from "react";
import type { PaymentLink } from "./data/types";

/** What the form collects. Everything else about a link is derived. */
export interface PaymentLinkDraft {
  description: string;
  tokenId: string;
  /** absent means the payer chooses */
  amountUnits?: number;
  /** how long from now the link stays payable */
  expiresInDays: number;
}

let created: PaymentLink[] = [];
const listeners = new Set<() => void>();

const EMPTY: readonly PaymentLink[] = [];
let snapshot: readonly PaymentLink[] = EMPTY;

function notify(): void {
  snapshot = [...created];
  for (const listener of listeners) listener();
}

/*
 * Enough to tell two links apart in one session, and deliberately not a real
 * one: a code is the address someone pays, and inventing one that looks like a
 * server issued it is the kind of number this codebase does not print. Ten hex
 * characters, from the counter, so it reads as a code without pretending to be
 * unpredictable.
 */
let seq = 0;

function nextCode(): string {
  seq += 1;
  return `draft${seq.toString(16).padStart(4, "0")}`;
}

/**
 * Add a link, newest first.
 *
 * `createdAt` and `expiresAt` are taken from the clock at the moment of the
 * call, which is the one honest source for them here.
 */
export function createPaymentLink(
  draft: PaymentLinkDraft,
  /* The wallet the money will land in. Passed rather than read here because a
     store has no view of which workspace is asking, and a link filed against
     the wrong wallet is a link that vanishes from the list that made it. */
  accountId: string,
): PaymentLink {
  const now = new Date();
  const expires = new Date(
    now.getTime() + draft.expiresInDays * 24 * 60 * 60 * 1000
  );
  const link: PaymentLink = {
    id: `pl-draft-${seq + 1}`,
    accountId,
    code: nextCode(),
    description: draft.description,
    tokenId: draft.tokenId,
    ...(draft.amountUnits === undefined
      ? {}
      : { amountUnits: draft.amountUnits }),
    status: "open",
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    payments: [],
  };
  created = [link, ...created];
  notify();
  return link;
}

/** Drop one again — the Undo behind the toast that confirms a creation. */
export function removePaymentLink(id: string): void {
  const next = created.filter((link) => link.id !== id);
  if (next.length === created.length) return;
  created = next;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Links made this session, newest first. */
export function useCreatedPaymentLinks(): readonly PaymentLink[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY
  );
}
