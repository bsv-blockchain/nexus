"use client";

/**
 * The seam between the demo fixtures and the real wallet.
 *
 * 89 components import lib/data directly. Rewriting all of them at once would be a huge,
 * untestable change, so instead screens migrate to these hooks one at a time: each hook
 * returns the same shapes the fixtures already provide, sourced from whichever side
 * resolveDataMode() selects.
 *
 * Live data arrives asynchronously over window.nexusHost; fixtures are synchronous. The
 * hooks therefore always expose a loading flag, and in demo mode it is simply false from
 * the first render.
 */
import { useEffect, useState } from "react";
import type { WalletAccount, WalletTransaction } from "./data/types";
import { walletAccounts as demoAccounts, walletTransactions as demoTransactions } from "./data/wallet";
import { DEMO_DATA_COMPILED_IN, resolveDataMode, type DataMode } from "./data-mode";

type NexusHost = {
  on?: (event: string, cb: (payload: unknown) => void) => () => void;
  wallet?: {
    info: () => Promise<WalletInfo>;
    accounts: () => Promise<WalletAccount[]>;
    transactions: (opts?: { accountId?: string; limit?: number }) => Promise<WalletTransaction[]>;
    restore?: (mnemonic: string) => Promise<{ ok: boolean }>;
  };
  setOverlay?: (open: boolean) => Promise<unknown>;
};

export interface WalletInfo {
  /** False when the shell has no wallet wired at all — distinct from an empty wallet. */
  available: boolean;
  /** True once keys are loaded and the wallet can answer queries. */
  ready: boolean;
  network?: "main" | "test";
  identityKey?: string;
}

function host(): NexusHost | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { nexusHost?: NexusHost }).nexusHost ?? null;
}

export interface Source<T> {
  data: T;
  loading: boolean;
  /** Which source produced `data` — surface it in dev UI so nobody demos fake numbers by accident. */
  mode: DataMode;
  error: string | null;
  refresh: () => void;
}

function useSource<T>(demo: T, fetchLive: (h: NonNullable<NexusHost["wallet"]>) => Promise<T>, empty: T): Source<T> {
  const [mode, setMode] = useState<DataMode>("demo");
  const [data, setData] = useState<T>(demo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const resolved = resolveDataMode();
    setMode(resolved);

    if (resolved === "demo") {
      // Fixtures may have been compiled out; never claim demo data we do not have.
      setData(DEMO_DATA_COMPILED_IN ? demo : empty);
      setLoading(false);
      setError(null);
      return;
    }

    const wallet = host()?.wallet;
    if (!wallet) {
      setData(empty);
      setError("no wallet available from the shell");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLive(wallet)
      .then((live) => {
        if (cancelled) return;
        setData(live);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Deliberately NOT falling back to fixtures: showing invented balances because a
        // real query failed is the worst possible outcome in a wallet.
        setData(empty);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // The shell pushes wallet.state when the wallet finishes building, is torn down, or
  // starts over. Re-reading on that beats polling: a cold start can spend half a
  // minute deriving keys, and until then every answer here is "not ready".
  useEffect(() => {
    const h = host();
    if (!h?.on) return;
    return h.on("wallet.state", () => setNonce((n) => n + 1));
  }, []);

  return { data, loading, mode, error, refresh: () => setNonce((n) => n + 1) };
}

export function useWalletAccounts(): Source<WalletAccount[]> {
  return useSource<WalletAccount[]>(demoAccounts, (w) => w.accounts(), []);
}

export function useWalletTransactions(opts?: { accountId?: string; limit?: number }): Source<WalletTransaction[]> {
  return useSource<WalletTransaction[]>(demoTransactions, (w) => w.transactions(opts), []);
}

export function useWalletInfo(): Source<WalletInfo> {
  const demo: WalletInfo = { available: true, ready: true, network: "main" };
  return useSource<WalletInfo>(demo, (w) => w.info(), { available: false, ready: false });
}

/**
 * Hand a recovery phrase to the shell.
 *
 * The words are passed straight through and never stored on this side — key
 * derivation and the device keychain are the shell's job, and a phrase sitting in
 * DOM state or localStorage is a phrase that leaks.
 */
export async function restoreWallet(mnemonic: string): Promise<void> {
  const wallet = host()?.wallet;
  if (!wallet?.restore) throw new Error("this shell cannot restore a wallet");
  await wallet.restore(mnemonic);
}

/**
 * Tell the shell that the chrome is covering itself.
 *
 * On mobile the browsed page is a native view stacked ABOVE this document, so it
 * paints straight through any sheet or dialog the chrome opens. The shell hides the
 * tab layer while `open` is true. A no-op in a plain browser, which has no tab layer.
 */
let overlayHolders = 0;
let overlaySent: boolean | null = null;

/** Send only on a real edge, so a dozen mounts do not become a dozen bridge calls. */
function syncOverlay(): void {
  const wanted = overlayHolders > 0;
  if (wanted === overlaySent) return;
  overlaySent = wanted;
  void host()?.setOverlay?.(wanted);
}

export function useHostOverlay(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    // Refcounted, because more than one surface can be covering the chrome at once
    // (the onboarding gate and a browser sheet, say). A plain boolean would let
    // whichever one closed last uncover a page that is still hidden behind another.
    overlayHolders += 1;
    syncOverlay();
    return () => {
      overlayHolders -= 1;
      syncOverlay();
    };
  }, [open]);
}
