"use client";

/**
 * Store Admin — configuring Discover's two promotional rows, one campaign at
 * a time. Nexus staff only; see lib/developer-mode.tsx for how it stays out
 * of an ordinary install's rail, store and search entirely.
 *
 * Modelled on the App Store's own shell (a heading line, a tab row, a grid
 * below it) rather than invented from nothing, and on the campaign managers
 * named in the brief — X, Meta, Google — for the shape all three share: a
 * list of placements, each with a status, a schedule, and a sponsorship a
 * placement either carries or does not. `Group` and `Toggle` are the same
 * components Settings itself is built from (components/apps/settings/blocks),
 * reused rather than redrawn — a switch that looks different here than it
 * does one app over is a switch that reads as a different product.
 *
 * What is and is not editable here is deliberate. Enabled, sponsored, a
 * slot, a priority, a schedule, an advertiser and a price label are all
 * state — fair to hold in a store (see lib/admin-store.ts). A banner's
 * headline and subhead are not: every other string in Nexus is content
 * decided in code and reviewed like any other copy, and a text box that let
 * a placement's words drift from what shipped would make this the one
 * screen in the app where that stopped being true.
 */

import { Group, Toggle } from "@/components/apps/settings/blocks";
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
  rateCard,
  SLOT_COUNT,
  type FeaturedBanner,
  type FeaturedCollection,
} from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import { useState, type ReactNode } from "react";

type AdminTab = "banners" | "collections" | "guidelines";

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
          <Tab
            label="Guidelines"
            group="store-admin"
            size="lg"
            active={tab === "guidelines"}
            onClick={() => setTab("guidelines")}
          />
        </TabRow>

        <div className="mt-6 space-y-4">
          {tab === "banners" &&
            featuredBanners.map((banner) => (
              <BannerCampaign key={banner.id} banner={banner} />
            ))}
          {tab === "collections" &&
            featuredCollections.map((collection) => (
              <CollectionCampaign key={collection.id} collection={collection} />
            ))}
          {tab === "guidelines" && <Guidelines />}
        </div>
      </div>
    </div>
  );
}

