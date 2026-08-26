"use client";

/**
 * Which extensions this browser still has, and which of them are switched on.
 *
 * The fixture says what could be installed; this says what you have done about
 * it. Removing and disabling are different acts and are stored separately: off
 * is a thing you undo with one press, removed is a thing you undo through a
 * store and a permission prompt, and a single list could not tell them apart.
 *
 * It has to be a store rather than component state because three places read
 * it — the manager's cards, the tiles in the address-bar popover, and whether
 * TumbleUpon's toolbar is over the page at all. A switch that only the screen
 * it lives on can see is a switch with nothing behind it.
 *
 * @see lib/data/extensions.ts for the catalogue
 */

import { useSyncExternalStore } from "react";
import { getExtensions, type BrowserExtension } from "@/lib/data";
import { getChosenPresets } from "@/lib/presets-store";

const KEY = "nexus.extensions";

interface State {
  removed: string[];
  disabled: string[];
}

const EMPTY: State = { removed: [], disabled: [] };

let state: State = EMPTY;
const listeners = new Set<() => void>();
/* Rebuilt on write rather than per render: `useSyncExternalStore` compares by
   reference, and a fresh array every call is an infinite loop. */
let installed: BrowserExtension[] = getExtensions();

function rebuild(): void {
  installed = getExtensions()
    .filter((entry) => !state.removed.includes(entry.id))
    .map((entry) => ({
      ...entry,
      enabled: entry.enabled && !state.disabled.includes(entry.id),
    }));
}

function emit(): void {
  rebuild();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* Private mode. Losing which extension was off is survivable. */
    }
  }
  for (const listener of listeners) listener();
}

/**
 * Whether a first run leaves TumbleUpon installed.
 *
 * It is a discovery tool, and discovery needs somewhere to go. Somebody who
 * picked no presets has an empty rail and nothing to be shown around; somebody
 * who picked only Thinker asked for a quiet setup, and a toolbar that offers to
 * fling them at a marketplace is the opposite of what they said. Every other
 * setup gets it, because a rail with apps on it is a rail whose neighbours are
 * worth meeting.
 *
 * Read once, when the store hydrates, rather than watched: this is a question
 * about how the workspace was set up, not a rule that should keep re-applying
 * and undo somebody removing it later.
 */
function wantedByDefault(): boolean {
  const chosen = getChosenPresets();
  if (chosen.length === 0) return false;
  return !(chosen.length === 1 && chosen[0] === "thinker");
}

/** Applied after the first paint — same hydration rule as the content mode. */
export function hydrateExtensions(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      state = { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) };
    } else if (!wantedByDefault()) {
      /* No stored answer yet, so this is the first look after a first run.
         Removed rather than merely disabled: not offered is a cleaner thing to
         be than offered and switched off, and the manager still lists it under
         the store link if somebody goes looking. */
      state = { ...EMPTY, removed: ["tumbleupon"] };
    }
    rebuild();
    for (const listener of listeners) listener();
  } catch {
    /* Written by an older shape. */
  }
}

const SERVER = getExtensions();

export function useInstalledExtensions(): BrowserExtension[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => installed,
    () => SERVER,
  );
}

export function getInstalledExtensions(): BrowserExtension[] {
  return installed;
}

/** Whether an extension is present and switched on. */
export function extensionIsOn(id: string): boolean {
  return installed.some((entry) => entry.id === id && entry.enabled);
}

export function setExtensionEnabled(id: string, on: boolean): void {
  state = {
    ...state,
    disabled: on
      ? state.disabled.filter((entry) => entry !== id)
      : state.disabled.includes(id)
        ? state.disabled
        : [...state.disabled, id],
  };
  emit();
}

export function removeExtension(id: string): void {
  if (state.removed.includes(id)) return;
  state = { ...state, removed: [...state.removed, id] };
  emit();
}

/** The way back, for the toast that offers it. */
export function restoreExtension(id: string): void {
  state = { ...state, removed: state.removed.filter((entry) => entry !== id) };
  emit();
}

/**
 * The address an extension's own page lives at.
 *
 * From the id with its dashes taken out, so `ublock-origin` is
 * `nexus://ublockorigin` — one rule rather than a field somebody has to
 * remember to fill in, and it cannot disagree with the id it came from.
 */
export function extensionUrl(id: string): string {
  return `nexus://${id.replace(/-/g, "")}`;
}

/** The extension a `nexus://` address names, if it names one. */
export function extensionForUrl(url: string): BrowserExtension | undefined {
  return getExtensions().find((entry) => extensionUrl(entry.id) === url);
}
