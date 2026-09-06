"use client";

/**
 * The option lists Store Admin's pickers are built from, written once.
 *
 * Two tabs both offer "which source", and a third offers "which placement";
 * built inline they would drift into three slightly different lists with
 * three slightly different marks beside them. The mark matters as much as the
 * list: a source drawn with `RepoMark` here looks the same as it does in the
 * store, which is the whole reason for replacing the native dropdowns that
 * could not draw one at all.
 */

import { RepoMark } from "@/components/hub/repo-section";
import type { PickerOption } from "@/components/hub/picker";
import type { Reportable } from "@/lib/admin-analytics";
import type { AppRepository } from "@/lib/data";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** A slot's number, drawn as the small square the picker puts beside it. */
export function SlotMark({ slot }: { slot: number }): ReactNode {
  return (
    <span className="bg-muted text-muted-foreground grid size-5 place-items-center rounded-md text-[11px] font-bold tabular-nums">
      {slot}
    </span>
  );
}

export function sourceOptions(repos: AppRepository[]): PickerOption[] {
  return repos.map((repo) => ({
    id: repo.id,
    label: repo.name,
    ...(repo.note ? { hint: repo.note } : {}),
    icon: <RepoMark repo={repo} size={20} />,
  }));
}

/** The same list with an "everything" row on top, for filtering rather than choosing. */
export function sourceFilterOptions(repos: AppRepository[]): PickerOption[] {
  return [{ id: "all", label: "Every source" }, ...sourceOptions(repos)];
}

/**
 * Placements, for the sponsor report.
 *
 * The hero has no source to draw, so it gets the one mark in this app that is
 * an icon rather than somebody's own logo — it is Nexus's own surface, not a
 * third party's.
 */
export function placementOptions(
  surfaces: Reportable[],
  repos: AppRepository[],
): PickerOption[] {
  return surfaces.map((surface) => {
    const repo = repos.find((entry) => entry.id === surface.repoId);
    return {
      id: surface.id,
      label: surface.headline,
      hint: surface.sponsored ? surface.advertiser || "Sponsored" : "House",
      meta: `${surface.impressions.toLocaleString()} impr`,
      icon: repo ? (
        <RepoMark repo={repo} size={20} />
      ) : (
        <span className="bg-muted text-muted-foreground grid size-5 place-items-center rounded-md">
          <Sparkles className="size-3" aria-hidden="true" />
        </span>
      ),
    };
  });
}
