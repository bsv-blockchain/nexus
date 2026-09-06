"use client";

/**
 * Show the wallet setup screen on demand, from the demo controls.
 *
 * The gate is the one screen in the product that nobody can navigate to. It
 * stands in front of everything when a live build reports no wallet, which
 * means seeing it takes a live build, an empty keychain and a restart — and
 * once it has been through, getting back to it means throwing the wallet away.
 * So it was the screen least looked at and most often wrong.
 *
 * A flag, held in memory rather than in storage: a preview that survived a
 * reload would be a demo build that had locked itself behind an onboarding
 * screen it cannot complete, with no obvious way back. It ends when the tab
 * does, and there is a way out of it on the screen itself.
 *
 * @see components/hub/phase-switcher.tsx — the way in
 * @see components/hub/wallet-gate.tsx — what it shows
 */

import { useSyncExternalStore } from "react";

let showing = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showGatePreview(): void {
  if (showing) return;
  showing = true;
  emit();
}

export function hideGatePreview(): void {
  if (!showing) return;
  showing = false;
  emit();
}

export function useGatePreview(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => showing,
    /* Never during the prerender: the server has no demo controls to have
       pressed, and a gate in the HTML would flash over the app on every load. */
    () => false,
  );
}
