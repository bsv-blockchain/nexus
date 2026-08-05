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
    name: "Open Protocol Labs",
    url: "https://openprotocollabs.com/registry",
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

/**
 * Known repos offered in the "add from a list" picker, and from the URL field
 * itself (not enabled yet).
 *
 * Third-party every one of them: none is vetted by Nexus or the BSV
 * Association, which is why adding one goes through a confirmation rather than
 * a toggle. They are offered at all so that somebody who has never seen a
 * registry URL has something to try instead of a blank box.
 */
export const suggestedRepositories: { name: string; url: string }[] = [
  { name: "Project Babbage", url: "https://apps.metanet.io/registry" },
  { name: "Catallaxy Capital", url: "https://market.handcash.io/registry" },
  { name: "1Sat Market", url: "https://ordinals.gorillapool.io/registry" },
];
