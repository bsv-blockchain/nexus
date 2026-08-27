/**
 * table: presets — the setups offered at the end of the first run.
 *
 * A preset is a description of a finished workspace, not a script that builds
 * one. Everything it does is declared here as data: which apps arrive, what
 * folder they land in on the rail, which app sources are switched on, and which
 * settings are flipped. Adding an app to a preset is one line in this file, and
 * nothing else in the app has to be told.
 *
 * That matters because presets combine. Somebody can take Thinker and Gamer
 * together, and the result has to be the union of the two with no duplicates
 * and no argument about ordering — which is a thing you can compute from data
 * and not from four functions that each install their own apps.
 *
 * @see lib/presets-store.ts — applies one of these to a workspace
 * @see lib/data/tour.ts — the Guided Tour cards each preset contributes
 */

import type { HubAppSlug } from "./types";

export type PresetId = "thinker" | "maker" | "developer" | "gamer";

/**
 * The apps every install gets, in rail order, whatever is chosen.
 *
 * Ahead of any preset's folders, because these are what Nexus is rather than
 * what you picked — a rail whose first tile moves depending on an answer given
 * once is a rail nobody can build a habit on.
 */
export const ALWAYS_APPS: HubAppSlug[] = [
  "identity",
  "messages",
  "browser",
  "connect",
  "wallet",
  "vault",
  /* Last, and always. It was already essential and default-installed, so it
     could never be removed — but it was not named here, which left it appended
     after the preset folders by whatever order the rail happened to reconcile.
     Named, it has a place instead of a leftover position. */
  "roadmap",
];

/**
 * The app every preset puts on the rail under its folder.
 *
 * Named here rather than repeated in each preset so "shown once however many
 * presets are chosen" is a property of the data instead of a rule the applier
 * has to remember. See `railPlanFor`, which places it exactly once.
 */
export const SHARED_SINGLES: HubAppSlug[] = ["bsv-radar"];

/**
 * The catalogue those shared singles are served from.
 *
 * Paired with `SHARED_SINGLES` rather than written into each preset's `repos`,
 * for the same reason the app is: which source carries BSV Radar is a fact
 * about BSV Radar, not about Thinker. Any preset brings the app, so any preset
 * has to bring the source too, or the rail ends up holding a listing the store
 * has stopped showing.
 *
 * Not reversible, unlike a preset's own `repos` — see `ownReposFor`.
 */
export const SHARED_REPOS: string[] = ["repo-tlon"];

export interface Preset {
  id: PresetId;
  /** shown on the tile and as the headline when focused */
  title: string;
  /** one line under the headline */
  tagline: string;
  /** what this setup is for, read before choosing it */
  blurb: string;
  /** looping clip behind the tile and the stage */
  video: string;
  /** the hue the whole screen grades to while this one is focused */
  accent: string;
  /**
   * The folder this preset adds to the rail.
   *
   * `id` is stable and namespaced so two presets cannot collide on it, and so
   * re-running the first run replaces a folder rather than adding a second with
   * the same name.
   */
  group: { id: string; name: string; apps: HubAppSlug[] };
  /** app repositories this preset switches on, by repo id */
  repos?: string[];
  /** settings this preset turns on */
  developerMode?: boolean;
}

/**
 * The four, in the order they are offered.
 *
 * Order is the array's, not a field: a `sort` key would be a second place for
 * the order to live and a chance for the two to disagree.
 */
