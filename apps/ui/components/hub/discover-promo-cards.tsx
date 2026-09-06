"use client";

/**
 * The two promo cards themselves, drawn once — Discover mounts them for
 * real (see discover-banner-row.tsx / discover-collection-row.tsx, which
 * wrap these with the impression/click recording that actually counts) and
 * Store Admin mounts the exact same components as a live preview while
 * editing a campaign. One component rather than two nearly-identical ones
 * is why the preview can never quietly drift from what a reader actually
 * sees: there is only one place this card's markup is written down.
 *
 * `onEnable` / `onConnectAll` are optional on purpose — leaving either off
 * is what makes a card a preview rather than a live control. A preview that
 * could still enable a real source or connect real apps from inside the
 * admin screen would be a side door into a decision that belongs on
 * Discover, not a snapshot of one.
 */

import { AppTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { content, type HubApp } from "@/lib/data";
import type { ReactNode } from "react";

export function BannerCard({
  headline,
  subhead,
  art,
  enabled,
  sponsored,
  advertiser,
  onEnable,
}: {
  headline: string;
  subhead: string;
  art?: string | undefined;
  enabled: boolean;
  sponsored: boolean;
  advertiser?: string | undefined;
  /** omit for a non-interactive preview */
  onEnable?: (() => void) | undefined;
}): ReactNode {
  const copy = content.library.apps;
  return (
    <div className="bg-surface-raised relative overflow-hidden rounded-2xl">
      <div
        aria-hidden="true"
        className="relative h-32 bg-cover bg-center"
        style={
          art
            ? { backgroundImage: `url(${art})` }
            : { backgroundImage: "linear-gradient(135deg, #4353ff, #8b5cf6)" }
        }
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
        />
        {sponsored && (
          <span className="bg-background/85 text-foreground absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {copy.sponsoredLabel}
            {advertiser ? ` · ${advertiser}` : ""}
          </span>
        )}
        <p className="absolute bottom-3 left-4 text-lg font-bold text-white">
          {headline}
        </p>
      </div>
      <div className="p-4">
        <p className="text-muted-foreground text-sm text-pretty">{subhead}</p>
        <button
          type="button"
          onClick={onEnable}
          disabled={enabled || !onEnable}
          className={`focus-ring mt-3 rounded-full px-3 py-1.5 text-xs font-semibold ${
            enabled ? "bg-muted text-muted-foreground" : PRIMARY_CTA
          } ${!onEnable && !enabled ? "opacity-60" : ""}`}
        >
          {enabled ? copy.sourceEnabled : copy.enableSource}
        </button>
      </div>
    </div>
  );
}

export function CollectionCard({
  headline,
  subhead,
  apps,
  sponsored,
  allConnected,
  onConnectAll,
}: {
  headline: string;
  subhead: string;
  apps: HubApp[];
  sponsored: boolean;
  allConnected: boolean;
  /** omit for a non-interactive preview */
  onConnectAll?: (() => void) | undefined;
}): ReactNode {
  const copy = content.library.apps;
  return (
    <div className="bg-surface-raised rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 -space-x-3">
          {apps.slice(0, 4).map((app) => (
            <span
              key={app.slug}
              className="ring-surface-raised size-11 overflow-hidden rounded-full shadow ring-2"
              title={app.name}
            >
              <AppTile app={app} size={44} />
            </span>
          ))}
        </div>
        {sponsored && (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {copy.sponsoredLabel}
          </span>
        )}
      </div>
      <p className="mt-3 text-base font-bold text-pretty">{headline}</p>
      <p className="text-muted-foreground mt-1 text-xs text-pretty">{subhead}</p>
      <button
        type="button"
        onClick={onConnectAll}
        disabled={allConnected || !onConnectAll}
        className={`focus-ring mt-3 rounded-full px-3 py-1.5 text-xs font-semibold ${
          allConnected ? "bg-muted text-muted-foreground" : PRIMARY_CTA
        } ${!onConnectAll && !allConnected ? "opacity-60" : ""}`}
      >
        {allConnected
          ? copy.connectedAll
          : copy.connectAll.replace("{n}", String(apps.length))}
      </button>
    </div>
  );
}
