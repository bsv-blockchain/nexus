"use client";

/**
 * Whether the Guided Tour is running, and how far through it is.
 *
 * Two separate facts, and only one of them persists. Where you are in a run is
 * this session's business — a tour resumed at card four after a reload is a
 * tour that lost its thread. Whether you have *finished* one is worth keeping,
 * because it is what stops the invitation coming back at somebody who has
 * already taken it.
 *
 * @see lib/data/tour.ts — the cards a run is assembled from
 */

import { storageKeys } from "@/lib/config";
import { useSyncExternalStore } from "react";

export interface TourState {
  /** null when no tour is running; otherwise the index into the run */
  index: number | null;
  /** true once a run has been finished or skipped, on this device */
  taken: boolean;
  /** true once the help circle has been hovered, which stops it pulsing */
  helpSeen: boolean;
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* storage unavailable — this session only */
  }
}

/** The server has no storage and no tour running, which is also a fresh install. */
const INITIAL: TourState = { index: null, taken: false, helpSeen: false };

let state: TourState = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TourState {
  /* Read once, lazily. Doing it at module load would run on the server, where
     there is no storage, and doing it every call would return a new object
     every time and spin `useSyncExternalStore`. */
  if (!hydrated) {
    hydrated = true;
    state = {
      index: null,
      taken: readFlag(storageKeys.tourTaken),
      helpSeen: readFlag(storageKeys.helpSeen),
    };
  }
  return state;
}

function getServerSnapshot(): TourState {
  return INITIAL;
}

function set(next: Partial<TourState>): void {
  state = { ...getSnapshot(), ...next };
  emit();
}

/** Open the tour at its first card. */
export function startTour(): void {
  set({ index: 0 });
}

export function tourNext(total: number): void {
  const current = getSnapshot().index;
  if (current === null) return;
  if (current >= total - 1) {
    endTour();
    return;
  }
  set({ index: current + 1 });
}

export function tourPrevious(): void {
  const current = getSnapshot().index;
  if (current === null || current === 0) return;
  set({ index: current - 1 });
}

/**
 * Shut the tour, and remember it happened.
 *
 * Skipping counts as taking it. Somebody who dismissed the invitation once has
 * answered the question, and asking again on the next reload is the behaviour
 * that makes people distrust a product's suggestions.
 */
export function endTour(): void {
  writeFlag(storageKeys.tourTaken, true);
  set({ index: null, taken: true });
}

/** The help circle has been hovered; it stops asking for attention. */
export function markHelpSeen(): void {
  if (getSnapshot().helpSeen) return;
  writeFlag(storageKeys.helpSeen, true);
  set({ helpSeen: true });
}

export function useTour(): TourState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
