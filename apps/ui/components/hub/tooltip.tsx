"use client";

import { useRef, useState, type ReactNode } from "react";

/** How long the pointer must rest before the tooltip appears. */
const DELAY_MS = 220;

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
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
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
    timer.current = setTimeout(() => setOpen(true), DELAY_MS);
  };
  const hide = (): void => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open && (
        <span
          ref={place}
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium whitespace-nowrap text-background shadow-lg ${
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {label}
          <span
            data-arrow=""
            className={`absolute left-1/2 size-1.5 -translate-x-1/2 rotate-45 bg-foreground ${
              side === "top" ? "-bottom-0.5" : "-top-0.5"
            }`}
          />
        </span>
      )}
    </span>
  );
}
