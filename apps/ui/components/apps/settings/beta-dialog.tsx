"use client";

import { Dialog } from "@/components/hub/dialog";
import { ShareBackdrop } from "@/components/hub/share-backdrop";
import { content } from "@/lib/data";
import { useReducedMotion } from "@/lib/motion";
import { TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

const copy = content.settings.about;

const EASE = [0.4, 0, 0.2, 1] as const;
const FLIP_EASE = [0.22, 1, 0.36, 1] as const;

const LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
};
/** The rocket arrives the way the share card does — hinged and swung up. */
const CARD = {
  hidden: { opacity: 0, rotateX: 58, transformPerspective: 900 },
  show: {
    opacity: 1,
    rotateX: 0,
    transformPerspective: 900,
    transition: { duration: 0.7, ease: FLIP_EASE },
  },
};
const STILL = { hidden: { opacity: 1 }, show: { opacity: 1 } };

/**
 * The confirmation in front of switching to Beta.
 *
 * The share modal's shape, because this is the same kind of moment: something
 * worth being pleased about that still needs saying out loud. The invitation is
 * the headline and the warning is a line you cannot miss — a dialog that only
 * enthuses is an advertisement, and one that only warns makes the thing sound
 * broken. Both are true here.
 *
 * Cancel is the wide, plain button and reads "Stay on Stable" rather than
 * "Cancel", so the safe option says what it does instead of only what it is not.
 */
export function BetaDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): ReactNode {
  const still = useReducedMotion();
  const item = still ? STILL : ITEM;

  return (
    <Dialog open onClose={onCancel} label={copy.channelBeta} className="max-w-sm">
      <ShareBackdrop>
        <motion.div
          variants={still ? STILL : LIST}
          initial="hidden"
          animate="show"
          className="relative z-10 px-7 pt-10 pb-7 text-center"
        >
          <motion.div variants={still ? STILL : CARD}>
            {/* An emoji rather than the product mark: this is not Nexus
                introducing itself, it is an invitation somewhere. */}
            <span className="block text-6xl leading-none" role="img" aria-label="Rocket">
              🚀
            </span>
          </motion.div>
          <motion.h2
            variants={item}
            className="mt-5 text-3xl leading-[1.05] font-extrabold tracking-tight whitespace-pre-line"
          >
            {copy.betaTitle}
          </motion.h2>
          <motion.p
            variants={item}
            className="text-muted-foreground mt-3 text-sm"
          >
            {copy.betaSubhead}
          </motion.p>

          <motion.div
            variants={item}
            className="bg-surface-raised/85 ring-border/60 mt-6 rounded-xl p-4 text-left ring-1 backdrop-blur-sm"
          >
            <p className="text-sm leading-relaxed text-pretty">
              {copy.betaBody}
            </p>
            {/* Centred against the whole warning rather than pinned to its
                first line, and at full strength: this is the one sentence in
                the dialog that argues against the button beside it, so it
                should not be the faintest thing on the card. */}
            <p className="border-warning/30 text-warning mt-3 flex items-center gap-2 border-t pt-3 text-xs leading-relaxed font-medium text-pretty">
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              {copy.betaWarning}
            </p>
          </motion.div>

          <motion.div variants={item} className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="focus-ring bg-surface-raised/85 ring-border/60 flex-1 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 backdrop-blur-sm"
            >
              {copy.betaCancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            >
              {copy.betaConfirm}
            </button>
          </motion.div>
        </motion.div>
      </ShareBackdrop>
    </Dialog>
  );
}
