import type { Variants } from "motion/react";

/**
 * Shared variants for the library panel crossfade. A container orchestrates a
 * staggered reveal of its items on enter and reverses the stagger on exit, so
 * switching between the Profiles and Downloads panes reads as one motion that
 * plays forwards opening and backwards closing.
 *
 * The container carries no visual change itself — items own opacity/offset —
 * so nested containers (a list inside a panel) compose cleanly.
 */
const EASE = [0.4, 0, 0.2, 1] as const;

export const panelContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

export const panelItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.16, ease: EASE } },
};
