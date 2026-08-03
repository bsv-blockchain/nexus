"use client";

import { useEffect, type ReactNode } from "react";

const SCROLL_IDLE_MS = 900;

/**
 * Stamps `.is-scrolling` on whichever element is being scrolled and removes
 * it shortly after scrolling stops — globals.css only paints the custom
 * scrollbar thumb while that class is present.
 */
export function ScrollWatcher(): ReactNode {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();

    const onScroll = (event: Event): void => {
      const target =
        event.target instanceof Element
          ? event.target
          : document.documentElement;

      target.classList.add("is-scrolling");
      const existing = timers.get(target);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.set(
        target,
        window.setTimeout(() => {
          target.classList.remove("is-scrolling");
        }, SCROLL_IDLE_MS),
      );
    };

    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  return null;
}
