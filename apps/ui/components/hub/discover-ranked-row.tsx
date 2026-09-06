"use client";

/**
 * "Top Free Apps" / "Top Paid Apps" — one tab group, two rankings of the same
 * catalogue split by whether an app declares a price at all.
 *
 * Almost nothing here does. Two apps in the whole catalogue carry
 * `pricing` — Sign and Publish — and everything else connects for free, so
 * Paid is thin rather than padded out with an invented subscription nobody
 * charges. The same principle the extensions fixture already states: a
 * section stocked with content that is not real describes a store that does
 * not exist.
 *
 * Ranked by `popularity`, the field the catalogue already carries for
 * exactly this. Column-major numbering (1-2-3 down the first column before
 * 4 starts a new one) is the real App Store's own layout; this reads row by
 * row instead, which keeps the grid honest at every width without a fixed
 * row count fighting the responsive columns.
 */

import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { TabRow, Tab } from "@/components/hub/tab-row";
import { content, type HubApp } from "@/lib/data";
import { useHub } from "@/components/hub/hub-provider";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export const RANKED_PREVIEW_COUNT = 10;

function byPopularity(apps: HubApp[]): HubApp[] {
  return [...apps].sort((a, b) => b.popularity - a.popularity);
}

/** One row: rank, icon, name, tagline, and the same Connect/Disconnect pill AppCard uses. */
function RankedItem({
  app,
  rank,
  onSelect,
}: {
  app: HubApp;
  rank: number;
  onSelect: (app: HubApp) => void;
}): ReactNode {
  const copy = content.library.apps;
  const { isInstalled, openAppPrompt } = useHub();
  const installed = isInstalled(app.slug);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={() => onSelect(app)}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className="text-muted-foreground w-4 shrink-0 text-right text-sm tabular-nums"
          aria-hidden="true"
        >
          {rank}
        </span>
        <AppTile app={app} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            <AppName app={app} />
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {app.tagline}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => openAppPrompt(app.slug, installed ? "uninstall" : "install")}
        aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
        className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          installed
            ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
            : "bg-surface-raised text-accent border-border border"
        }`}
      >
        {app.pricing ? app.pricing.summary : installed ? copy.uninstall : copy.install}
      </button>
    </div>
  );
}

export function RankedRow({
  freeApps,
  paidApps,
  onSelect,
  onSeeAll,
}: {
  freeApps: HubApp[];
  paidApps: HubApp[];
  onSelect: (app: HubApp) => void;
  onSeeAll: (kind: "free" | "paid") => void;
}): ReactNode {
  const copy = content.library.apps;
  const [tier, setTier] = useState<"free" | "paid">("free");
  const ranked = byPopularity(tier === "free" ? freeApps : paidApps);
  const preview = ranked.slice(0, RANKED_PREVIEW_COUNT);

  return (
    <section className="mt-8">
      <TabRow
        className="mb-1"
        gap="gap-6"
        action={
          preview.length > 0 ? (
            /* Hidden on a phone: this heading-sized TabRow has no room to
               spare for a second control beside it at that width. The ten
               apps already in the preview are what a phone gets for now. */
            <button
              type="button"
              onClick={() => onSeeAll(tier)}
              className="focus-ring text-accent bg-background hidden px-1 text-sm font-semibold hover:underline sm:inline"
            >
              {copy.seeAll}
            </button>
          ) : undefined
        }
      >
        <Tab
          label={copy.topFreeApps}
          group="ranked-apps"
          size="lg"
          active={tier === "free"}
          onClick={() => setTier("free")}
        />
        <Tab
          label={copy.topPaidApps}
          group="ranked-apps"
          size="lg"
          active={tier === "paid"}
          onClick={() => setTier("paid")}
        />
      </TabRow>
      {preview.length === 0 ? (
        <p className="text-muted-foreground py-6 text-sm">{copy.topPaidEmpty}</p>
      ) : (
        <div className="divide-border/60 grid divide-y sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-3">
          {preview.map((app, i) => (
            <div key={app.slug} className="sm:border-border/60 sm:border-b">
              <RankedItem app={app} rank={i + 1} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The full ranking, one tier, as its own page. */
export function RankedListPage({
  title,
  apps,
  onSelect,
  onBack,
}: {
  title: string;
  apps: HubApp[];
  onSelect: (app: HubApp) => void;
  onBack: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const ranked = byPopularity(apps);
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm font-medium"
      >
        <ChevronRight className="size-4 rotate-180" aria-hidden="true" />
        {copy.back}
      </button>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="divide-border/60 mt-4 grid divide-y sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-3">
        {ranked.map((app, i) => (
          <div key={app.slug} className="sm:border-border/60 sm:border-b">
            <RankedItem app={app} rank={i + 1} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}
