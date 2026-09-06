"use client";

/**
 * The same counted numbers, read three ways.
 *
 * A Nexus team member deciding what to sell next wants the whole picture:
 * what the promo real estate is doing, what has been booked this month, and
 * which slots are standing empty and when. A sponsor wants one answer about
 * one placement. Both come out of the same `daily` buckets in
 * lib/admin-store.ts — nothing here is a second copy of a count, only a
 * different way of adding it up.
 *
 * "Live now" is the number this tab used to get wrong: it counted every
 * campaign whose switch was on, including ones scheduled for next month,
 * ones whose flight had ended, ones whose cap was spent and ones losing
 * their slot — while the badge on the campaign itself said otherwise. It
 * asks `stateTotals` now, which asks the same slot competition Discover
 * does.
 */

import { AnalyticsChart } from "@/components/apps/store-admin/analytics-chart";
import { AdminGroup, Stat, money } from "@/components/apps/store-admin/blocks";
import { placementOptions } from "@/components/apps/store-admin/pickers";
import { Picker } from "@/components/hub/picker";
import {
  booked,
  ctrLabel,
  dailySeries,
  occupancy,
  reportables,
  seriesCsv,
  slotUtilization,
  stateTotals,
  totals,
  type Reportable,
} from "@/lib/admin-analytics";
import type { AdminPromoState } from "@/lib/admin-store";
import { getDefaultRepositories } from "@/lib/data";
import { SLOT_COUNT } from "@/lib/data/discover-promos";
import { Copy, Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type Metric = "impressions" | "clicks";
const RANGES = [14, 30, 90] as const;
type Range = (typeof RANGES)[number];

/** How far ahead the occupancy calendar looks — a quarter of selling, roughly. */
const OCCUPANCY_DAYS = 45;

export function AnalyticsTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const surfaces = reportables(admin);
  const overall = stateTotals(admin);
  const revenue = booked(admin);
  const utilization = slotUtilization(admin.banners, admin.collections, SLOT_COUNT);
  const ranked = [...surfaces].sort((a, b) => b.impressions - a.impressions);
  const [metric, setMetric] = useState<Metric>("impressions");
  const [range, setRange] = useState<Range>(14);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const sponsor = surfaces.find((entry) => entry.id === sponsorId) ?? null;
  const series = dailySeries(surfaces, range);

  return (
    <>
      <AdminGroup
        id="aggregate"
        title="Discover placements, in aggregate"
        hint="Every promotional surface together — the hero, the banners and the collections."
      >
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat label="Impressions" value={overall.impressions.toLocaleString()} />
          <Stat label="Clicks" value={overall.clicks.toLocaleString()} />
          <Stat label="CTR" value={ctrLabel(overall.ctr)} />
          <Stat
            label="Live now"
            value={String(overall.liveCount)}
            hint="Actually drawing on Discover"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Segmented
            options={[
              { id: "impressions", label: "Impressions" },
              { id: "clicks", label: "Clicks" },
            ]}
            value={metric}
            onPick={(next) => setMetric(next as Metric)}
          />
          <Segmented
            options={RANGES.map((days) => ({ id: String(days), label: `${days}d` }))}
            value={String(range)}
            onPick={(next) => setRange(Number(next) as Range)}
          />
        </div>
        {/* Real counts, not invented ones — a fresh profile has genuinely seen
            nothing yet, and a flat chart with no explanation reads as broken
            rather than as "come back once Discover has had some traffic". */}
        {overall.impressions > 0 ? (
          <div className="p-3">
            <AnalyticsChart data={series} metric={metric} label={metric} />
          </div>
        ) : (
          <p className="text-muted-foreground p-3 text-sm text-pretty">
            No impressions recorded yet — this fills in as people actually
            browse Discover, not on a timer.
          </p>
        )}
      </AdminGroup>

      <AdminGroup
        id="revenue"
        title="Booked and available"
        hint="What the rate card has actually produced this month, and what is still standing empty at list price."
      >
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat
            label="Booked this month"
            value={money(revenue.monthly)}
            hint={`${revenue.count} sold placement${revenue.count === 1 ? "" : "s"}`}
          />
          <Stat
            label="Unsold at list"
            value={money(revenue.available)}
            hint={`${revenue.unsoldSlots} placement${revenue.unsoldSlots === 1 ? "" : "s"} nobody has bought`}
          />
          <Stat label="Sponsored" value={String(overall.sponsoredCount)} />
          <Stat
            label="Unpriced"
            value={String(revenue.unpriced)}
            hint="Sold with no price set"
          />
        </div>
        {revenue.unpriced > 0 && (
          <p className="text-warning p-3 text-xs font-medium text-pretty">
            {revenue.unpriced} sold placement{revenue.unpriced === 1 ? "" : "s"} priced at
            nothing — booked revenue is short by whatever they went for.
          </p>
        )}
        <p className="text-muted-foreground p-3 text-[11px] text-pretty">
          A label, not a ledger: nothing in this build charges anybody. See
          Guidelines for what the rate card is for.
        </p>
      </AdminGroup>

      <AdminGroup
        id="slot-demand"
        title="Slot demand"
        hint="How many campaigns are actually in the running for each slot right now — banners and collections counted separately, since the two never compete with each other."
      >
        <div
          className="divide-border/60 grid divide-x"
          style={{ gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(0, 1fr))` }}
        >
          {utilization.map((entry) => (
            <div key={entry.slot} className="p-3 text-center">
              <p className="text-muted-foreground text-xs font-semibold">Slot {entry.slot}</p>
              <p className="mt-1 text-sm tabular-nums">
                {entry.banners} banner{entry.banners === 1 ? "" : "s"}
                {entry.banners > 1 ? " · shared" : entry.banners === 0 ? " · free" : ""}
              </p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {entry.collections} collection{entry.collections === 1 ? "" : "s"}
                {entry.collections > 1 ? " · shared" : entry.collections === 0 ? " · free" : ""}
              </p>
            </div>
          ))}
        </div>
      </AdminGroup>

      <OccupancyCalendar admin={admin} />

      <AdminGroup id="ranked" title="Ranked by impressions" hint="Every surface, most-seen first.">
        {ranked.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">No campaigns yet.</p>
        )}
        {ranked.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setSponsorId(entry.id);
              goToSponsorReport();
            }}
            className="focus-ring hover:bg-surface-hover flex w-full items-center justify-between gap-3 p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{entry.headline}</span>
              <span className="text-muted-foreground text-xs">
                {entry.sponsored ? entry.advertiser || "Sponsored" : "House"}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {entry.impressions.toLocaleString()} impr · {entry.clicks.toLocaleString()} clicks
            </span>
          </button>
        ))}
      </AdminGroup>

      <div id="admin-sponsor-report" className="scroll-mt-6">
        <AdminGroup
          id="sponsor-report"
          title="Sponsor report"
          hint="What a Nexus team member hands a sponsor: one placement, its own numbers, nothing else mixed in."
        >
          <div className="p-3">
            <Picker
              label="Placement"
              placeholder="Pick a placement"
              value={sponsorId}
              options={placementOptions(surfaces, getDefaultRepositories())}
              onPick={setSponsorId}
            />
          </div>
          {sponsor && <SponsorReport surface={sponsor} range={range} />}
        </AdminGroup>
      </div>
    </>
  );
}

/**
 * Same "scroll and flash" as Settings' own search-to-section jump. A ranked
 * campaign above selects itself into the Sponsor report further down the
 * page; without this, clicking one just changes a picker out of view, which
 * reads as nothing happened rather than as "look further down".
 */
function goToSponsorReport(): void {
  requestAnimationFrame(() => {
    const target = document.getElementById("admin-sponsor-report");
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    target.classList.add("settings-found");
    window.setTimeout(() => target.classList.remove("settings-found"), 1600);
  });
}

function Segmented({
  options,
  value,
  onPick,
}: {
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
}): ReactNode {
  return (
    <div className="border-border flex gap-1 rounded-full border p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick(option.id)}
          className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold ${
            value === option.id
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:bg-surface-hover"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Which slots are spoken for, day by day.
 *
 * The one view that answers "what can I sell, and from when" without opening
 * every campaign and reading its dates — and the reason a gap in the middle
 * of next month is now something an admin can see rather than something a
 * sponsor discovers for them.
 */
function OccupancyCalendar({ admin }: { admin: AdminPromoState }): ReactNode {
  const rows = occupancy(admin, OCCUPANCY_DAYS);
  const first = rows[0]?.days[0]?.date;
  const last = rows[0]?.days[rows[0].days.length - 1]?.date;

  return (
    <AdminGroup
      id="occupancy"
      title="What is free, and when"
      hint={`Every slot for the next ${OCCUPANCY_DAYS} days. Schedule only — a cap spent by teatime is about today's traffic, not next month's availability.`}
    >
      <div className="space-y-2 overflow-x-auto p-3">
        {rows.map((row) => (
          <div key={`${row.kind}-${row.slot}`} className="flex items-center gap-2">
            <span className="text-muted-foreground w-28 shrink-0 text-[11px] font-semibold">
              {row.kind === "banner" ? "Banner" : "Collection"} {row.slot}
            </span>
            <div
              className="grid min-w-100 flex-1 gap-px"
              style={{ gridTemplateColumns: `repeat(${OCCUPANCY_DAYS}, minmax(0, 1fr))` }}
            >
              {row.days.map((day) => (
                <span
                  key={day.date}
                  title={
                    day.headline
                      ? `${day.date} · ${day.headline}${day.sponsored ? " (sold)" : " (house)"}`
                      : `${day.date} · free`
                  }
                  className={`h-4 rounded-[2px] ${
                    day.headline
                      ? day.sponsored
                        ? "bg-accent"
                        : "bg-accent/35"
                      : "bg-muted-foreground/15"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-4 p-3 text-[11px]">
        <span>
          {first} → {last}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-accent size-3 rounded-[2px]" aria-hidden="true" /> Sold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-accent/35 size-3 rounded-[2px]" aria-hidden="true" /> House
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/15 size-3 rounded-[2px]" aria-hidden="true" /> Free
        </span>
      </div>
    </AdminGroup>
  );
}

/** The numbers as a sponsor sees them — one placement, scoped to its own history. */
function SponsorReport({ surface, range }: { surface: Reportable; range: Range }): ReactNode {
  const series = dailySeries([surface], range);
  const stats = totals([surface]);

  const summary = (): string => {
    const window =
      surface.startDate || surface.endDate
        ? ` (${surface.startDate || "no start date"} – ${surface.endDate || "ongoing"})`
        : "";
    return (
      `${surface.headline}${window}: ${stats.impressions.toLocaleString()} impressions, ` +
      `${stats.clicks.toLocaleString()} clicks, ${ctrLabel(stats.ctr)} CTR`
    );
  };

  const csv = (): string => seriesCsv(surface.headline, series);

  const onDownload = (): void => {
    const blob = new Blob([csv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${surface.id}-${range}d.csv`;
    link.click();
    /* Revoked on the next tick, not immediately: some browsers have not
       started reading the blob by the time `click` returns, and pulling the
       URL out from under them cancels the download with nothing on screen to
       say why. Same trade as the image save in Messages. */
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Report downloaded", { description: surface.headline });
  };

  return (
    <div className="border-border border-t p-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Impressions" value={stats.impressions.toLocaleString()} />
        <Stat label="Clicks" value={stats.clicks.toLocaleString()} />
        <Stat label="CTR" value={ctrLabel(stats.ctr)} />
      </div>
      {stats.impressions > 0 ? (
        <div className="mt-3">
          <AnalyticsChart data={series} metric="impressions" label="impressions" />
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          No impressions recorded yet for this placement.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(summary());
            toast.success("Summary copied", { description: surface.headline });
          }}
          className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copy summary
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(csv());
            toast.success("CSV copied", { description: `${range} days of daily counts` });
          }}
          className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copy CSV
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Download CSV
        </button>
      </div>
    </div>
  );
}
