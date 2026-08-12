"use client";

import { storageKeys } from "@/lib/config";
import { useSyncExternalStore } from "react";

/**
 * Which sources the reader has shut.
 *
 * Stored as the collapsed ones rather than the open ones, so a source added
 * later arrives open. The opposite — remembering what is expanded — would mean
 * every new source in a repository list you already curated shows up collapsed
 * and silently missing from the page.
 *
 * Persisted because collapsing a source is a statement about how you want the
 * store to look, and having to make it again on every visit is what makes
 * people stop bothering.
 */
function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKeys.collapsedRepos);
    if (!raw) return new Set();
    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? new Set(saved.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

let snapshot: Set<string> | null = null;
const listeners = new Set<() => void>();
const EMPTY: Set<string> = new Set();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached, because `useSyncExternalStore` compares snapshots by identity. */
function getSnapshot(): Set<string> {
  snapshot ??= read();
  return snapshot;
}

/** The server has no storage, and nothing there has been shut. */
function getServerSnapshot(): Set<string> {
  return EMPTY;
}

export function toggleRepoCollapsed(id: string): void {
  const next = new Set(getSnapshot());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  snapshot = next;
  try {
    window.localStorage.setItem(
      storageKeys.collapsedRepos,
      JSON.stringify([...next]),
    );
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  for (const listener of listeners) listener();
}

export function useCollapsedRepos(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
