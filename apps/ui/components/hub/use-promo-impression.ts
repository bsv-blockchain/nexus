"use client";

/**
 * One impression per promo a reader has actually seen.
 *
 * The count used to happen on mount, which meant Discover recorded an
 * impression for every card on the page whether or not the reader ever
 * scrolled far enough to meet it, recorded a second one every time they came
 * back to the tab, and recorded two of everything in development where React
 * mounts each component twice on purpose. These numbers end up in a sponsor's
 * report, so all three of those are the same problem: the tool was counting
 * renders and calling them views.
 *
 * What counts now: half the card visible in the viewport, once per reader per
 * page load. The `counted` set is deliberately module-level rather than
 * per-component — scrolling a card out of view and back is the same reader
 * meeting the same placement, and charging a sponsor twice for it would be
 * the old bug wearing a better hat.
 */

import { useEffect, useRef } from "react";

/** Keyed `kind:id`, cleared by a reload, which is where a session ends. */
const counted = new Set<string>();

/** How much of a card has to be on screen before it counts as seen. */
const VISIBLE_FRACTION = 0.5;

export function useSeenOnce<T extends HTMLElement>(
  key: string,
  onSeen: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  /* Held in a ref so a caller can pass an inline arrow without re-arming the
     observer on every render of the row above it. Written in an effect
     rather than during render: the ref is not what this component draws
     with, and React's own rule about that is worth keeping even where the
     value happens to be a callback. */
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || counted.has(key)) return;
    /* No IntersectionObserver — a very old browser, or a test environment.
       Counting on mount is the old behaviour, which is wrong but is better
       than a placement that can never report anything at all. */
    if (typeof IntersectionObserver === "undefined") {
      counted.add(key);
      seen.current();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (counted.has(key)) return;
        counted.add(key);
        seen.current();
      },
      { threshold: VISIBLE_FRACTION },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [key]);

  return ref;
}
