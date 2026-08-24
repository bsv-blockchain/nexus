"use client";

/**
 * Make a workspace, and dress it.
 *
 * Two providers have to agree for a new workspace to arrive looking like
 * anything: the hub knows which names and marks are taken, and the theme store
 * knows which colours are. They cannot be asked in one place — the theme store
 * is mounted INSIDE the hub, so the hub cannot read it — so the seam is here,
 * in a hook that every "New Workspace" control calls instead of `createSpace`.
 *
 * @see lib/data/workspace-defaults.ts — the ten themes, the ten adjectives
 */

import { useHub } from "@/components/hub/hub-provider";
import { useCustomTheme } from "@/components/hub/theme-provider";
import {
  pickUnused,
  STANDARD_THEMES,
  type StandardTheme,
} from "@/lib/data/workspace-defaults";
import { useCallback } from "react";

export function useCreateWorkspace(): () => string {
  const { createSpace, spaces } = useHub();
  const { profileTheme, setProfileTheme } = useCustomTheme();

  return useCallback(() => {
    const id = createSpace();
    /* By id rather than by colour: two workspaces could be wearing the same
       stops through a hand-made theme, and what matters here is which of the
       ten standard ones is spoken for. */
    const taken = new Set<string>();
    for (const space of spaces) {
      const colors = profileTheme(space.id);
      if (!colors) continue;
      const key = colors.join(",");
      const match = STANDARD_THEMES.find(
        (theme) => theme.colors.join(",") === key,
      );
      if (match) taken.add(match.id);
    }
    /* Drawn once and then looked up. Calling `pickUnused` inside the predicate
       re-rolls it for every candidate, so `find` compares each id against a
       different random answer and usually matches nothing. */
    const chosen = pickUnused(
      STANDARD_THEMES.map((standard) => standard.id),
      taken,
    );
    const theme: StandardTheme =
      STANDARD_THEMES.find((entry) => entry.id === chosen) ??
      STANDARD_THEMES[0]!;
    setProfileTheme(id, theme.colors);
    return id;
  }, [createSpace, spaces, profileTheme, setProfileTheme]);
}
