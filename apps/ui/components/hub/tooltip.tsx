"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** How long the pointer must rest before the tooltip appears. */
const DELAY_MS = 220;

/** Gap between the trigger and the panel. */
const OFFSET = 6;

/**
 * Room a top-side tooltip needs above the trigger before it gives up and flips
 * under it. One line of tooltip plus its offset, rounded up.
 */
const NEEDED_ABOVE = 34;

/**
 * Small hover/focus tooltip in the shadcn idiom — inverted surface, arrow,
 * short delay — without pulling in Radix for one primitive.
 *
 * `bg-foreground` with `text-background` inverts with the theme by itself, so
 * the tooltip is dark-on-light in a light theme and light-on-dark in a dark one,
 * including custom palettes.
 *
 * Focus shows it as well as hover, so keyboard users get the label too, and the
 * trigger keeps its own `aria-label` as the accessible name while the tooltip
 * is `aria-hidden` decoration. That avoids the doubled announcement you get
 * when a tooltip is wired as the label of an already-labelled control.
 *
 * PORTALLED, and placed from the trigger's own rect. It used to be an
 * `absolute` child, which put it inside every ancestor's overflow: the first row
 * of any scrolling list had its tooltip sliced off at the container's top edge,
 * because a panel above the first row is above the scroll box itself. Same
 * reason PopoverMenu portals — no z-index fixes a clip.
 *
 * The rect is captured when the tooltip opens rather than tracked, so a tooltip
 * does not follow a scroll it is already showing through. Pointer-leave closes
 * it long before that matters, and the alternative is a scroll listener per
 * tooltip on a page that has dozens.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: {
  /**
   * A word, or a small block of them.
   *
   * A node rather than a string because a workspace tab has four facts to state
   * and they belong on four lines. `whitespace-nowrap` is dropped when it is
   * not a plain string, since a block that cannot wrap is a block that runs off
   * the screen — a single-line label still gets it, which is what keeps every
   * other tooltip in the app the shape it was.
   */
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}): ReactNode {
  const [rect, setRect] = useState<{
    top: number;
    bottom: number;
    centre: number;
  } | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Nudges the panel back on-screen when a centred tooltip would overflow the
   * viewport. Icon rows put their first and last buttons close to an edge, and
   * a label is always wider than the 32px button it describes.
   *
   * Done in a ref callback rather than a layout effect: the measurement and the
   * correction are both writes to the node that just mounted, so there is no
   * state to round-trip through and no second render to pay for.
   */
  const place = (node: HTMLSpanElement | null): void => {
    if (!node) return;
    const pad = 8;
    const box = node.getBoundingClientRect();
    const over = Math.max(0, box.right + pad - window.innerWidth);
    const under = Math.max(0, pad - box.left);
    const shift = under > 0 ? under : -over;
    if (!shift) return;
    node.style.marginLeft = `${shift}px`;
    // The arrow keeps pointing at the trigger, so it cancels the panel's shift.
    const arrow = node.querySelector<HTMLElement>("[data-arrow]");
    if (arrow) arrow.style.marginLeft = `${-shift}px`;
  };

  const show = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const element = wrap.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      setRect({
        top: box.top,
        bottom: box.bottom,
        centre: box.left + box.width / 2,
      });
    }, DELAY_MS);
  };
  const hide = (): void => {
    if (timer.current) clearTimeout(timer.current);
    setRect(null);
  };

  /* Asked for the top, given the top only where there is room for it. Near the
     top of the window there is not, and a clamped tooltip would sit on the
     control it is describing. */
  const above = side === "top" && (rect?.top ?? 0) >= NEEDED_ABOVE;

  return (
    <span
      ref={wrap}
      className={`relative inline-flex ${className}`}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {rect &&
        createPortal(
          <span
            ref={place}
            aria-hidden="true"
            style={{
              left: rect.centre,
              top: above ? rect.top - OFFSET : rect.bottom + OFFSET,
              transform: above
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
            }}
            className={`bg-foreground text-background pointer-events-none fixed z-100 rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${
              typeof label === "string" ? "whitespace-nowrap" : "max-w-56"
            }`}
          >
            {label}
            <span
              data-arrow=""
              className={`bg-foreground absolute left-1/2 size-1.5 -translate-x-1/2 rotate-45 ${
                above ? "-bottom-0.5" : "-top-0.5"
              }`}
            />
          </span>,
          document.body
        )}
    </span>
  );
}
