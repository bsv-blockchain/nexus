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
  setBsvPricing,
  type Holding,
} from "@/lib/wallet";
import { useWalletAccounts, useWalletTransactions } from "@/lib/wallet-data";
import type { DataMode } from "@/lib/data-mode";

export interface Portfolio {
  rows: Holding[];
  /** Null when there is no exchange rate to strike it through — not zero. */
  total: number | null;
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
  // way this header does. Demo mode publishes the fixtures' own price instead.
  //
  // Set during render, not in an effect: everything downstream reads it while THIS
  // render runs, and an effect fires after that read — so the first paint of a live
  // portfolio priced its rows at the fixtures' $72.50 before correcting itself.
  setBsvPricing(accounts.mode, liveRate);

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
  // as the device most recently saw it. Zero means the shell has never had one,
  // which is a missing price rather than a free coin.
  const usdPerUnit = liveRate !== null && liveRate > 0 ? liveRate : null;
  const token: Token = { ...bsvToken(), usdPerUnit: usdPerUnit ?? 0, change24h: 0 };
  const value = usdPerUnit === null ? null : units * usdPerUnit;

  return {
    rows: account ? [{ token, units, usd: value }] : [],
    total: account ? value : null,
    change: null,
    loading: accounts.loading,
    mode: "live",
    error: accounts.error,
    account,
    refresh: accounts.refresh,
  };
}

/**
 * One asset's holding, from whichever side is live.
 *
 * The token-detail screen used to read `holdingOf()` straight out of the fixtures,
 * so a real wallet's BSV page showed 34.2180455 BSV at $2,480.81 no matter what the
 * wallet held — the one screen in the app still quoting a demo balance to a live user.
 */
export interface HoldingView {
  holding: Holding | null;
  loading: boolean;
  mode: DataMode;
  /** Sparkline and 24h percentage are fixture properties; nothing prices history here. */
  showTrend: boolean;
}

export function useHolding(tokenId: string): HoldingView {
  const portfolio = usePortfolio();
  return {
    holding: portfolio.rows.find((row) => row.token.id === tokenId) ?? null,
    loading: portfolio.loading,
    mode: portfolio.mode,
    showTrend: portfolio.mode === "demo",
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
