"use client";

/**
 * Portfolio and activity, from whichever side the data mode selects.
 *
 * The demo fixtures describe a multi-asset portfolio — tokens, collectibles, 24h
 * moves. A real wallet here holds one asset (BSV) and knows nothing about a 24h
 * move, so live mode does not try to fake the missing parts: no sparkline data, no
 * percentage change, just the balance and what it is worth.
 */

import { getToken, type Token, type WalletAccount, type WalletTransaction } from "@/lib/data";
import {
  holdings,
  portfolioChange24h,
  portfolioUsd,
  SATS_PER_BSV,
  setLiveBsvRate,
  type Holding,
} from "@/lib/wallet";
import { useWalletAccounts, useWalletTransactions } from "@/lib/wallet-data";
import type { DataMode } from "@/lib/data-mode";
import { useEffect } from "react";

export interface Portfolio {
  rows: Holding[];
  total: number;
  /** 24h move, or null when the source cannot answer — which is not the same as 0%. */
  change: number | null;
  loading: boolean;
  mode: DataMode;
  error: string | null;
  account: WalletAccount | null;
  refresh: () => void;
}

/**
 * BSV's display metadata. Normally the fixture token, but the fixtures can be
 * compiled out of a live build, so there is a minimal fallback — a wallet must
 * still be able to render its own base currency.
 */
function bsvToken(): Token {
  const fromFixtures = getToken("bsv");
  if (fromFixtures) return fromFixtures;
  return {
    id: "bsv",
    symbol: "BSV",
    name: "Bitcoin SV",
    ecosystem: null,
    icon: null,
    color: "#eab308",
    decimals: 8,
    base: true,
    blurb: "",
    protocol: "",
    usdPerUnit: 0,
    change24h: 0,
  };
}

export function usePortfolio(): Portfolio {
  const accounts = useWalletAccounts();
  const liveRate = accounts.mode === "live" ? (accounts.data[0]?.fiatRate ?? null) : null;

  // Publish the device's rate so transaction rows and token detail price BSV the same
  // way this header does. Demo mode publishes null and the fixtures' own price stands.
  useEffect(() => {
    setLiveBsvRate(liveRate);
  }, [liveRate]);

  if (accounts.mode === "demo") {
    return {
      rows: holdings(),
      total: portfolioUsd(),
      change: portfolioChange24h(),
      loading: false,
      mode: "demo",
      error: null,
      account: null,
      refresh: accounts.refresh,
    };
  }

  const account = accounts.data[0] ?? null;
  const units = account ? account.balanceSatoshis / SATS_PER_BSV : 0;
  // The shell's live exchange rate, not the fixture's — `fiatRate` is USD per BSV
  // as the device most recently saw it.
  const usdPerUnit = account?.fiatRate ?? 0;
  const token: Token = { ...bsvToken(), usdPerUnit, change24h: 0 };

  return {
    rows: account ? [{ token, units, usd: units * usdPerUnit }] : [],
    total: units * usdPerUnit,
    change: null,
    loading: accounts.loading,
    mode: "live",
    error: accounts.error,
    account,
    refresh: accounts.refresh,
  };
}

export interface Activity {
  transactions: WalletTransaction[];
  loading: boolean;
  mode: DataMode;
  error: string | null;
  refresh: () => void;
}

export function useActivity(demo: WalletTransaction[]): Activity {
  const live = useWalletTransactions({ limit: 100 });
  if (live.mode === "demo") {
    return { transactions: demo, loading: false, mode: "demo", error: null, refresh: live.refresh };
  }
  // No account filter here. The fixtures model several accounts and callers filter by
  // the one they are showing; a real wallet has exactly one, and filtering its ledger
  // by a fixture's account id silently returns nothing at all.
  return {
    transactions: live.data,
    loading: live.loading,
    mode: "live",
    error: live.error,
    refresh: live.refresh,
  };
}
