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
  /** the sites the user pinned to the rail */
  pinnedSites: "nexus.pinned-sites",
  /** what Messages anchors, globally and per conversation */
  chainPolicy: "nexus.chain-policy",
  /** app store sources the reader has shut */
  collapsedRepos: "nexus.collapsed-repos",
  /** sources the Apps surface reads listings from, and which are switched on */
  repositories: "nexus.repositories",
  /**
   * Which apps each profile has connected, as `Record<spaceId, slug[]>`.
   *
   * Named for what it used to be so an existing install is not orphaned. The
   * reader in hub-provider still accepts the flat array this key held before
   * connections became per-profile, and reads it as what every profile had.
   */
  connectedApps: "nexus.installed-apps",
} as const;
