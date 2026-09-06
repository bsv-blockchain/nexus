/**
 * Discover's two promotional rows — a banner that pitches a whole third-party
 * source, and a collection that pitches connecting everything it ships at
 * once. Both point at a real `AppRepository` id; nothing here names a
 * publisher or an app that is not already in the catalogue.
 *
 * Seeded fixture content. `lib/admin-store.ts` holds the mutable overlay a
 * fresh install starts from this and can then edit — sponsorship, an
 * advertiser, a price, whether it is switched on at all — through the Store
 * Admin app. This file is the honest starting point, not the live answer.
 *
 * Scoped to the three sources Manage already calls out as third-party
 * (see lib/data/repositories.ts): Handcash, Open Protocol Labs and Game
 * Center. Nexus Signature Apps and BSV Association are Nexus's own — there
 * is nothing to advertise about a source you already are.
 */

export interface FeaturedBanner {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  /** hero art; a repo with none falls back to its own accent + mark */
  art?: string;
}

export interface FeaturedCollection {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
}

export const featuredBanners: FeaturedBanner[] = [
  {
    id: "banner-handcash",
    repoId: "repo-handcash",
    headline: "HandCash",
    subhead: "The wallet a generation of BSV games and apps already speak.",
    art: "/app-repos/handcash.jpg",
  },
  {
    id: "banner-1sat",
    repoId: "repo-1sat",
    headline: "Open Protocol Labs",
    subhead: "Ordinals, inscriptions, and the tools built to read them.",
    art: "/app-repos/open-protocol-labs.jpg",
  },
  {
    id: "banner-catallaxy",
    repoId: "repo-catallaxy",
    headline: "Game Center",
    subhead: "On-chain games — switched off by default. See what's there.",
  },
];

export const featuredCollections: FeaturedCollection[] = [
  {
    id: "collection-handcash",
    repoId: "repo-handcash",
    headline: "Everything from HandCash",
    subhead: "Connect every app this source ships, in one go.",
  },
  {
    id: "collection-1sat",
    repoId: "repo-1sat",
    headline: "Everything from Open Protocol Labs",
    subhead: "Connect every app this source ships, in one go.",
  },
  {
    id: "collection-catallaxy",
    repoId: "repo-catallaxy",
    headline: "Everything from Game Center",
    subhead: "Connect every app this source ships, in one go.",
  },
];
