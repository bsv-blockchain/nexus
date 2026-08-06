"use client";

import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { content } from "@/lib/data";
import {
  changeTone,
  percent,
  sparkPath,
  sparkline,
  usd,
  type Holding,
} from "@/lib/wallet";
import { usePortfolio } from "@/lib/wallet-live";
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import type { ReactNode } from "react";

/** Compact sparkline. Purely decorative, so it carries no accessible name. */
export function Spark({
  holding,
  width = 64,
  height = 22,
}: {
  holding: Holding;
  width?: number;
  height?: number;
}): ReactNode {
  const values = sparkline(holding.token);
  const up = holding.token.change24h >= 0;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={sparkPath(values, width, height)}
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
}: {
  onOpenToken: (tokenId: string) => void;
  /** Absent means the shell has no rail behind the button — it hides rather
      than open a sheet that could only show fixtures. */
  onSend?: () => void;
  onReceive?: () => void;
  onExchange?: () => void;
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
      <section className="rounded-2xl bg-surface p-5 sm:p-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {copy.totalValue}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {loading ? "—" : usd(total)}
        </p>
        {/* An em dash above says the total is unknown; this says why. Without it a
            funded wallet with no rate looks like a broken wallet. */}
        {!loading && total === null && rows.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{copy.noRate}</p>
        ) : null}
        {/* A real wallet cannot answer "how much did this move today", and printing
            0.00% would be an answer rather than an absence of one. */}
        {change !== null ? (
          <p className={`mt-1 text-sm font-semibold ${changeTone(change)}`}>
            {percent(change)}{" "}
            <span className="font-normal text-muted-foreground">
              {copy.change24h}
            </span>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-1 text-sm font-medium text-negative">
            {error}
          </p>
        ) : null}

        {actions.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {actions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="focus-ring flex flex-col items-center gap-1.5 rounded-xl bg-surface-raised px-3 py-3 text-xs font-semibold ring-1 ring-border/60 transition-colors hover:bg-surface-hover"
              >
                <Icon className="size-4 text-accent" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-sm font-semibold">{copy.assets}</h2>
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
          {rows.map((holding) => (
            <li key={holding.token.id}>
              <button
                type="button"
                onClick={() => onOpenToken(holding.token.id)}
                className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <TokenMark token={holding.token} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {holding.token.name}
                    </span>
                    {holding.token.base && (
                      <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-bold text-accent">
                        {copy.baseCurrency}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
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
                      className={`block text-xs font-medium ${changeTone(holding.token.change24h)}`}
                    >
                      {percent(holding.token.change24h)}
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
