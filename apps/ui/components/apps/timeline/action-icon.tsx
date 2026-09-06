"use client";

/**
 * An action's icon, hollow until the action is taken.
 *
 * Two stacked copies rather than one that animates its `fill`, because a fill
 * cannot scale from nothing — it appears at full size the instant the attribute
 * flips, which is the opposite of a gesture. Growing a solid heart out of the
 * middle of the hollow one, past its own size and back, is the gesture;
 * shrinking it away leaves the outline that was underneath the whole time.
 *
 * Shared by the feed row and the thread's larger row so the two cannot end up
 * with different-feeling likes.
 */

import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/*
 * Overshoot and settle.
 *
 * A spring rather than keyframed scales, so an undo is the same motion running
 * back from wherever it had got to — tapping twice quickly should not have to
 * wait for the first animation to finish being wrong.
 */
const OVERSHOOT = {
  type: "spring" as const,
  stiffness: 700,
  damping: 15,
  mass: 0.5,
};

export function ActionIcon({
  icon: Icon,
  size,
  filled = false,
}: {
  icon: LucideIcon;
  /** a Tailwind size class, since the feed and the thread set different ones */
  size: string;
  filled?: boolean;
}): ReactNode {
  return (
    <span className="relative grid shrink-0 place-items-center">
      <Icon className={size} aria-hidden="true" />
      {/* AnimatePresence so the fill has somewhere to shrink to on the way out.
          Without it React drops the node and the heart simply vanishes. */}
      <AnimatePresence initial={false}>
        {filled ? (
          <motion.span
            key="fill"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={OVERSHOOT}
            className="absolute inset-0 grid place-items-center"
          >
            <Icon className={size} fill="currentColor" aria-hidden="true" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
