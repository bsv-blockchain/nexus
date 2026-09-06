"use client";

import { content } from "@/lib/data";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

/** Width the pane takes from the app column on desktop. */
export const SIDE_PANE_WIDTH = 340;

/**
 * Reference panel docked beside the active app.
 *
 * Part of the layout, not an overlay: it takes width from the app column, so
 * whatever you opened it from narrows and stays readable rather than being
 * covered by a sheet with a matte over it. Rounded on its left edge only, since
 * its right edge is flush with the canvas.
 *
 * Below `sm` there is no width to give up, so it covers the app and takes a back
 * affordance, reading as a second page rather than a squeeze. Both variants are
 * rendered and selected by breakpoint, so neither carries the other's
 * compromises.
 *
 * The header is sticky and the body is the only thing that scrolls. Horizontal
 * overflow is clipped rather than scrolled: a 340px column has no room for a
 * sideways scrollbar, so content wraps or truncates instead — which is why every
 * child here needs `min-w-0` and breakable text rather than fixed widths.
 */
export function SidePane({
  open,
  title,
  onClose,
  children,
  footer,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** pinned below the scroll area, for destructive or committing actions */
  footer?: ReactNode;
  /**
   * Controls on the header's trailing edge, for settings that belong to whatever
   * the pane is showing rather than to the pane itself.
   *
   * A slot rather than a fixed control, because this component frames a profile,
   * a vouch list and a conversation's settings alike — and a gear that means
   * something in one of those means nothing in the others.
   */
  actions?: ReactNode;
}): ReactNode {
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
      </div>
      {footer && (
        <div className="border-border bg-surface-raised shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            /* Animating width is what makes the app column give ground rather
               than the panel floating over it. */
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: SIDE_PANE_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            aria-label={title}
            className="border-border bg-surface-raised text-foreground relative z-30 hidden shrink-0 overflow-hidden rounded-l-xl border-l sm:block"
          >
            <div
              className="flex h-full flex-col"
              style={{ width: SIDE_PANE_WIDTH }}
            >
              {/* Close sits on the leading edge, as it does on mobile below.
                  On the trailing edge it landed on the exact point that opened
                  the pane: the control that opens this lives at the app
                  header's right edge, and opening it narrows that column out
                  from under the pointer, leaving the close button where the
                  cursor already was. The trigger looked like a toggle. */}
              <div className="border-border bg-surface-raised sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={content.messages.media.close}
                  className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1.5 shrink-0 rounded-md p-1.5"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {title}
                </h2>
                {actions && <span className="shrink-0">{actions}</span>}
              </div>
              {body}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="bg-background text-foreground fixed inset-0 z-80 flex flex-col sm:hidden"
          >
            <div className="border-border bg-background sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label={content.messages.back}
                className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1.5"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {title}
              </h2>
              {actions && <span className="shrink-0">{actions}</span>}
            </div>
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
