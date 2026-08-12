"use client";

import { getWalletAccounts, type WalletAccount } from "@/lib/data";
import { useSyncExternalStore } from "react";

/**
 * Which wallets exist, and which one each profile is using.
 *
 * A wallet is owned by you; a profile connects exactly one of them. One is the
 * point rather than a limitation — a profile exists to be a context you act
 * inside, and a context with three wallets in it puts the "which one did that
 * come from?" question back on every payment, which is the question the profile
 * was supposed to have already answered.
 *
 * Connecting is not exclusive the other way round: the same household float can
 * be the wallet for Personal and for Shared. That is worth surfacing rather
 * than preventing, which is what the profiles column's shared list is for.
 *
 * Nothing here is persisted, like every other store in this prototype.
 */
export interface WalletsState {
  /** wallets added during this session, on top of the seeded ones */
  added: WalletAccount[];
  /** the one wallet each profile is using */
  byProfile: Record<string, string>;
  /** locked wallets opened during this session */
  unlocked: string[];
}

/** What a profile falls back to before anybody has chosen for it. */
const DEFAULT_WALLET = "acct-main";

/**
 * Seeded so the two profiles do not start out identical.
 *
 * A prototype where every profile uses the same wallet demonstrates nothing
 * about why a profile has one.
 */
let state: WalletsState = {
  added: [],
  byProfile: {
    "space-my-hub": "acct-main",
    "space-work": "acct-work",
  },
  unlocked: [],
};

const listeners = new Set<() => void>();

function emit(): void {
  state = { ...state };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WalletsState {
  return state;
}

export function useWallets(): WalletsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Every wallet you hold, seeded and session-added alike. */
export function allWallets(): WalletAccount[] {
  return [...getWalletAccounts(), ...state.added];
}

export function getWallet(id: string): WalletAccount | undefined {
  return allWallets().find((wallet) => wallet.id === id);
}

/** The one wallet a profile is using, or undefined if it has none left. */
export function activeWalletFor(spaceId: string): WalletAccount | undefined {
  const chosen = state.byProfile[spaceId] ?? DEFAULT_WALLET;
  return getWallet(chosen) ?? allWallets()[0];
}

/** Points a profile at a wallet. Replaces whatever it was using. */
export function setActiveWallet(spaceId: string, id: string): void {
  state.byProfile = { ...state.byProfile, [spaceId]: id };
  emit();
}

/** Which profiles are using a wallet — the same one may serve several. */
export function profilesUsing(id: string, spaceIds: string[]): string[] {
  return spaceIds.filter(
    (spaceId) => (state.byProfile[spaceId] ?? DEFAULT_WALLET) === id,
  );
}

/**
 * Most recently made first.
 *
 * What a picker should show before anybody types: the wallet you just created
 * is the one you are most likely reaching for, and an alphabetical list buries
 * it under whatever happens to start with A.
 */
export function walletsByRecent(): WalletAccount[] {
  return [...allWallets()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function isUnlocked(id: string): boolean {
  return state.unlocked.includes(id);
}

export function unlockWallet(id: string): void {
  if (state.unlocked.includes(id)) return;
  state.unlocked = [...state.unlocked, id];
  emit();
}

export function lockWallet(id: string): void {
  state.unlocked = state.unlocked.filter((entry) => entry !== id);
  emit();
}

/** A new wallet, however it arrived — created, imported from a phrase or a key. */
export function addWallet(
  wallet: Omit<WalletAccount, "createdAt">,
  spaceId: string,
  now: number,
): void {
  state.added = [
    ...state.added,
    { ...wallet, createdAt: new Date(now).toISOString() },
  ];
  /* Connected where it was added. Adding a wallet you then have to go and
     switch on is a two-step answer to a one-step ask. */
  state.byProfile = { ...state.byProfile, [spaceId]: wallet.id };
  emit();
}

export function renameWallet(id: string, label: string): void {
  state.added = state.added.map((wallet) =>
    wallet.id === id ? { ...wallet, label } : wallet,
  );
  /* Seeded wallets are renamed through an overlay rather than by rewriting the
     build's table, which is read fresh on every call. */
  renamed[id] = label;
  emit();
}

const renamed: Record<string, string> = {};

/** The label to show, with any session rename applied. */
export function labelOf(wallet: WalletAccount): string {
  return renamed[wallet.id] ?? wallet.label;
}
