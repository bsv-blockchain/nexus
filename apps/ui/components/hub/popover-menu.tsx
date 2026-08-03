"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Lightweight anchored popover: render inside a `relative` wrapper next to
 * the trigger. A fixed backdrop handles click-outside; Escape closes.
 */
export function PopoverMenu({
  open,
  onClose,
  children,
  className = "",
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}): ReactNode {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label={label}
        className={`absolute z-50 min-w-56 rounded-2xl border border-border bg-surface-raised p-1.5 shadow-2xl ${className}`}
      >
        {children}
      </div>
    </>
  );
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
