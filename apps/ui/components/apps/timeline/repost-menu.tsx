"use client";

/**
 * The two things a repost button can mean.
 *
 * Pressing it outright would pick one, and X learned the same lesson: passing
 * somebody else's post on unchanged and passing it on with your own line are
 * different enough acts that the button has to ask. Two items, so the menu is
 * over as fast as a click would have been.
 *
 * Popover on a pointer, sheet on a phone, like every other menu here.
 */

import { MenuItem } from "@/components/hub/popover-menu";
import { content } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { openQuote, toggleRepost, useTimeline } from "@/lib/timeline-store";
import { PenLine, Repeat2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { ReactNode } from "react";

const copy = content.timeline.repostMenu;

export function RepostMenu({
  postId,
  authorId,
  anchor,
  onClose,
}: {
  postId: string;
  /** whose post, so Activity can name them */
  authorId: string;
  anchor: DOMRect | null;
  onClose: () => void;
}): ReactNode {
  return (
    <AnimatePresence>
      {anchor && (
        <Sheet
          key="repost"
          postId={postId}
          authorId={authorId}
          anchor={anchor}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function Sheet({
  postId,
  authorId,
  anchor,
  onClose,
}: {
  postId: string;
  authorId: string;
  anchor: DOMRect;
  onClose: () => void;
}): ReactNode {
  const isDesktop = useIsDesktop();
  const { reposted } = useTimeline();
  const on = reposted.includes(postId);

  const width = 200;
  /* Opens downward, flips up near the foot of the feed — the same rule the
     post menu follows, so two menus on one row never disagree about which way
     is out. */
  const below = window.innerHeight - anchor.bottom > 160;
  const pos = {
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
    ...(below
      ? { top: anchor.bottom + 8 }
      : { bottom: window.innerHeight - anchor.top + 8 }),
  };

  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.label}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-75 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="menu"
        aria-label={copy.label}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(isDesktop ? { style: { ...pos, width } } : {})}
        className={
          isDesktop
            ? `fixed rounded-2xl p-1.5 ${frame}`
            : `fixed inset-x-0 bottom-0 rounded-t-3xl p-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${frame}`
        }
      >
        {!isDesktop && (
          <div className="flex justify-center pb-2" aria-hidden="true">
            <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
          </div>
        )}
        <MenuItem
          icon={Repeat2}
          label={on ? copy.undoRepost : copy.repost}
          onClick={() => {
            toggleRepost(postId, authorId);
            toast.success(on ? copy.unreposted : copy.reposted);
            onClose();
          }}
        />
        <MenuItem
          icon={PenLine}
          label={copy.quote}
          onClick={() => {
            openQuote(postId);
            onClose();
          }}
        />
      </motion.div>
    </>
  );
}
