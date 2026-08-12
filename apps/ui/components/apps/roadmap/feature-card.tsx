"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { getMessagePerson, type RoadmapFeature } from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { Check, GripVertical, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

/** How full the bar is. Clamped, because a feature can be over-funded. */
export function progressOf(feature: RoadmapFeature): number {
  if (feature.goalSats <= 0) return 1;
  return Math.min(1, feature.pledgedSats / feature.goalSats);
}

/**
 * Risk and unknowns, as three segments.
 *
 * Three because the data has three values, and a bar rather than a word because
 * the reader is scanning a column of cards. It stays neutral in colour: a red
 * "high" would read as a warning, and a hard feature is not a problem, it is
 * just expensive.
 */
export function ComplexityBar({
  complexity,
  className = "",
}: {
  complexity: RoadmapFeature["complexity"];
  className?: string;
}): ReactNode {
  const filled = complexity === "low" ? 1 : complexity === "medium" ? 2 : 3;
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1.5 w-2.5 rounded-[2px] ${
            index < filled ? "bg-muted-foreground" : "bg-muted-foreground/25"
          }`}
        />
      ))}
    </span>
  );
}

/** Who is behind it, at a glance. */
function Backers({ feature }: { feature: RoadmapFeature }): ReactNode {
  const people = feature.pledges
    .map((pledge) => getMessagePerson(pledge.personId))
    .filter((person) => person !== undefined)
    .slice(0, 4);
  if (people.length === 0) return null;
  return (
    <span className="flex items-center -space-x-1.5">
      {people.map((person) => (
        <MemberAvatar
          key={person.id}
          person={person}
          size={18}
          className="ring-surface ring-2"
        />
      ))}
      {feature.pledges.length > people.length && (
        <span className="text-muted-foreground pl-2.5 text-[10px] tabular-nums">
          +{feature.pledges.length - people.length}
        </span>
      )}
    </span>
  );
}

/**
 * One feature, as it appears on the board.
 *
 * The bar is the card's point: it is the difference between "somebody wants
 * this" and "this is paid for". Shipped cards keep theirs rather than dropping
 * it, because what a feature cost is still the most interesting thing about it
 * after the fact.
 *
 * Draggable with the platform's own drag and drop, the way the app rail already
 * reorders — no library, and it works with the pointer, touch and a keyboard's
 * context menu because the browser supplies all three.
 */
export function FeatureCard({
  feature,
  onOpen,
  dragging,
  onDragStart,
  onDragEnd,
  index = 0,
}: {
  feature: RoadmapFeature;
  onOpen: () => void;
  dragging: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  /** place in the column, which is what staggers the fill */
  index?: number;
}): ReactNode {
  const funded = feature.pledgedSats >= feature.goalSats;
  const progress = progressOf(feature);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group bg-surface-raised ring-border/60 rounded-xl ring-1 transition-shadow ${
        dragging ? "opacity-40" : "hover:ring-accent/50 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring w-full rounded-xl p-3 text-left"
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-pretty">
              {feature.title}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed text-pretty">
              {feature.summary}
            </span>
          </span>
          {/* Only a hint that the card moves. The whole card is the handle —
              a 12px grip target would be a worse one on every device. */}
          <GripVertical
            className="text-muted-foreground/40 mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>

        <span className="mt-3 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-2">
            <Backers feature={feature} />
            {feature.comments.length > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span className="tabular-nums">{feature.comments.length}</span>
              </span>
            )}
          </span>
          <span
            className={`tabular-nums ${
              funded ? "text-muted-foreground" : "font-semibold"
            }`}
          >
            {funded ? (
              <span className="flex items-center gap-1">
                <Check className="size-3.5" aria-hidden="true" />
                {formatSats(feature.goalSats)}
              </span>
            ) : (
              <>
                {formatSats(feature.pledgedSats)}
                <span className="text-muted-foreground font-normal">
                  {" / "}
                  {formatSats(feature.goalSats)}
                </span>
              </>
            )}
          </span>
        </span>

        <span
          className="bg-muted mt-2 block h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${feature.title} funding`}
        >
          {/* One colour for money raised, in every column and every theme.
              It is not a state of the app, so it should not move with the
              accent — and a bar that means "funded" here and something else
              there is a bar nobody can read at a glance. */}
          <span
            className="nexus-fund-fill block h-full rounded-full bg-[#FFAF00]"
            style={
              {
                "--fund-width": `${progress * 100}%`,
                "--fund-delay": `${Math.min(index, 8) * 70}ms`,
              } as React.CSSProperties
            }
          />
        </span>
      </button>
    </div>
  );
}
