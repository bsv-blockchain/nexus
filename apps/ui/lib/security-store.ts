"use client";

/**
 * What you are allowed to prove yourself with, and where you are asked to.
 *
 * Split from {@link file://./vault-store.ts} on purpose. That one holds whether
 * the doors are shut right now — a thing about this session. This holds what
 * has been registered: a passphrase, security keys, paired phones, one-time
 * codes. The vault reads it to decide which options its chooser offers, and
 * Settings writes it. Keeping them apart is what stops "the vault is open"
 * living in the same object as "this account has two security keys".
 *
 * Same module-store shape as the rest of the shell — read through
 * `useSyncExternalStore`, a server snapshot matching the prerender, nothing
 * written to disk.
 */

import { useSyncExternalStore } from "react";

/** A registered authenticator. */
export interface SecurityKey {
  id: string;
  label: string;
}

/** A phone paired as a second factor, used to answer the vault's QR. */
export interface PairedPhone {
  id: string;
  label: string;
}

export interface SecurityState {
  /** whether a vault passphrase has been set at all */
  passphraseSet: boolean;
  keys: SecurityKey[];
  phones: PairedPhone[];
  /** one-time codes from an authenticator app */
  otpOn: boolean;
  /**
   * Apps that open without asking, by slug.
   *
   * Empty by default: out of the box every app is behind the lock and you tick
   * the ones you want to skip. `ALL_APPS` is the pseudo-entry for "every app",
   * held in the same list so there is one answer to read rather than a boolean
   * and a list that can disagree.
   */
  exempt: string[];
}

/** The pseudo-slug meaning every app, present or future. */
export const ALL_APPS = "*";

/**
 * What a fresh account looks like.
 *
 * One of each factor registered and codes on, so all four ways into the vault
 * are live from the first run — the chooser is the point of the screen, and a
 * chooser with one option in it teaches nothing. Nothing is exempt, so the
 * lock actually means something until somebody decides otherwise.
 */
const INITIAL: SecurityState = {
  passphraseSet: true,
  keys: [{ id: "key-1", label: "YubiKey C Bio - FIDO Edition" }],
  phones: [{ id: "phone-1", label: "iPhone 16 Pro Max" }],
  otpOn: true,
  exempt: [],
};

/**
 * What a newly-detected authenticator says it is.
 *
 * A pool rather than one string, so registering a second key does not produce
 * two rows with the same name — which is the one thing a list of keys must not
 * do, since the name is all you have to tell them apart by when revoking one.
 */
const KEY_BRANDS = [
  "YubiKey C Bio - FIDO Edition",
  "YubiKey 5 NFC",
  "SoloKey V2 USB-C",
  "Titan Security Key",
];

const PHONE_MODELS = [
  "iPhone 16 Pro Max",
  "Pixel 9 Pro",
  "Galaxy S25 Ultra",
  "iPhone 15",
];

let state: SecurityState = INITIAL;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<SecurityState>): void {
  state = { ...state, ...patch };
  emit();
}

export function useSecurity(): SecurityState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  );
}

/** The name a key or phone announces when it is first seen. */
export function suggestKeyLabel(): string {
  return KEY_BRANDS[state.keys.length % KEY_BRANDS.length] ?? KEY_BRANDS[0]!;
}

export function suggestPhoneLabel(): string {
  return (
    PHONE_MODELS[state.phones.length % PHONE_MODELS.length] ?? PHONE_MODELS[0]!
  );
}

export function setPassphrase(): void {
  set({ passphraseSet: true });
}

export function addKey(label: string): void {
  set({
    keys: [...state.keys, { id: `key-${Date.now()}`, label: label.trim() }],
  });
}

export function removeKey(id: string): void {
  set({ keys: state.keys.filter((key) => key.id !== id) });
}

export function addPhone(label: string): void {
  set({
    phones: [
      ...state.phones,
      { id: `phone-${Date.now()}`, label: label.trim() },
    ],
  });
}

export function removePhone(id: string): void {
  set({ phones: state.phones.filter((phone) => phone.id !== id) });
}

export function setOtp(on: boolean): void {
  set({ otpOn: on });
}

/**
 * Tick or untick one app.
 *
 * Ticking anything clears "every app", because the two cannot both be true
 * without the list saying something it does not mean: with `ALL_APPS` present,
 * the individual ticks would be decoration.
 */
export function toggleExempt(slug: string): void {
  if (slug === ALL_APPS) {
    set({ exempt: state.exempt.includes(ALL_APPS) ? [] : [ALL_APPS] });
    return;
  }
  const without = state.exempt.filter((entry) => entry !== ALL_APPS);
  set({
    exempt: without.includes(slug)
      ? without.filter((entry) => entry !== slug)
      : [...without, slug],
  });
}
