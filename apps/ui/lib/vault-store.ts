"use client";

/**
 * Whether the vault is shut, and what it takes to open it.
 *
 * A module store rather than component state, because three separate parts of
 * the shell need the same answer: the canvas draws the doors, the contextual
 * column collapses to a single Locked row, and the button in that column's help
 * bar sets the policy. They are siblings with the whole shell between them.
 *
 * Same shape as {@link file://./settings-store.ts} — read through
 * `useSyncExternalStore`, a server snapshot matching the prerender, nothing
 * written to disk. A prototype that remembered your vault was open would be
 * claiming to have a session.
 */

import { useSyncExternalStore } from "react";

/**
 * Where the door is in its cycle.
 *
 * `checking` and `denied` are separate from `locked` because both are things
 * the door is *doing* rather than states it is resting in — the panel shakes on
 * one and the lamp changes on the other, and a single boolean could express
 * neither.
 */
export type VaultPhase =
  | "locked"
  | "checking"
  | "denied"
  | "unlocking"
  | "parting"
  | "open";

/**
 * How you are proving it is you.
 *
 * Which of these the door actually offers is not decided here: it is whatever
 * Security has registered, read at render. See lib/security-store.
 */
export type UnlockMethod = "password" | "qr" | "security-key" | "otp";

/**
 * Which panel the lock screen is showing.
 *
 * `shut` is the resting state: doors closed, one button on the seam. The
 * chooser and the method panels are the two steps behind it, which is why the
 * password field is no longer on screen beside the button that opens the vault
 * — a passphrase box is one of three answers, not the question.
 */
export type LockStep = "shut" | "chooser" | "method";

/**
 * When the vault shuts itself again.
 *
 * `on-leave` is the default and the honest one for cold storage: the doors are
 * closed every time you arrive, which is what a vault is. The other two exist
 * because a person moving between apps all afternoon has a different threat
 * model from one walking away from the machine.
 */
export type LockPolicy = "on-leave" | "timed" | "never";

/** How long `timed` waits. Stated here so the copy and the timer agree. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

export interface VaultState {
  phase: VaultPhase;
  step: LockStep;
  /** the option the chooser has highlighted, before Continue */
  method: UnlockMethod;
  policy: LockPolicy;
  /** what the panel is complaining about, if anything */
  message: string;
}

const INITIAL: VaultState = {
  phase: "locked",
  step: "shut",
  method: "password",
  policy: "on-leave",
  message: "",
};

let state: VaultState = INITIAL;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<VaultState>): void {
  state = { ...state, ...patch };
  emit();
}

export function useVault(): VaultState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  );
}

export function getVaultPolicy(): LockPolicy {
  return state.policy;
}

/** The button on the seam. */
export function openChooser(): void {
  set({ step: "chooser", message: "" });
}

/** Cancel, from either step. */
export function closeChooser(): void {
  set({ step: "shut", phase: "locked", message: "" });
}

export function chooseMethod(method: UnlockMethod): void {
  set({ method });
}

/** Continue, from the chooser into the chosen method's own panel. */
export function beginMethod(): void {
  set({ step: "method", message: "" });
}

/** The back arrow at the top of a method panel. */
export function backToChooser(): void {
  set({ step: "chooser", phase: "locked", message: "" });
}

export function checking(): void {
  set({ phase: "checking", message: "" });
}

/** Refuse, with a reason. The panel shakes and returns to rest. */
export function deny(message: string): void {
  set({ phase: "denied", message });
}

/** Back to rest after a refusal, keeping the message on screen. */
export function settle(): void {
  set({ phase: "locked" });
}

/** Accepted. The wheel turns; the doors have not moved yet. */
export function unlocking(): void {
  set({ phase: "unlocking", message: "" });
}

/**
 * The doors themselves.
 *
 * A phase of its own because the previous build had none, and the doors were
 * never seen to move: the canvas swapped to the item list the moment the wheel
 * finished, unmounting the very animation it had just wound up. Opening is two
 * events — the lock releasing and the doors travelling — and only the first of
 * them was on screen.
 */
export function parting(): void {
  set({ phase: "parting", message: "" });
}

export function opened(): void {
  set({ phase: "open", step: "shut", message: "" });
}

/**
 * Shut it.
 *
 * Also resets the step and the message, so arriving at a locked vault never
 * shows the panel you happened to be on when it closed — the door is shut, and
 * the only thing to do with a shut door is choose how to open it.
 */
export function lock(): void {
  set({ phase: "locked", step: "shut", message: "" });
}

export function setPolicy(policy: LockPolicy): void {
  set({ policy });
}
