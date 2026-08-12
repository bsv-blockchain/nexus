"use client";

import { progressOf } from "@/components/apps/roadmap/feature-card";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { currentFeature } from "@/lib/roadmap-effects";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.roadmap;

/**
 * A roadmap feature, under the line that named it.
 *
 * Read-only in the thread on purpose. The card carries the one number worth
 * arguing about — how far off the goal it is — and hands the argument's outcome
 * to Roadmap, where funding is confirmed against a wallet. A Fund button in a
 * chat bubble would be a second way to spend money, in the surface least suited
 * to confirming one.
 *
 * The figures come from the live store rather than from the card, so a feature
 * funded elsewhere in this session is not still showing yesterday's total in a
 * conversation somebody scrolls back to.
 */
export function RoadmapCard({ featureId }: { featureId: string }): ReactNode {
  const { openApp, openDetailPane } = useHub();
  const feature = currentFeature(featureId);
  if (!feature) return null;

  const full = feature.pledgedSats >= feature.goalSats;
  const progress = progressOf(feature);
  const label =
    feature.status === "fundable"
      ? copy.fundable
      : feature.status === "funded"
        ? copy.funded
        : copy.shipped;

  return (
    <button
      type="button"
      onClick={() => {
        openApp("roadmap");
        openDetailPane({ kind: "feature", id: feature.id });
      }}
      className="focus-ring bg-surface-raised ring-border/60 hover:ring-accent/50 mt-1.5 block w-full rounded-xl p-3 text-left ring-1 transition-shadow"
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-[10px] font-bold tracking-wide uppercase">
            {copy.title} · {label}
          </span>
          <span className="mt-0.5 block text-sm font-bold text-pretty">
            {feature.title}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {feature.summary}
          </span>
        </span>
        <ChevronRight
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
      </span>

      <span className="mt-2.5 flex items-baseline justify-between text-[11px] tabular-nums">
        <span className="font-semibold">{formatSats(feature.pledgedSats)}</span>
        <span className="text-muted-foreground">
          {full ? copy.fundedAlready : `${copy.ofGoal} ${formatSats(feature.goalSats)}`}
        </span>
      </span>
      <span className="bg-muted mt-1.5 block h-1.5 overflow-hidden rounded-full">
        <span
          className={`block h-full rounded-full ${
            feature.status === "shipped" ? "bg-positive" : "bg-accent"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </span>
    </button>
  );
}
