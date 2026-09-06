"use client";

import { Dialog } from "@/components/hub/dialog";
import { useHub } from "@/components/hub/hub-provider";
import { ShareBackdrop } from "@/components/hub/share-backdrop";
import { content } from "@/lib/data";
import { useReducedMotion } from "@/lib/motion";
import { Check, Copy, Gift } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

/** "Share Nexus with a friend" referral modal opened from the rail gift button. */
export function ShareModal(): ReactNode {
  const { shareOpen, setShareOpen } = useHub();
  if (!shareOpen) return null;
  return <ShareModalContent onClose={() => setShareOpen(false)} />;
}

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
/**
 * The card's own entrance: the 3D flip Vela gives its QR codes.
 *
 * Hinged below centre rather than through the middle, so it swings up into
 * place like something being laid down in front of you instead of spinning on
 * an axle. It takes the card's turn in the stagger rather than playing over the
 * top of it, so there is one motion to follow.
 */
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

/** Substitutes the sender's figure into a line of copy. */
function fill(template: string, amount: string): string {
  return template.replace("{amount}", amount);
}

/** Digits and at most one dot, so a half-typed "1." survives being typed. */
function sanitise(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  const head = (whole ?? "").slice(0, 4);
  return rest.length > 0 ? `${head}.${rest.join("").slice(0, 2)}` : head;
}

function ShareModalContent({ onClose }: { onClose: () => void }): ReactNode {
  const copy = content.share;
  const { shareCode: code } = useHub();
  const still = useReducedMotion();
  const [gift, setGift] = useState(true);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("0.10");

  const money = `$${amount === "" ? "0.00" : amount}`;
  const link = gift
    ? `https://nexus.xyz/gift/${code}`
    : `https://nexus.xyz/i/${code}`;
  const headline = gift
    ? fill(copy.giftHeadline, money)
    : copy.plainHeadline;
  const subhead = gift ? copy.giftSubhead : copy.plainSubhead;
  const message = gift ? fill(copy.giftMessage, money) : copy.plainMessage;

  const onCopy = (): void => {
    const text = `${message}\n\n${link}`;
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // clipboard unavailable — button still gives feedback
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  /* Normalised on the way out, not on every keystroke: rewriting "1" to "1.00"
     mid-type puts the caret behind two characters nobody asked for. */
  const settleAmount = (): void => {
    const parsed = Number.parseFloat(amount);
    setAmount(!Number.isFinite(parsed) || parsed <= 0 ? "0.10" : parsed.toFixed(2));
  };

  const item = still ? STILL : ITEM;

  return (
    <Dialog open onClose={onClose} label="Share Nexus" className="max-w-sm">
      <ShareBackdrop>
        <motion.div
          variants={still ? STILL : LIST}
          initial="hidden"
          animate="show"
          className="relative z-10 px-7 pt-10 pb-7 text-center"
        >
          <motion.div variants={item}>
            <Image
              src="/icons/Nexus-logo-solid-BG2.png"
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
              className="mx-auto rounded-[22%]"
            />
          </motion.div>
          <motion.h2
            variants={item}
            className="mt-5 text-3xl leading-[1.05] font-extrabold tracking-tight whitespace-pre-line"
          >
            {headline}
          </motion.h2>
          <motion.p
            variants={item}
            className="text-muted-foreground mt-3 text-sm"
          >
            {subhead}
          </motion.p>

          {/* Receipt-style card. Raised and ringed rather than flat: the ground
              behind it is the collage now, and a card the same colour as what it
              sits on stops reading as a card. */}
          <motion.div
            variants={still ? STILL : CARD}
            style={{ transformOrigin: "center 80%" }}
            className="bg-surface-raised/85 ring-border/60 mt-6 overflow-hidden rounded-xl ring-1 backdrop-blur-sm"
          >
            <div className="p-4 text-center">
              <p className="text-sm leading-relaxed text-balance">{message}</p>
              {/* Full contrast, not the accent. This is the one string somebody
                  may need to read off the screen and type somewhere else, and
                  accent-on-surface is the lowest-contrast text in the modal. */}
              <p className="text-foreground mt-3 font-mono text-sm break-all">
                {link}
              </p>
            </div>
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
                  {copy.copy}
                </>
              )}
            </button>
          </motion.div>

          {/* Gift row. A row rather than one big button, because the amount is
              an input now and an input inside a button is neither valid nor
              clickable — every attempt to type would have flipped the switch. */}
          <motion.div
            variants={item}
            className="bg-surface-raised/85 ring-border/60 mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 backdrop-blur-sm"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                gift
                  ? "bg-accent/15 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              <Gift className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium">
              {copy.toggleLead}
              {/* A bordered field rather than an underline: this is the one
                  thing in the modal somebody is meant to change, and a dashed
                  rule under a number reads as emphasis, not as an input. The
                  `$` sits inside the box so the field is the whole amount. */}
              <span
                className={`focus-within:ring-accent border-border bg-surface inline-flex items-baseline rounded-md border px-1.5 py-0.5 transition-shadow focus-within:ring-2 ${
                  gift ? "" : "text-muted-foreground opacity-60"
                }`}
              >
                $
                <input
                  value={amount}
                  onChange={(event) => setAmount(sanitise(event.target.value))}
                  onBlur={settleAmount}
                  onFocus={(event) => event.target.select()}
                  disabled={!gift}
                  inputMode="decimal"
                  aria-label={copy.amountLabel}
                  /* Sized to its content so the row reads as a sentence with an
                     editable word in it, not as a form field parked in a label. */
                  /* `field-sizing: content` grows the box to the value as it
                     is typed. `size` stays as the fallback for browsers
                     without it — it grows in character widths rather than
                     pixels, which is coarse but never clips. */
                  size={Math.max(amount.length, 1)}
                  className="field-sizing-content min-w-[1ch] bg-transparent text-left font-semibold tabular-nums outline-none"
                />
              </span>
              {copy.toggleTrail}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={gift}
              aria-label={copy.toggleLead}
              onClick={() => setGift((on) => !on)}
              className={`focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                gift ? "bg-accent" : "bg-muted-foreground/40"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                  gift ? "left-4.5" : "left-0.5"
                }`}
                aria-hidden="true"
              />
            </button>
          </motion.div>
        </motion.div>
      </ShareBackdrop>
    </Dialog>
  );
}
