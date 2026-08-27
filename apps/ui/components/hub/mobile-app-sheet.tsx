"use client";

/**
 * An app's contextual column, on a phone.
 *
 * Fifteen apps have one — Mail's folders, Messages' conversations, the vault's
 * sections, the wallet's areas, the roadmap's filters — and every one of them
 * lives in the panel beside the icon rail, which the shell hides below `md`.
 * Four of the fifteen had built their own mobile root and kept working. The
 * other eleven showed a canvas with no way to move around it.
 *
 * The same component in a sheet, rather than eleven second implementations
 * that would drift from the columns they were copied from within a fortnight.
 *
 * It opens from the chevron on the browse bar, which is the control that
 * already means "more about what is on screen" — for a page that is the page's
 * options, and for an app it is the app's list. Same corner, same question,
 * the answer that fits what is actually there.
 *
 * Nearly full height on purpose. These are lists: a conversation list that can
 * show four rows is a list you scroll past rather than one you read.
 */

import {
  AppContextSidebar,
  hasContextSidebar,
} from "@/components/hub/app-context-sidebar";
import type { AppSlug } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function MobileAppSheet({
  slug,
  onClose,
}: {
  slug: AppSlug;
  onClose: () => void;
}): ReactNode {
  /* Belt and braces: the bar only offers this where there is one, and an empty
     sheet is a worse answer than no sheet. */
  if (!hasContextSidebar(slug)) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <motion.button
        type="button"
        aria-label={content.messages.media.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={content.appMenu.pickApp}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="bg-surface relative h-[calc(100dvh-1rem)] overflow-hidden rounded-t-[28px] p-3 shadow-2xl"
      >
        <AppContextSidebar slug={slug} onClose={onClose} />
      </motion.div>
    </div>
  );
}
