"use client";

/**
 * Room above the page, for the things that have to be seen over it.
 *
 * A browsed page is a native view painting above this whole document, so a
 * dropdown in the browser's chrome opens *behind* it — no z-index reaches a
 * sibling the compositor puts on top. The existing answer is `useHostOverlay`,
 * which asks the shell to take the page away entirely. That works for a sheet
 * that owns the screen and is wrong for a menu: hiding the site to show a
 * filter for the site is answering the question by removing it.
 *
 * So: reserve the pixels instead. The toolbar renders a spacer of this height,
 * which shrinks the pane below it, which fires the ResizeObserver that already
 * re-pushes the page's rect. The page moves down by the height of the menu, the
 * menu draws into the gap, and both are on screen at once — which is what
 * somebody narrowing a filter is actually trying to do.
 *
 * A spacer rather than arithmetic on the bounds: the layout already knows how
 * to move that pane, and doing it in the document means the web build gets the
 * same behaviour without a shell to ask.
 *
 * @see components/apps/browser/tumble-bar.tsx, which renders the spacer
 */

import { useSyncExternalStore } from "react";

const holders = new Map<string, number>();
let total = 0;
const listeners = new Set<() => void>();

function recount(): void {
  /* The tallest claim wins rather than the sum. Two menus open at once want
     the same gap, not two stacked gaps — and only one of them can be under the
     pointer anyway. */
  const next = Math.max(0, ...holders.values());
  if (next === total) return;
  total = next;
  for (const listener of listeners) listener();
}

/** Claim `height` pixels above the page until the returned function is called. */
export function reserveTop(key: string, height: number): () => void {
  holders.set(key, height);
  recount();
  return () => {
    holders.delete(key);
    recount();
  };
}

export function getReservedTop(): number {
  return total;
}

export function useReservedTop(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => total,
    () => 0,
  );
}