/** A compact label-over-control field, for the things Toggle doesn't cover. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-semibold">
        {label}
      </span>
      {children}
      {hint && <span className="text-muted-foreground mt-1 block text-[11px]">{hint}</span>}
    </label>
  );
}

const fieldClass =
  "border-border bg-surface focus-ring w-full rounded-lg border px-3 py-2 text-sm";

/** Slot, priority and schedule — every campaign carries these, sponsored or not. */
function SlotAndSchedule({
  fields,
  onChange,
}: {
  fields: PromoAdminFields;
  onChange: (patch: Partial<PromoAdminFields>) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field
        label="Slot"
        hint={`1–${SLOT_COUNT} positions on Discover's front page`}
      >
        <select
          value={fields.slot}
          onChange={(event) => onChange({ slot: Number(event.target.value) })}
          className={fieldClass}
        >
          {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => (
            <option key={slot} value={slot}>
              Slot {slot}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority" hint="Lower wins this slot when more than one campaign is live for it">
        <input
          type="number"
          min={1}
          value={fields.priority}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange({ priority: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) });
          }}
          className={fieldClass}
        />
      </Field>
      <Field label="Start date" hint="Blank means no lower bound">
        <input
          type="date"
          value={fields.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="End date" hint="Blank means no upper bound">
        <input
          type="date"
          value={fields.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
          className={fieldClass}
        />
      </Field>
    </div>
  );
}

function SponsorshipFields({
  fields,
  placement,
  onChange,
}: {
  fields: PromoAdminFields;
  placement: "banner" | "collection";
  onChange: (patch: Partial<PromoAdminFields>) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2">
      <Field label="Advertiser">
        <input
          value={fields.advertiser}
          onChange={(event) => onChange({ advertiser: event.target.value })}
          placeholder="Who bought this slot"
          className={fieldClass}
        />
      </Field>
      <Field label="Price label" hint={`List price: ${rateCard[placement].priceLabel}`}>
        <input
          value={fields.priceLabel}
          onChange={(event) => onChange({ priceLabel: event.target.value })}
          placeholder={rateCard[placement].priceLabel}
          className={fieldClass}
        />
      </Field>
    </div>
  );
}

/** Real counts, not invented ones — see lib/admin-store.ts's recordImpression / recordClick. */
function PerformanceLine({ fields }: { fields: PromoAdminFields }): ReactNode {
  return (
    <p className="text-muted-foreground p-3 text-xs">
      {fields.impressions.toLocaleString()} impressions ·{" "}
      {fields.clicks.toLocaleString()} clicks
    </p>
  );
}

function BannerCampaign({ banner }: { banner: FeaturedBanner }): ReactNode {
  const admin = useAdminPromoState();
  const repos = useRepositories();
  const fields = admin.banners[banner.id];
  const repo =
    repos.find((r) => r.id === banner.repoId) ??
    getDefaultRepositories().find((r) => r.id === banner.repoId);
  if (!fields || !repo) return null;
  const onChange = (patch: Partial<PromoAdminFields>) =>
    setBannerFields(banner.id, patch);

  return (
    <Group
      title={banner.headline}
      hint={`${repo.name} · ${repo.enabled ? "source on" : "source off"} · ${banner.subhead}`}
    >
      {!repo.enabled && (
        <div className="flex items-center justify-between gap-3 p-3">
          <p className="text-muted-foreground text-xs">
            Not switched on for testers yet.
          </p>
          <button
            type="button"
            onClick={() => enableRepository(repo.id)}
            className="focus-ring border-border hover:bg-surface-hover rounded-full border px-3 py-1 text-xs font-semibold"
          >
            Enable for testing
          </button>
        </div>
      )}
      <Toggle
        label="Enabled"
        hint="Off takes this campaign out of rotation for every slot."
        value={fields.enabled}
        onChange={(next) => onChange({ enabled: next })}
      />
      <Toggle
        label="Sponsored"
        hint="Adds the disclosed badge Discover already shows."
        value={fields.sponsored}
        onChange={(next) => onChange({ sponsored: next })}
      />
      {fields.sponsored && (
        <SponsorshipFields fields={fields} placement="banner" onChange={onChange} />
      )}
      <SlotAndSchedule fields={fields} onChange={onChange} />
      <PerformanceLine fields={fields} />
    </Group>
  );
}

function CollectionCampaign({
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
  const onChange = (patch: Partial<PromoAdminFields>) =>
    setCollectionFields(collection.id, patch);

  return (
    <Group
      title={collection.headline}
      hint={`${appCount} apps in this source · ${collection.subhead}`}
    >
      <Toggle
        label="Enabled"
        hint="Off takes this campaign out of rotation for every slot."
        value={fields.enabled}
        onChange={(next) => onChange({ enabled: next })}
      />
      <Toggle
        label="Sponsored"
        hint="Adds the disclosed badge Discover already shows."
        value={fields.sponsored}
        onChange={(next) => onChange({ sponsored: next })}
      />
      {fields.sponsored && (
        <SponsorshipFields fields={fields} placement="collection" onChange={onChange} />
      )}
      <SlotAndSchedule fields={fields} onChange={onChange} />
      <PerformanceLine fields={fields} />
    </Group>
  );
}

function Guidelines(): ReactNode {
  return (
    <>
      <Group
        title="Disclosure"
        hint="Every sponsored placement says so, in the same place a reader is already looking."
      >
        <p className="p-3 text-sm text-pretty">
          Marking a campaign &ldquo;Sponsored&rdquo; adds the badge Discover
          already renders on it — the advertiser&rsquo;s name alongside it
          when one is set. Nothing sold through this tool is disguised as
          editorial; if a placement cannot carry that badge honestly, it
          should not be sold.
        </p>
      </Group>
      <Group
        title="Rate card"
        hint="The reference price per placement type — quote from this rather than inventing a number per campaign."
      >
        {Object.entries(rateCard).map(([type, entry]) => (
          <div key={type} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{entry.label}</p>
              <p className="text-muted-foreground text-xs text-pretty">
                {entry.description}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">{entry.priceLabel}</p>
          </div>
        ))}
      </Group>
      <Group
        title="What never gets sold"
        hint="Two surfaces stay out regardless of demand."
      >
        <div className="space-y-2 p-3 text-sm">
          <p>
            <strong>Updates</strong> — a plain record of what changed
            recently, not a browse surface. A sponsored slot there reads as
            the plumbing being for sale.
          </p>
          <p>
            <strong>Essential Nexus Extensions</strong> — infrastructure the
            browser ships with, not merchandising. Same reasoning.
          </p>
        </div>
      </Group>
    </>
  );
}
