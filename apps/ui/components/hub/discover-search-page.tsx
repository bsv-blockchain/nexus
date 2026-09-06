"use client";

/**
 * What the sidebar's search field opens onto — a plain match against name,
 * tagline and publisher across the whole catalogue, not scoped to whichever
 * Discover section happened to be open. The same `noResults` string Manage's
 * own search already uses, since it is the same sentence either way: nothing
 * here matched what was typed.
 */

import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { content, getHubApps, type HubApp } from "@/lib/data";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

function matches(app: HubApp, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    app.name.toLowerCase().includes(q) ||
    app.tagline.toLowerCase().includes(q) ||
    app.publisher.toLowerCase().includes(q)
  );
}

export function SearchResultsPage({
  query,
  onSelect,
  onBack,
}: {
  query: string;
  onSelect: (app: HubApp) => void;
  onBack: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const { isInstalled, openAppPrompt } = useHub();
  const results = getHubApps()
    .filter((app) => matches(app, query))
    .sort((a, b) => b.popularity - a.popularity);

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
      <h1 className="text-2xl font-bold tracking-tight text-pretty">
        &ldquo;{query}&rdquo;
      </h1>
      {results.length === 0 ? (
        <p className="text-muted-foreground py-6 text-sm">
          {content.appStore.noResults}
        </p>
      ) : (
        <div className="divide-border/60 mt-4 grid divide-y sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-3">
          {results.map((app) => {
            const installed = isInstalled(app.slug);
            return (
              <div
                key={app.slug}
                className="sm:border-border/60 flex items-center gap-3 py-2.5 sm:border-b"
              >
                <button
                  type="button"
                  onClick={() => onSelect(app)}
                  className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
                >
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
                  onClick={() =>
                    openAppPrompt(app.slug, installed ? "uninstall" : "install")
                  }
                  aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
                  className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    installed
                      ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
                      : PRIMARY_CTA
                  }`}
                >
                  {installed ? copy.uninstall : copy.install}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
