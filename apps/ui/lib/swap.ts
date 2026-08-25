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

import { getEcosystem, getToken, getTokens } from "@/lib/data";
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

  /* Every BSV-native token, held or not: you can swap into a token you have
     never owned, which is rather the point of a swap. Held foreign coins too,
     because they are the only way to swap back out. */
  const ours: SwapCoin[] = [
    ...getTokens(),
    ...[...held.keys()]
      .map((id) => getToken(id))
      .filter((token): token is Token => Boolean(token?.chain)),
  ].map((token) => fromToken(token, held.get(token.id) ?? 0));

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
 * What you get for what you put in.
 *
 * Two assets we can both price is real arithmetic and reads as a rate. Anything
 * involving a coin the fixtures cannot price returns null, and the screen says
 * the provider quotes at deposit — which is true of a real cross-chain swap
 * anyway, where the number shown before you send is an estimate and the number
 * you get is whatever the market did in between.
 */
export function quote(
  from: SwapCoin,
  to: SwapCoin,
  units: number,
): { rate: number; units: number } | null {
  if (!from.usdPerUnit || !to.usdPerUnit) return null;
  const rate = from.usdPerUnit / to.usdPerUnit;
  return { rate, units: units * rate };
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
 * A plausible deposit address on the coin's own chain.
 *
 * Shaped per chain because the shape is the check — somebody about to send ETH
 * looks for `0x`, and an address that looked like a bitcoin one would be the
 * single most alarming thing on the screen.
 */
export function depositAddress(coin: SwapCoin, id: string): string {
  const body = `${id}${coin.symbol}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filler = (length: number): string =>
    body.repeat(Math.ceil(length / body.length)).slice(0, length);
  switch (coin.network) {
    case "eth":
    case "bsc":
    case "base":
    case "arbitrum":
    case "matic":
    case "op":
      return `0x${filler(40)}`;
    case "sol":
      return filler(44);
    case "btc":
      return `bc1q${filler(38)}`;
    case "bsv":
      return `1${filler(33)}`;
    default:
      return filler(34);
  }
}

/** How long the provider holds the quote. Their number, not ours. */
export const SWAP_WINDOW_MS = 24 * 60 * 60 * 1000;
