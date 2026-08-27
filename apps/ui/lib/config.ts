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
  /**
   * Whether developer surfaces are revealed across the app.
   *
   * Persisted, unlike everything in the settings store: that store's rule is
   * about not remembering a policy it cannot enforce, and this is not a policy
   * — it is whether you are shown a panel. Re-ticking it after every reload
   * while building against it would be the only thing it reliably did.
   */
  developerMode: "nexus.developer-mode",
  /** which first-run presets this install was set up with */
  presets: "nexus.presets",
  /** splits raised here, and the share statuses set on any of them */
  splits: "nexus.splits",
  /** true once the Guided Tour has been finished or skipped */
  tourTaken: "nexus.tour-taken",
  /** true once the help circle has been hovered, which stops it pulsing */
  helpSeen: "nexus.help-seen",
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
