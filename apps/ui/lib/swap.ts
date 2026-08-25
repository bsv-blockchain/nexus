"use client";

/**
 * One vocabulary for both kinds of swap.
 *
 * A swap in this wallet is one of two quite different things wearing the same
 * button. BSV to a BSV-issued token is a transaction this wallet writes itself:
 * instant, mid-market, no counterparty. BSV to ether is a stranger holding your
 * money for twenty minutes while two chains that have never heard of each other
 * are reconciled by a third party.
 *
 * The person pressing the button should not have to know which one they are
 * about to do, so the entry is one screen and the route is decided by what they
 * picked. What they must not be allowed to miss is which one they got — the
 * second involves an address they cannot mistype twice and a refund path that
 * only exists if they filled it in. That is why the two routes diverge into
 * visibly different screens rather than one screen with extra fields.
 *
 * @see lib/swap-assets.ts for where the cross-chain list comes from
 * @see components/apps/wallet/swap-flow.tsx for the screens
 */

import { chainAddress } from "@/lib/chain-address";
import { foreignTokens, getEcosystem, getTokens } from "@/lib/data";
import type { Token } from "@/lib/data";
import { networkLabel, useSwapAssets, type SwapAsset } from "@/lib/swap-assets";
import { holdings, usdPerUnitOf } from "@/lib/wallet";

/** The BSV chain's code, matching the provider's spelling of it. */
export const BSV_NETWORK = "bsv";

/**
 * A coin, whichever side of the divide it lives on.
 *
 * `native` is the whole question: true means this wallet can move it, false
 * means a provider must. Everything else on here is what a row needs to draw.
 */
export interface SwapCoin {
  /** `bsv`, `nutri` for our own; `eth-eth`, `usdc-sol` for the provider's */
  id: string;
  symbol: string;
  name: string;
  network: string;
  networkLabel: string;
  icon: string;
  color: string;
  decimals: number;
  /** on the BSV chain, so this wallet settles it */
  native: boolean;
  /** the provider's own popular flag, which is the Popular group */
  featured: boolean;
  /** held units, when this is something the wallet holds */
  units: number;
  /** null when nothing can price it */
  usdPerUnit: number | null;
}

function fromToken(token: Token, units: number): SwapCoin {
  const network = token.chain ?? BSV_NETWORK;
  return {
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    network,
    networkLabel: networkLabel(network),
    /* Its own mark, or the issuing ecosystem's — the same fallback TokenMark
       uses, so NUTRI carries the Mycelia glyph here and in the portfolio
       instead of a letter on a plate in one place and a logo in the other. */
    icon:
      token.icon ??
      (token.ecosystem ? (getEcosystem(token.ecosystem)?.icon ?? "") : ""),
    color: token.color,
    decimals: token.decimals,
    native: network === BSV_NETWORK,
    /* Our own assets lead the Popular group. Somebody swapping inside a BSV
       wallet is most often swapping something this wallet issued, and burying
       that under the provider's eight majors would be describing a different
       product. */
    featured: true,
    units,
    usdPerUnit: usdPerUnitOf(token),
  };
}

function fromAsset(asset: SwapAsset, units: number): SwapCoin {
  return {
    id: asset.id,
    symbol: asset.ticker.toUpperCase(),
    name: asset.name,
    network: asset.network,
    networkLabel: asset.networkLabel,
    icon: asset.image,
    color: "#6b7280",
    /* The provider does not publish decimals and the wallet never has to write
       one of these transactions, so eight is a display cap rather than a claim
       about the chain. */
    decimals: 8,
    native: asset.network === BSV_NETWORK,
    featured: asset.featured,
    units,
    usdPerUnit: null,
  };
}

/**
 * Every coin either side of a swap can be, with what is held folded in.
 *
 * Ours first, then the provider's, and a provider entry that names something we
 * already hold is dropped — a person who holds DOGE should see one DOGE row
 * carrying their balance, not two rows where the second is the same coin with
 * the balance missing. Matched on `chain` + symbol, which is what makes two
 * rows the same coin.
 */
