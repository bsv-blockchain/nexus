"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

/**
 * Bottom sheet, matching the app-permission sheet's geometry and spring so
 * every interstitial in Nexus feels like the same surface: docked to the bottom
 * edge, capped at `max-w-md` so it reads as a card on desktop rather than a
 * stretched bar, and scrollable within the viewport.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  footer,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** pinned below the scroll area, for confirm/cancel actions */
  footer?: ReactNode;
  /**
   * Dock to the right edge on desktop instead of the bottom. Reference
   * material for a person is easier to read beside the conversation than
   * covering it; below `sm` it still comes up from the bottom, where a side
   * panel would be the whole screen anyway.
   */
  side?: boolean;
}): ReactNode {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-80 flex ${
            side
              ? "items-end justify-center sm:items-stretch sm:justify-end"
              : "items-end justify-center"
          }`}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={side ? { y: "100%" } : { y: "100%" }}
            animate={{ y: 0, x: 0 }}
            exit={side ? { y: "100%" } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className={`relative flex w-full max-w-md flex-col overflow-hidden bg-surface-raised text-foreground shadow-[0_-12px_90px_-8px_rgba(0,0,0,0.55)] ring-1 ring-black/10 dark:shadow-[0_-12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10 ${
              side
                ? "max-h-[92dvh] rounded-t-3xl sm:h-full sm:max-h-none sm:rounded-t-none sm:rounded-l-3xl"
                : "max-h-[92dvh] rounded-t-3xl"
            }`}
          >
            <div
              className={`flex shrink-0 justify-center pt-2.5 ${side ? "sm:hidden" : ""}`}
              aria-hidden="true"
            >
              <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-border bg-surface-raised px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
