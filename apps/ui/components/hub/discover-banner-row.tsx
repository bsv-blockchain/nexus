"use client";

/**
 * "Discover More Sources" — a banner per third-party store, each a click
 * away from switching that source on. The reference App Stores sell this
 * exact slot to a publisher; Nexus's own version of that is the Store Admin
 * app (components/apps/store-admin-app.tsx), which is where `sponsored` /
 * `advertiser` / `priceLabel` come from — a label an admin can set, not a
 * transaction. See lib/admin-store.ts for why there is no checkout behind it.
 *
 * One card per `FeaturedBanner`, filtered to whatever the admin has switched
 * on — same principle as everything else this session shipped hidden behind
 * a "no real content yet" empty state: a section with nothing enabled to
 * show does not render a row of promises.
 */

import { PRIMARY_CTA } from "@/components/hub/cta";
import { useAdminPromoState } from "@/lib/admin-store";
import { content, getDefaultRepositories } from "@/lib/data";
import { featuredBanners } from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import type { ReactNode } from "react";

export function DiscoverBannerRow(): ReactNode {
  const copy = content.library.apps;
  const repos = useRepositories();
  const admin = useAdminPromoState();
  const banners = featuredBanners.filter(
    (banner) => admin.banners[banner.id]?.enabled !== false
  );
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
          const fields = admin.banners[banner.id];
          return (
            <BannerCard
              key={banner.id}
              headline={banner.headline}
              subhead={banner.subhead}
              art={banner.art}
              enabled={repo.enabled}
              sponsored={fields?.sponsored ?? false}
              advertiser={fields?.advertiser}
              onEnable={() => enableRepository(repo.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function BannerCard({
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
  onEnable: () => void;
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
          disabled={enabled}
          className={`focus-ring mt-3 rounded-full px-3 py-1.5 text-xs font-semibold ${
            enabled
              ? "bg-muted text-muted-foreground"
              : PRIMARY_CTA
          }`}
        >
          {enabled ? copy.sourceEnabled : copy.enableSource}
        </button>
      </div>
    </div>
  );
}
