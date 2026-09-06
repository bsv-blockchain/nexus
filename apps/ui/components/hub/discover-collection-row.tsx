"use client";

/**
 * "Connect a Whole Source at Once" — the same shelf every reference App
 * Store sells a publisher, pointed at one of ours: every app one source
 * ships, connected together rather than one at a time.
 *
 * A deliberate departure from how connecting an app usually works elsewhere
 * in this build. `AppCard`'s own repo toggle switches a source on and
 * installs nothing — "a catalogue grants nothing and installs nothing" is
 * the principle stated on it — because connecting one app is a decision
 * about one permission. This button skips straight to installing all of
 * them, the same way switching a whole source on already skips the
 * per-listing question a moment most people are not asking here: somebody
 * reaching for "everything from HandCash" has already decided about HandCash,
 * not about `soundbase` specifically.
 */

import { AppTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { useAdminPromoState } from "@/lib/admin-store";
import { content, getHubApps } from "@/lib/data";
import { featuredCollections } from "@/lib/data/discover-promos";
import { enableRepository } from "@/lib/repositories-store";
import type { ReactNode } from "react";

export function DiscoverCollectionRow(): ReactNode {
  const copy = content.library.apps;
  const admin = useAdminPromoState();
  const { isInstalled, installApp, pinSite } = useHub();
  const apps = getHubApps();

  const collections = featuredCollections
    .filter((collection) => admin.collections[collection.id]?.enabled !== false)
    .map((collection) => ({
      collection,
      apps: apps.filter((app) => app.repoId === collection.repoId),
    }))
    .filter((entry) => entry.apps.length > 0);
  if (collections.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">{copy.featuredCollectionsTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map(({ collection, apps: repoApps }) => {
          const fields = admin.collections[collection.id];
          const allIn = repoApps.every((app) => isInstalled(app.slug));
          return (
            <div key={collection.id} className="bg-surface-raised rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex shrink-0 -space-x-3">
                  {repoApps.slice(0, 4).map((app) => (
                    <span
                      key={app.slug}
                      className="ring-surface-raised size-11 overflow-hidden rounded-full shadow ring-2"
                      title={app.name}
                    >
                      <AppTile app={app} size={44} />
                    </span>
                  ))}
                </div>
                {fields?.sponsored && (
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    {copy.sponsoredLabel}
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-bold text-pretty">
                {collection.headline}
              </p>
              <p className="text-muted-foreground mt-1 text-xs text-pretty">
                {collection.subhead}
              </p>
              <button
                type="button"
                onClick={() => {
                  enableRepository(collection.repoId);
                  /* A website is "installed" by being pinned, a screen we
                     compiled by being named in the profile's list — see
                     the same branch on the permission sheet's own confirm
                     handler. `installApp` alone leaves a web listing here
                     looking connected in this list and disconnected
                     everywhere that actually checks. */
                  for (const app of repoApps) {
                    if (app.web) pinSite(app.web.url, app.name);
                    else installApp(app.slug);
                  }
                }}
                disabled={allIn}
                className={`focus-ring mt-3 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  allIn ? "bg-muted text-muted-foreground" : PRIMARY_CTA
                }`}
              >
                {allIn
                  ? copy.connectedAll
                  : copy.connectAll.replace("{n}", String(repoApps.length))}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