export const presets: Preset[] = [
  {
    id: "thinker",
    title: "Thinker",
    tagline: "Read, write, keep",
    blurb: "Post, sign what you send, and keep a library worth coming back to.",
    video: "/first-run/presets/thinker.mp4",
    accent: "#6366f1",
    group: {
      id: "preset-thinker",
      name: "Productivity",
      apps: ["mail", "signer", "learn", "clndr"],
    },
  },
  {
    id: "maker",
    title: "Maker",
    tagline: "Make it, sell it",
    blurb:
      "Publish what you make and put it in front of people who will pay for it.",
    video: "/first-run/presets/maker.mp4",
    accent: "#f97316",
    group: {
      id: "preset-maker",
      name: "Publish",
      apps: ["publisher", "market", "omnibazaar"],
    },
  },
  {
    id: "developer",
    title: "Developer",
    tagline: "Build on the chain",
    blurb:
      "Read transactions, prove things about them, and see what your apps hold.",
    video: "/first-run/presets/developer.mp4",
    accent: "#22d3ee",
    group: {
      id: "preset-developer",
      name: "Build",
      apps: ["tx-viewer", "attestations", "baskets"],
    },
    /* The whole Developer Tools section in Preferences, on from the start:
       somebody who picked this preset has said what they are here for. */
    developerMode: true,
  },
  {
    id: "gamer",
    title: "Gamer",
    tagline: "Play for stakes",
    blurb:
      "Games that settle on chain, from a catalogue that keeps adding them.",
    video: "/first-run/presets/gamer.mp4",
    accent: "#ec4899",
    group: {
      id: "preset-gamer",
      name: "Games",
      apps: ["pixel-war", "pelf", "cookie-clucker"],
    },
    /* The games come from a community source that ships switched off. Picking
       this preset is the answer to the question that switch asks. */
    repos: ["repo-catallaxy"],
  },
];

export function getPreset(id: PresetId): Preset | undefined {
  return presets.find((preset) => preset.id === id);
}

/** One rail folder, or one loose tile, in the order it should be placed. */
export type PresetRailEntry =
  | { type: "group"; id: string; name: string; apps: HubAppSlug[] }
  | { type: "single"; app: HubAppSlug };

/**
 * What the rail should hold for a set of chosen presets.
 *
 * Folders first in preset order, then the shared singles once — which is where
 * "show BSV Radar only once however many presets are picked" is actually
 * enforced, rather than in four places that each try to remember.
 *
 * The always-on apps are not here: they are placed by the applier ahead of all
 * of this, and putting them in the same list would let a preset reorder them.
 */
export function railPlanFor(chosen: PresetId[]): PresetRailEntry[] {
  const entries: PresetRailEntry[] = [];
  for (const preset of presets) {
    if (!chosen.includes(preset.id)) continue;
    entries.push({ type: "group", ...preset.group });
  }
  /* Only when something was chosen. With no preset there is no folder for a
     loose tile to sit under, and an app on its own below nothing is just an
     app nobody asked for. */
  if (entries.length > 0) {
    for (const app of SHARED_SINGLES) entries.push({ type: "single", app });
  }
  return entries;
}

/** Every app a set of presets installs, deduped, in rail order. */
export function appsFor(chosen: PresetId[]): HubAppSlug[] {
  const seen = new Set<HubAppSlug>(ALWAYS_APPS);
  const out: HubAppSlug[] = [...ALWAYS_APPS];
  for (const entry of railPlanFor(chosen)) {
    const apps = entry.type === "group" ? entry.apps : [entry.app];
    for (const app of apps) {
      if (seen.has(app)) continue;
      seen.add(app);
      out.push(app);
    }
  }
  return out;
}

/** Repo ids a preset declares for itself, deduped. */
export function ownReposFor(chosen: PresetId[]): string[] {
  const out = new Set<string>();
  for (const preset of presets) {
    if (!chosen.includes(preset.id)) continue;
    for (const repo of preset.repos ?? []) out.add(repo);
  }
  return [...out];
}

/**
 * Every repo id a set of presets needs switched on, deduped.
 *
 * The declared ones plus the shared catalogue, which any preset needs because
 * every preset brings the app it serves.
 */
export function reposFor(chosen: PresetId[]): string[] {
  const out = new Set<string>(ownReposFor(chosen));
  if (chosen.length > 0) for (const repo of SHARED_REPOS) out.add(repo);
  return [...out];
}

/** True when any chosen preset asks for developer mode. */
export function developerModeFor(chosen: PresetId[]): boolean {
  return presets.some(
    (preset) => chosen.includes(preset.id) && preset.developerMode === true
  );
}
