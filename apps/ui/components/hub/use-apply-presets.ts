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
  managedApps,
  railPlanFor,
  reposFor,
  ALWAYS_APPS,
  type PresetId,
} from "@/lib/data/presets";
import type { RailEntry } from "@/lib/rail/layout";
import type { HubAppSlug } from "@/lib/data/types";
import { getHubApps, type AppRepository } from "@/lib/data";
import { setDeveloperMode } from "@/lib/developer-mode";
import {
  getRepositoriesSnapshot,
  setRepositories,
} from "@/lib/repositories-store";
import { useCallback } from "react";

export function useApplyPresets(): (chosen: PresetId[]) => void {
  const { installApp, uninstallApp, applyRailPlan, activeSpaceId } = useHub();

  return useCallback(
    (chosen: PresetId[]) => {
      const wantedApps = appsFor(chosen);

      /*
       * Clear out first, so the profile is the answer and not the answer piled
       * on top of the last one.
       *
       * Two sets go, and only from the active profile:
       *
       *   - apps a preset could have installed, when the new choice does not
       *     want them. Picking Thinker and later re-running as a Gamer should
       *     not leave Mail and Sign behind with no folder to live in.
       *   - everything from a third-party developer. Somebody re-running the
       *     welcome is asking for the workspace this preset describes, not that
       *     workspace with whatever they had connected still hanging off it.
       *
       * Nexus's own apps that no preset manages — Roadmap, say — are left
       * alone. They were not installed by an answer to this question, so they
       * are not this question's to remove.
       */
      const doomed = new Set<HubAppSlug>(managedApps());
      for (const app of getHubApps()) {
        if (app.developer === "third-party") doomed.add(app.slug);
      }
      for (const slug of doomed) {
        if (!wantedApps.includes(slug)) uninstallApp(slug, activeSpaceId);
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
    [installApp, uninstallApp, applyRailPlan, activeSpaceId]
  );
}
