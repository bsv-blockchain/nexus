/**
 * table: tokens — what the wallet can hold and what a command can move.
 *
 * BSV is the base currency: it is the default for any bare amount, it is what
 * satoshis denominate, and every other token's value is quoted through it.
 * Ecosystem tokens inherit their issuer's mark, so a NUTRI amount carries the
 * same Mycelia glyph a Mycelia handle does and the provenance is legible
 * without a legend.
 *
 * Note on the grammar: BRC-218 section 3 defines `amount = fiat / sats` only,
 * so token-denominated amounts are an extension beyond the spec rather than
 * part of it. Global verbs keep their specified behaviour for fiat and satoshi
 * amounts; tokens ride the same syntax position.
 */
import { FALLBACK_USD_PER_BSV } from "@/lib/exchange-rate";
import type { Token } from "./types";

export const tokens: Token[] = [
  {
    id: "bsv",
    symbol: "BSV",
    name: "Bitcoin SV",
    ecosystem: null,
    icon: "/tokens/bsv.svg",
    color: "#EAB300",
    decimals: 8,
    base: true,
    protocol: "BSV Blockchain",
    protocolUrl: "https://bsvblockchain.org",
    issuer: "Satoshi",
    issuerUrl:
      "https://hub.bsvblockchain.org/higher-learning/bsv-academy/bitcoin-whitepaper-series",
    blurb: "Peer to Peer Electronic Cash",
    /* Ignored. BSV is the one asset in this table with a real price, so it is
       read from the market instead — see `usdPerUnitOf` in lib/wallet.ts and
       lib/exchange-rate.ts. Left here because `Token` requires it and because
       a zero would be a claim. */
    usdPerUnit: FALLBACK_USD_PER_BSV,
    change24h: 1.2,
  },
  {
    id: "eursv",
    symbol: "EURsv",
    name: "Euro Stablecoin",
    ecosystem: null,
    icon: "/tokens/eursv.svg",
    color: "#3D5AE0",
    decimals: 2,
    protocol: "BSV-21",
    peg: { currency: "EUR", note: "1 EURsv = €1.00 · fully backed" },
    flag: "eu",
    blurb:
      "A euro-denominated stablecoin on BSV. The rail the Common Source bond-token pledges have been waiting on.",
    usdPerUnit: 1.08,
    change24h: 0.02,
  },
  {
    id: "usdsv",
    symbol: "USDsv",
    name: "US Dollar Stablecoin",
    ecosystem: null,
    icon: "/tokens/usdsv.svg",
    color: "#2E7D5B",
    decimals: 2,
    protocol: "BSV-21",
    peg: { currency: "USD", note: "1 USDsv = $1.00 · fully backed" },
    flag: "us",
    blurb:
      "A dollar-denominated stablecoin on BSV. The default rail for anyone who still thinks in dollars.",
    usdPerUnit: 1,
    change24h: 0,
  },
  {
    id: "nutri",
    symbol: "NUTRI",
    name: "Nutrient Credits",
    ecosystem: "mycelia",
    icon: null,
    color: "#00b34c",
    decimals: 0,
    protocol: "BSV-21",
    blurb:
      "Earned by growers for verified nutrient-density readings, and spent on lab work and sample kits.",
    usdPerUnit: 0.15,
    change24h: -0.8,
  },
  {
    id: "nex",
    symbol: "NEX",
    name: "Nexus Credits",
    ecosystem: "nexus",
    /* The wordmark rather than the ecosystem's app tile, which is a square
       picture with its own background and showed its corners inside a round
       mark. This one is a glyph on nothing, so it gets a plate. */
    icon: "/icons/Nexus-logo-white.svg",
    plate: "#000000",
    color: "#4353ff",
    decimals: 2,
    protocol: "BSV-21",
    blurb: "Prepaid credits for on-chain publishing, storage and network fees.",
    usdPerUnit: 0.42,
    change24h: 3.1,
  },
];

/** What the signed-in user holds. Balances are units, not satoshis. */
/**
 * What each wallet holds, rather than what "the wallet" holds.
 *
 * Per account because a wallet IS a balance — a switcher that changes the name
 * above the number and not the number is a switcher that does nothing. The four
 * read as four different jobs, which is the point of having four:
 *
 *   Everyday    a hundred dollars or so of BSV and a little of everything else
 *   Cold storage the base asset and nothing else, because savings do not shop
 *   Work         invoiced in and out, so mostly held in the pegged stablecoins
 *   Household    all but empty, in the credits the apps charge in
 *
 * `units` is the token's own unit throughout — see `Token.decimals`. A second
 * chain arrives as more rows here against a token that declares it, rather than
 * as a second table; the accountId is what keeps that honest.
 */
export const tokenBalances: {
  accountId: string;
  tokenId: string;
  units: number;
}[] = [
  /* Everyday — 5.88 BSV is about $100 at the fallback rate. */
  { accountId: "acct-main", tokenId: "bsv", units: 5.8824 },
  { accountId: "acct-main", tokenId: "usdsv", units: 42 },
  { accountId: "acct-main", tokenId: "nex", units: 310 },

  /* Cold storage — one asset, a lot of it, and nothing that moves. */
  { accountId: "acct-cold", tokenId: "bsv", units: 120 },

  /* Work — a float in BSV, and the money it invoices in. */
  { accountId: "acct-work", tokenId: "bsv", units: 1.485 },
  { accountId: "acct-work", tokenId: "usdsv", units: 320 },
  { accountId: "acct-work", tokenId: "eursv", units: 240 },

  /* Household — nearly nothing, in the credits it spends on apps. */
  { accountId: "acct-shared", tokenId: "bsv", units: 0.0214 },
  { accountId: "acct-shared", tokenId: "nutri", units: 1240 },
];
