"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
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
}): ReactNode {
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
  const rect = anchor
    ? {
        top: anchor.bottom + 8,
        left: Math.max(
          8,
          align === "end"
            ? Math.min(anchor.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
            : anchor.left,
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
        style={rect ? { top: rect.top, left: rect.left } : undefined}
        className={`${
          rect ? "fixed" : "absolute"
        } z-50 min-w-56 rounded-2xl border border-border bg-surface-raised p-1.5 shadow-2xl ${className}`}
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
      className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover ${
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
        <span className="shrink-0 text-xs text-muted-foreground">
          {shortcut}
        </span>
      )}
      {hasSubmenu && (
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function MenuSeparator(): ReactNode {
  return <div className="mx-2 my-1 h-px bg-border" aria-hidden="true" />;
}
