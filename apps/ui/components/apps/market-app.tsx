"use client";

import { AppTile } from "@/components/hub/app-icon";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getHubApp,
  getMarketListings,
  type MarketListing,
} from "@/lib/data";
import {
  Expand,
  ExternalLink,
  Heart,
  MessageCircle,
  RefreshCw,
  Share2,
  Tag,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

function formatBsv(satoshis: number): string {
  return `${(satoshis / 100_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} BSV`;
}

function OrdinalCard({ listing }: { listing: MarketListing }): ReactNode {
  const copy = content.market;
  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-sm transition-shadow hover:shadow-lg ${
        listing.featured ? "ring-2 ring-warning/60" : ""
      }`}
    >
      <div
        className="relative aspect-square"
        style={{
          background: `linear-gradient(135deg, ${listing.thumbnail.from}, ${listing.thumbnail.to})`,
        }}
      >
        {listing.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center text-5xl drop-shadow-lg select-none"
            aria-hidden="true"
          >
            {listing.glyph}
          </span>
        )}

        {listing.featured && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-warning px-2.5 py-1 text-[10px] font-bold text-black uppercase shadow">
            <Tag className="size-3" aria-hidden="true" />
            {copy.featuredBadge}
          </span>
        )}

        <button
          type="button"
          aria-label={`Share ${listing.title}`}
          className={`focus-ring absolute left-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75 ${
            listing.featured ? "top-11" : "top-2"
          }`}
        >
          <Share2 className="size-4" aria-hidden="true" />
        </button>

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white">
            <Heart
              className={`size-3.5 ${listing.likes > 0 ? "fill-negative text-negative" : ""}`}
              aria-hidden="true"
            />
            {listing.likes}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            {listing.comments}
          </span>
        </div>

        <span className="absolute bottom-2 left-2 rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-accent-foreground">
          {listing.application}
        </span>

        <button
          type="button"
          aria-label={`View ${listing.title} fullscreen`}
          className="focus-ring absolute right-2 bottom-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
        >
          <Expand className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold">{listing.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {listing.collection}
        </p>
        <p className="mt-2 text-sm font-bold">
          {listing.listed ? formatBsv(listing.priceSatoshis) : copy.notListed}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            className="focus-ring flex-1 rounded-lg border border-accent px-2 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
          >
            {copy.viewDetails}
          </button>
          <a
            href="https://1sat.market"
            target="_blank"
            rel="noreferrer"
            aria-label="Open on 1sat.market"
            className="focus-ring flex items-center justify-center rounded-lg bg-accent px-2.5 py-1.5 text-accent-foreground hover:opacity-90"
          >
            <span className="text-xs font-bold">1S</span>
          </a>
          <a
            href="https://whatsonchain.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Open on WhatsOnChain"
            className="focus-ring flex items-center justify-center rounded-lg bg-accent px-2.5 py-1.5 text-accent-foreground hover:opacity-90"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function MarketApp(): ReactNode {
  const app = getHubApp("market");
  const copy = content.market;
  const { marketFilters: f } = useHub();
  const listings = useMemo(() => getMarketListings(), []);
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(() => {
    const filtered = listings.filter((l) => {
      if (f.query && !l.title.toLowerCase().includes(f.query.toLowerCase()))
        return false;
      if (f.application !== "all" && l.application !== f.application)
        return false;
      if (f.collection !== "all" && l.collection !== f.collection) return false;
      if (f.sale === "not_listed" && l.listed) return false;
      return true;
    });
    const sorted = [...filtered];
    if (f.sale === "price_high") {
      sorted.sort((a, b) => b.priceSatoshis - a.priceSatoshis);
    } else if (f.sale === "price_low") {
      sorted.sort((a, b) => a.priceSatoshis - b.priceSatoshis);
    } else if (f.nameSort === "az") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (f.nameSort === "za") {
      sorted.sort((a, b) => b.title.localeCompare(a.title));
    } else if (f.chrono === "oldest_activity" || f.chrono === "oldest") {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [listings, f]);

  const refresh = (): void => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {app && <AppTile app={app} size={22} />}
          <h1 className="text-lg font-bold">{copy.title}</h1>
        </div>
        <button
          type="button"
          className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          <Tag className="size-4" aria-hidden="true" />
          {copy.sellAction}
        </button>
      </header>

      <div className="p-6">
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-muted-foreground">
            {visible.length} {copy.countLabel}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {copy.refresh}
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {visible.map((listing) => (
              <OrdinalCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