export function useSwapCoins(accountId?: string): SwapCoin[] {
  const assets = useSwapAssets();
  const held = new Map(
    holdings(accountId).map(({ token, units }) => [token.id, units]),
  );

  /*
   * Every asset this wallet supports, held or not.
   *
   * Not just what is in the balance table: a wallet you can only swap *out* of
   * is not a wallet, and support for an asset is a property of the wallet
   * rather than of your current holding. It is also what keeps a pair priced
   * the same in every wallet — when ETH was only known if you held some, the
   * same BSV→ETH swap showed a rate under Work and "quoted at deposit" under
   * Everyday, which is the app disagreeing with itself about the market.
   */
  const ours: SwapCoin[] = [...getTokens(), ...foreignTokens].map((token) =>
    fromToken(token, held.get(token.id) ?? 0),
  );

  const mine = new Set(ours.map((coin) => `${coin.network}:${coin.symbol}`));
  const theirs = assets
    .filter(
      (asset) => !mine.has(`${asset.network}:${asset.ticker.toUpperCase()}`),
    )
    .map((asset) => fromAsset(asset, 0));

  return [...ours, ...theirs];
}

/**
 * Which machinery this pair needs.
 *
 * `wallet` when both ends are on the BSV chain — one transaction, this wallet's
 * own keys, done when it confirms. `provider` for anything that crosses, since
 * neither end can be settled by a wallet that only holds BSV keys.
 */
export type SwapRoute = "wallet" | "provider";

export function routeFor(from: SwapCoin, to: SwapCoin): SwapRoute {
  return from.native && to.native ? "wallet" : "provider";
}

/**
 * What Nexus takes, on the swaps it is doing work for.
 *
 * Charged on anything that is not two BSV instruments trading against each
 * other. Inside the BSV chain this wallet writes the transaction itself and
 * there is nothing to mark up — a fee there would be a charge for reading our
 * own ledger. Once a swap leaves the chain there is routing, a counterparty,
 * and a quote somebody has to stand behind, and that is what this pays for.
 */
export const SWAP_FEE = 0.0218;

export interface Quote {
  /** the rate you actually get, fee already in it */
  rate: number;
  /** what lands, at that rate */
  units: number;
  /** the rate before the fee, for anyone who wants to see the difference */
  mid: number;
  /** the fee as a fraction, 0 on the in-wallet route */
  fee: number;
}

/**
 * What you get for what you put in, fee included.
 *
 * Built into the rate rather than added beside it, which is how every wallet
 * that does this quotes it: the figure under "You get" is then the figure that
 * arrives, and there is no second number to reconcile after the fact. The
 * screens say the rate includes it, and `mid` is here for the ones that want to
 * show what it would have been.
 *
 * Two assets we can both price is real arithmetic. Anything involving a coin
 * the fixtures cannot price returns null, and the screen says the provider
 * quotes at deposit — which is true of a real cross-chain swap anyway, where
 * the number shown before you send is an estimate and the number you get is
 * whatever the market did in between.
 */
export function quote(
  from: SwapCoin,
  to: SwapCoin,
  units: number,
): Quote | null {
  if (!from.usdPerUnit || !to.usdPerUnit) return null;
  const mid = from.usdPerUnit / to.usdPerUnit;
  const fee = routeFor(from, to) === "provider" ? SWAP_FEE : 0;
  const rate = mid * (1 - fee);
  return { rate, units: units * rate, mid, fee };
}

/**
 * A swap id in the provider's shape.
 *
 * Derived from the pair and the amount rather than drawn at random, because
 * `Math.random` during a render is a different id every paint and this one is
 * shown, copied, and quoted at support. Nothing depends on it being unique
 * across people — it is a fixture standing in for the provider's receipt.
 */
export function swapId(from: SwapCoin, to: SwapCoin, amount: string): string {
  const seed = `${from.id}${to.id}${amount}`;
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).padStart(7, "0").slice(0, 7) +
    (hash % 97).toString(36).padStart(2, "0");
}

/**
 * The provider's one-off deposit address for a swap.
 *
 * Theirs, not ours — this is where you send the coin so they can send back the
 * other one, and it exists for this swap only. Seeded on the swap id so it is
 * stable while the order is open and different for the next one.
 */
export function depositAddress(coin: SwapCoin, id: string): string {
  return chainAddress(`deposit:${id}`, coin.network);
}

/**
 * This wallet's own address on a coin's chain.
 *
 * What a destination field should already contain: you are swapping into ether
 * so it can land in your wallet, and making you paste in an address you own is
 * making you retype something the app knows.
 */
export function ownAddress(accountIdentifier: string, network: string): string {
  return chainAddress(accountIdentifier, network);
}

/** How long the provider holds the quote. Their number, not ours. */
export const SWAP_WINDOW_MS = 24 * 60 * 60 * 1000;
