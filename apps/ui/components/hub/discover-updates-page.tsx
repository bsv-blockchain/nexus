"use client";

/**
 * "Updates" — but the reference's "Upcoming Automatic Updates" section has no
 * honest answer here. Nexus does not ship these apps; they are web apps, each
 * updated by whoever runs its origin, whenever they choose to. There is
 * nothing upcoming to show and nothing to promise. What is real is which
 * repository most recently published a new catalogue version — see
 * getRecentlyUpdatedApps — so this page only ever claims the one thing it can
 * actually back up: what changed lately, not what will.
 */

import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { content, getRecentlyUpdatedApps, type HubAppSlug } from "@/lib/data";
import type { ReactNode } from "react";

function timeAgo(iso: string): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function UpdatesPage({
  onOpen,
}: {
  onOpen: (slug: HubAppSlug) => void;
}): ReactNode {
  const copy = content.library.apps;
  const updates = getRecentlyUpdatedApps();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{copy.updatesTitle}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{copy.updatesHint}</p>

      <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-bold tracking-wide uppercase">
        {copy.updatedRecently}
      </h2>
      {updates.length === 0 ? (
        <p className="text-muted-foreground py-6 text-sm">{copy.updatesEmpty}</p>
      ) : (
        <div className="divide-border/60 divide-y">
          {updates.map(({ app, updatedAt }) => (
            <div key={app.slug} className="flex items-center gap-3 py-3">
              <AppTile app={app} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  <AppName app={app} />
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {copy.updatedLabel.replace("{when}", timeAgo(updatedAt))}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onOpen(app.slug)}
                className="focus-ring bg-surface-raised text-accent border-border shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
              >
                {copy.openApp}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
