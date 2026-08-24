"use client";

/**
 * Which screen "Home" means, right now.
 *
 * Three facts decide it and they are read in the same order everywhere, which
 * is the only reason this is a function rather than three conditions written
 * out at each of the four call sites:
 *
 *   1. the Timeline is not there at all — promoted to an app and then
 *      disconnected — so there is nothing to choose and Focus wins
 *   2. otherwise whatever Preferences says, which the first run seeded from
 *      the presets
 *
 * @see components/hub/use-apply-presets.ts — what seeds the preference
 */

import type { MainViewKind } from "@/components/hub/hub-provider";

export function homeView(
  homescreen: "timeline" | "focus",
  timelineHere: boolean,
): MainViewKind {
  if (!timelineHere) return "home";
  return homescreen === "focus" ? "home" : "timeline";
}
