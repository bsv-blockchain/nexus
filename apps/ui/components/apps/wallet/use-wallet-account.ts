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
import { activeWalletFor, useWallets } from "@/lib/wallets-store";

/** The selected wallet's id, or undefined where the workspace has none. */
export function useWalletAccountId(): string | undefined {
  const { activeSpaceId } = useHub();
  useWallets();
  return activeWalletFor(activeSpaceId)?.id;
}
