/**
 * ============================================================================
 * APP CONFIGURATION
 * ============================================================================
 *
 * Runtime settings for the Nexus shell. User-visible copy lives in
 * lib/data/content.ts; structural data lives in the other lib/data modules.
 */

export const themeConfig = {
  defaultTheme: "dark" as "light" | "dark" | "system",
  enableSystemTheme: true,
};

/** localStorage keys for client-persisted UI state */
export const storageKeys = {
  installedApps: "nexus.installed-apps",
  repositories: "nexus.app-repositories",
  /** what Messages anchors, globally and per conversation */
  chainPolicy: "nexus.chain-policy",
} as const;
