"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Centered modal card on a dark overlay. Backdrop click and Escape close it. */
export function Dialog({
  open,
  onClose,
  label,
  children,
  showClose = true,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  showClose?: boolean;
  className?: string;
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring absolute top-3 right-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
