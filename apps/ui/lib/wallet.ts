/**
 * Wallet arithmetic and formatting.
 *
 * Balances live in token units; BSV also has satoshis, which are its smallest
 * unit rather than a separate thing. Everything is valued through USD per unit
 * so a portfolio total can be struck across assets that have nothing else in
 * common.
 */
import { getBsvChange, getBsvRates, getUsdPerBsv } from "@/lib/exchange-rate";
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
 * Fixture-side only — a live wallet's single holding is assembled in
 * wallet-live.ts from the shell's balance. Every price here is a fixture price
 * EXCEPT bitcoin's, which `usdPerUnitOf` takes from the market: the invented
 * tokens can only be worth what this file says, and BSV can be checked against
 * any exchange in the world.
 */
export function holdings(): Holding[] {
  return getTokenBalances()
    .map(({ token, units }) => {
      const rate = usdPerUnitOf(token);
      return { token, units, usd: rate === null ? null : units * rate };
    })
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
    (sum, h) => sum + change24hOf(h.token) * ((h.usd ?? 0) / total),
    0
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
  /*
   * Bitcoin is priced from the market in demo mode too.
   *
   * The other symbols here are invented and their fixture prices are the only
   * ones they can have, but BSV is a real asset with a real price, and quoting
   * a stale one under a balance somebody can check elsewhere is the one figure
   * on this screen that can be caught out. See lib/exchange-rate.
   */
  if (token.id === "bsv") return getUsdPerBsv();
  return token.usdPerUnit;
}

export function txUsd(tx: WalletTransaction): number | null {
  const token = txToken(tx);
  if (!token) return null;
  const rate = usdPerUnitOf(token);
  return rate === null ? null : txUnits(tx) * rate;
}

const DAY_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Group transactions under day headings, newest first — Vela's activity shape.
 *
 * "Today" and "Yesterday" are relative to the newest transaction rather than to
 * the clock, so the seeded history keeps stable labels instead of drifting into
 * "3 weeks ago" and never matching between server and client.
 */
export function groupByDay(
  transactions: WalletTransaction[]
): { label: string; items: WalletTransaction[] }[] {
  const sorted = [...transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
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
 * What an asset did today, in percent.
 *
 * The mirror of `usdPerUnitOf`, and for the same reason: bitcoin is a real
 * asset whose move anyone can check against an exchange, and the invented
 * symbols beside it have only the numbers the fixtures gave them. Live where
 * there is a live answer, fixture where there is not.
 */
export function change24hOf(token: Token): number {
  if (token.id !== "bsv") return token.change24h;
  return getBsvChange() ?? token.change24h;
}

/**
 * The series a sparkline draws.
 *
 * A month of real daily closes for bitcoin; the deterministic wobble below for
 * everything else. Both are normalised by `sparkPath`, so one returns dollars
 * and the other returns numbers around 1 and the drawing does not care.
 */
export function sparkSeries(token: Token, points = 30): number[] {
  if (token.id === "bsv") {
    const closes = getBsvRates();
    if (closes.length >= 2) return closes;
  }
  return sparkline(token, points);
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
  /*
   * The wobble is a fraction of the token's own move, not a fixed 3.5%.
   *
   * At a fixed amplitude the wobble swamped the drift for every asset here —
   * a stablecoin at 0.00% drew the same dramatic oscillation as a token up
   * 3.1%, because the shape came from the token's id and nothing else. Beside
   * bitcoin's real closes that reads as a chart of nothing. Tied to the move,
   * a flat asset draws flat.
   */
  const amplitude = Math.min(0.02, Math.abs(drift) * 0.6);
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    // Repeatable, so the chart is identical on server and client.
    /* Two harmonics rather than one. A single sine is obvious as a sine at
       the size the asset's own page draws it, and a series that announces
       itself as generated is worse than one that simply is. */
    const phase = (seed + i * 17) * 0.7;
    const wobble =
      (Math.sin(phase) * 0.7 + Math.sin(phase * 2.3 + seed) * 0.3) * amplitude;
    return 1 + drift * t + wobble;
  });
}

/**
 * The smallest move that fills the box, as a fraction of the series' level.
 *
 * Below this the line is drawn proportionally smaller and centred instead. A
 * sparkline scaled purely to its own min and max always fills its height, so
 * an asset that moved a hundredth of a percent draws the same swing as one
 * that moved thirty — the chart would be a picture of rounding error.
 */
const MIN_SPARK_SPAN = 0.02;

/**
 * The same geometry as an SVG path command string.
 *
 * A `<path>` rather than a `<polyline>` because the draw-on animation works by
 * dashing the stroke against `pathLength`, and Chromium honours that attribute
 * on a path — on a polyline the dash lengths stayed in user units, so a line
 * meant to be drawing itself rendered as five evenly spaced ticks.
 */
export function sparkD(
  values: number[],
  width: number,
  height: number
): string {
  const points = sparkPath(values, width, height).split(" ");
  return points.map((point, i) => `${i === 0 ? "M" : "L"}${point}`).join(" ");
}

/** Sparkline points as an SVG polyline string. */
export function sparkPath(
  values: number[],
  width: number,
  height: number
): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  const level =
    Math.abs(values.reduce((sum, value) => sum + value, 0) / values.length) ||
    1;
  const span = Math.max(max - min, level * MIN_SPARK_SPAN);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height / 2 - ((value - mid) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
