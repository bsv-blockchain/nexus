"use client";

import { AppTile } from "@/components/hub/app-icon";
import { getHubApp, getMintTiers } from "@/lib/data";
import { Settings2, Sparkles, Tag, Upload } from "lucide-react";
import type { ReactNode } from "react";

/** Faithful rebranded replica of the MintFlow token-minting studio. */
export function PublisherApp(): ReactNode {
  const app = getHubApp("publisher");
  const tiers = getMintTiers();

  return (
    <div className="relative h-full overflow-y-auto bg-background">
      {/* Ambient gradient wash */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-70"
        aria-hidden="true"
      >
        <div className="absolute top-[-10%] left-[-10%] size-[45vw] rounded-full bg-accent/25 blur-[120px]" />
        <div className="absolute top-[5%] right-[-10%] size-[40vw] rounded-full bg-[#22d3ee]/20 blur-[120px]" />
      </div>

      {/* Product header — consistent with the other app headers */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/70 px-5 py-3 backdrop-blur-xl">
        {app && <AppTile app={app} size={24} />}
        <h1 className="text-sm font-semibold">{app?.name ?? "Publish"}</h1>
      </header>

      <div className="relative z-1 mx-auto max-w-6xl px-6 py-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Tokenized Access &amp; Loyalty
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
            Mint{" "}
            <span className="bg-linear-to-r from-accent via-[#7c86ff] to-[#22d3ee] bg-clip-text text-transparent">
              Digital Assets
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-balance text-muted-foreground">
            Issue flexible, tradeable tokens for your business, from recurring
            revenue to punch-card loyalty programs, powered by BSV.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          {/* Upload */}
          <div className="lg:col-span-5">
            <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-surface/60 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-accent/10 p-2 text-accent">
                  <Upload className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Upload Asset</h2>
                  <p className="text-xs text-muted-foreground">
                    Step 1: Choose your file
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
                <span className="mb-4 rounded-full bg-muted p-4">
                  <Upload
                    className="size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>
                <p className="text-base font-medium">
                  Drag collection image here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supports JPG, PNG, GIF (max 10MB)
                </p>
              </div>
            </div>
          </div>

          {/* Configure tiers */}
          <div className="lg:col-span-7">
            <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-surface/60 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[#7c86ff]/15 p-2 text-[#7c86ff]">
                    <Settings2 className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Configure Tiers</h2>
                    <p className="text-xs text-muted-foreground">
                      Step 2: Define pricing &amp; rarity
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tiers.length} Active Tiers
                </span>
              </div>

              <div className="mt-4 divide-y divide-border rounded-xl border border-border">
                {tiers.map((tier, index) => (
                  <div
                    key={tier.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover"
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: tier.accent }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tier.supplyPct}% · {tier.price}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Edit ${tier.name} tier`}
                      className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                    >
                      <Tag className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="focus-ring mt-4 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Mint collection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
