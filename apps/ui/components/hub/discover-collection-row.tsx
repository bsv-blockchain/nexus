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
 *
 * One card per slot, not per campaign — see the same note on
 * DiscoverBannerRow for why `winningCampaigns` rather than a plain filter,
 * for how a shared slot rotates between the campaigns tied for it, and for
 * why an impression is now a card somebody scrolled to rather than one that
 * merely mounted.
 * The card itself lives in discover-promo-cards.tsx, shared with Store
 * Admin's own live preview.
 */

import { CollectionCard } from "@/components/hub/discover-promo-cards";
import { useHub } from "@/components/hub/hub-provider";
import { useSeenOnce } from "@/components/hub/use-promo-impression";
import { recordClick, recordImpression, useAdminPromoState, winningCampaigns } from "@/lib/admin-store";
import { content, getHubApps, type HubApp } from "@/lib/data";
import { SLOT_COUNT } from "@/lib/data/discover-promos";
import { useRotationPick } from "@/lib/promo-rotation";
import { enableRepository } from "@/lib/repositories-store";
import type { ReactNode } from "react";

export function DiscoverCollectionRow(): ReactNode {
  const copy = content.library.apps;
  const admin = useAdminPromoState();
  const pick = useRotationPick();
  const apps = getHubApps();

  const collections = winningCampaigns(admin.collections, SLOT_COUNT, { pick })
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
        {collections.map(({ collection, apps: repoApps }) => (
          <TrackedCollection
            key={collection.id}
            id={collection.id}
            repoId={collection.repoId}
            headline={collection.headline}
            subhead={collection.subhead}
            sponsored={collection.sponsored}
            apps={repoApps}
          />
        ))}
      </div>
    </section>
  );
}

/** Wraps the shared card with real data plus impression/click counting. */
function TrackedCollection({
  id,
  repoId,
  apps,
  ...card
}: {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  sponsored: boolean;
  apps: HubApp[];
}): ReactNode {
  const { isInstalled, installApp, pinSite } = useHub();
  const allConnected = apps.every((app) => isInstalled(app.slug));
  const ref = useSeenOnce<HTMLDivElement>(`collections:${id}`, () =>
    recordImpression("collections", id),
  );

  return (
    <div ref={ref}>
      <CollectionCard
        {...card}
        apps={apps}
        allConnected={allConnected}
        onConnectAll={() => {
          recordClick("collections", id);
          enableRepository(repoId);
          /* A website is "installed" by being pinned, a screen we compiled
             by being named in the profile's list — see the same branch on
             the permission sheet's own confirm handler. `installApp` alone
             leaves a web listing here looking connected in this list and
             disconnected everywhere that actually checks. */
          for (const app of apps) {
            if (app.web) pinSite(app.web.url, app.name);
            else installApp(app.slug);
          }
        }}
      />
    </div>
  );
}
