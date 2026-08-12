"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Movement below this is a wobble, not a scroll. */
const THRESHOLD = 6;
/** Within this of the top, the bar is always shown. */
const TOP_ZONE = 24;

/**
 * Whether the chrome should be out of the way.
 *
 * Listens in the capture phase on the document rather than to one element,
 * because there is no single scroller: the canvas is a different component per
 * app, several of them nest their own, and a hook that had to be handed the
 * right node would be a hook every new app has to remember to wire up. Scroll
 * events do not bubble, but they do capture.
 *
 * Position is tracked per scroller, so a list that is halfway down does not
 * read as a jump upward the moment a different one scrolls. The map is weak so
 * a scroller that unmounts takes its entry with it.
 *
 * Near the top the bar always comes back, whatever the direction: the top of a
 * page is where somebody is orienting themselves, and hiding navigation there
 * is hiding it exactly when it is wanted.
 */
export function useScrollDirection(enabled: boolean): {
  hidden: boolean;
  reveal: () => void;
} {
  const [hidden, setHidden] = useState(false);
  const positions = useRef<WeakMap<EventTarget, number> | null>(null);

  const reveal = useCallback(() => setHidden(false), []);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const onScroll = (event: Event): void => {
      const target = event.target;
      if (!target) return;
      const top =
        target === document || target === window
          ? window.scrollY
          : ((target as HTMLElement).scrollTop ?? 0);

      positions.current ??= new WeakMap();
      const previous = positions.current.get(target) ?? 0;
      const delta = top - previous;

      if (top <= TOP_ZONE) {
        positions.current.set(target, top);
        setHidden(false);
        return;
      }
      if (Math.abs(delta) < THRESHOLD) return;
      positions.current.set(target, top);
      setHidden(delta > 0);
    };

    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled]);

  return { hidden, reveal };
}
