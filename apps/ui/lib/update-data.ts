"use client";

/**
 * The desktop auto-updater, as the chrome sees it.
 *
 * Every value here comes from the shell over `window.nexusHost` — the chrome has
 * no idea what version is published and no business guessing. Same shape as
 * lib/pay-data.ts: thin calls out, a subscription back, and no local opinion
 * about anything.
 *
 * `supported` and the presence of an updater are different questions, and the
 * About panel asks both. A build with no shell has no updater at all; a .deb
 * install has one that answers `supported: false, reason: "linux-package"`,
 * because electron-updater cannot replace a file the system package manager
 * owns. Telling that user "up to date" would be a claim nobody checked.
 */

import { useEffect, useState } from "react";

export interface UpdateState {
  supported: boolean;
  /** why not, when it is not: "dev" | "linux-package" */
  reason: string | null;
  checking: boolean;
  /** the version on offer, or null when there is none */
  available: string | null;
  downloading: boolean;
  percent: number;
  /** downloaded and waiting for a restart */
  ready: boolean;
  error: string | null;
  lastCheckedAt: string | null;
  currentVersion: string;
}

interface UpdateHost {
  has?: (name: string) => boolean;
  on?: (event: string, cb: (payload: unknown) => void) => () => void;
  update?: {
    state: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    install: () => Promise<unknown>;
  };
}

function host(): UpdateHost | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { nexusHost?: UpdateHost }).nexusHost ?? null;
}

/** Whether this shell has an updater surface at all. */
export function updateAvailable(): boolean {
  const h = host();
  return Boolean(h?.update && h.has?.("update"));
}

export async function checkForUpdate(): Promise<UpdateState | null> {
  const h = host();
  if (!h?.update) return null;
  return h.update.check();
}

export async function installUpdate(): Promise<void> {
  const h = host();
  if (!h?.update) return;
  await h.update.install();
}

/**
 * The shell's update state, kept current.
 *
 * Read once on mount and then pushed: a download that finishes while somebody is
 * on another screen still has to be there when they come back, and the shell —
 * not this hook — is what remembers it. The same check-then-subscribe as
 * components/hub/shell-version.tsx, for the same reason: on Android the host
 * client is injected asynchronously and can arrive after this mounts.
 */
export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;

    const attach = (): boolean => {
      const h = host();
      if (!h?.update) return false;
      h.update
        .state()
        .then((next) => {
          if (alive) setState(next);
        })
        .catch(() => {
          // A shell that cannot answer its own update state has bigger problems
          // than a missing panel; stay blank rather than invent one.
        });
      unsubscribe = h.on?.("update.state", (payload) => {
        if (alive) setState(payload as UpdateState);
      });
      return true;
    };

    if (!attach()) {
      const onReady = (): void => void attach();
      window.addEventListener("nexushost:ready", onReady, { once: true });
      return () => {
        alive = false;
        window.removeEventListener("nexushost:ready", onReady);
        unsubscribe?.();
      };
    }
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}

/** "2 minutes ago", for a check nobody needs to the second. */
export function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
