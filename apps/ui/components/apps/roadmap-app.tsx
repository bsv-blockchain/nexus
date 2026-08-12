"use client";

import { FeatureCard } from "@/components/apps/roadmap/feature-card";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  type RoadmapFeature,
  type RoadmapSort,
  type RoadmapStatus,
} from "@/lib/data";
import { formatSats } from "@/lib/messages";
import {
  columnFeatures,
  currentFeatures,
  getRoadmap,
  getRoadmapServerSnapshot,
  moveFeature,
  subscribeRoadmap,
} from "@/lib/roadmap-effects";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const DRAG_MIME = "application/x-nexus-feature";

const copy = content.roadmap;

export const COLUMNS: { id: RoadmapStatus; label: string; hint: string }[] = [
  { id: "fundable", label: copy.fundable, hint: copy.fundableHint },
  { id: "funded", label: copy.funded, hint: copy.fundedHint },
  { id: "shipped", label: copy.shipped, hint: copy.shippedHint },
];

/** Reads the board with this session's pledges, comments and moves applied. */
export function useRoadmapFeatures(): RoadmapFeature[] {
  useSyncExternalStore(
    subscribeRoadmap,
    getRoadmap,
    getRoadmapServerSnapshot,
  );
  return currentFeatures();
}

function sortFeatures(
  features: RoadmapFeature[],
  sort: RoadmapSort,
): RoadmapFeature[] {
  const out = [...features];
  if (sort === "top-funded") {
    out.sort((a, b) => b.pledgedSats - a.pledgedSats);
  } else if (sort === "closest") {
    /* How near the goal, not how much is behind it. A small feature two
       thirds of the way there is closer to being built than a large one at a
       fifth, and that is the question this sort answers. */
    out.sort(
      (a, b) => b.pledgedSats / b.goalSats - a.pledgedSats / a.goalSats,
    );
  } else if (sort === "most-discussed") {
    out.sort((a, b) => b.comments.length - a.comments.length);
  } else {
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return out;
}

function Column({
  column,
  features,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  column: (typeof COLUMNS)[number];
  features: RoadmapFeature[];
  dragging: string | null;
  onDragStart: (id: string) => (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (status: RoadmapStatus, before: string | null) => void;
}): ReactNode {
  const { openDetailPane } = useHub();
  const [over, setOver] = useState<string | null>(null);
  const pledged = features.reduce((sum, f) => sum + f.pledgedSats, 0);

  const accept = (event: React.DragEvent): boolean =>
    event.dataTransfer.types.includes(DRAG_MIME);

  return (
    <section
      onDragOver={(event) => {
        if (!accept(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(event) => {
        if (!accept(event)) return;
        event.preventDefault();
        onDrop(column.id, over === "end" ? null : over);
        setOver(null);
      }}
      className={`bg-surface ring-border/60 flex min-h-0 flex-col rounded-2xl ring-1 transition-colors ${
        dragging ? "ring-accent/40" : ""
      }`}
      aria-label={column.label}
    >
      <header className="border-border/60 flex items-baseline gap-2 border-b px-3 py-2.5">
        <h2 className="text-sm font-bold">{column.label}</h2>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {features.length}
        </span>
        <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
          {formatSats(pledged)}
        </span>
      </header>
      <p className="text-muted-foreground px-3 pt-2 text-[11px] text-pretty">
        {column.hint}
      </p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {features.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-xs text-pretty">
            {copy.emptyColumn}
          </p>
        )}
        {features.map((feature, index) => (
          <div
            key={feature.id}
            onDragOver={(event) => {
              if (!accept(event)) return;
              event.preventDefault();
              setOver(feature.id);
            }}
          >
            {/* The line the card would land on, drawn where it would go rather
                than as a highlight on the neighbour — a highlighted card looks
                like the thing you are about to replace. */}
            {over === feature.id && dragging && dragging !== feature.id && (
              <span
                className="bg-accent mb-2 block h-0.5 rounded-full"
                aria-hidden="true"
              />
            )}
            <FeatureCard
              feature={feature}
              index={index}
              dragging={dragging === feature.id}
              onDragStart={onDragStart(feature.id)}
              onDragEnd={onDragEnd}
              onOpen={() =>
                openDetailPane({ kind: "feature", id: feature.id })
              }
            />
          </div>
        ))}
        {/* The tail of the column is its own drop target, so a card can be put
            last without aiming below the final card and hitting nothing. */}
        <div
          onDragOver={(event) => {
            if (!accept(event)) return;
            event.preventDefault();
            setOver("end");
          }}
          className="min-h-8"
        >
          {over === "end" && dragging && (
            <span
              className="bg-accent block h-0.5 rounded-full"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The Nexus roadmap.
 *
 * Three columns that say three different things: nobody has paid for this, the
 * money is here and the work is not, this is in your hands. Cards are draggable
 * across all three, which in a prototype means you can move a feature into
 * shipped without shipping it — that is a demo affordance, and the board says
 * so in its own help pane.
 *
 * One column on a phone. Three columns side by side on a 390px screen is three
 * unreadable columns, and the status is already on every card's own bar.
 */
export function RoadmapApp(): ReactNode {
  const { roadmapStatus, roadmapSort, roadmapQuery } = useHub();
  const features = useRoadmapFeatures();
  const [dragging, setDragging] = useState<string | null>(null);

  const needle = roadmapQuery.trim().toLowerCase();
  const visible = features.filter((feature) => {
    if (needle) {
      const hay = `${feature.title} ${feature.summary} ${feature.body}`;
      if (!hay.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  const shown = COLUMNS.filter(
    (column) => roadmapStatus === "all" || roadmapStatus === column.id,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
      <div
        className={`grid min-h-0 flex-1 gap-3 ${
          shown.length === 1 ? "" : "lg:grid-cols-3"
        }`}
      >
        {shown.map((column) => (
          <Column
            key={column.id}
            column={column}
            features={sortFeatures(
              columnFeatures(column.id, visible),
              roadmapSort,
            )}
            dragging={dragging}
            onDragStart={(id) => (event) => {
              event.dataTransfer.setData(DRAG_MIME, id);
              event.dataTransfer.effectAllowed = "move";
              setDragging(id);
            }}
            onDragEnd={() => setDragging(null)}
            onDrop={(status, before) => {
              if (!dragging) return;
              moveFeature(dragging, status, before);
              setDragging(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}
