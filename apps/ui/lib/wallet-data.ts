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
  wallet?: {
    info: () => Promise<WalletInfo>;
    accounts: () => Promise<WalletAccount[]>;
    transactions: (opts?: { accountId?: string; limit?: number }) => Promise<WalletTransaction[]>;
  };
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
