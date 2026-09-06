"use client";

/**
 * One campaign, collapsed to a line until somebody opens it.
 *
 * Every campaign used to render every field it has, plus a preview card,
 * always — three of them filled a screen, and the tool got harder to use the
 * more it was used, which is backwards for something whose whole point is
 * that an admin can now add a fourth campaign without a deploy. Collapsed,
 * the row says the six things somebody scanning a list actually wants:
 * status, who it is for, which slot, when it runs, what it has done, and
 * whether anything is wrong with it.
 *
 * The editor underneath is the same fields as before plus the three the tool
 * was missing: the creative itself (a banner's art was renderable and not
 * editable, so a campaign added here could never have any), the weight that
 * lets two campaigns share a slot instead of one of them silently never
 * showing, and the caps that make an impression something you can sell
 * rather than something that runs until the end date.
 */

import { Group, Toggle } from "@/components/apps/settings/blocks";
import { SlotMark, sourceOptions } from "@/components/apps/store-admin/pickers";
import {
  Field,
  RemoveButton,
  StatusBadge,
  WarningsList,
  fieldClass,
  formatDate,
} from "@/components/apps/store-admin/blocks";
import { BannerCard, CollectionCard } from "@/components/hub/discover-promo-cards";
import { useHub } from "@/components/hub/hub-provider";
import { Picker } from "@/components/hub/picker";
import {
  campaignStatus,
  campaignWarnings,
  contendersForSlot,
  duplicateCampaign,
  removeCampaign,
  restoreCampaign,
  setCampaignFields,
  type CampaignBase,
  type PromoKind,
} from "@/lib/admin-store";
import { getDefaultRepositories, getHubApps } from "@/lib/data";
import { rateCard, SLOT_COUNT, priceLabel } from "@/lib/data/discover-promos";
import { enableRepository, useRepositories } from "@/lib/repositories-store";
import { sinceLabel } from "@/lib/update-data";
import { ChevronRight, Copy } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";

/** A campaign's flight, in the fewest words that still say when it runs. */
function scheduleLabel(campaign: CampaignBase): string {
  if (!campaign.startDate && !campaign.endDate) return "No end date";
  if (campaign.startDate && campaign.endDate) {
    return `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`;
  }
  if (campaign.startDate) return `From ${formatDate(campaign.startDate)}`;
  return `Until ${formatDate(campaign.endDate)}`;
}

function ctr(campaign: CampaignBase): string {
  if (campaign.impressions === 0) return "—";
  return `${((campaign.clicks / campaign.impressions) * 100).toFixed(1)}%`;
}

/**
 * Art already in use, offered as a list rather than typed from memory.
 *
 * Derived from what campaigns actually carry rather than from a hand-kept
 * roster of files in `public/` — a picker that lists an image nobody ships
 * is a picker that offers a broken card.
 */
function artSuggestions(all: CampaignBase[]): string[] {
  return [...new Set(all.map((campaign) => campaign.art).filter(Boolean))];
}

