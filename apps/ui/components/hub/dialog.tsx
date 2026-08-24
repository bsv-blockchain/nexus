"use client";

import { X } from "lucide-react";
import { useHostOverlay } from "@/lib/wallet-data";
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
        className={`border-border bg-surface-raised relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground absolute top-3 right-3 z-10 rounded-md p-1.5"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
