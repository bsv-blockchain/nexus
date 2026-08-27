"use client";

/**
 * Turn a set of chosen presets into a set-up workspace.
 *
 * Everything it does is read from {@link file://../../lib/data/presets.ts}; this
 * only carries it out, in the one order that produces a sensible rail:
 *
 *   1. install every app the choice implies, always-on ones first
 *   2. lay the rail out — the always-on tiles, then a folder per preset, then
 *      the shared singles under them
 *   3. switch on any app sources a preset needs
 *   4. flip any settings a preset asks for
 *
 * Only the active workspace is touched. Re-running the first run to try a
 * different answer should not cost somebody the workspace they had already
 * built, so the others are left exactly as they were.
 */

import { useHub } from "@/components/hub/hub-provider";
import { setSetting } from "@/lib/settings-store";
import { homescreenFor } from "@/lib/home-view";
import {
  appsFor,
  developerModeFor,
  ownReposFor,
  presets,
  railPlanFor,
  reposFor,
  ALWAYS_APPS,
  type PresetId,
} from "@/lib/data/presets";
import { setChosenPresets, useChosenPresets } from "@/lib/presets-store";
import type { RailEntry } from "@/lib/rail/layout";
import { getHubApps, type AppRepository } from "@/lib/data";
import { sameUrl } from "@/lib/tabs";
import { setDeveloperMode } from "@/lib/developer-mode";
import {
  getRepositoriesSnapshot,
  setRepositories,
} from "@/lib/repositories-store";
import { useCallback } from "react";

export function useApplyPresets(): (chosen: PresetId[]) => void {
  const {
    installApp,
    uninstallApp,
    applyRailPlan,
    activeSpaceId,
    installedApps,
    pinnedSites,
    unpinSite,
  } = useHub();

  return useCallback(
    (chosen: PresetId[]) => {
      const wantedApps = appsFor(chosen);

      /* Which screen this person should land on. The rule is in lib/home-view
         beside the one that reads it back, and is tested there. Seeded rather
         than locked: Preferences carries the same choice, and whichever of the
         two was answered most recently is the one that stands. */
      setSetting("homescreen", homescreenFor(chosen));

      /*
       * Clear out first, so the profile is the answer and not the answer piled
       * on top of the last one.
       *
       * Everything not wanted goes, rather than a named subset. Two earlier
       * attempts were too narrow: clearing only the apps some preset lists left
       * anything no preset mentions, and adding "third-party developers" still
       * missed Vote, which is published by the BSV Association. Whose name is
       * on an app says nothing about whether this answer asked for it.
       *
       * `uninstallApp` refuses to remove an essential app, so the six that must
       * survive do, whatever this asks for.
       */
      for (const slug of installedApps) {
        if (!wantedApps.includes(slug)) uninstallApp(slug, activeSpaceId);
      }

      /*
       * A web listing is connected by having its URL pinned, not by being in
       * the installed list — see `isInstalled`. So uninstalling one does
       * nothing at all, which is why Jamify and TonicPow kept their tiles
       * through a first run that was supposed to have cleared them. The site is
       * the thing to remove.
       */
      for (const app of getHubApps()) {
        if (!app.web || wantedApps.includes(app.slug)) continue;
        for (const site of pinnedSites) {
          if (sameUrl(site.url, app.web.url)) unpinSite(site.id);
        }
      }

      /* Installed before the rail is laid out, because `applyRailPlan`
         reconciles its plan against what is actually present and would drop a
         folder naming an app this profile has not got yet. */
      for (const slug of wantedApps) installApp(slug, activeSpaceId);

      const entries: RailEntry[] = [
        ...ALWAYS_APPS.map(
          (slug): RailEntry => ({ type: "single", ref: { kind: "app", slug } })
        ),
        ...railPlanFor(chosen).map(
          (entry): RailEntry =>
            entry.type === "group"
              ? {
                  type: "group",
                  id: entry.id,
                  name: entry.name,
                  members: entry.apps.map((slug) => ({
                    kind: "app" as const,
                    slug,
                  })),
                }
              : { type: "single", ref: { kind: "app", slug: entry.app } }
        ),
      ];
      applyRailPlan(entries);

      /* Additive: a source somebody switched on themselves stays on. A preset
         says what it needs, not what the store should look like. */
      const wanted = reposFor(chosen);
      if (wanted.length > 0) {
        setRepositories(
          getRepositoriesSnapshot().map((repo: AppRepository) =>
            wanted.includes(repo.id) ? { ...repo, enabled: true } : repo
          )
        );
      }

      /* Only ever turned on. Nobody picking Thinker expects it to switch off
         developer tools they had already found and enabled. */
      if (developerModeFor(chosen)) setDeveloperMode(true);
    },
    [
      installApp,
      uninstallApp,
      applyRailPlan,
      activeSpaceId,
      installedApps,
      pinnedSites,
      unpinSite,
    ]
  );
}

