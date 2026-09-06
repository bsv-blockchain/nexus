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

/**
 * Which homescreen a set of chosen presets implies.
 *
 * Focus for somebody who picked nothing, and for a Thinker on their own: both
 * describe a person who came here to get something done rather than to see what
 * everyone is doing, and a feed is the wrong first thing to hand either of
 * them. Every other answer — Maker, Developer, Gamer, or Thinker alongside one
 * of them — is somebody with a reason to watch what is happening.
 *
 * A default, not a verdict. Preferences carries the same choice and the newest
 * answer wins whichever screen it came from: setting the radio overrides what
 * the first run seeded, and running the first run again overrides the radio.
 *
 * Here rather than inline in the applier so it can be tested without a browser
 * — the screen it seeds is behind five welcome cards and a picker, which is a
 * long way to walk to find out that a one-line rule still holds.
 *
 * @see components/hub/use-apply-presets.ts — the only caller
 */
export function homescreenFor(chosen: readonly string[]): "timeline" | "focus" {
  const solitaryThinker =
    chosen.length === 0 || (chosen.length === 1 && chosen[0] === "thinker");
  return solitaryThinker ? "focus" : "timeline";
}
