"use client";

import { Dialog } from "@/components/hub/dialog";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import { QrBlock } from "@/components/hub/qr-block";
import { ShareBackdrop } from "@/components/hub/share-backdrop";
import { content } from "@/lib/data";
import { useReducedMotion } from "@/lib/motion";
import { useSettings } from "@/lib/settings-store";
import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

const copy = content.identity.handles;

const EASE = [0.4, 0, 0.2, 1] as const;
/** Vela's QR easing — the overshoot is what makes the flip land rather than stop. */
const FLIP_EASE = [0.22, 1, 0.36, 1] as const;

const LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
};
/** Hinged below centre, so the code swings up into place rather than spinning. */
const CARD = {
  hidden: { opacity: 0, rotateX: 58, transformPerspective: 900 },
  show: {
    opacity: 1,
    rotateX: 0,
    transformPerspective: 900,
    transition: { duration: 0.7, ease: FLIP_EASE },
  },
};
/** Reduced motion: everything arrives, nothing travels. */
const STILL = { hidden: { opacity: 1 }, show: { opacity: 1 } };

/**
 * Your handle as something you hold up to a phone.
 *
 * The share card's little code mark was a picture of a code — 36px of icon that
 * nothing could scan and nothing could read. A code that is not big enough to
 * point a camera at is decoration, so it becomes a button into the thing it was
 * pretending to be.
 *
 * Built on the gift modal, deliberately: that is already the shell's answer to
 * "hand this to somebody", down to the collage behind it and the flip the code
 * arrives on. Two share surfaces that look unrelated is how a product stops
 * feeling like one.
 *
 * The face in the middle is the same one the card shows, generated mark
 * included. A code with a stranger's picture at its centre is the one thing
 * here that would actually mislead somebody, so it is never a default or a
 * placeholder — it is whatever this profile is currently wearing.
 */
export function HandleShareSheet({
  handle,
  link,
  onClose,
}: {
  handle: string;
  link: string;
  onClose: () => void;
}): ReactNode {
  const settings = useSettings();
  const still = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const item = still ? STILL : ITEM;

  const onCopy = (): void => {
    try {
      void navigator.clipboard?.writeText(link);
    } catch {
      /* clipboard unavailable — the button still confirms */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open onClose={onClose} label={copy.sheetLabel} className="max-w-sm">
      <ShareBackdrop>
        <motion.div
          variants={still ? STILL : LIST}
          initial="hidden"
          animate="show"
          className="relative z-10 px-7 pt-10 pb-7 text-center"
        >
          <motion.h2
            variants={item}
            className="text-3xl leading-[1.05] font-extrabold tracking-tight"
          >
            @{handle}
          </motion.h2>
          <motion.p
            variants={item}
            className="text-muted-foreground mt-3 text-sm text-pretty"
          >
            {copy.sheetSubhead}
          </motion.p>

          {/* The code, at a size somebody can actually point a phone at. */}
          <motion.div
            variants={still ? STILL : CARD}
            style={{ transformOrigin: "center 80%" }}
            className="mt-7 flex justify-center"
          >
            <QrBlock
              value={link}
              label={copy.sheetCodeLabel.replace("{handle}", `@${handle}`)}
              className="size-56"
            >
              <span className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white ring-4 ring-white">
                {settings.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={settings.avatar}
                    alt=""
                    aria-hidden="true"
                    className="size-full object-cover"
                  />
                ) : (
                  <IdentitySigil
                    value={handle}
                    size={56}
                    className="rounded-2xl"
                  />
                )}
              </span>
            </QrBlock>
          </motion.div>

          <motion.p
            variants={item}
            className="text-muted-foreground mt-5 text-xs text-pretty"
          >
            {copy.sheetScan.replace("{handle}", `@${handle}`)}
          </motion.p>

          {/* The link, then the button that takes it. Full contrast on the
              string itself: this is the one thing here somebody may need to
              read off the screen and type somewhere else. */}
          <motion.div
            variants={item}
            className="bg-surface-raised/85 ring-border/60 mt-5 overflow-hidden rounded-xl ring-1 backdrop-blur-sm"
          >
            <p className="text-foreground px-4 py-3 font-mono text-sm break-all">
              {link}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="focus-ring bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              {copied ? (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  {copy.copied}
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" />
                  {copy.copyLink}
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      </ShareBackdrop>
    </Dialog>
  );
}
