/**
 * table: tour_cards — the Guided Tour that follows the preset picker.
 *
 * A card is data. It says which presets pull it in, where in the run it sits,
 * what screen to put behind it, and which piece of the interface it is pointing
 * at. Adding one is an entry in `tourCards`; nothing else has to be told.
 *
 * Four rules the assembly holds, all of them properties of this file rather
 * than of the component that renders it:
 *
 *   - A card can belong to several presets and is played once. `id` is the
 *     dedupe key, so a card listed under three presets is still one card.
 *   - A card can belong to none. `presets: "always"` is in every run, which is
 *     how the four things everybody needs told get told.
 *   - Order is explicit and global, so a shared card can be made to land
 *     between two preset-specific ones. Sparse, so a card can be slipped in
 *     without renumbering.
 *   - The run always opens with the start card and closes with the end card,
 *     whatever else is in it — including when nothing was chosen.
 *
 * @see lib/data/presets.ts — the presets a card can be attached to
 */

import { presets, type PresetId } from "./presets";

/**
 * Where the app should be while a card is shown.
 *
 * A tour that describes a screen you cannot see is a slideshow. This says which
 * screen to put behind the card; the tour drives the hub from it. A small
 * declared union rather than a callback, so a card stays data — something
 * somebody can add without writing code.
 */
export interface TourAppState {
  /* The hub's own `MainViewKind`, restated rather than imported: this module is
     data and stays free of component imports. "workspaces" and "apps" are not
     here because they are not canvases — the rail is visible on every view, so
     a card about a rail folder shows the feed and points at the rail. */
  view: "app" | "timeline" | "settings" | "store";
  /** which app, when `view` is "app" */
  app?: string;
  /** which settings section, when `view` is "settings" */
  section?: string;
}

/**
 * Which side of its anchor a card sits on.
 *
 * Separate for pointer and touch because the constraint is different: on a
 * desktop there is room beside the thing being explained, and on a phone there
 * is not — so a phone card goes to whichever end of the screen the anchor is
 * NOT at, and the answer is per card because the rail is up the left on one and
 * along the bottom on the other.
 */
export type TourSide = "top" | "bottom" | "left" | "right";

export type TourKind = "start" | "step" | "end";

export interface TourCard {
  /** stable, and the dedupe key when two presets share a card */
  id: string;
  kind: TourKind;
  /** low first; global across the run, and sparse on purpose */
  order: number;
  /** which presets pull this card in; "always" is in every run */
  presets: PresetId[] | "always";
  appState: TourAppState;
  /**
   * The interface this card is about, as a `data-tour` value.
   *
   * A named handle rather than a CSS selector: a selector encodes what the
   * markup looks like today, and the first refactor breaks every card silently.
   * The element carries `data-tour="rail-messages"` and says so about itself.
   *
   * Absent on the start and end cards, which are about the whole app and are
   * centred rather than pointed.
   */
  anchor?: string;
  /** which side of the anchor on a pointer */
  side?: TourSide;
  /** which end of the screen on a phone, chosen not to cover the anchor */
  mobileSide?: "top" | "bottom";
  /** the illustration; empty renders the placeholder field */
  image: string;
  title: string;
  /**
   * The card's words.
   *
   * `*starred*` runs are drawn heavier. A marker rather than a second field of
   * spans, because the emphasis belongs inside the sentence — pulling it out
   * into structure would make writing a card a layout job.
   */
  body: string;
}

/**
 * The cards.
 *
 * `image` is empty on all of them: the placeholder field is deliberate, and an
 * obvious gap is easier to replace later than a gradient that looks finished.
 *
 * The four "always" steps are the four things somebody has to be told whatever
 * they picked — who they are, how they are reached, how they are paid, and
 * where the things they cannot lose go. Each preset adds exactly one more,
 * about the thing that preset is for.
 */
