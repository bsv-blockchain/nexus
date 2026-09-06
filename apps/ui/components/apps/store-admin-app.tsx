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
 * A campaign tool now, not a config screen for three fixed fixtures — the
 * distinction an earlier pass of this file drew, that headline and subhead
 * are not editable because "content is decided in code", stopped holding the
 * moment lib/admin-store.ts let an admin add or duplicate a campaign without
 * a deploy. Every field on a campaign is editable here now, including the
 * words, alongside what this pass adds on top: a status line that can never
 * say "live" about a card Discover is not actually drawing (`campaignStatus`
 * shares its selection logic with `winningCampaigns` itself), soft warnings
 * for the two mistakes that quietly cost a sponsor their placement (an end
 * date before the start, "sponsored" with nobody named), a live preview built
 * from the exact same card component Discover renders
 * (components/hub/discover-promo-cards.tsx) so a preview can never drift
 * from what a reader actually sees, and Analytics — the fourth tab — which
 * answers two different questions from the same counted numbers: what is
 * Discover's promo real estate doing in aggregate, for a Nexus team member
 * deciding what to sell next, and what did one campaign do, for the sponsor
 * who bought it.
 */

import { Group, Toggle } from "@/components/apps/settings/blocks";
import { AnalyticsChart } from "@/components/apps/store-admin/analytics-chart";
import { BannerCard, CollectionCard } from "@/components/hub/discover-promo-cards";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { Tab, TabRow } from "@/components/hub/tab-row";
import {
  allCampaigns,
  ctrLabel,
  dailySeries,
  slotUtilization,
  totals,
} from "@/lib/admin-analytics";
import {
  addBanner,
  addCollection,
  campaignStatus,
  campaignWarnings,
  duplicateBanner,
  duplicateCollection,
  removeBanner,
  removeCollection,
  setBannerFields,
  setCollectionFields,
  useAdminPromoState,
  type AdminPromoState,
  type BannerCampaign,
  type CampaignBase,
  type CampaignStatus,
  type CollectionCampaign,
} from "@/lib/admin-store";
import { getDefaultRepositories, getHubApps, type AppRepository } from "@/lib/data";
import { rateCard, SLOT_COUNT, type PlacementType } from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import { sinceLabel } from "@/lib/update-data";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type AdminTab = "banners" | "collections" | "analytics" | "guidelines";

