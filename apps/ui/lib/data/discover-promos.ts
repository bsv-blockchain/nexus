/**
 * The seed for Discover's two promotional rows — a banner that pitches a
 * whole third-party source, and a collection that pitches connecting
 * everything it ships at once. Both point at a real `AppRepository` id;
 * nothing here names a publisher or an app that is not already in the
 * catalogue.
 *
 * "Seed" rather than "the list": lib/admin-store.ts reads this exactly once,
 * the first time a profile ever opens Store Admin, and owns the mutable
 * result from then on — including adding a fourth campaign or removing one
 * of these three. This file is where a fresh install starts, not a ceiling
 * on what can exist.
 *
 * Scoped to the three sources Manage already calls out as third-party
 * (see lib/data/repositories.ts): Handcash, Open Protocol Labs and Game
 * Center. Nexus Signature Apps and BSV Association are Nexus's own — there
 * is nothing to advertise about a source you already are, though an admin
 * is free to add a campaign for either later if that ever changes.
 */

export interface SeedBanner {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  /** hero art; a repo with none falls back to its own accent + mark */
  art?: string;
  /** which of `SLOT_COUNT` positions this starts assigned to */
  slot: number;
}

export interface SeedCollection {
  id: string;
  repoId: string;
  headline: string;
  subhead: string;
  slot: number;
}

/**
 * Positions on Discover's front page, not campaigns — three of each row show
 * today because three third-party sources exist, not because three is a
 * ceiling. A fourth campaign assigned to a slot that already has one does not
 * get a fourth card; it competes for that slot, and `priority` in
 * lib/admin-store.ts decides which one actually shows. See
 * `winningCampaigns` there for the rule.
 */
export const SLOT_COUNT = 3;

export const seedBanners: SeedBanner[] = [
  {
    id: "banner-handcash",
    repoId: "repo-handcash",
    headline: "HandCash",
    subhead: "The wallet a generation of BSV games and apps already speak.",
    art: "/app-repos/handcash.jpg",
    slot: 1,
  },
  {
    id: "banner-1sat",
    repoId: "repo-1sat",
    headline: "Open Protocol Labs",
    subhead: "Ordinals, inscriptions, and the tools built to read them.",
    art: "/app-repos/open-protocol-labs.jpg",
    slot: 2,
  },
  {
    id: "banner-catallaxy",
    repoId: "repo-catallaxy",
    headline: "Game Center",
    subhead: "On-chain games — switched off by default. See what's there.",
    slot: 3,
  },
];

export const seedCollections: SeedCollection[] = [
  {
    id: "collection-handcash",
    repoId: "repo-handcash",
    headline: "Everything from HandCash",
    subhead: "Connect every app this source ships, in one go.",
    slot: 1,
  },
  {
    id: "collection-1sat",
    repoId: "repo-1sat",
    headline: "Everything from Open Protocol Labs",
    subhead: "Connect every app this source ships, in one go.",
    slot: 2,
  },
  {
    id: "collection-catallaxy",
    repoId: "repo-catallaxy",
    headline: "Everything from Game Center",
    subhead: "Connect every app this source ships, in one go.",
    slot: 3,
  },
];

/**
 * What a slot is worth, by placement type — the reference an admin quotes
 * from rather than inventing a number per campaign. Still a label, not a
 * charge: see lib/admin-store.ts for why nothing here moves real money.
 */
export type PlacementType = "banner" | "collection";

export const rateCard: Record<
  PlacementType,
  { label: string; priceLabel: string; description: string }
> = {
  banner: {
    label: "Discover Banner",
    priceLabel: "$600/mo",
    description:
      'Full-width hero card in "Discover More Sources" — one of three rotating slots on Discover\'s front page.',
  },
  collection: {
    label: "Connect-All Collection",
    priceLabel: "$350/mo",
    description:
      'One-click bulk-connect card in "Connect a Whole Source at Once" — one of three rotating slots on Discover\'s front page.',
  },
};
