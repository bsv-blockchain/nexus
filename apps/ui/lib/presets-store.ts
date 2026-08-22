"use client";

/**
 * Which presets this install was set up with, and how to apply them.
 *
 * Persisted, because it is the answer to a question asked once: the Guided Tour
 * reads it to know which cards to run, and Settings reads it to show what the
 * first run produced. Losing it on reload would mean a tour that changes shape
 * between one visit and the next.
 *
 * The choice is kept, not the consequences. Which apps a preset installs lives
 * in {@link file://./data/presets.ts} and is read fresh every time, so adding an
 * app to Thinker reaches everybody who picked Thinker rather than only people
 * who run the first run again.
 */

import { storageKeys } from "@/lib/config";
import { presets, type PresetId } from "@/lib/data/presets";
import { useSyncExternalStore } from "react";

function read(): PresetId[] {
  try {
    const raw = window.localStorage.getItem(storageKeys.presets);
    if (!raw) return [];
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return [];
    /* Filtered against the live list, so a preset removed from the build does
       not leave a dead id in everybody's storage forever. Order comes from the
       build too — the file decides the order, not the order they were ticked. */
    return presets
      .map((preset) => preset.id)
      .filter((id) => saved.includes(id));
  } catch {
    return [];
  }
}

let snapshot: PresetId[] | null = null;
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

function getSnapshot(): PresetId[] {
  snapshot ??= read();
  return snapshot;
}

/** Nothing chosen, which is what the server and a fresh install both are. */
const NONE: PresetId[] = [];

function getServerSnapshot(): PresetId[] {
  return NONE;
}

export function setChosenPresets(chosen: PresetId[]): void {
  snapshot = presets
    .map((preset) => preset.id)
    .filter((id) => chosen.includes(id));
  try {
    window.localStorage.setItem(storageKeys.presets, JSON.stringify(snapshot));
  } catch {
    /* storage unavailable — keep it for this session */
  }
  emit();
}

/** The presets this install was set up with, in build order. */
export function useChosenPresets(): PresetId[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
