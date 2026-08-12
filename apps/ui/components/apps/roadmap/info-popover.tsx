"use client";

import { FloatingPanel } from "@/components/apps/messages/floating-panel";
import { useRef, useState, type ReactNode } from "react";

/**
 * A definition you can hover for, or click to pin.
 *
 * Hover alone is not enough: the panel carries a paragraph and a note from
 * whoever scoped the work, and a reader who wants to finish a sentence should
 * not lose it by drifting a few pixels. Clicking pins it open, which is also
 * the only way in on a touch screen.
 *
 * Built on {@link FloatingPanel} so it portals out of whatever it sits inside —
 * these live in a 340px side pane, and a panel clipped by its own scroll
 * container is a panel nobody can read.
 */
export function InfoPopover({
  label,
  trigger,
  children,
}: {
  /** accessible name for the trigger and the panel */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}): ReactNode {
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovering || pinned;

  return (
    <span ref={anchor} className="relative inline-flex">
      <button
        type="button"
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onClick={() => setPinned((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className="focus-ring hover:bg-surface-hover -mx-1 cursor-help rounded px-1 py-0.5 transition-colors"
      >
        {trigger}
      </button>

      {open && (
        <FloatingPanel
          anchor={anchor}
          align="end"
          label={label}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          <span className="border-border bg-surface-raised block w-64 rounded-xl border p-3 text-left shadow-xl">
            {children}
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}