/**
 * One preset on or off, from the App Store column.
 *
 * Not `useApplyPresets` with a different argument. That one is the first run's:
 * it clears everything the answer does not name, because the answer IS the
 * workspace at that moment. Doing the same from a settings-shaped column would
 * mean flicking one switch and losing every app somebody had connected by hand
 * since, which is not what a switch on a card promises.
 *
 * So this applies the difference instead, and applies all four of the things a
 * preset is made of rather than only its apps:
 *
 *   1. the apps it adds, or the ones only it wanted
 *   2. its folder on the rail
 *   3. the app sources it needs
 *   4. the settings it flips
 *
 * The rail is rebuilt from the presets that remain rather than edited in place,
 * and `applyRailPlan` appends anything present that the plan forgot — so an app
 * connected by hand keeps its tile through a toggle. A folder made by hand does
 * not survive as a folder; its apps come back as singles.
 */
export function useTogglePreset(): (id: PresetId, on: boolean) => void {
  const chosen = useChosenPresets();
  const {
    installApp,
    uninstallApp,
    applyRailPlan,
    activeSpaceId,
    pinnedSites,
    unpinSite,
  } = useHub();

  return useCallback(
    (id: PresetId, on: boolean) => {
      /* Build order, not tap order — the same rule the picker follows, so a
         rail built here and a rail built by the welcome come out identical. */
      const next = presets
        .map((preset) => preset.id)
        .filter((entry) => (entry === id ? on : chosen.includes(entry)));

      const keep = appsFor(next);
      const going = appsFor([id]).filter((slug) => !keep.includes(slug));

      if (on) {
        for (const slug of keep) installApp(slug, activeSpaceId);
      } else {
        /* Only what nothing else still wants. Maker and Gamer both bring BSV
           Radar; switching one off must not take it from the other. */
        for (const slug of going) uninstallApp(slug, activeSpaceId);
        /* A web listing is connected by having its URL pinned rather than by
           being in the installed list, so uninstalling one does nothing at all
           — the site is the thing to remove. Same trap as the first run's. */
        for (const app of getHubApps()) {
          if (!app.web || !going.includes(app.slug)) continue;
          for (const site of pinnedSites) {
            if (sameUrl(site.url, app.web.url)) unpinSite(site.id);
          }
        }
      }

      const entries: RailEntry[] = [
        ...ALWAYS_APPS.map(
          (slug): RailEntry => ({ type: "single", ref: { kind: "app", slug } })
        ),
        ...railPlanFor(next).map(
          (entry): RailEntry =>
            entry.type === "group"
              ? {
                  type: "group",
                  id: entry.id,
                  name: entry.name,
                  members: entry.apps.map((slug) => ({
                    kind: "app" as const,
                    slug,
                  })),
                }
              : { type: "single", ref: { kind: "app", slug: entry.app } }
        ),
      ];
      applyRailPlan(entries);

      /*
       * Sources and settings follow the remaining presets exactly, in both
       * directions.
       *
       * The first run only ever switches these on, on the grounds that nobody
       * picking Thinker expects their developer tools turned off. A switch is a
       * different promise: leaving Game Center in the store, or the inspectors
       * in every app, after somebody has just switched Gamer or Developer off
       * makes the switch look like it did not work.
       */
      const wanted = reposFor(next);
      /* Only what this preset declared for itself may be switched back off.
         The shared catalogue is in `reposFor` as well, and it ships enabled and
         serves listings that have nothing to do with presets — taking it away
         because somebody turned Gamer off would be a switch reaching further
         than its own card. */
      const touched = ownReposFor([id]);
      setRepositories(
        getRepositoriesSnapshot().map((repo: AppRepository) =>
          wanted.includes(repo.id)
            ? { ...repo, enabled: true }
            : touched.includes(repo.id)
              ? { ...repo, enabled: false }
              : repo
        )
      );
      if (developerModeFor([id])) setDeveloperMode(developerModeFor(next));

      setChosenPresets(next);
    },
    [
      chosen,
      installApp,
      uninstallApp,
      applyRailPlan,
      activeSpaceId,
      pinnedSites,
      unpinSite,
    ]
  );
}
