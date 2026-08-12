/**
 * table: handles — the name people reach you by, and the accounts vouching for it.
 *
 * A handle is the one piece of this product everybody else has to type. It is
 * scarce, so changing it costs something: without a price, every good name is
 * taken by the first person to write a script, and nobody who wants one can
 * have it.
 *
 * The linked accounts are the other half of the same idea, borrowed from Vela.
 * A handle says what to call you; an attestation says the account somebody
 * already knows you by belongs to the same key. Neither is worth much alone.
 */

/** What claiming an unused handle costs, in dollars. */
export const HANDLE_CHANGE_USD = 2.18;

/** Nobody needs six. A cap is what stops one person hoarding the good ones. */
export const MAX_HANDLES = 5;

/**
 * A handle somebody else owns and has put a price on.
 *
 * The resale market is the other half of the cap: if you cannot hold more than
 * five, the way a good name reaches somebody who wants it is that the holder
 * sells it rather than sitting on it forever.
 */
export interface HandleListing {
  handle: string;
  /** the seller's person id, so the buyer can see who they are dealing with */
  sellerId: string;
  priceUsd: number;
}

export const handleListings: HandleListing[] = [
  { handle: "deggen", sellerId: "darren-kellenschwiler", priceUsd: 218 },
  { handle: "overlay", sellerId: "connor-murray", priceUsd: 89 },
  { handle: "sats", sellerId: "tw-utxo", priceUsd: 640 },
];

export type SocialProvider = "x" | "github" | "google" | "linkedin";

export interface LinkedAccount {
  id: string;
  provider: SocialProvider;
  /** the account name on that service */
  handle: string;
  /** null while unlinked; an ISO date once the attestation is signed */
  attestedAt: string | null;
}

export const socialProviders: {
  id: SocialProvider;
  label: string;
  domain: string;
  /** the mark, as the service itself writes it */
  mark: string;
  colour: string;
}[] = [
  { id: "x", label: "X", domain: "x.com", mark: "𝕏", colour: "#000000" },
  {
    id: "github",
    label: "GitHub",
    domain: "github.com",
    mark: "GH",
    colour: "#24292f",
  },
  {
    id: "google",
    label: "Google",
    domain: "accounts.google.com",
    mark: "G",
    colour: "#4285f4",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    domain: "linkedin.com",
    mark: "in",
    colour: "#0a66c2",
  },
];

/**
 * One linked, three not.
 *
 * Deliberately not all linked: the state worth showing is the middle one, where
 * a person can see what an attestation buys them and what is still missing.
 */
export const linkedAccounts: LinkedAccount[] = [
  {
    id: "la-x",
    provider: "x",
    handle: "@crumbs",
    attestedAt: "2026-06-18T10:24:00.000Z",
  },
  { id: "la-github", provider: "github", handle: "crumbs", attestedAt: null },
  {
    id: "la-google",
    provider: "google",
    handle: "crumbs@nexus.build",
    attestedAt: null,
  },
  { id: "la-linkedin", provider: "linkedin", handle: "", attestedAt: null },
];

/**
 * Whether a handle can be taken.
 *
 * Deterministic rather than random so the same name gives the same answer every
 * time somebody types it — a checker that changes its mind is worse than none.
 * Short names and obvious ones are taken, which is what makes the good ones
 * scarce and the price meaningful.
 */
const TAKEN = new Set([
  "nexus",
  "bsv",
  "admin",
  "support",
  "wallet",
  "satoshi",
  "crumbs",
  "pay",
  "money",
  "bitcoin",
  "help",
  "root",
]);

/** Names for sale count as taken: you buy them, you do not claim them. */
export function listingFor(handle: string): HandleListing | undefined {
  const value = handle.trim().toLowerCase().replace(/^@/, "");
  return handleListings.find((entry) => entry.handle === value);
}

export type HandleCheck =
  | { state: "empty" }
  | { state: "short" }
  | { state: "invalid" }
  | { state: "taken" }
  | { state: "for-sale"; listing: HandleListing }
  | { state: "owned" }
  | { state: "current" }
  | { state: "available" };

export function checkHandle(
  raw: string,
  current: string,
  owned: string[] = [],
): HandleCheck {
  const value = raw.trim().toLowerCase().replace(/^@/, "");
  if (!value) return { state: "empty" };
  if (value === current.toLowerCase()) return { state: "current" };
  if (owned.includes(value)) return { state: "owned" };
  if (!/^[a-z0-9_]+$/.test(value)) return { state: "invalid" };
  if (value.length < 4) return { state: "short" };
  /* For sale is checked before taken, because "somebody has it" and "somebody
     will sell it to you" lead somewhere different. */
  const listing = listingFor(value);
  if (listing) return { state: "for-sale", listing };
  if (TAKEN.has(value)) return { state: "taken" };
  return { state: "available" };
}