export function StoreAdminApp(): ReactNode {
  const [tab, setTab] = useState<AdminTab>("banners");
  const admin = useAdminPromoState();

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
            label="Analytics"
            group="store-admin"
            size="lg"
            active={tab === "analytics"}
            onClick={() => setTab("analytics")}
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
          {tab === "banners" && <BannersTab admin={admin} />}
          {tab === "collections" && <CollectionsTab admin={admin} />}
          {tab === "analytics" && <AnalyticsTab admin={admin} />}
          {tab === "guidelines" && <Guidelines />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Shared field chrome
 * ---------------------------------------------------------------------- */

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ---------------------------------------------------------------------- *
 * Adding a campaign
 * ---------------------------------------------------------------------- */

/** The one control every tab needs before it can have a fourth campaign: which source this one is for. */
function NewCampaignToolbar({
  repoId,
  onRepoIdChange,
  onAdd,
  label,
}: {
  repoId: string;
  onRepoIdChange: (id: string) => void;
  onAdd: () => void;
  label: string;
}): ReactNode {
  const repos = getDefaultRepositories();
  return (
    <div className="border-border bg-surface-raised flex flex-wrap items-center gap-2 rounded-xl border p-3">
      <select
        value={repoId}
        onChange={(event) => onRepoIdChange(event.target.value)}
        className={`${fieldClass} w-auto min-w-40 flex-1`}
      >
        {repos.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAdd}
        className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${PRIMARY_CTA}`}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Per-campaign status, duplicate and remove — shared by both tabs
 * ---------------------------------------------------------------------- */

function statusPresentation(status: CampaignStatus): { label: string; className: string } {
  switch (status.kind) {
    case "live":
      return { label: "Live", className: "bg-positive/15 text-positive" };
    case "losing":
      return { label: `Losing to ${status.to}`, className: "bg-warning/15 text-warning" };
    case "scheduled":
      return {
        label: `Starts ${formatDate(status.startsAt)}`,
        className: "bg-warning/15 text-warning",
      };
    case "expired":
      return {
        label: `Ended ${formatDate(status.endedAt)}`,
        className: "bg-muted text-muted-foreground",
      };
    case "disabled":
      return { label: "Disabled", className: "bg-muted text-muted-foreground" };
  }
}

function StatusBadge({ status }: { status: CampaignStatus }): ReactNode {
  const { label, className } = statusPresentation(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

/** How long a "Remove" stays armed before it quietly stands down on its own. */
const REMOVE_ARM_MS = 5000;

/**
 * Arm, then confirm — the same shape the destructive controls in the wallet's
 * own inbox use (see StuckRow in components/apps/wallet/pay-flow.tsx), for the
 * same reason: a `window.confirm` is a browser-chrome dialog in an app that
 * does not present itself as a browser page, and it blocks everything behind
 * it while it sits there.
 */
function RemoveButton({ onRemove }: { onRemove: () => void }): ReactNode {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), REMOVE_ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) onRemove();
        else setArmed(true);
      }}
      className={`focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        armed
          ? "border-negative bg-negative/15 text-negative"
          : "border-border hover:bg-surface-hover text-muted-foreground"
      }`}
    >
      <Trash2 className="size-3" aria-hidden="true" />
      {armed ? "Confirm remove" : "Remove"}
    </button>
  );
}

function CampaignToolbar({
  status,
  onDuplicate,
  onRemove,
}: {
  status: CampaignStatus;
  onDuplicate: () => void;
  onRemove: () => void;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      <StatusBadge status={status} />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDuplicate}
          className="focus-ring border-border hover:bg-surface-hover text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
        >
          <Copy className="size-3" aria-hidden="true" />
          Duplicate
        </button>
        <RemoveButton onRemove={onRemove} />
      </div>
    </div>
  );
}

/** Soft warnings, held right where the admin is already looking — see campaignWarnings. */
function WarningsList({ warnings }: { warnings: string[] }): ReactNode {
  return (
    <div className="bg-warning/10 space-y-1 p-3">
      {warnings.map((warning) => (
        <p key={warning} className="text-warning text-xs font-medium text-pretty">
          {warning}
        </p>
      ))}
    </div>
  );
}

/** The one place the actual words live on a campaign now — see the file header for why. */
function HeadlineFields({
  headline,
  subhead,
  onChange,
}: {
  headline: string;
  subhead: string;
  onChange: (patch: Partial<CampaignBase>) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2">
      <Field label="Headline">
        <input
          value={headline}
          onChange={(event) => onChange({ headline: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="Subhead">
        <input
          value={subhead}
          onChange={(event) => onChange({ subhead: event.target.value })}
          className={fieldClass}
        />
      </Field>
    </div>
  );
}

/** Slot, priority and schedule — every campaign carries these, sponsored or not. */
function SlotAndSchedule({
  campaign,
  onChange,
}: {
  campaign: CampaignBase;
  onChange: (patch: Partial<CampaignBase>) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field
        label="Slot"
        hint={`1–${SLOT_COUNT} positions on Discover's front page`}
      >
        <select
          value={campaign.slot}
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
          value={campaign.priority}
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
          value={campaign.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="End date" hint="Blank means no upper bound">
        <input
          type="date"
          value={campaign.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
          className={fieldClass}
        />
      </Field>
    </div>
  );
}

function SponsorshipFields({
  campaign,
  placement,
  onChange,
}: {
  campaign: CampaignBase;
  placement: PlacementType;
  onChange: (patch: Partial<CampaignBase>) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2">
      <Field label="Advertiser">
        <input
          value={campaign.advertiser}
          onChange={(event) => onChange({ advertiser: event.target.value })}
          placeholder="Who bought this slot"
          className={fieldClass}
        />
      </Field>
      <Field label="Price label" hint={`List price: ${rateCard[placement].priceLabel}`}>
        <input
          value={campaign.priceLabel}
          onChange={(event) => onChange({ priceLabel: event.target.value })}
          placeholder={rateCard[placement].priceLabel}
          className={fieldClass}
        />
      </Field>
    </div>
  );
}

/** Real counts, not invented ones — see lib/admin-store.ts's recordImpression / recordClick. */
function PerformanceLine({ campaign }: { campaign: CampaignBase }): ReactNode {
  return (
    <p className="text-muted-foreground p-3 text-xs">
      {campaign.impressions.toLocaleString()} impressions ·{" "}
      {campaign.clicks.toLocaleString()} clicks
    </p>
  );
}

/** What Discover actually draws for this campaign, not a second copy of it — see discover-promo-cards.tsx. */
function LivePreview({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="bg-canvas p-3">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        Preview
      </p>
      <div className="max-w-80">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Banners
 * ---------------------------------------------------------------------- */

function BannersTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const repos = useRepositories();
  const [newRepoId, setNewRepoId] = useState(
    () => getDefaultRepositories()[0]?.id ?? "",
  );

  return (
    <>
      <NewCampaignToolbar
        repoId={newRepoId}
        onRepoIdChange={setNewRepoId}
        onAdd={() => addBanner(newRepoId)}
        label="New banner"
      />
      {admin.banners.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No banner campaigns yet — add one above.
        </p>
      )}
      {admin.banners.map((banner) => (
        <BannerCampaignEditor
          key={banner.id}
          banner={banner}
          siblings={admin.banners}
          repos={repos}
        />
      ))}
    </>
  );
}

function BannerCampaignEditor({
  banner,
  siblings,
  repos,
}: {
  banner: BannerCampaign;
  siblings: BannerCampaign[];
  repos: AppRepository[];
}): ReactNode {
  const repo =
    repos.find((r) => r.id === banner.repoId) ??
    getDefaultRepositories().find((r) => r.id === banner.repoId);
  if (!repo) return null;
  const onChange = (patch: Partial<BannerCampaign>) => setBannerFields(banner.id, patch);
  const status = campaignStatus(banner, siblings);
  const warnings = campaignWarnings(banner);

  return (
    <Group
      title={`${repo.name} banner`}
      hint={`${repo.enabled ? "Source on" : "Source off"} · Edited ${sinceLabel(banner.updatedAt) ?? "just now"}`}
    >
      <CampaignToolbar
        status={status}
        onDuplicate={() => duplicateBanner(banner.id)}
        onRemove={() => removeBanner(banner.id)}
      />
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
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
      <HeadlineFields headline={banner.headline} subhead={banner.subhead} onChange={onChange} />
      <Toggle
        label="Enabled"
        hint="Off takes this campaign out of rotation for every slot."
        value={banner.enabled}
        onChange={(next) => onChange({ enabled: next })}
      />
      <Toggle
        label="Sponsored"
        hint="Adds the disclosed badge Discover already shows."
        value={banner.sponsored}
        onChange={(next) => onChange({ sponsored: next })}
      />
      {banner.sponsored && (
        <SponsorshipFields campaign={banner} placement="banner" onChange={onChange} />
      )}
      <SlotAndSchedule campaign={banner} onChange={onChange} />
      <PerformanceLine campaign={banner} />
      <LivePreview>
        <BannerCard
          headline={banner.headline}
          subhead={banner.subhead}
          art={banner.art}
          enabled={repo.enabled}
          sponsored={banner.sponsored}
          advertiser={banner.advertiser}
        />
      </LivePreview>
    </Group>
  );
}

/* ---------------------------------------------------------------------- *
 * Collections
 * ---------------------------------------------------------------------- */

function CollectionsTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const [newRepoId, setNewRepoId] = useState(
    () => getDefaultRepositories()[0]?.id ?? "",
  );

  return (
    <>
      <NewCampaignToolbar
        repoId={newRepoId}
        onRepoIdChange={setNewRepoId}
        onAdd={() => addCollection(newRepoId)}
        label="New collection"
      />
      {admin.collections.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No collection campaigns yet — add one above.
        </p>
      )}
      {admin.collections.map((collection) => (
        <CollectionCampaignEditor
          key={collection.id}
          collection={collection}
          siblings={admin.collections}
        />
      ))}
    </>
  );
}

function CollectionCampaignEditor({
  collection,
  siblings,
}: {
  collection: CollectionCampaign;
  siblings: CollectionCampaign[];
}): ReactNode {
  const { isInstalled } = useHub();
  const repo = getDefaultRepositories().find((r) => r.id === collection.repoId);
  const apps = getHubApps().filter((app) => app.repoId === collection.repoId);
  const onChange = (patch: Partial<CollectionCampaign>) =>
    setCollectionFields(collection.id, patch);
  const status = campaignStatus(collection, siblings);
  const warnings = campaignWarnings(collection);
  const allConnected = apps.length > 0 && apps.every((app) => isInstalled(app.slug));

  return (
    <Group
      title={`${repo?.name ?? collection.repoId} collection`}
      hint={`${apps.length} apps in this source · Edited ${sinceLabel(collection.updatedAt) ?? "just now"}`}
    >
      <CampaignToolbar
        status={status}
        onDuplicate={() => duplicateCollection(collection.id)}
        onRemove={() => removeCollection(collection.id)}
      />
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      <HeadlineFields headline={collection.headline} subhead={collection.subhead} onChange={onChange} />
      <Toggle
        label="Enabled"
        hint="Off takes this campaign out of rotation for every slot."
        value={collection.enabled}
        onChange={(next) => onChange({ enabled: next })}
      />
      <Toggle
        label="Sponsored"
        hint="Adds the disclosed badge Discover already shows."
        value={collection.sponsored}
        onChange={(next) => onChange({ sponsored: next })}
      />
      {collection.sponsored && (
        <SponsorshipFields campaign={collection} placement="collection" onChange={onChange} />
      )}
      <SlotAndSchedule campaign={collection} onChange={onChange} />
      <PerformanceLine campaign={collection} />
      <LivePreview>
        <CollectionCard
          headline={collection.headline}
          subhead={collection.subhead}
          apps={apps}
          sponsored={collection.sponsored}
          allConnected={allConnected}
        />
      </LivePreview>
    </Group>
  );
}

/* ---------------------------------------------------------------------- *
 * Analytics — the same numbers, read two different ways
 * ---------------------------------------------------------------------- */

function Stat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function AnalyticsTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const campaigns = allCampaigns(admin);
  const overall = totals(campaigns);
  const series = dailySeries(campaigns);
  const utilization = slotUtilization(campaigns, SLOT_COUNT);
  const ranked = [...campaigns].sort((a, b) => b.impressions - a.impressions);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const sponsorCampaign = campaigns.find((c) => c.id === sponsorId) ?? null;

  return (
    <>
      <Group
        title="Discover placements, in aggregate"
        hint="Every banner and collection campaign together — what a Nexus team member checks before deciding what to sell next."
      >
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat label="Impressions" value={overall.impressions.toLocaleString()} />
          <Stat label="Clicks" value={overall.clicks.toLocaleString()} />
          <Stat label="CTR" value={ctrLabel(overall.ctr)} />
          <Stat label="Live now" value={String(overall.liveCount)} />
        </div>
        <div className="p-3">
          <AnalyticsChart data={series} metric="impressions" label="impressions" />
        </div>
      </Group>

      <Group
        title="Slot demand"
        hint="How many enabled campaigns are competing for each slot right now — a slot with more than one is a slot worth a higher price."
      >
        <div className="divide-border/60 grid grid-cols-3 divide-x">
          {utilization.map((entry) => (
            <div key={entry.slot} className="p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{entry.contenders}</p>
              <p className="text-muted-foreground text-xs">
                Slot {entry.slot}
                {entry.contenders > 1 ? " · contested" : ""}
              </p>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Ranked by impressions" hint="Every campaign, most-seen first.">
        {ranked.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">No campaigns yet.</p>
        )}
        {ranked.map((campaign) => (
          <button
            key={campaign.id}
            type="button"
            onClick={() => setSponsorId(campaign.id)}
            className="focus-ring hover:bg-surface-hover flex w-full items-center justify-between gap-3 p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{campaign.headline}</span>
              <span className="text-muted-foreground text-xs">
                {campaign.sponsored ? campaign.advertiser || "Sponsored" : "House"}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {campaign.impressions.toLocaleString()} impr · {campaign.clicks.toLocaleString()} clicks
            </span>
          </button>
        ))}
      </Group>

      <Group
        title="Sponsor report"
        hint="What a Nexus team member hands a sponsor: one campaign, its own numbers, nothing else mixed in."
      >
        <div className="p-3">
          <select
            value={sponsorId ?? ""}
            onChange={(event) => setSponsorId(event.target.value || null)}
            className={fieldClass}
          >
            <option value="">Pick a campaign…</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.headline}
              </option>
            ))}
          </select>
        </div>
        {sponsorCampaign && <SponsorReport campaign={sponsorCampaign} />}
      </Group>
    </>
  );
}

