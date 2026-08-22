/**
 * table: tour_cards — the Guided Tour that follows the preset picker.
 *
 * The tour itself is not built yet. This is the shape its content goes in, and
 * the function that assembles a run of it, so that adding a card later is one
 * entry in `tourCards` and nothing else.
 *
 * Three rules the assembly has to hold, all of which are properties of the data
 * rather than of a component that will be written later:
 *
 *   - A card can belong to several presets. Somebody who picks Thinker and
 *     Maker sees a card those two share exactly once, not twice. `id` is the
 *     dedupe key, so the same card listed under three presets is still one
 *     card.
 *   - A card can belong to no preset. `presets: "always"` is in every run,
 *     which is how the tour keeps the things everybody needs told regardless of
 *     what they picked.
 *   - Order is explicit and global. `order` sorts the whole assembled run, not
 *     each preset's slice, so a shared card can be made to land between two
 *     preset-specific ones rather than after whichever preset happened to be
 *     chosen first.
 *
 * @see lib/data/presets.ts — the presets a card can be attached to
 */

import type { PresetId } from "./presets";

/**
 * Where the app should be while a card is shown.
 *
 * A tour that describes a screen you cannot see is a slideshow. This says which
 * screen to put behind the card; the tour component reads it and drives the
 * hub. Kept as a small declared union rather than a callback so a card stays
 * data — something a non-engineer can add — instead of becoming code.
 */
export interface TourAppState {
  /** the canvas: an app by slug, or one of the shell's own views */
  view: "app" | "workspaces" | "apps" | "timeline" | "settings";
  /** which app, when `view` is "app" */
  app?: string;
  /** which settings section, when `view` is "settings" */
  section?: string;
}

export interface TourCard {
  /**
   * Stable, and the dedupe key.
   *
   * Two presets listing the same `id` is how a card is shared; the assembled
   * run keeps the first and drops the rest.
   */
  id: string;
  /**
   * Where this card sits in the assembled run, low first.
   *
   * Global rather than per preset, and deliberately sparse — leave gaps so a
   * card can be slipped between two others without renumbering the file.
   */
  order: number;
  /** which presets pull this card in; "always" is in every run */
  presets: PresetId[] | "always";
  /** the screen to show behind it */
  appState: TourAppState;
  /** the illustration, or the empty string for a card that is only words */
  image: string;
  title: string;
  body: string;
}

/**
 * The cards, in no particular order — `order` decides that, not the array.
 *
 * Empty while the tour is unbuilt. The two below are commented rather than
 * live, as the shape to copy: one shared by two presets, one in every run.
 *
 *   {
 *     id: "rail-groups",
 *     order: 200,
 *     presets: ["thinker", "maker"],
 *     appState: { view: "workspaces" },
 *     image: "/first-run/tour/rail.webp",
 *     title: "Your apps, in folders",
 *     body: "The rail keeps what you chose. Drag a tile onto another to group them.",
 *   },
 *   {
 *     id: "handle",
 *     order: 100,
 *     presets: "always",
 *     appState: { view: "app", app: "identity" },
 *     image: "/first-run/tour/handle.webp",
 *     title: "One handle, everywhere",
 *     body: "It is yours, it is on chain, and nobody can take it back.",
 *   },
 */
export const tourCards: TourCard[] = [];

/**
 * The run of cards for a set of chosen presets.
 *
 * Deduped by `id` and sorted by `order`. A card with no presets chosen still
 * gets the "always" cards, which is the tour a first run with no preset should
 * show.
 */
export function tourFor(chosen: PresetId[]): TourCard[] {
  const seen = new Set<string>();
  const run: TourCard[] = [];
  for (const card of tourCards) {
    const wanted =
      card.presets === "always" ||
      card.presets.some((preset) => chosen.includes(preset));
    if (!wanted || seen.has(card.id)) continue;
    seen.add(card.id);
    run.push(card);
  }
  /* Stable within an equal `order`, so two cards sharing a number keep the
     order they were written in rather than swapping between renders. */
  return run.sort((a, b) => a.order - b.order);
}

/**
 * Which footer buttons a card should show, given where it sits in the run.
 *
 * Here rather than in the component so the rule is testable without rendering,
 * and so the last card cannot end up offering "Next" to nothing.
 */
export interface TourFooter {
  previous: boolean;
  next: boolean;
  skip: boolean;
  gotIt: boolean;
}

export function footerFor(index: number, total: number): TourFooter {
  const last = index >= total - 1;
  return {
    previous: index > 0,
    next: !last,
    /* Skip disappears on the last card: with nothing left to skip it is a
       second, worse-worded "Got it". */
    skip: !last,
    gotIt: last,
  };
}
