"use client";

/**
 * A row of underlined tabs with a pinned control on the right.
 *
 * Two surfaces now want the same object — the Timeline's strips and the
 * Profiles panel's personas — and both want the same awkward part: the tabs
 * scroll, the `+` does not, and the tabs pass *underneath* it rather than
 * stopping short of it. A row that reserved space for the button would waste
 * that width on every screen wide enough not to need it.
 *
 * The scroller is full width and the button floats over its trailing edge on a
 * gradient, so the last tab fades under the control instead of colliding with
 * it. That gradient is the whole trick: without it a tab clipped mid-word under
 * an opaque button reads as a rendering fault.
 */

import type { ReactNode } from "react";
import { motion } from "motion/react";

export function TabRow({
  children,
  action,
  fade = "from-background",
  className = "",
}: {
  /** the tabs, normally <Tab> */
  children: ReactNode;
  /** the control pinned to the trailing edge */
  action?: ReactNode;
  /**
   * The colour the tabs fade into under the action, as a Tailwind `from-*`.
   *
   * It has to be the row's own background or the fade is a visible band of a
   * different colour behind the button — which is exactly what it looked like
   * when the feed moved onto `--surface` and this was still fading to
   * `--background`.
   */
  fade?: string;
  className?: string;
}): ReactNode {
  return (
    /* `overflow-hidden` so a caller that rounds a corner actually gets one: the
       fade is a square gradient pinned to the trailing edge and the action sits
       on top of it, and without clipping both paint straight into the radius. */
    <div className={`relative flex items-stretch overflow-hidden ${className}`}>
      {/* `scrollbar-none` because a horizontal bar under a tab row reads as a
          second, broken underline. */}
      <div className="scrollbar-none flex min-w-0 flex-1 overflow-x-auto">
        {children}
      </div>
      {action && (
        <>
          <span
            aria-hidden="true"
            className={`${fade} pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l to-transparent`}
          />
          <div className="absolute inset-y-0 right-0 flex items-stretch">
            {action}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One tab.
 *
 * The underline sits under the label's width, not the tab's, so a short tab and
 * a long one get rules in proportion to the words rather than to the padding —
 * which is what stops the row looking like a segmented control.
 *
 * `layoutId` is what makes the rule travel between tabs instead of cutting. Two
 * rows on screen at once must not share one, hence the required `group`.
 */
export function Tab({
  label,
  active,
  onClick,
  group,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** namespaces the travelling underline to this row */
  group: string;
  /** replaces the plain label, for tabs that carry a face or a close control */
  children?: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`focus-ring relative shrink-0 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
        active
          ? "text-foreground font-semibold"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {children ?? label}
      {active && (
        <motion.span
          layoutId={`tabrow-${group}`}
          className="bg-accent absolute inset-x-3 bottom-0 h-[3px] rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </button>
  );
}
