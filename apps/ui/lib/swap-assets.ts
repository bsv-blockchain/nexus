"use client";

/**
 * Every coin a cross-chain swap can start from or end at.
 *
 * Live, from ChangeNOW's own currency list, because a hand-kept copy of 1,280
 * assets is a copy that is wrong within a week — new chains appear, old tokens
 * are delisted, and a picker offering a route the provider will refuse is worse
 * than one that is a day behind. The endpoint is public, needs no key and sends
 * `access-control-allow-origin: *`, so this is a plain fetch from the page.
 *
 * The icons are theirs too. Serving our own copies of twelve hundred logos
 * would be twelve hundred files to keep in step with a list we do not own.
 *
 * Fetched once per session and held. Somebody opening the swap four times in a
 * minute is asking the same question four times, and the answer does not move
 * that fast.
 *
 * @see https://changenow.io/api/docs
 */

import { useSyncExternalStore } from "react";

const ENDPOINT =
  "https://api.changenow.io/v2/exchange/currencies?active=true&flow=standard";

export interface SwapAsset {
  /** ticker as the provider spells it, e.g. `usdt` */
  ticker: string;
  /** full name, which carries the network in brackets for bridged assets */
  name: string;
  /** provider's network code, e.g. `bsc` */
  network: string;
  /** what to call that network on screen */
  networkLabel: string;
  /** provider-hosted logo; absent for a handful */
  image: string;
  /** the provider's own "popular" flag, which is the Popular group */
  featured: boolean;
  /** a stable id for this coin-on-this-network */
  id: string;
}

/**
 * Names for the networks that come back as codes.
 *
 * Only the ones somebody is likely to meet. Anything not here shows its code
 * upper-cased, which is what the reference does for the long tail — `USDT ·
 * ASSETHUB` is not pretty and it is not a lie, where guessing at a full name
 * would be.
 */
const NETWORK_LABELS: Record<string, string> = {
  btc: "Bitcoin",
  bsv: "BSV",
  bch: "Bitcoin Cash",
  eth: "Ethereum",
  bsc: "BNB Smart Chain",
  sol: "Solana",
  base: "Base",
  arbitrum: "Arbitrum",
  matic: "Polygon",
  op: "Optimism",
  trx: "Tron",
  avaxc: "Avalanche",
  ton: "TON",
  ada: "Cardano",
  xrp: "XRP Ledger",
  xmr: "Monero",
  doge: "Dogecoin",
  ltc: "Litecoin",
  dot: "Polkadot",
  atom: "Cosmos",
  near: "NEAR",
  algo: "Algorand",
  xlm: "Stellar",
  zksync: "zkSync Era",
  apt: "Aptos",
  sui: "Sui",
  strk: "Starknet",
  lna: "Linea",
  hood: "Robinhood",
};

export function networkLabel(network: string): string {
  return NETWORK_LABELS[network] ?? network.toUpperCase();
}

/**
 * What the picker shows before the network has answered, and if it never does.
 *
 * Not an empty list: a swap screen with nothing in it looks broken, and these
 * eight are the ones most people are looking for anyway. Replaced wholesale the
 * moment the real list lands.
 */
const FALLBACK: SwapAsset[] = [
  { ticker: "btc", name: "Bitcoin", network: "btc", image: "", featured: true },
  { ticker: "eth", name: "Ethereum", network: "eth", image: "", featured: true },
  { ticker: "sol", name: "Solana", network: "sol", image: "", featured: true },
  { ticker: "usdt", name: "Tether (ERC20)", network: "eth", image: "", featured: true },
  { ticker: "usdc", name: "USD Coin", network: "eth", image: "", featured: true },
  { ticker: "xrp", name: "Ripple", network: "xrp", image: "", featured: true },
  { ticker: "doge", name: "Dogecoin", network: "doge", image: "", featured: true },
  { ticker: "ltc", name: "Litecoin", network: "ltc", image: "", featured: true },
].map((row) => ({
  ...row,
  id: `${row.ticker}-${row.network}`,
  networkLabel: networkLabel(row.network),
}));

interface Raw {
  ticker?: unknown;
  name?: unknown;
  network?: unknown;
  image?: unknown;
  featured?: unknown;
  isFiat?: unknown;
}

function parse(rows: unknown): SwapAsset[] {
  if (!Array.isArray(rows)) return [];
  const out: SwapAsset[] = [];
  for (const row of rows as Raw[]) {
    const ticker = typeof row.ticker === "string" ? row.ticker : "";
    const network = typeof row.network === "string" ? row.network : "";
    const name = typeof row.name === "string" ? row.name : "";
    /* Fiat is in the list and is not a thing this wallet can swap; dropping it
       here rather than at each call site keeps every reader honest. */
    if (!ticker || !network || !name || row.isFiat === true) continue;
    out.push({
      ticker,
      name,
      network,
      networkLabel: networkLabel(network),
      image: typeof row.image === "string" ? row.image : "",
      featured: row.featured === true,
      id: `${ticker}-${network}`,
    });
  }
  return out;
}

let assets: SwapAsset[] = FALLBACK;
let started = false;
let live = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Whether the list on screen came from the provider or is the stand-in. */
export function assetsAreLive(): boolean {
  return live;
}

export function getSwapAssets(): SwapAsset[] {
  return assets;
}

/**
 * Ask once, the first time somebody opens the picker.
 *
 * Not on app start: most sessions never swap, and a wallet that fetches twelve
 * hundred rows from a third party on launch is a wallet telling that third
 * party when it launched.
 */
export function loadSwapAssets(): void {
  if (started) return;
  started = true;
  void fetch(ENDPOINT)
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => {
      const parsed = parse(body);
      if (parsed.length === 0) return;
      assets = parsed;
      live = true;
      emit();
    })
    .catch(() => {
      /* Offline, blocked, or the shape changed. The fallback is already on
         screen and saying so is the picker's job, not this module's. */
    });
}

export function useSwapAssets(): SwapAsset[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSwapAssets,
    () => FALLBACK,
  );
}
