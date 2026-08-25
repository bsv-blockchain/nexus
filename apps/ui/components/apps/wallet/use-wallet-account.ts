"use client";

/**
 * The wallet everything in this app is about.
 *
 * One question, asked in six places. Cash, Collectibles, Activity, Links,
 * Contacts and Splits are all "…of this wallet", and the wallet is the one the
 * workspace is spending from — the same answer the pay flow and the profiles
 * column read, which is what makes the switcher a real choice rather than a
 * filter that only this screen honours.
 *
 * `useWallets` is subscribed here rather than in each caller: the id is read
 * from module state, so without it a switch would change the store and leave
 * every section rendering the wallet before it.
 */

import { useHub } from "@/components/hub/hub-provider";
import type { WalletAccount } from "@/lib/data";
import { activeWalletFor, useWallets } from "@/lib/wallets-store";

/**
 * The selected wallet's id, or `""` where the workspace has none.
 *
 * An empty string rather than `undefined` on purpose. Every section passes this
 * straight to a `get…(accountId)` accessor, and those read a missing argument as
 * "no wallet named, so give me everything" — which is right for a share card and
 * exactly wrong here: a workspace that has not connected a wallet was being
 * shown the sum of all four. `""` is a real id that nothing equals, so each
 * section falls to its own empty state, which is the truthful answer.
 */
export function useWalletAccountId(): string {
  const { activeSpaceId } = useHub();
  useWallets();
  return activeWalletFor(activeSpaceId)?.id ?? "";
}

/**
 * The selected wallet itself, where a caller needs more than its id.
 *
 * The receive and swap screens need its identifier, because that is what stands
 * in for the seed the chain addresses are derived from — see lib/chain-address.
 * Undefined where the workspace has no wallet, which those screens read as
 * "nothing to show an address for".
 */
export function useWalletAccount(): WalletAccount | undefined {
  const { activeSpaceId } = useHub();
  useWallets();
  return activeWalletFor(activeSpaceId);
}
