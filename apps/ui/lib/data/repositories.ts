/**
 * table: app_repositories — sources the App Store pulls app listings from.
 *
 * `defaultRepositories` are the repos enabled out of the box (the official
 * ones can't be removed, only toggled). `suggestedRepositories` are well-known
 * repos a user can add from the picker; anything else is added by raw URL.
 */

/**
 * One published state of a repository's catalogue.
 *
 * Newest first. Selecting an older one shows the catalogue as it stood then —
 * which is just the apps published on or before its date, so nothing here has
 * to carry a list that can fall out of step with the apps table.
 */
export interface RepoVersion {
  version: string;
  /** ISO date it was published */
  releasedAt: string;
}

export interface AppRepository {
  id: string;
  name: string;
  /** the registry endpoint the store reads */
  url: string;
  /** where a person goes to read about who runs this; the header links here */
  website?: string;
  /** the repo's mark; without one the header draws a generated one */
  iconSrc?: string;
  /** published catalogue states, newest first */
  versions?: RepoVersion[];
  /** Official repos are always present — toggleable but not removable. */
  official: boolean;
  /**
   * What this source is for, in two or three words.
   *
   * Sits right-aligned on the address line rather than as a badge by the name.
   * "Official" is a claim about who runs a source; these say what you get from
   * it, which is a different question and a quieter one.
   */
  note?: string;
  enabled: boolean;
}

export const defaultRepositories: AppRepository[] = [
  {
    id: "repo-nexus",
    name: "Nexus Official",
    url: "https://apps.nexus.build/registry",
    official: true,
    note: "Signature apps",
    website: "https://nexus.build",
    iconSrc: "/icons/Nexus-logo-solid-BG2.png",
    versions: [
      { version: "2026.08", releasedAt: "2026-08-06T09:00:00.000Z" },
      { version: "2026.06", releasedAt: "2026-06-18T09:00:00.000Z" },
      { version: "2026.03", releasedAt: "2026-03-02T09:00:00.000Z" },
      { version: "2026.01", releasedAt: "2026-01-10T09:00:00.000Z" },
    ],
    enabled: true,
  },
  {
    id: "repo-bsv",
    name: "BSV Association",
    url: "https://apps.bsvblockchain.org/registry",
    official: true,
    note: "More from BSVA",
    website: "https://bsvblockchain.org",
    /* The association's own mark rather than the generated "B". A source is
       chosen by sight in a list of five, and a letter in a box is what every
       source without an icon already looks like. */
    iconSrc: "/icons/bsv-association.png",
    versions: [
      { version: "2026.06", releasedAt: "2026-06-18T09:00:00.000Z" },
      { version: "2026.04", releasedAt: "2026-04-15T09:00:00.000Z" },
      { version: "2026.03", releasedAt: "2026-03-02T09:00:00.000Z" },
      { version: "2026.01", releasedAt: "2026-01-10T09:00:00.000Z" },
    ],
    enabled: true,
  },
  /* Under the two official ones, because that is the order of how much anybody
     has checked: ours, the association's, then somebody else's. */
  {
    id: "repo-handcash",
    name: "Handcash",
    url: "https://handcash.io/registry",
    official: false,
    note: "Featured 3rd party",
    website: "https://handcash.io",
    versions: [
      { version: "2026.04", releasedAt: "2026-04-15T09:00:00.000Z" },
      { version: "2026.03", releasedAt: "2026-03-02T09:00:00.000Z" },
    ],
    enabled: true,
  },
  {
    id: "repo-1sat",
    name: "Open Protocol Labs",
    url: "https://openprotocollabs.com/registry",
    official: false,
    note: "Featured 3rd party",
    website: "https://openprotocollabs.com",
    iconSrc: "/icons/open-protocol-labs.svg",
    versions: [
      { version: "2026.06", releasedAt: "2026-06-01T09:00:00.000Z" },
      { version: "2026.05", releasedAt: "2026-05-20T09:00:00.000Z" },
      { version: "2026.01", releasedAt: "2026-01-10T09:00:00.000Z" },
    ],
    enabled: true,
  },
  /*
   * Present but switched off.
   *
   * The only source here that has to be turned on before it serves anything,
   * which is the one thing the other four cannot demonstrate: that a repo is a
   * subscription and not just a heading. Somebody who never touches it sees a
   * store of four vetted sources; somebody who does gets a fifth and can watch
   * where its listings land.
   */
  {
    /* `id` stays `repo-catallaxy`: it is the key a saved subscription is
       written under, and the apps below point at it. Renaming it would drop
       this source for anybody who had already switched it on. */
    id: "repo-tlon",
    name: "Tlon.cc",
    url: "https://tlon.cc/registry",
    official: false,
    note: "Community catalogue",
    website: "https://tlon.cc",
    versions: [
      { version: "2026.08", releasedAt: "2026-08-14T09:00:00.000Z" },
      { version: "2026.06", releasedAt: "2026-06-03T09:00:00.000Z" },
    ],
    /* On by default, unlike Game Center below. One community source switched on
       and one switched off is the pair that shows the difference: the store has
       something from outside the official repos in it out of the box, and there
       is still a source to turn on and watch land. */
    enabled: true,
  },
  {
    id: "repo-catallaxy",
    name: "Game Center",
    url: "https://gamecenter.dev/registry",
    official: false,
    note: "Community catalogue",
    website: "https://gamecenter.dev",
    versions: [
      { version: "2026.07", releasedAt: "2026-07-22T09:00:00.000Z" },
      { version: "2026.05", releasedAt: "2026-05-20T09:00:00.000Z" },
    ],
    enabled: false,
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
];