export function CampaignEditor({
  kind,
  campaign,
  siblings,
  open,
  onToggle,
  autoFocus,
  onFocused,
}: {
  kind: PromoKind;
  campaign: CampaignBase;
  siblings: CampaignBase[];
  open: boolean;
  onToggle: () => void;
  /** the campaign that was just created, which opens and takes the caret */
  autoFocus: boolean;
  onFocused: () => void;
}): ReactNode {
  const repos = useRepositories();
  const { isInstalled } = useHub();
  const headlineRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const defaults = getDefaultRepositories();
  const repo =
    repos.find((r) => r.id === campaign.repoId) ??
    defaults.find((r) => r.id === campaign.repoId);
  const placement = kind === "banners" ? "banner" : "collection";
  const status = campaignStatus(campaign, siblings);
  const warnings = campaignWarnings(campaign);
  const apps = getHubApps().filter((app) => app.repoId === campaign.repoId);
  const allConnected = apps.length > 0 && apps.every((app) => isInstalled(app.slug));
  const onChange = (patch: Partial<CampaignBase>): void =>
    setCampaignFields(kind, campaign.id, patch);

  /*
   * A campaign that was just created opens itself, scrolls into view and
   * takes the caret. Without this, "New banner" prepended a disabled
   * campaign to a list sorted live-first, which put it fourth — somebody
   * pressed a button and, as far as the screen was concerned, nothing
   * happened.
   */
  useEffect(() => {
    if (!autoFocus) return;
    rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    headlineRef.current?.focus();
    headlineRef.current?.select();
    onFocused();
  }, [autoFocus, onFocused]);

  const onRemove = (): void => {
    const removed = removeCampaign(kind, campaign.id);
    if (!removed) return;
    toast.success("Campaign removed", {
      description: campaign.headline,
      action: {
        label: "Undo",
        onClick: () => restoreCampaign(kind, removed.campaign, removed.index),
      },
    });
  };

  return (
    <div ref={rowRef}>
      <Group
        id={`admin-campaign-${campaign.id}`}
        title={campaign.headline || "Untitled campaign"}
        hint={`${repo?.name ?? campaign.repoId} · Slot ${campaign.slot} · Edited ${sinceLabel(campaign.updatedAt) ?? "just now"}`}
      >
        {/* The collapsed line: everything somebody scanning the list needs,
            and the control that opens the rest. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 p-3 text-left"
        >
          <ChevronRight
            className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <StatusBadge status={status} />
          <span className="text-muted-foreground min-w-0 flex-1 text-xs">
            {scheduleLabel(campaign)}
            {campaign.sponsored ? ` · ${campaign.advertiser || "Sponsored"}` : " · House"}
            {campaign.sponsored && campaign.priceMonthly > 0
              ? ` · ${priceLabel(campaign.priceMonthly)}`
              : ""}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {campaign.impressions.toLocaleString()} impr · {ctr(campaign)}
          </span>
        </button>

        {warnings.length > 0 && <WarningsList warnings={warnings} />}

        {open && (
          <>
            <div className="flex flex-wrap items-center justify-end gap-1.5 p-3">
              <button
                type="button"
                onClick={() => {
                  duplicateCampaign(kind, campaign.id);
                  toast.success("Campaign duplicated", {
                    description: `${campaign.headline} (copy) — off until you switch it on`,
                  });
                }}
                className="focus-ring border-border hover:bg-surface-hover text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
              >
                <Copy className="size-3" aria-hidden="true" />
                Duplicate
              </button>
              <RemoveButton onRemove={onRemove} />
            </div>

            {repo && !repo.enabled && (
              <div className="flex items-center justify-between gap-3 p-3">
                <p className="text-muted-foreground text-xs">
                  {repo.name} is not switched on for testers yet.
                </p>
                <button
                  type="button"
                  onClick={() => enableRepository(repo.id)}
                  className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                >
                  Enable for testing
                </button>
              </div>
            )}

            <div className="grid gap-4 p-3 sm:grid-cols-2">
              <Field label="Source">
                <Picker
                  label="Source"
                  value={campaign.repoId}
                  options={sourceOptions(defaults)}
                  onPick={(repoId) => onChange({ repoId })}
                />
              </Field>
              <Field label="Headline">
                <input
                  ref={headlineRef}
                  value={campaign.headline}
                  onChange={(event) => onChange({ headline: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Subhead">
                <input
                  value={campaign.subhead}
                  onChange={(event) => onChange({ subhead: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              {kind === "banners" && (
                <Field
                  label="Art"
                  hint="A path under public/. Blank draws the gradient the card falls back to."
                >
                  <input
                    value={campaign.art}
                    list="store-admin-art"
                    placeholder="/app-repos/handcash.jpg"
                    onChange={(event) => onChange({ art: event.target.value })}
                    className={fieldClass}
                  />
                  <datalist id="store-admin-art">
                    {artSuggestions(siblings).map((art) => (
                      <option key={art} value={art} />
                    ))}
                  </datalist>
                </Field>
              )}
            </div>

            <Toggle
              label="Enabled"
              hint="Off takes this campaign out of the running for every slot."
              value={campaign.enabled}
              onChange={(next) => onChange({ enabled: next })}
            />
            <Toggle
              label="Sponsored"
              hint="Adds the disclosed badge Discover already shows, and counts towards booked revenue."
              value={campaign.sponsored}
              onChange={(next) => onChange({ sponsored: next })}
            />
            {campaign.sponsored && (
              <div className="grid gap-4 p-3 sm:grid-cols-2">
                <Field label="Advertiser">
                  <input
                    value={campaign.advertiser}
                    onChange={(event) => onChange({ advertiser: event.target.value })}
                    placeholder="Who bought this slot"
                    className={fieldClass}
                  />
                </Field>
                <Field
                  label="Price per month"
                  hint={`Rate card: ${priceLabel(rateCard[placement].monthly)}`}
                >
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={campaign.priceMonthly}
                    onChange={(event) =>
                      onChange({ priceMonthly: Math.max(0, Number(event.target.value) || 0) })
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
            )}

            <SlotAndSchedule campaign={campaign} siblings={siblings} onChange={onChange} />
            <Caps campaign={campaign} onChange={onChange} />

            <p className="text-muted-foreground p-3 text-xs">
              {campaign.impressions.toLocaleString()} impressions ·{" "}
              {campaign.clicks.toLocaleString()} clicks · {ctr(campaign)} CTR
            </p>

            {/* What Discover actually draws for this campaign, not a second
                copy of it — see discover-promo-cards.tsx. */}
            <div className="bg-canvas p-3">
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Preview
              </p>
              <div className="max-w-80">
                {kind === "banners" ? (
                  <BannerCard
                    headline={campaign.headline}
                    subhead={campaign.subhead}
                    art={campaign.art || undefined}
                    enabled={repo?.enabled ?? false}
                    sponsored={campaign.sponsored}
                    advertiser={campaign.advertiser}
                  />
                ) : (
                  <CollectionCard
                    headline={campaign.headline}
                    subhead={campaign.subhead}
                    apps={apps}
                    sponsored={campaign.sponsored}
                    allConnected={allConnected}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </Group>
    </div>
  );
}

/**
 * Slot, priority, weight and the flight window.
 *
 * The slot picker names whoever already holds each slot, because "Slot 2" on
 * its own is a number an admin has to go and look up — and looking it up is
 * exactly the step that ends with two campaigns pointed at one position and
 * nobody noticing until a sponsor asks why their card never appeared.
 */
function SlotAndSchedule({
  campaign,
  siblings,
  onChange,
}: {
  campaign: CampaignBase;
  siblings: CampaignBase[];
  onChange: (patch: Partial<CampaignBase>) => void;
}): ReactNode {
  const occupantOf = (slot: number): string => {
    const holders = contendersForSlot(siblings, slot).filter((c) => c.id !== campaign.id);
    if (holders.length === 0) return "free";
    if (holders.length === 1) return holders[0]!.headline;
    return `${holders.length} campaigns`;
  };
  const contenders = contendersForSlot(siblings, campaign.slot);
  const sharing = contenders.length > 1 && contenders.some((c) => c.id === campaign.id);
  const totalWeight = contenders.reduce((sum, c) => sum + Math.max(1, c.weight), 0);

  return (
    <div className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Slot" hint={`${SLOT_COUNT} positions on Discover's front page`}>
        <Picker
          label="Slot"
          value={String(campaign.slot)}
          options={Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => ({
            id: String(slot),
            label: `Slot ${slot}`,
            hint: occupantOf(slot),
            icon: <SlotMark slot={slot} />,
          }))}
          onPick={(slot) => onChange({ slot: Number(slot) })}
        />
      </Field>
      <Field label="Priority" hint="Lower wins the slot outright; equal priorities share it">
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
      <Field
        label="Weight"
        hint={
          sharing
            ? `${Math.round((Math.max(1, campaign.weight) / totalWeight) * 100)}% of this slot's views`
            : "Share of the slot when tied with another campaign on priority"
        }
      >
        <input
          type="number"
          min={1}
          value={campaign.weight}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange({ weight: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) });
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

/**
 * How much of a flight can be spent, and how fast.
 *
 * Without a cap, "a month" is the only unit of inventory a placement can be
 * sold in. With one, an admin can sell fifty thousand impressions, or two
 * thousand a day, or promise a reader they will not meet the same card six
 * times before lunch — three different things a sponsor asks for, none of
 * which a date range can express.
 */
function Caps({
  campaign,
  onChange,
}: {
  campaign: CampaignBase;
  onChange: (patch: Partial<CampaignBase>) => void;
}): ReactNode {
  const spent =
    campaign.capTotal > 0
      ? Math.min(100, Math.round((campaign.impressions / campaign.capTotal) * 100))
      : 0;
  const capField = (
    label: string,
    hint: string,
    value: number,
    key: "capTotal" | "capDaily" | "frequencyCap",
  ): ReactNode => (
    <Field label={label} hint={hint}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange({ [key]: Math.max(0, Number(event.target.value) || 0) })}
        className={fieldClass}
      />
    </Field>
  );

  return (
    <div className="grid gap-4 p-3 sm:grid-cols-3">
      {capField(
        "Total cap",
        campaign.capTotal > 0
          ? `${spent}% spent — ${campaign.impressions.toLocaleString()} of ${campaign.capTotal.toLocaleString()}`
          : "0 means it runs until the end date",
        campaign.capTotal,
        "capTotal",
      )}
      {capField("Daily cap", "Impressions a day, across everybody", campaign.capDaily, "capDaily")}
      {capField(
        "Frequency cap",
        "Times one reader sees it in a day",
        campaign.frequencyCap,
        "frequencyCap",
      )}
    </div>
  );
}
