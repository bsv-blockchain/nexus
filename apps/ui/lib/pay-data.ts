"use client";

/**
 * The payments and transactions surface, as the chrome calls it.
 *
 * Every function here is a thin call across window.nexusHost into the shell,
 * where the real rails live (@nexus/wallet-core). Nothing on this side decides
 * anything about money: it does not pick a rail, validate an address, or work out
 * whether a payment can be retried. Those answers come back from the shell, which
 * is the only side holding the wallet, the SDK, and the tests that cover them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveDataMode } from "./data-mode";

// ── Wire shapes ─────────────────────────────────────────────────────────────

export type RailId = "nearby" | "handle" | "address";

export type PayTarget =
  | { kind: "nearby"; session: unknown }
  | { kind: "handle"; identityKey: string; sats?: number }
  | { kind: "address"; address: string; sats?: number };

/** An inbound payment already credited to this address by the background sweeper. */
export interface ProcessedTx {
  txid: string;
  satoshis: number;
  status: string;
  importedAt: string | null;
}

export interface AddressReceiveState {
  address: string;
  date: string;
  derivationPrefix: string;
  daysOffset: number;
  maxRecoveryDays: number;
  processed: ProcessedTx[];
}

export interface OutboxEntry {
  id: string;
  createdAt: string;
  recipient: string;
  token: { amount: number };
  messageBoxUrl: string;
  status: "unsent" | "sent";
  lastAttemptAt?: string;
  lastError?: string;
}

/**
 * A resolved counterparty, as @bsv/sdk's IdentityClient describes one.
 *
 * Declared here rather than imported from the SDK: the chrome is a DOM bundle that
 * deliberately holds no wallet dependency, and this is the wire shape the shell
 * already sends. Every field is decoration on a payment that can go ahead without
 * it — an unresolvable handle is still payable.
 */
export interface PayIdentity {
  name: string;
  avatarURL: string;
  abbreviatedKey: string;
  identityKey: string;
  badgeIconURL: string;
  badgeLabel: string;
  badgeClickURL: string;
}

/**
 * Which MessageBox server the handle rail delivers through.
 *
 * `defaultUrl` and `noneValue` come from the shell rather than being spelled here:
 * they are rail constants, and a chrome carrying its own copy of the disable
 * sentinel would go on sending a string the rail had stopped recognising.
 */
export interface MessageBoxState {
  url: string;
  isDefault: boolean;
  /** The user has chosen no server. The handle rail cannot deliver at all. */
  disabled: boolean;
  defaultUrl: string;
  noneValue: string;
}

/** A payment the wallet has given up crediting automatically. */
export interface InboxRow {
  messageId: string;
  sender: string;
  amount: number;
  attempts: number;
  error: string;
}

export interface OfflineRow {
  txid: string;
  status: "queued" | "posting" | "rejected";
  role: "sent" | "received";
  senderIdentityKey?: string;
  receivedVia?: string;
  framePayload?: string;
}

export interface OfflineStatus {
  queued: number;
  rejected: OfflineRow[];
  sentRejected: OfflineRow[];
  queuedSent: OfflineRow[];
  stalled?: string;
}

export interface WalletActionRow {
  txid: string;
  satoshis: number;
  status: string;
  isOutgoing: boolean;
  description: string;
  reference?: string;
}

export interface TxPage {
  actions: WalletActionRow[];
  totalActions: number;
  offline: Record<string, OfflineRow>;
}

// ── Host access ─────────────────────────────────────────────────────────────