export const tourCards: TourCard[] = [
  {
    id: "start",
    kind: "start",
    order: 0,
    presets: "always",
    appState: { view: "timeline" },
    image: "",
    title: "", // written from the chosen presets — see `startCopy`
    body: "",
  },

  /* ---- the four everybody gets ------------------------------------------ */
  {
    id: "identity",
    kind: "step",
    order: 100,
    presets: "always",
    appState: { view: "app", app: "identity" },
    anchor: "rail-identity",
    /* The rail is up the left edge, so a card to its right sits beside the tile
       rather than over it. On a phone the rail is along the bottom, so the card
       goes to the top. */
    side: "right",
    mobileSide: "top",
    image: "",
    title: "One handle, everywhere",
    body: "Your handle is *yours* and it is *on chain*. Messages, payments and anything you sign all hang off it, so there is one name to give out and one to protect.",
  },
  {
    id: "messages",
    kind: "step",
    order: 200,
    presets: "always",
    appState: { view: "app", app: "messages" },
    anchor: "rail-messages",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "Talk to anyone, anywhere",
    body: "*Six ecosystems* share one inbox. Type *@* to reach somebody on any of them, and */* to pay, sign or seal without leaving the line you are writing.",
  },
  {
    id: "payments",
    kind: "step",
    order: 300,
    presets: "always",
    appState: { view: "app", app: "wallet" },
    anchor: "rail-wallet",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "Getting paid, and paying",
    body: "Send *sats* to a handle, or a *payment link* anybody can open. Every payment lands in *Activity* with what it was for, and the things you buy stay yours: *collectibles* you keep and *consumables* you spend. Set a ceiling once and anything under it stops asking.",
  },
  {
    id: "vault",
    kind: "step",
    order: 400,
    presets: "always",
    appState: { view: "app", app: "vault" },
    anchor: "rail-vault",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "The things you cannot lose",
    body: "*Keys*, recovery phrases and documents go behind a door that *shuts on its own* when you leave the app.",
  },

  /* ---- one per preset ---------------------------------------------------- */
  {
    id: "thinker-library",
    kind: "step",
    order: 500,
    presets: ["thinker"],
    appState: { view: "timeline" },
    anchor: "rail-group-preset-thinker",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "Read it, sign it, keep it",
    body: "*Productivity* holds Mail, Sign and Learn. Anything you send can carry your *signature*, so whoever reads it knows it was you.",
  },
  {
    id: "maker-publish",
    kind: "step",
    order: 600,
    presets: ["maker"],
    appState: { view: "timeline" },
    anchor: "rail-group-preset-maker",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "Put it out, get paid for it",
    body: "*Publish* writes it, *Market* and *OmniBazaar* sell it. The payment and the thing being paid for are the *same transaction*.",
  },
  {
    id: "developer-build",
    kind: "step",
    order: 700,
    presets: ["developer"],
    appState: { view: "settings", section: "appearance" },
    anchor: "settings-developer-tools",
    side: "left",
    mobileSide: "bottom",
    image: "",
    title: "The tools are already on",
    body: "*Developer Tools* is switched on for you, which reveals the *page inspector*, the *overlay inspector* and unsigned repositories. Turn it off here and they all go quiet.",
  },
  {
    id: "gamer-play",
    kind: "step",
    order: 800,
    presets: ["gamer"],
    appState: { view: "timeline" },
    anchor: "rail-group-preset-gamer",
    side: "right",
    mobileSide: "top",
    image: "",
    title: "Games that settle on chain",
    body: "*Games* holds three to start with, and the *Game Center* catalogue is switched on, so more arrive without you going looking.",
  },

  {
    id: "end",
    kind: "end",
    order: 9000,
    presets: "always",
    appState: { view: "timeline" },
    image: "",
    title: "", // written from the chosen presets — see `endCopy`
    body: "",
  },
];

/**
 * The most cards a run can hold, start and end included.
 *
 * Ten rather than nine: the four everybody gets plus one per preset is eight,
 * and somebody who picks all four presets should not have the fourth silently
 * go unexplained to keep a round number.
 */
export const MAX_TOUR_CARDS = 10;

/**
 * The run of cards for a set of chosen presets.
 *
 * Deduped by `id`, sorted by `order`, and always opening and closing with the
 * two that belong to every run.
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
  return run.sort((a, b) => a.order - b.order).slice(0, MAX_TOUR_CARDS);
}

/** The list of chosen preset names, as a sentence fragment. */
function presetNames(chosen: PresetId[]): string {
  const names = presets
    .filter((preset) => chosen.includes(preset.id))
    .map((preset) => preset.title);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What the opening card says, which depends on what was picked.
 *
 * Written here rather than stored on the card because it is the one piece of
 * copy that cannot be fixed in advance: it names the answer somebody just gave.
 */
export function startCopy(chosen: PresetId[]): {
  title: string;
  body: string;
} {
  if (chosen.length === 0) {
    return {
      title: "Welcome to Nexus",
      body: "You skipped the presets, so this is the plain setup: a *handle*, an *inbox*, a *wallet* and a *vault*. Two minutes on what each of them is for.",
    };
  }
  return {
    title: `Set up for ${presetNames(chosen)}`,
    body: `Your apps are on the *rail* and your sources are switched on. Two minutes on what you just got, and on the four things everybody here uses.`,
  };
}

/** What the closing card says. */
export function endCopy(chosen: PresetId[]): { title: string; body: string } {
  if (chosen.length === 0) {
    return {
      title: "That is the whole thing",
      body: "Everything else is a preset away. Open *Preferences* and run the welcome again whenever you want a different setup.",
    };
  }
  return {
    title: "That is the whole thing",
    body: `You are set up for *${presetNames(chosen)}*. Change your mind and *Preferences* will run the welcome again with a different answer.`,
  };
}

/**
 * Which footer buttons a card shows.
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
