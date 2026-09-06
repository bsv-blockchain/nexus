"use client";

/**
 * Store Admin — configuring Discover's two promotional rows, one campaign at
 * a time. Nexus staff only; see lib/developer-mode.tsx for how it stays out
 * of an ordinary install's rail, store and search entirely.
 *
 * Modelled on the App Store's own shell (a heading line, a tab row, a grid
 * below it) rather than invented from nothing, and on the campaign managers
 * named in the brief — X, Meta, Google — for the one shape all three share:
 * a list of placements, each with a status, and a sponsorship a placement
 * either carries or does not. There is no fourth tab for performance
 * numbers, because there is no ad delivery behind this to report on; a chart
 * of invented impressions would be exactly the "store that does not exist"
 * the extensions fixture already warned against building.
 *
 * What is and is not editable here is deliberate. Enabled, sponsored,
 * advertiser and a price label are switches and labels — state, which this
 * build already treats as fair to hold in a store (see lib/admin-store.ts).
 * A banner's headline and subhead are not: every other string in Nexus is
 * content decided in code and reviewed like any other copy, and a text box
 * that let a placement's words drift from what shipped would make this the
 * one screen in the app where that stopped being true.
 */

import { PRIMARY_CTA } from "@/components/hub/cta";
import { Tab, TabRow } from "@/components/hub/tab-row";
import {
  setBannerFields,
  setCollectionFields,
  useAdminPromoState,
  type PromoAdminFields,
} from "@/lib/admin-store";
import { getDefaultRepositories, getHubApps } from "@/lib/data";
import {
  featuredBanners,
  featuredCollections,
  type FeaturedBanner,
  type FeaturedCollection,
} from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import { useState, type ReactNode } from "react";

type AdminTab = "banners" | "collections";

export function StoreAdminApp(): ReactNode {
  const [tab, setTab] = useState<AdminTab>("banners");

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-200">
        <p className="text-muted-foreground text-sm">
          Discover&rsquo;s featured banners and collections — what is on,
          what is sponsored, and who bought the slot.
        </p>

        <TabRow className="mt-2" fade="from-background" gap="gap-6">
          <Tab
            label="Banners"
            group="store-admin"
            size="lg"
            active={tab === "banners"}
            onClick={() => setTab("banners")}
          />
          <Tab
            label="Collections"
            group="store-admin"
            size="lg"
            active={tab === "collections"}
            onClick={() => setTab("collections")}
          />
        </TabRow>

        <div className="mt-6 space-y-4">
          {tab === "banners"
            ? featuredBanners.map((banner) => (
                <BannerCampaignRow key={banner.id} banner={banner} />
              ))
            : featuredCollections.map((collection) => (
                <CollectionCampaignRow
                  key={collection.id}
                  collection={collection}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

/** The switches and labels every campaign row shares, regardless of kind. */
function CampaignFields({
  fields,
  onChange,
}: {
  fields: PromoAdminFields;
  onChange: (patch: Partial<PromoAdminFields>) => void;
}): ReactNode {
  return (
    <div className="border-border/60 mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Enabled</span>
        <Switch checked={fields.enabled} onChange={(on) => onChange({ enabled: on })} />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Sponsored</span>
        <Switch
          checked={fields.sponsored}
          onChange={(on) => onChange({ sponsored: on })}
        />
      </label>
      {fields.sponsored && (
        <>
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-xs font-semibold">
              Advertiser
            </span>
            <input
              value={fields.advertiser}
              onChange={(event) => onChange({ advertiser: event.target.value })}
              placeholder="Who bought this slot"
              className="border-border bg-surface focus-ring w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-xs font-semibold">
              Price label
            </span>
            <input
              value={fields.priceLabel}
              onChange={(event) => onChange({ priceLabel: event.target.value })}
              placeholder="e.g. $400/mo — a label, not a charge"
              className="border-border bg-surface focus-ring w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        </>
      )}
    </div>
  );
}

function BannerCampaignRow({ banner }: { banner: FeaturedBanner }): ReactNode {
  const admin = useAdminPromoState();
  const repos = useRepositories();
  const fields = admin.banners[banner.id];
  const repo =
    repos.find((r) => r.id === banner.repoId) ??
    getDefaultRepositories().find((r) => r.id === banner.repoId);
  if (!fields || !repo) return null;

  return (
    <div className="border-border bg-surface-raised rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold">{banner.headline}</p>
          <p className="text-muted-foreground text-xs">
            {repo.name} · {repo.enabled ? "source on" : "source off"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            {banner.subhead}
          </p>
        </div>
        {!repo.enabled && (
          <button
            type="button"
            onClick={() => enableRepository(repo.id)}
            className={`focus-ring shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${PRIMARY_CTA}`}
          >
            Enable for testing
          </button>
        )}
      </div>
      <CampaignFields
        fields={fields}
        onChange={(patch) => setBannerFields(banner.id, patch)}
      />
    </div>
  );
}

function CollectionCampaignRow({
  collection,
}: {
  collection: FeaturedCollection;
}): ReactNode {
  const admin = useAdminPromoState();
  const fields = admin.collections[collection.id];
  const appCount = getHubApps().filter(
    (app) => app.repoId === collection.repoId,
  ).length;
  if (!fields) return null;

  return (
    <div className="border-border bg-surface-raised rounded-2xl border p-5">
      <p className="text-base font-bold">{collection.headline}</p>
      <p className="text-muted-foreground text-xs">{appCount} apps in this source</p>
      <p className="text-muted-foreground mt-1 text-sm text-pretty">
        {collection.subhead}
      </p>
      <CampaignFields
        fields={fields}
        onChange={(patch) => setCollectionFields(collection.id, patch)}
      />
    </div>
  );
}

/** A plain toggle switch — kept local rather than imported from Settings'
    own, which is styled for a list of full-width rows rather than sitting
    beside a label in a two-column admin form. */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
