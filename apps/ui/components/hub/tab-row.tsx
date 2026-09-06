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
  gap = "",
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
  /**
   * Space between tabs, as a Tailwind `gap-*`.
   *
   * Empty by default: every tab up to now has carried its own horizontal
   * padding, which is what held the row apart on its own. A `size="lg"` tab
   * has none — it is a heading standing in for what used to be plain text —
   * so the row has to make the room that padding is no longer making.
   */
  gap?: string;
}): ReactNode {
  return (
    /* `overflow-hidden` so a caller that rounds a corner actually gets one: the
       fade is a square gradient pinned to the trailing edge and the action sits
       on top of it, and without clipping both paint straight into the radius. */
    <div className={`relative flex items-stretch overflow-hidden ${className}`}>
      {/* `scrollbar-none` because a horizontal bar under a tab row reads as a
          second, broken underline. */}
      <div
        className={`scrollbar-none flex min-w-0 flex-1 overflow-x-auto ${gap}`}
      >
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
  size = "sm",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** namespaces the travelling underline to this row */
  group: string;
  /** replaces the plain label, for tabs that carry a face or a close control */
  children?: ReactNode;
  /**
   * `"lg"` for a tab standing in for what used to be a page's own `<h1>` —
   * the App Store's Discover/Manage pair, where the row IS the heading rather
   * than a strip of filters under one. Same size and weight the heading had,
   * and no horizontal padding: a heading does not indent from the margin
   * every other line on the page lines up against, so the tab that replaced
   * one should not either. `gap` on the enclosing `TabRow` is what holds it
   * apart from its neighbour instead.
   */
  size?: "sm" | "lg";
}): ReactNode {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`focus-ring relative shrink-0 whitespace-nowrap transition-colors ${
        lg
          ? "py-1 text-2xl font-bold tracking-tight"
          : "px-4 py-3 text-sm"
      } ${
        active
          ? `text-foreground ${lg ? "" : "font-semibold"}`
          : `text-muted-foreground hover:text-foreground ${lg ? "" : "hover:bg-surface-hover"}`
      }`}
    >
      {children ?? label}
      {active && (
        <motion.span
          layoutId={`tabrow-${group}`}
          className={`bg-accent absolute bottom-0 h-[3px] rounded-full ${lg ? "inset-x-0" : "inset-x-3"}`}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </button>
  );
}