interface PayHost {
  /** Declared by the shell at injection; see packages/bridge/src/client.js. */
  has?: (capability: string) => boolean;
  pay?: {
    classify: (text: string) => Promise<PayTarget | null>;
    validateAddress: (text: string) => Promise<{ normalized: string; valid: boolean }>;
    proofNudge: () => Promise<{ ran: boolean }>;
    address: {
      receive: (daysOffset?: number) => Promise<AddressReceiveState>;
      history: (address: string) => Promise<ProcessedTx[]>;
      sweep: (address: string, daysOffset?: number) => Promise<{ importedSatoshis: number; failureCount: number }>;
      send: (address: string, satoshis: number) => Promise<{ ok: boolean }>;
    };
    handle: {
      identity: (sats?: number) => Promise<{ identityKey: string; link: string }>;
      messageBox: () => Promise<MessageBoxState>;
      setMessageBox: (url: string) => Promise<{ url: string }>;
      /**
       * Who a handle belongs to, and who matches a typed name. Both are decoration
       * on a payment that works without them, so neither rejects: an unresolvable
       * key and an unknown peer are the same answer here, and a failed search is an
       * empty list rather than an error the field has to render.
       */
      resolve: (identityKey: string) => Promise<{ identity: PayIdentity | null }>;
      search: (query: string) => Promise<{ results: PayIdentity[] }>;
      send: (identityKey: string, satoshis: number) => Promise<{ outboxId: string }>;
      outbox: () => Promise<OutboxEntry[]>;
      retry: (id: string) => Promise<{ ok: boolean }>;
      dismiss: (id: string) => Promise<{ ok: boolean }>;
      /**
       * `creditedSatoshis` is what the arrival is worth, not just how many there
       * were: a receipt that says "1 payment received" without a figure asks the
       * payee to go and look, which is the doubt the receipt exists to remove.
       */
      inbox: (retry?: string[]) => Promise<{ accepted: number; creditedSatoshis: number; stuck: InboxRow[] }>;
      discard: (messageId: string) => Promise<{ ok: boolean }>;
    };
    offline: {
      status: () => Promise<OfflineStatus>;
      sendNow: () => Promise<{ ok: boolean }>;
    };
    /**
     * The local-payments rail, as a native screen. It does not return a value to
     * render — it returns what happened, because the whole exchange took place
     * outside this document. `queued` is deliberately distinct from `received`:
     * the frame is durably stored and cannot be lost, but the money is not in
     * the wallet yet.
     */
    nearby: {
      open: (role: "payer" | "payee") => Promise<{
        outcome: "paid" | "received" | "queued" | "cancelled";
        satoshis?: number;
      }>;
    };
  };
  tx?: {
    list: (opts?: { offset?: number; limit?: number }) => Promise<TxPage>;
    abort: (reference: string) => Promise<{ ok: boolean }>;
    refreshProof: (txid: string) => Promise<{ ok: boolean }>;
    rawHex: (txid: string) => Promise<{ hex: string }>;
    exportCsv: () => Promise<{ count: number; filename: string; csv: string }>;
    explorerUrl: (txid: string) => Promise<{ url: string }>;
  };
  /**
   * The OS share sheet. Only shells that have one answer these — the surface is
   * declared by the bridge client everywhere, so absence shows up as a rejected
   * call, not a missing property. Callers need a fallback, not a capability check.
   */
  share?: {
    text: (text: string, title?: string) => Promise<{ shared: boolean }>;
    file: (filename: string, contents: string, mimeType?: string) => Promise<{ shared: boolean }>;
  };
  /**
   * The camera. Only shells with one answer; `target` carries classifyScan's
   * verdict so a caller wanting an address does not re-parse the string.
   */
  scan?: {
    qr: (opts?: { accept?: RailId[]; hint?: string; multi?: boolean }) => Promise<
      { text: string; target: PayTarget | null } | { cancelled: true }
    >;
  };
  tabs?: { create: (url: string, opts?: unknown) => Promise<{ id: string }>; setActive: (id: string) => Promise<unknown> };
  on?: (event: string, cb: (payload: unknown) => void) => () => void;
}

function host(): PayHost | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { nexusHost?: PayHost }).nexusHost ?? null;
}

/**
 * Whether the shell hosting us implements a thing.
 *
 * Never test for the presence of a namespace: the bridge client builds `pay`, `tx`,
 * `scan` and `share` on every shell, because the chrome is meant to code against one
 * API. Presence therefore tells you nothing, and a chrome that trusts it renders
 * payment surfaces on a shell that cannot pay.
 */
export function can(capability: string): boolean {
  return Boolean(host()?.has?.(capability));
}

/** The shell's payment surface, or a refusal naming what is missing. */
export function payHost(): NonNullable<PayHost["pay"]> {
  const p = host()?.pay;
  if (!p || !can("pay")) throw new Error("payments are not available in this shell");
  return p;
}

export function txHost(): NonNullable<PayHost["tx"]> {
  const t = host()?.tx;
  if (!t || !can("tx")) throw new Error("transactions are not available in this shell");
  return t;
}

/**
 * The share sheet, or a refusal.
 *
 * Deliberately the same throw-on-absence shape as the two above even though a
 * shell without a share sheet is expected rather than broken: whether the sheet
 * is missing, refused or unavailable on the device, the caller finds out by the
 * call failing, so there is only one path to handle instead of two.
 */
export function shareHost(): NonNullable<PayHost["share"]> {
  const s = host()?.share;
  if (!s || !can("share")) throw new Error("sharing is not available in this shell");
  return s;
}

/** The camera, or a refusal. Same shape as the others: absence surfaces as a failed call. */
export function scanHost(): NonNullable<PayHost["scan"]> {
  const s = host()?.scan;
  if (!s || !can("scan")) throw new Error("this device has no camera surface");
  return s;
}

/** Whether there is a shell to pay through at all. Demo mode has no rails. */
export function payAvailable(): boolean {
  return resolveDataMode() === "live" && can("pay");
}

/** Open a URL in a real browser tab — how a transaction reaches its explorer. */
export async function openInTab(url: string): Promise<void> {
  const h = host();
  if (!h?.tabs) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { id } = await h.tabs.create(url);
  await h.tabs.setActive(id);
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export interface Async<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Run a shell call and hold its result.
 *
 * `enabled` exists because most of these are wallet round-trips that must not
 * fire until the surface they belong to is actually open — a Pay sheet that
 * derives an address on mount would derive one every time the wallet screen
 * renders.
 */
export function useAsync<T>(fn: () => Promise<T>, empty: T, enabled = true, deps: unknown[] = []): Async<T> {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, loading, error, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/**
 * Re-read on an interval while `enabled`.
 *
 * Used by the receive screen so a payee standing in front of an address gets the
 * arrival moment rather than a silently-updated list. It only reads — the sweep
 * itself runs in the shell on its own cycle — so it cannot race the sweeper.
 */
export function usePoll(fn: () => Promise<void>, ms: number, enabled: boolean): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let running = false;
    const tick = async (): Promise<void> => {
      if (stop || running || document.hidden) return;
      running = true;
      try {
        await fnRef.current();
      } catch {
        // A failed read is not worth reporting: the next tick retries and the
        // money is credited either way.
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void tick(), ms);
    const onVisible = (): void => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/** Connectivity, for the offline gating the rails depend on. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}
