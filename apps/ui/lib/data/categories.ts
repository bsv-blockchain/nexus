import type { StoreCategory } from "./types";

/**
 * table: app_categories — the shelves the store filter offers.
 *
 * Alphabetical, with Other last. Any other order is an editorial claim about
 * which kind of app matters most, and a filter is not the place to make one —
 * somebody looking for Gaming should find it where the alphabet says it is.
 * "Other" is the exception, because a catch-all read in sequence looks like a
 * category with a name nobody can remember.
 */
export interface StoreCategoryInfo {
  id: StoreCategory;
  label: string;
  /** one line under the label, saying what you would find there */
  description: string;
}

export const storeCategories: StoreCategoryInfo[] = [
  {
    id: "block-explorers",
    label: "Block explorers",
    description: "Browse BSV blocks",
  },
  {
    id: "collectibles",
    label: "Collectibles",
    description: "Digital collectibles on BSV",
  },
  {
    id: "education",
    label: "Education",
    description: "Learn about BSV",
  },
  {
    id: "exchanges",
    label: "Exchanges",
    description: "Buy, sell, and trade BSV",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Financial applications on BSV",
  },
  {
    id: "gaming",
    label: "Gaming",
    description: "Play games and earn BSV",
  },
  {
    id: "marketplaces",
    label: "Marketplaces",
    description: "Buy and sell goods with BSV",
  },
  {
    id: "media",
    label: "Media",
    description: "Metanet first media and content",
  },
  {
    id: "productivity",
    label: "Productivity",
    description: "Productivity tools and time-savers",
  },
  {
    id: "social",
    label: "Social",
    description: "Connect with other BSV users",
  },
  {
    id: "wallets",
    label: "Wallets",
    description: "Interface to manage your BSV or Tokens",
  },
  {
    /* Last, and phrased as a shelf rather than an apology: the apps here are
       not lesser, they are the ones the other eleven names would misdescribe. */
    id: "other",
    label: "Other",
    description: "Everything the other shelves don't quite describe",
  },
];
