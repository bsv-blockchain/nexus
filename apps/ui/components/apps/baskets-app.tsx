"use client";

import { useHub } from "@/components/hub/hub-provider";
import { content, getOutputBaskets } from "@/lib/data";
import { Boxes, Coins, Plus } from "lucide-react";
import type { ReactNode } from "react";

function formatSats(satoshis: number): string {
  if (satoshis >= 1_000_000)
    return `${(satoshis / 100_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })} BSV`;
  return `${satoshis.toLocaleString("en-US")} sats`;
}

export function BasketsApp(): ReactNode {
  const { basketSelected } = useHub();
  const baskets = getOutputBaskets();
  const basket =
    baskets.find((b) => b.id === basketSelected) ?? baskets[0] ?? null;
  const copy = content.baskets;

  if (!basket) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {copy.subtitle}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Boxes className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-lg font-bold">
                {basket.name}
              </p>
              <p className="text-xs text-muted-foreground">{basket.protocol}</p>
            </div>
          </div>
          <button
            type="button"
            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.newBasket}
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {basket.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              {copy.outputs}
            </p>
            <p className="mt-1 text-2xl font-bold">{basket.outputCount}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Value
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatSats(basket.satoshis)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Protocol
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {basket.protocol}
            </p>
          </div>
        </div>

        <ul className="mt-5 divide-y divide-border rounded-2xl bg-surface">
          {Array.from({ length: Math.min(basket.outputCount, 8) }).map(
            (_, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Coins className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">
                    {basket.name}:{index}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {basket.protocol}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold">
                  {formatSats(Math.round(basket.satoshis / basket.outputCount))}
                </p>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
