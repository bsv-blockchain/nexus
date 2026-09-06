"use client";

/**
 * "Discover More Sources" — a banner per third-party store, each a click
 * away from switching that source on. The reference App Stores sell this
 * exact slot to a publisher; Nexus's own version of that is the Store Admin
 * app (components/apps/store-admin-app.tsx), which is where `sponsored` /
 * `advertiser` come from — a label an admin can set, not a transaction. See
 * lib/admin-store.ts for why there is no checkout behind it.
 *
 * One card per slot, not per campaign — `winningCampaigns` picks whichever
 * live campaign is assigned to each of `SLOT_COUNT` positions, so a slot with
 * nothing live assigned to it just does not draw a card. Same principle as
 * everything else this session shipped hidden behind a "no real content yet"
 * empty state: a section with nothing to show does not render a row of
 * promises.
 *
 * The card itself lives in discover-promo-cards.tsx, shared with Store
 * Admin's own live preview — this file's job is only real data plus the
 * impression/click counting that actually matters.
 */

import { BannerCard } from "@/components/hub/discover-promo-cards";
import { recordClick, recordImpression, useAdminPromoState, winningCampaigns } from "@/lib/admin-store";
import { content, getDefaultRepositories } from "@/lib/data";
import { SLOT_COUNT } from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import { useEffect, type ReactNode } from "react";

export function DiscoverBannerRow(): ReactNode {
  const copy = content.library.apps;
  const repos = useRepositories();
  const admin = useAdminPromoState();
  const banners = winningCampaigns(admin.banners, SLOT_COUNT);
  if (banners.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">{copy.featuredBannersTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => {
          const repo =
            repos.find((r) => r.id === banner.repoId) ??
            getDefaultRepositories().find((r) => r.id === banner.repoId);
          if (!repo) return null;
          return (
            <TrackedBanner
              key={banner.id}
              id={banner.id}
              headline={banner.headline}
              subhead={banner.subhead}
              art={banner.art}
              enabled={repo.enabled}
              sponsored={banner.sponsored}
              advertiser={banner.advertiser}
              onEnable={() => {
                recordClick("banners", banner.id);
                enableRepository(repo.id);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

/** Wraps the shared card with the one impression Discover itself is responsible for counting. */
function TrackedBanner({
  id,
  onEnable,
  ...card
}: {
  id: string;
  headline: string;
  subhead: string;
  art?: string | undefined;
  enabled: boolean;
  sponsored: boolean;
  advertiser?: string | undefined;
  onEnable: () => void;
}): ReactNode {
  /* One impression per mount — this card just won its slot for the reader
     looking at it right now, which is the one honest moment to count. */
  useEffect(() => {
    recordImpression("banners", id);
  }, [id]);

  return <BannerCard {...card} onEnable={onEnable} />;
}
