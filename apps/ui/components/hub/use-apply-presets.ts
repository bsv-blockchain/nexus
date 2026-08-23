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
import {
  appsFor,
  developerModeFor,
  railPlanFor,
  reposFor,
  ALWAYS_APPS,
  type PresetId,
} from "@/lib/data/presets";
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
