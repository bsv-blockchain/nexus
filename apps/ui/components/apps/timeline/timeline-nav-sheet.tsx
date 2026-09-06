"use client";

/**
 * The Timeline's contextual column, on a phone.
 *
 * Saved, Lists, Muted, the ecosystems and the topics live in the panel beside
 * the rail — and that whole column is inside the shell's `hidden md:block`, so
 * below `md` they were not merely cramped, they were absent. The feed was
 * there and nothing could aim it.
 *
 * A sheet rather than a second column, because there is no room for a second
 * column and because narrowing a feed is a thing you do and then stop doing:
 * you open it, pick, and it gets out of the way. Every setter the column can
 * reach closes this on its way through — see lib/timeline-store — so picking a
 * topic does not leave you looking at the sheet you picked it in.
 *
 * The search bar is deliberately not in here. It is already the middle button
 * of the browse bar at the bottom of the screen on the Timeline, which is
 * nearer the thumb than anything a sheet could offer.
 */

import { TimelineSidebar } from "@/components/apps/timeline/timeline-sidebar";
import { content } from "@/lib/data";
import { closeNav, useTimeline } from "@/lib/timeline-store";
import { useHostOverlay } from "@/lib/wallet-data";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export function TimelineNavSheet(): ReactNode {
  const { navOpen } = useTimeline();
  /* Take the native tab layer away while this is up: a browsed page in another
     tab is a native view that paints above this document. Called before the
     early return, because a hook cannot sit behind one. */
  useHostOverlay(navOpen);

  return (
    <AnimatePresence>
      {navOpen && (
        <>
          <motion.button
            type="button"
            aria-label={content.messages.media.close}
            onClick={closeNav}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 bg-black/50 md:hidden"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={content.timeline.title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            /* Top-4 rather than a short sheet: the column is a nav list, a set
               of ecosystems and a set of topics, which is taller than a phone
               — and a sheet that cannot reach its own last row is a dead end. */
            className="bg-surface fixed inset-x-0 top-4 bottom-0 z-75 overflow-hidden rounded-t-3xl md:hidden"
          >
            <TimelineSidebar asSheet />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
