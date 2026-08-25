"use client";

/**
 * Sites this session has granted the wallet to, on top of the seeded ones.
 *
 * The fixtures in lib/data are three sites somebody connected before this
 * session started. These are the ones connected DURING it — by opening a
 * metanet-enabled site while auto-connect is on, or by putting one on the rail.
 * Kept apart from the fixtures so the two never have to be merged into one
 * mutable table, and so turning the demo's history off does not take a grant
 * somebody just made with it.
 *
 * Persisted, because a connection is a permission. One that forgets itself on
 * reload would ask again on every launch, which is how people learn to click
 * through the asking.
 *
 * @see components/apps/browser-app.tsx — where the grant is actually made
 * @see lib/settings-store.ts `autoConnectSites` — whether it is made at all
 */

import type { Connection } from "@/lib/data/types";
import { useSyncExternalStore } from "react";

const KEY = "nexus.grantedConnections";

export interface GrantedConnection extends Connection {
  /** the wallet that was active when the grant was made */
  walletId: string;
  /** the workspace it was made in; a grant is per workspace, like the wallet */
  spaceId: string;
}

function read(): GrantedConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GrantedConnection[]) : [];
  } catch {
    return [];
  }
}

/* Empty until hydration, for the reason lib/content-mode spells out: this is
   read during render and the server has no storage to read it from. */
let granted: GrantedConnection[] = [];
const listeners = new Set<() => void>();
const EMPTY: GrantedConnection[] = [];

function emit(): void {
  for (const listener of listeners) listener();
}

export function hydrateGrantedConnections(): void {
  const stored = read();
  if (stored.length === 0 && granted.length === 0) return;
  granted = stored;
  emit();
}

function write(next: GrantedConnection[]): void {
  granted = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* In-memory only, which lasts the session. */
  }
  emit();
}

export function getGrantedConnections(): GrantedConnection[] {
  return granted;
}

export function useGrantedConnections(): GrantedConnection[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => granted,
    () => EMPTY,
  );
}

/** The origin of a URL, or the URL itself where it will not parse. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Grant the active wallet to a site, unless it already has it.
 *
 * Idempotent by origin AND workspace: the same site opened in Work and in
 * Personal is two grants, because it is two wallets — which is the whole reason
 * a workspace has one. Re-opening it in the same workspace is not a second
 * grant and must not stack a second row.
 */
export function grantConnection(entry: {
  origin: string;
  name: string;
  category: Connection["category"];
  walletId: string;
  spaceId: string;
  now: string;
}): void {
  const already = granted.some(
    (row) => row.origin === entry.origin && row.spaceId === entry.spaceId,
  );
  if (already) return;
  write([
    ...granted,
    {
      id: `conn-granted-${entry.spaceId}-${entry.origin}`,
      name: entry.name,
      category: entry.category,
      origin: entry.origin,
      /* The favicon component derives the real one from the origin; these two
         are only the fallback tile, for a site that serves none. */
      favicon: entry.name.slice(0, 1).toUpperCase(),
      faviconColor: "#4353ff",
      /* What auto-connect actually grants: the identity handshake and nothing
         else. Spending is a separate ask, every time, and a switch in
         Preferences must not be able to hand that out quietly. */
      permissions: ["identity"],
      lastUsedAt: entry.now,
      createdAt: entry.now,
      walletId: entry.walletId,
      spaceId: entry.spaceId,
    },
  ]);
}

export function revokeGranted(id: string): void {
  write(granted.filter((row) => row.id !== id));
}