/** The numbers as a sponsor sees them — one campaign, scoped to just its own history. */
function SponsorReport({ campaign }: { campaign: CampaignBase }): ReactNode {
  const series = dailySeries([campaign]);
  const stats = totals([campaign]);

  const summarize = (): string => {
    const window =
      campaign.startDate || campaign.endDate
        ? ` (${campaign.startDate || "no start date"} – ${campaign.endDate || "ongoing"})`
        : "";
    return (
      `${campaign.headline}${window}: ${stats.impressions.toLocaleString()} impressions, ` +
      `${stats.clicks.toLocaleString()} clicks, ${ctrLabel(stats.ctr)} CTR`
    );
  };

  return (
    <div className="border-border border-t p-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Impressions" value={stats.impressions.toLocaleString()} />
        <Stat label="Clicks" value={stats.clicks.toLocaleString()} />
        <Stat label="CTR" value={ctrLabel(stats.ctr)} />
      </div>
      <div className="mt-3">
        <AnalyticsChart data={series} metric="impressions" label="impressions" />
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(summarize());
          toast.success("Summary copied", { description: campaign.headline });
        }}
        className="focus-ring border-border hover:bg-surface-hover mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
      >
        <Copy className="size-3.5" aria-hidden="true" />
        Copy summary for sponsor
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Guidelines
 * ---------------------------------------------------------------------- */

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
