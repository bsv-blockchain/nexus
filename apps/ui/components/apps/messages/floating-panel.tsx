"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";

/**
 * Gap between the anchor and the panel, and the minimum margin to the window.
 *
 * The gap is bridged by an invisible strip on the panel, so the pointer never
 * crosses dead space on its way over — a gap with nothing in it is the reason
 * hover panels feel like they run away from you.
 */
const GAP = 6;
const EDGE = 8;

/** Marks the portalled panel so an outside-click test can recognise it. */
const PANEL_ATTR = "data-floating-panel";

/**
 * Close on an outside click or Escape, counting the panel as inside.
 *
 * Shared because getting it wrong is silent and total: the panel is portalled
 * to the document root, so it is not a descendant of its trigger. A handler
 * that tests only the trigger sees `mousedown` inside the panel as an outside
 * click, unmounts the panel, and the `click` never lands — every control in it
 * is dead, with nothing in the console to say so.
 */
export function useDismissOnOutside(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  /** the state setter itself, so the listeners subscribe once per open */
  setOpen: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && anchor.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[${PANEL_ATTR}]`)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor, setOpen]);
}

/**
 * A panel anchored to something, rendered at the document root.
 *
 * Portalled rather than positioned inside its trigger, because the triggers
 * live in the message scroller: an absolutely-positioned panel is clipped by
 * that `overflow-y-auto` the moment it extends past it, and no z-index can undo
 * clipping. Being at the root also puts it above every stacking context in the
 * app rather than only above its siblings.
 *
 * Placement is measured, not assumed: it opens downward when there is no room
 * above, and is clamped so it can never leave the window on either axis.
 * Positioned imperatively in a ref callback and on scroll, so following the
 * anchor costs no re-renders.
 */
export function FloatingPanel({
  anchor,
  align = "start",
  label,
  children,
  onPointerEnter,
  onPointerLeave,
}: {
  anchor: RefObject<HTMLElement | null>;
  /** which edge of the anchor the panel lines up with */
  align?: "start" | "end";
  label: string;
  children: ReactNode;
  /**
   * Hover handlers for the panel itself. It is portalled out of the trigger, so
   * the trigger's own pointer-leave fires as soon as you move toward it — the
   * panel has to be able to say "the pointer is over me, stay open".
   */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}): ReactNode {
  const panel = useRef<HTMLDivElement | null>(null);

  const position = (node: HTMLDivElement | null): void => {
    if (node) panel.current = node;
    const element = panel.current;
    const target = anchor.current;
    if (!element || !target) return;

    const a = target.getBoundingClientRect();
    const p = element.getBoundingClientRect();
    const roomAbove = a.top - GAP - EDGE;
    const openDown = roomAbove < p.height;

    const top = openDown ? a.bottom + GAP : a.top - p.height - GAP;
    const left = align === "end" ? a.right - p.width : a.left;

    element.style.top = `${Math.max(
      EDGE,
      Math.min(top, window.innerHeight - p.height - EDGE),
    )}px`;
    element.style.left = `${Math.max(
      EDGE,
      Math.min(left, window.innerWidth - p.width - EDGE),
    )}px`;
    element.style.visibility = "visible";
  };

  useEffect(() => {
    const onMove = (): void => position(null);
    // `capture` so inner scrollers count, not just the window.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={position}
      role="dialog"
      aria-label={label}
      {...{ [PANEL_ATTR]: "" }}
      // Hidden until measured, so it never paints at the wrong place first.
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="z-100"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Catches the pointer while it crosses the gap from the trigger. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -top-2 -bottom-2 -z-10"
      />
      {children}
    </div>,
    document.body,
  );
}
