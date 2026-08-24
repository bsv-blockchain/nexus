"use client";

import { AnimatePresence, motion } from "motion/react";
import { useHostOverlay } from "@/lib/wallet-data";
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
  full = false,
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
  /**
   * Drop the `max-w-md` cap and fill the width.
   *
   * For sheets that are a list of destinations rather than a card of content:
   * a menu narrower than the sheet it replaced reads as a smaller thing having
   * opened, not as the same list in a different frame.
   */
  full?: boolean;
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
            className={`bg-surface-raised text-foreground relative flex w-full flex-col overflow-hidden shadow-[0_-12px_90px_-8px_rgba(0,0,0,0.55)] ring-1 ring-black/10 dark:shadow-[0_-12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10 ${full ? "" : "max-w-md"} ${
              side
                ? "max-h-[92dvh] rounded-t-3xl sm:h-full sm:max-h-none sm:rounded-t-none sm:rounded-l-3xl"
                : "max-h-[92dvh] rounded-t-3xl"
            }`}
          >
            <div
              className={`flex shrink-0 justify-center pt-2.5 ${side ? "sm:hidden" : ""}`}
              aria-hidden="true"
            >
              <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="border-border bg-surface-raised shrink-0 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
