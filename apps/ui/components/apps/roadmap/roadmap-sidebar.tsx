"use client";

import { useRoadmapFeatures } from "@/components/apps/roadmap-app";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  ROADMAP_STATUSES,
  type RoadmapSort,
  type RoadmapStatus,
} from "@/lib/data";
import { formatSats } from "@/lib/messages";
import {
  Circle,
  CircleCheck,
  CircleDot,
  Layers,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const copy = content.roadmap;

const FILTERS: {
  id: RoadmapStatus | "all";
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "all", label: copy.all, icon: Layers },
  { id: "fundable", label: copy.fundable, icon: Circle },
  { id: "funded", label: copy.funded, icon: CircleDot },
  { id: "shipped", label: copy.shipped, icon: CircleCheck },
];

const SORTS: { id: RoadmapSort; label: string }[] = [
  { id: "top-funded", label: copy.sortTopFunded },
  { id: "closest", label: copy.sortClosest },
  { id: "newest", label: copy.sortNewest },
  { id: "most-discussed", label: copy.sortDiscussed },
];

function Label({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="text-muted-foreground px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </p>
  );
}

/**
 * The board's controls, in the column every app puts its navigation in.
 *
 * Filtering to one status is the same act as choosing a column, so the filter
 * list doubles as the phone's column picker rather than being a second control
 * that means the same thing.
 */
export function RoadmapSidebar(): ReactNode {
  const {
    roadmapStatus,
    setRoadmapStatus,
    roadmapSort,
    setRoadmapSort,
    roadmapQuery,
    setRoadmapQuery,
    openDetailPane,
  } = useHub();
  const features = useRoadmapFeatures();

  const counts = Object.fromEntries(
    ROADMAP_STATUSES.map((status) => [
      status,
      features.filter((feature) => feature.status === status).length,
    ]),
  ) as Record<RoadmapStatus, number>;

  const pledged = features.reduce((sum, f) => sum + f.pledgedSats, 0);
  const goal = features.reduce((sum, f) => sum + f.goalSats, 0);
  const backers = new Set(
    features.flatMap((f) => f.pledges.map((p) => p.personId)),
  ).size;
  const yours = features.filter((feature) =>
    feature.pledges.some((p) => p.personId === "me"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="bg-surface-raised mb-2 flex items-center gap-2 rounded-lg px-3 py-2">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          value={roadmapQuery}
          onChange={(event) => setRoadmapQuery(event.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        {FILTERS.map((filter) => {
          const active = roadmapStatus === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setRoadmapStatus(filter.id)}
              aria-current={active ? "true" : undefined}
              /* Tint behind, words unchanged — the house rule for a selected
                 row anywhere in this product. */
              className={`focus-ring text-foreground flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                active ? "bg-accent/15 font-medium" : "hover:bg-surface-hover"
              }`}
            >
              <filter.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{filter.label}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {filter.id === "all" ? features.length : counts[filter.id]}
              </span>
            </button>
          );
        })}
      </div>

      <Label>{copy.sortTitle}</Label>
      <div className="flex flex-col gap-0.5">
        {SORTS.map((sort) => {
          const active = roadmapSort === sort.id;
          return (
            <button
              key={sort.id}
              type="button"
              onClick={() => setRoadmapSort(sort.id)}
              aria-pressed={active}
              className={`focus-ring text-foreground w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${
                active ? "bg-accent/15 font-medium" : "hover:bg-surface-hover"
              }`}
            >
              {sort.label}
            </button>
          );
        })}
      </div>

      <Label>{copy.totalsTitle}</Label>
      <dl className="border-border bg-surface-raised mx-1 rounded-xl border px-3 py-2 text-xs">
        <div className="flex items-center justify-between py-0.5">
          <dt className="text-muted-foreground">{copy.totalPledged}</dt>
          <dd className="font-semibold tabular-nums">{formatSats(pledged)}</dd>
        </div>
        <div className="flex items-center justify-between py-0.5">
          <dt className="text-muted-foreground">{copy.totalGoal}</dt>
          <dd className="tabular-nums">{formatSats(goal)}</dd>
        </div>
        <div className="flex items-center justify-between py-0.5">
          <dt className="text-muted-foreground">{copy.totalBackers}</dt>
          <dd className="tabular-nums">{backers}</dd>
        </div>
      </dl>

      <Label>{copy.yoursTitle}</Label>
      {yours.length === 0 ? (
        <p className="text-muted-foreground px-2.5 pb-2 text-[11px] text-pretty">
          {copy.yoursEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {yours.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() =>
                openDetailPane({ kind: "feature", id: feature.id })
              }
              className="focus-ring hover:bg-surface-hover w-full rounded-lg px-2.5 py-1.5 text-left"
            >
              <span className="block truncate text-xs font-medium">
                {feature.title}
              </span>
              <span className="text-muted-foreground block text-[10px] tabular-nums">
                {formatSats(
                  feature.pledges
                    .filter((p) => p.personId === "me")
                    .reduce((sum, p) => sum + p.sats, 0),
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
