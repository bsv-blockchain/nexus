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
    protocol: "native",
    blurb:
      "The base currency. Amounts without a token are BSV, and satoshis are its smallest unit.",
    usdPerUnit: 72.5,
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
    icon: null,
    color: "#4353ff",
    decimals: 2,
    protocol: "BSV-21",
    blurb: "Prepaid credits for on-chain publishing, storage and network fees.",
    usdPerUnit: 0.42,
    change24h: 3.1,
  },
];

/** What the signed-in user holds. Balances are units, not satoshis. */
export const tokenBalances: { tokenId: string; units: number }[] = [
  { tokenId: "bsv", units: 34.2180455 },
  { tokenId: "usdsv", units: 320 },
  { tokenId: "eursv", units: 240 },
  { tokenId: "nutri", units: 1240 },
  { tokenId: "nex", units: 310 },
];
