"use client";

/**
 * The master switch for everything only a developer should see.
 *
 * Its own module rather than a field on {@link file://./settings-store.ts}
 * for two reasons. It is read from all over the app — Browse, Settings, the
 * wallet, whatever comes next — and a module that pulls in the whole settings
 * store to answer one boolean drags a lot of unrelated state with it. And it
 * persists, which that store deliberately does not: its rule is that a
 * prototype should not remember a *policy* it cannot enforce, and this is not a
 * policy, it is whether you are shown a panel.
 *
 * ## Hooking a feature to it
 *
 * Two ways, and they are the whole API:
 *
 * ```tsx
 * <DeveloperOnly>
 *   <SomeDiagnosticPanel />
 * </DeveloperOnly>
 * ```
 *
 * ```ts
 * const dev = useDeveloperMode();
 * if (dev) rows.push(rawJsonRow);
 * ```
 *
 * Prefer the wrapper in JSX and the hook when the answer changes a list, a
 * count or a branch. Both read the same store, so a feature cannot end up
 * gated on a copy that has drifted.
 */

import { storageKeys } from "@/lib/config";
import { useSyncExternalStore, type ReactNode } from "react";

/** Off until somebody turns it on, on every device, every time. */
const DEFAULT = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(storageKeys.developerMode) === "1";
  } catch {
    /* storage unavailable — a private window, or a shell that blocks it */
    return DEFAULT;
  }
}

let snapshot: boolean | null = null;
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

/** Cached: `useSyncExternalStore` compares snapshots by identity. */
function getSnapshot(): boolean {
  snapshot ??= read();
  return snapshot;
}

/**
 * The server has no storage, so it renders as off.
 *
 * Which is also the honest answer for a first paint: developer surfaces
 * appearing a frame after everything else is right, and the opposite — shipping
 * them in the HTML and then hiding them — would put them in a page source that
 * a non-developer can read.
 */
function getServerSnapshot(): boolean {
  return DEFAULT;
}

export function setDeveloperMode(on: boolean): void {
  snapshot = on;
  try {
    window.localStorage.setItem(storageKeys.developerMode, on ? "1" : "0");
  } catch {
    /* storage unavailable — keep it for this session only */
  }
  emit();
}

/** Whether developer surfaces should be shown. */
export function useDeveloperMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Renders its children only when developer mode is on.
 *
 * Nothing else: no wrapper element, no styling, no placeholder when off. A gate
 * that left a box behind would change the layout of every screen it was used
 * on, and the point of this is that a normal install cannot tell it is there.
 */
export function DeveloperOnly({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return useDeveloperMode() ? children : null;
}
