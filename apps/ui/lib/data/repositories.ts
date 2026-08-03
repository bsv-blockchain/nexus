/**
 * table: app_repositories — sources the App Store pulls app listings from.
 *
 * `defaultRepositories` are the repos enabled out of the box (the official
 * ones can't be removed, only toggled). `suggestedRepositories` are well-known
 * repos a user can add from the picker; anything else is added by raw URL.
 */

export interface AppRepository {
  id: string;
  name: string;
  url: string;
  /** Official repos are always present — toggleable but not removable. */
  official: boolean;
  enabled: boolean;
}

export const defaultRepositories: AppRepository[] = [
  {
    id: "repo-1sat",
    name: "bOpen apps",
    url: "https://ordinals.gorillapool.io/registry",
    official: false,
    enabled: true,
  },
  {
    id: "repo-nexus",
    name: "Nexus Official",
    url: "https://apps.nexus.build/registry",
    official: true,
    enabled: true,
  },
  {
    id: "repo-bsv",
    name: "BSV Association",
    url: "https://apps.bsvblockchain.org/registry",
    official: true,
    enabled: true,
  },
];

/** Known repos offered in the "add from a list" picker (not enabled yet). */
export const suggestedRepositories: { name: string; url: string }[] = [
  { name: "Project Babbage", url: "https://apps.metanet.io/registry" },
  { name: "Catallaxy Capital", url: "https://market.handcash.io/registry" },
];
