"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useHostOverlay } from "@/lib/wallet-data";
import { useEffect, type ReactNode } from "react";

/** The widest menu this renders; used to keep one on screen near an edge. */
const MENU_WIDTH = 288;

/**
 * Lightweight anchored popover: render inside a `relative` wrapper next to
 * the trigger. A fixed backdrop handles click-outside; Escape closes.
 *
 * Pass `anchor` where the trigger sits inside a column that clips — the browser
 * sidebar is `overflow-hidden`, so an absolutely-positioned menu wider than the
 * column gets sliced off no matter what its z-index says. With an anchor the
 * menu is portalled to the body and placed from the trigger's own rect, which
 * takes it out of every clip and stacking context on the way up.
 */
export function PopoverMenu({
  open,
  onClose,
  children,
  className = "",
  label,
  anchor,
  align = "end",
  width,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
  /**
   * The trigger's rect, captured at click. Portals the menu when given.
   *
   * A rect rather than a ref, because measuring in an effect means setting
   * state during render's aftermath — the pattern the rail and the theme picker
   * already avoid for the same reason.
   */
  anchor?: { top: number; left: number; right: number; bottom: number };
  /** which edge of the trigger the menu lines up with */
  align?: "start" | "end";
  /**
   * Pin the menu to this width, in px — normally the trigger's own.
   *
   * A menu that picks one value for a field reads as part of the field, and a
   * fixed 256px hanging under a 308px control looks like a different element
   * that happened to open nearby. Also replaces MENU_WIDTH in the edge clamp
   * below, which would otherwise keep a wider menu on screen by the wrong
   * margin.
   */
  width?: number;
}): ReactNode {
  /*
   * Hold the shell's page layer down while this is up.
   *
   * A browsed page is a native view in both shells — a WebContentsView on the
   * desktop, a native web view on mobile — and a native view is a sibling of
   * this document that always paints ABOVE it. No z-index reaches over one, so
   * without this the surface renders perfectly and is then completely hidden
   * behind whatever tab happens to be open.
   *
   * Held by the primitive rather than by each caller, because "remember to call
   * useHostOverlay" is a rule that gets forgotten exactly once and then fails
   * silently. A no-op in a plain browser, which has no page layer to hide.
   */
  useHostOverlay(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /* Placed from the trigger's own rect, flush with the chosen edge and nudged
     back inside the viewport if that would overflow it. */
  const menuWidth = width ?? MENU_WIDTH;
  /*
   * Opens downward, and flips up when there is no room.
   *
   * Automatic rather than a prop: a caller cannot know where its trigger will
   * be. The help circle is pinned to the bottom of the window, so a menu that
   * only ever opened downward opened entirely off screen — and any trigger low
   * enough has the same problem.
   *
   * `bottom` rather than a computed `top`, so the flip does not need the
   * menu's height, which is not known until it has rendered.
   */
  const flip = anchor ? window.innerHeight - anchor.bottom < 320 : false;
  const rect = anchor
    ? {
        ...(flip
          ? { bottom: window.innerHeight - anchor.top + 8 }
          : { top: anchor.bottom + 8 }),
        left: Math.max(
          8,
          align === "end"
            ? Math.min(
                anchor.right - menuWidth,
                window.innerWidth - menuWidth - 8
              )
            : anchor.left
        ),
      }
    : null;

  if (!open) return null;

  const body = (
    <>
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label={label}
        style={{
          ...(rect ? rect : {}),
          ...(width ? { width } : {}),
        }}
        /* `min-w-56` only where no width was given: with one, it is the floor
           that would stop a narrow trigger's menu from matching it. */
        className={`${rect ? "fixed" : "absolute"} ${
          width ? "" : "min-w-56"
        } border-border bg-surface-raised z-50 rounded-2xl border p-1.5 shadow-2xl ${className}`}
      >
        {children}
      </div>
    </>
  );

  return anchor ? createPortal(body, document.body) : body;
}

export function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  hasSubmenu = false,
  destructive = false,
}: {
  icon?: LucideIcon;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  hasSubmenu?: boolean;
  destructive?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
        destructive ? "text-negative" : ""
      }`}
    >
      {Icon && (
        <Icon
          className={`size-4 shrink-0 ${destructive ? "" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {shortcut}
        </span>
      )}
      {hasSubmenu && (
        <ChevronRight
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function MenuSeparator(): ReactNode {
  return <div className="bg-border mx-2 my-1 h-px" aria-hidden="true" />;
}
