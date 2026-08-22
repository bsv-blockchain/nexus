"use client";

import { storageKeys } from "@/lib/config";
import { getDefaultRepositories, type AppRepository } from "@/lib/data";
import { useSyncExternalStore } from "react";

/**
 * Which sources the store is reading from.
 *
 * Lifted out of the repositories sheet once the store itself had to group by
 * repo: the sheet owned this in local state, so toggling a source updated the
 * sheet and left the catalogue behind it showing apps from a repo that was no
 * longer switched on. One module store, two readers, no reconciliation.
 *
 * Name, address, note and version history come from the build; only `enabled`
 * comes from storage. The old version kept whatever was saved, so renaming a
 * built-in left everybody who had ever opened the sheet looking at the old name
 * forever — which is exactly what happened to Open Protocol Labs. Built-ins
 * also come back in the build's order, so adding one does not bury it under a
 * list somebody assembled months ago.
 */
function read(): AppRepository[] {
  const defaults = getDefaultRepositories();
  try {
    const raw = window.localStorage.getItem(storageKeys.repositories);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as AppRepository[];
    const savedById = new Map(saved.map((repo) => [repo.id, repo]));
    const builtInIds = new Set(defaults.map((repo) => repo.id));
    const builtIns = defaults.map((repo) => ({
      ...repo,
      enabled: savedById.get(repo.id)?.enabled ?? repo.enabled,
    }));
    const added = saved.filter((repo) => !builtInIds.has(repo.id));
    return [...builtIns, ...added];
  } catch {
    return defaults;
  }
}

let snapshot: AppRepository[] | null = null;
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

/** Cached, because `useSyncExternalStore` compares snapshots by identity. */
function getSnapshot(): AppRepository[] {
  snapshot ??= read();
  return snapshot;
}

/** The server has no storage, so it renders the build's defaults. */
function getServerSnapshot(): AppRepository[] {
  return getDefaultRepositories();
}

/**
 * The current list, outside React.
 *
 * For callers that have to read-modify-write in an event handler — the first
 * run's preset applier switches two sources on and must not clobber the rest.
 */
export function getRepositoriesSnapshot(): AppRepository[] {
  return getSnapshot();
}

export function setRepositories(next: AppRepository[]): void {
  snapshot = next;
  try {
    window.localStorage.setItem(storageKeys.repositories, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  emit();
}

export function useRepositories(): AppRepository[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Only the sources currently switched on, in the order they are listed. */
export function useEnabledRepositories(): AppRepository[] {
  return useRepositories().filter((repo) => repo.enabled);
}
