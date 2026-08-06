/**
 * Wallet arithmetic and formatting.
 *
 * Balances live in token units; BSV also has satoshis, which are its smallest
 * unit rather than a separate thing. Everything is valued through USD per unit
 * so a portfolio total can be struck across assets that have nothing else in
 * common.
 */
import {
  getToken,
  getTokenBalances,
  type Token,
  type WalletTransaction,
} from "@/lib/data";
import type { DataMode } from "@/lib/data-mode";

export const SATS_PER_BSV = 100_000_000;

export interface Holding {
  token: Token;
  units: number;
  /** Null when nothing can price it — see usdPerUnitOf. Not the same as zero. */
  usd: number | null;
}

/**
 * Held assets, most valuable first, with BSV always pinned to the top.
 *
 * Fixture-side only — a live wallet's single holding is assembled in wallet-live.ts
 * from the shell's balance, so every price here is a fixture price by definition.
 */
export function holdings(): Holding[] {
  return getTokenBalances()
    .map(({ token, units }) => ({ token, units, usd: units * token.usdPerUnit }))
    .sort((a, b) => {
      if (a.token.base !== b.token.base) return a.token.base ? -1 : 1;
      return (b.usd ?? 0) - (a.usd ?? 0);
    });
}

export function portfolioUsd(): number {
  return holdings().reduce((total, h) => total + (h.usd ?? 0), 0);
}

/** Value-weighted 24h move across the whole portfolio. */
export function portfolioChange24h(): number {
  const rows = holdings();
  const total = portfolioUsd();
  if (total === 0) return 0;
  return rows.reduce(
    (sum, h) => sum + h.token.change24h * ((h.usd ?? 0) / total),
    0,
  );
}

export function holdingOf(tokenId: string): Holding | undefined {
  return holdings().find((h) => h.token.id === tokenId);
}

/** `$3,412.88`, or an em dash when there is no price to render. */
export function usd(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount !== 0 && Math.abs(amount) < 0.01 ? 4 : 2,
  });
}

/** `+2.4%` / `−0.8%`, with a true minus sign. */
export function percent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(Math.abs(value) < 1 ? 2 : 1)}%`;
}

export function changeTone(value: number): string {
  if (value > 0) return "text-positive";
  if (value < 0) return "text-negative";
  return "text-muted-foreground";
}

/** Units held of a transaction's asset, whichever way it was denominated. */
export function txUnits(tx: WalletTransaction): number {
  if (tx.tokenId && tx.amountUnits !== undefined) return tx.amountUnits;
  return tx.amountSatoshis / SATS_PER_BSV;
}

export function txToken(tx: WalletTransaction): Token | undefined {
  return getToken(tx.tokenId ?? "bsv");
}

/**
 * How this session prices an asset.
 *
 * The fixtures carry their own BSV price, and in live mode it is simply wrong — the
 * portfolio total was reading the device's rate while every transaction row read the
 * fixture's, so the same balance appeared at two different dollar values on two
 * screens. One rate, set once by the live data layer, keeps them agreeing.
 *
 * And when a live wallet has no rate at all, the answer is null rather than the
 * fixture's price or zero. `$0.00` is a claim about the balance; the fixture price
 * is a fiction; an em dash is the only honest one of the three.
 */
let pricing: { mode: DataMode; usdPerBsv: number | null } = {
  mode: "demo",
  usdPerBsv: null,
};

export function setBsvPricing(mode: DataMode, usdPerBsv: number | null): void {
  pricing = {
    mode,
    usdPerBsv: usdPerBsv !== null && usdPerBsv > 0 ? usdPerBsv : null,
  };
}

/** USD per unit, or null when this session cannot price the asset. */
export function usdPerUnitOf(token: Token): number | null {
  // A live wallet holds BSV and nothing else; a fixture price for any other
  // symbol would be describing a holding that does not exist.
  if (pricing.mode === "live") {
    return token.id === "bsv" ? pricing.usdPerBsv : null;
  }
  return token.usdPerUnit;
}

export function txUsd(tx: WalletTransaction): number | null {
  const token = txToken(tx);
  if (!token) return null;
  const rate = usdPerUnitOf(token);
  return rate === null ? null : txUnits(tx) * rate;
}

const DAY_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Group transactions under day headings, newest first — Vela's activity shape.
 *
 * "Today" and "Yesterday" are relative to the newest transaction rather than to
 * the clock, so the seeded history keeps stable labels instead of drifting into
 * "3 weeks ago" and never matching between server and client.
 */
export function groupByDay(
  transactions: WalletTransaction[],
): { label: string; items: WalletTransaction[] }[] {
  const sorted = [...transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const newest = sorted[0]?.createdAt.slice(0, 10);
  const groups = new Map<string, WalletTransaction[]>();
  for (const tx of sorted) {
    const day = tx.createdAt.slice(0, 10);
    const existing = groups.get(day);
    if (existing) existing.push(tx);
    else groups.set(day, [tx]);
  }
  const dayNumber = (iso: string): number =>
    Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
  const newestDay = newest ? dayNumber(newest) : 0;

  return [...groups.entries()].map(([day, items]) => {
    const delta = newestDay - dayNumber(day);
    let label: string;
    if (delta === 0) label = "Today";
    else if (delta === 1) label = "Yesterday";
    else {
      const date = new Date(`${day}T00:00:00Z`);
      label = `${date.getUTCDate()} ${DAY_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    }
    return { label, items };
  });
}

/**
 * A deterministic 30-point series for a token's sparkline, shaped so it ends
 * consistently with the token's 24h move. No randomness — the chart must be
 * identical on server and client.
 */
export function sparkline(token: Token, points = 30): number[] {
  let seed = 0;
  for (const char of token.id) seed = (seed * 31 + char.charCodeAt(0)) % 997;
  const drift = token.change24h / 100;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    // A repeatable wobble plus the drift, so the line trends the right way.
    const wobble = Math.sin((seed + i * 17) * 0.7) * 0.035;
    return 1 + drift * t + wobble;
  });
}

/** Sparkline points as an SVG polyline string. */
export function sparkPath(
  values: number[],
  width: number,
  height: number,
): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
