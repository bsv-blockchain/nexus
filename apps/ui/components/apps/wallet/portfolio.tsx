"use client";

import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { content } from "@/lib/data";
import { useBsvHistory } from "@/lib/exchange-rate";
import {
  change24hOf,
  changeTone,
  percent,
  sparkD,
  sparkSeries,
  usd,
  type Holding,
} from "@/lib/wallet";
import { usePortfolio } from "@/lib/wallet-live";
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The row sparkline. Purely decorative, so it carries no accessible name.
 *
 * Wide and shallow rather than square: this is a trend line beside a balance,
 * and a month of closes reads as a direction across the width. The old box was
 * near enough square that a drawing swinging edge to edge looked like a
 * seismograph — which it was, since the series it drew was a sine wave.
 *
 * Deliberately not interactive and deliberately not animated. The chart you can
 * actually read lives on the asset's own page; five of these drawing themselves
 * every time the list paints is a page that fidgets.
 *
 * Subscribed rather than merely read, so the line redraws from the wobble to
 * the real closes the moment the explorer answers.
 *
 * @see components/apps/wallet/price-chart.tsx
 */
export function Spark({
  holding,
  width = 88,
  height = 18,
}: {
  holding: Holding;
  width?: number;
  height?: number;
}): ReactNode {
  useBsvHistory();
  const values = sparkSeries(holding.token);
  const up = change24hOf(holding.token) >= 0;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <path
        d={sparkD(values, width, height)}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={up ? "stroke-positive" : "stroke-negative"}
      />
    </svg>
  );
}

/**
 * One column per action, rather than a fixed three.
 *
 * Exchange is demo-only — see the comment beside `onExchange` in wallet-app —
 * so a live wallet offers two buttons and the demo offers three. A hardcoded
 * grid-cols-3 left the live pair at two thirds width with an empty cell beside
 * them, which reads as a third control that failed to load rather than as a
 * wallet that has two. Indexed by `actions.length`, so the widths follow what
 * the build actually carries.
 *
 * Spelled out rather than interpolated: Tailwind scans source text, so a
 * `grid-cols-${n}` it cannot read is a class it never generates.
 */
const ACTION_COLUMNS = [
  "",
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
] as const;

/**
 * Portfolio header and the held-asset list.
 *
 * The total is struck across every asset through USD, since that is the only
 * thing a harvest share and a satoshi have in common. BSV is pinned first: it
 * is the base currency, not just the largest holding.
 */
export function Portfolio({
  onOpenToken,
  onSend,
  onReceive,
  onExchange,
  wallet,
}: {
  onOpenToken: (tokenId: string) => void;
  /** Absent means the shell has no rail behind the button — it hides rather
      than open a sheet that could only show fixtures. */
  onSend?: () => void;
  onReceive?: () => void;
  onExchange?: () => void;
  /** The wallet picker, which the card heads rather than the page. */
  wallet?: ReactNode;
}): ReactNode {
  const copy = content.wallet;
  const { rows, total, change, loading, error, mode } = usePortfolio();
  // Sparklines and 24h percentages are fixture properties. A live balance has
  // neither, and a flat line next to "0.00%" reads as a real quote rather than as
  // missing data.
  const showTrend = mode === "demo";
  const actions = [
    { label: copy.send, icon: ArrowUpRight, onClick: onSend },
    { label: copy.receive, icon: ArrowDownLeft, onClick: onReceive },
    { label: copy.exchange, icon: Repeat, onClick: onExchange },
  ].filter((action) => action.onClick);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section className="bg-surface rounded-2xl p-5 sm:p-6">
        {/*
          The wallet's name, level with the figure it belongs to.

          It used to sit above the card, where it read as a page heading — but
          this number is one wallet's, not the app's, and the two belong in the
          same frame. Right of the total rather than over it, so the eye still
          lands on the money first.
        */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {copy.totalValue}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {loading ? "—" : usd(total)}
            </p>
            {/* An em dash above says the total is unknown; this says why. Without it a
            funded wallet with no rate looks like a broken wallet. */}
            {!loading && total === null && rows.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {copy.noRate}
              </p>
            ) : null}
            {/* A real wallet cannot answer "how much did this move today", and printing
            0.00% would be an answer rather than an absence of one. */}
            {change !== null ? (
              <p className={`mt-1 text-sm font-semibold ${changeTone(change)}`}>
                {percent(change)}{" "}
                <span className="text-muted-foreground font-normal">
                  {copy.change24h}
                </span>
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="text-negative mt-1 text-sm font-medium"
              >
                {error}
              </p>
            ) : null}
          </div>
          {wallet}
        </div>

        {actions.length > 0 && (
          <div className={`mt-5 grid gap-2 ${ACTION_COLUMNS[actions.length]}`}>
            {actions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="focus-ring bg-surface-raised ring-border/60 hover:bg-surface-hover flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold ring-1 transition-colors"
              >
                {/*
                  Bigger, and mixed toward the foreground rather than sitting at
                  the flat accent.

                  `var(--foreground)` is near-black in a light theme and
                  near-white in a dark one, so mixing the accent toward it
                  darkens the mark on light and lightens it on dark by
                  construction — no `dark:` variant, and it follows the custom
                  per-workspace palettes the theme picker sets, which a pair of
                  hardcoded colours would not.
                */}
                <Icon
                  className="size-5"
                  style={{
                    color:
                      "color-mix(in oklab, var(--accent) 62%, var(--foreground))",
                  }}
                  aria-hidden="true"
                />
                {label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-sm font-semibold">{copy.assets}</h2>
        <ul className="divide-border bg-surface mt-2 divide-y overflow-hidden rounded-2xl">
          {rows.map((holding) => (
            <li key={holding.token.id}>
              <button
                type="button"
                onClick={() => onOpenToken(holding.token.id)}
                className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              >
                <TokenMark token={holding.token} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {holding.token.name}
                    </span>
                    {holding.token.base && (
                      <span className="bg-accent/15 text-accent shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold">
                        {copy.baseCurrency}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {formatUnits(holding.units, holding.token.decimals)}{" "}
                    {holding.token.symbol}
                  </span>
                </span>
                {showTrend && <Spark holding={holding} />}
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold">
                    {usd(holding.usd)}
                  </span>
                  {showTrend && (
                    <span
                      className={`block text-xs font-medium ${changeTone(change24hOf(holding.token))}`}
                    >
                      {percent(change24hOf(holding.token))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
