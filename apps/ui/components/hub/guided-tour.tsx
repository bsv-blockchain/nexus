"use client";

/**
 * The Guided Tour.
 *
 * Three shapes, one run:
 *
 *   - the opening card, centred over a dimmed app, content beside a placeholder
 *     visual. It is about the whole thing, so it points at nothing.
 *   - the steps, each a popover beside the piece of interface it explains. The
 *     app is not dimmed here: the point is to look at the thing being described,
 *     and dimming it would be telling somebody to read about a screen while
 *     hiding the screen.
 *   - the closing card, centred again and shaped like the opening one.
 *
 * On a phone the opening and closing cards are near-full-height bottom sheets
 * with the visual above the words, and the steps are full-width popovers pinned
 * to whichever end of the screen their anchor is not at — a card that covers
 * the thing it is pointing at is worse than no card.
 *
 * Clicking outside, or Skip, ends the run. Ending counts as having taken it.
 *
 * @see lib/data/tour.ts — the cards, and the rules for assembling a run
 */

import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import {
  endCopy,
  footerFor,
  startCopy,
  tourFor,
  type TourCard,
} from "@/lib/data/tour";
import { useChosenPresets } from "@/lib/presets-store";
import { endTour, tourNext, tourPrevious, useTour } from "@/lib/tour-store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useReducedMotion } from "@/lib/motion";
import { useHostOverlay } from "@/lib/wallet-data";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const copy = content.tour;

/** How far a step card sits from the thing it is pointing at. */
const OFFSET = 14;
const CARD_W = 360;

export function GuidedTour(): ReactNode {
  const { index } = useTour();
  const chosen = useChosenPresets();
  const run = tourFor(chosen);
  const card = index === null ? undefined : run[index];

  return (
    <AnimatePresence>
      {card && index !== null && (
        <Run key="tour" card={card} index={index} total={run.length} />
      )}
    </AnimatePresence>
  );
}

function Run({
  card,
  index,
  total,
}: {
  card: TourCard;
  index: number;
  total: number;
}): ReactNode {
  const chosen = useChosenPresets();
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion();
  const { setMainView, openApp, setSettingsCategory } = useHub();
  useHostOverlay(true);

  /*
   * Put the app where the card is talking about.
   *
   * In an effect rather than at render because it writes to the hub, and a
   * component that navigates the app while rendering it is a component that can
   * render twice and navigate twice.
   */
  useEffect(() => {
    const { view, app, section } = card.appState;
    if (view === "app" && app) {
      openApp(app as Parameters<typeof openApp>[0]);
      return;
    }
    setMainView(view);
    if (view === "settings" && section) {
      setSettingsCategory(section as Parameters<typeof setSettingsCategory>[0]);
    }
  }, [card, openApp, setMainView, setSettingsCategory]);

  const footer = footerFor(index, total);
  const centred = card.kind !== "step";
  const words =
    card.kind === "start"
      ? startCopy(chosen)
      : card.kind === "end"
        ? endCopy(chosen)
        : { title: card.title, body: card.body };

  const fade = reduced ? { duration: 0 } : { duration: 0.24 };

  return (
    <>
      {/*
        The scrim.

        Solid under the opening and closing cards, which are about the app as a
        whole; invisible but still clickable under a step, where the point is to
        see the thing being explained. Either way it catches the click that ends
        the run.
      */}
      <motion.button
        type="button"
        aria-label={copy.dismiss}
        onClick={endTour}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        className={`fixed inset-0 z-[110] cursor-default ${
          centred ? "bg-black/60 backdrop-blur-[2px]" : "bg-transparent"
        }`}
      />
      {centred ? (
        isDesktop ? (
          <CentredCard
            words={words}
            index={index}
            total={total}
            footer={footer}
          />
        ) : (
          <SheetCard
            words={words}
            index={index}
            total={total}
            footer={footer}
          />
        )
      ) : (
        <StepCard
          card={card}
          words={words}
          index={index}
          total={total}
          isDesktop={isDesktop}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- the words */

/**
 * A card's body, with `*starred*` runs drawn heavier.
 *
 * Split on the marker: odd pieces are the emphasised ones, which is the whole
 * grammar. Not markdown and not trying to be — a card wants two weights of the
 * same sentence, and a parser that also did links and lists would be a parser
 * to maintain for nothing.
 */
function Body({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}): ReactNode {
  return (
    <p className={className}>
      {text.split("*").map((piece, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="text-foreground font-semibold">
            {piece}
          </strong>
        ) : (
          <span key={index}>{piece}</span>
        )
      )}
    </p>
  );
}

/* -------------------------------------------------------- the placeholder */

/**
 * Where the artwork goes.
 *
 * Deliberately flat and obviously empty. A gradient pretending to be an
 * illustration is harder to replace than a visible gap, because it looks
 * finished and nobody comes back to it.
 */
function Placeholder({ className = "" }: { className?: string }): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={`bg-accent/12 ring-border/50 ring-1 ${className}`}
    />
  );
}

/* ------------------------------------------------- opening / closing card */

interface CardProps {
  card: TourCard;
  words: { title: string; body: string };
  index: number;
  total: number;
  footer: ReturnType<typeof footerFor>;
}

function CentredCard({
  words,
  index,
  total,
  footer,
}: Omit<CardProps, "card">): ReactNode {
  const reduced = useReducedMotion();

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={words.title}
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 8 }}
      transition={reduced ? { duration: 0 } : { duration: 0.28 }}
      className="bg-surface-raised ring-border fixed top-1/2 left-1/2 z-[120] w-[min(44rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl ring-1"
    >
      {/* Words left, visual right, opening and closing alike. The closing card
          used to stack a wide band above a single sentence, which read as a
          different component rather than as the other end of the same run —
          the two cards bookend each other, so they are the same shape. */}
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {words.title}
          </h2>
          <Body
            text={words.body}
            className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty"
          />
          <Footer
            index={index}
            total={total}
            footer={footer}
            className="mt-7"
          />
        </div>
        <Placeholder className="hidden min-h-72 md:block" />
      </div>
    </motion.div>
  );
}

/** The same two cards on a phone: a tall sheet, visual above the words. */
function SheetCard({
  words,
  index,
  total,
  footer,
}: Omit<CardProps, "card">): ReactNode {
  const reduced = useReducedMotion();

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={words.title}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", damping: 32, stiffness: 320 }
      }
      className="bg-surface-raised ring-border fixed inset-x-0 bottom-0 z-[120] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl shadow-2xl ring-1"
    >
      <Placeholder className="h-52 w-full shrink-0" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold tracking-tight">{words.title}</h2>
        <Body
          text={words.body}
          className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty"
        />
      </div>
      <div className="shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Footer index={index} total={total} footer={footer} />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------- step card */

/**
 * A step, beside the thing it is about.
 *
 * The anchor is found by `data-tour`, measured once per card. If it is not on
 * screen — an app that did not mount, a rail that is collapsed — the card
 * centres itself rather than pointing confidently at nothing.
 */
function StepCard({
  card,
  words,
  index,
  total,
  isDesktop,
}: Omit<CardProps, "footer"> & { isDesktop: boolean }): ReactNode {
  const reduced = useReducedMotion();
  const [rect, setRect] = useState<DOMRect | null>(null);
  /*
   * The card's own height, measured rather than assumed.
   *
   * The clamp below used a fixed 280 and the cards are taller than that, so on
   * a 868px window the Vault card ran off the bottom. A ResizeObserver rather
   * than a one-off read: the height changes with the copy, and this keeps the
   * clamp right for a two-line card and a six-line one without anybody having
   * to keep a number in step with the writing.
   */
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const footer = footerFor(index, total);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setCardH(node.getBoundingClientRect().height)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Measured after the card's own `appState` has had a frame to take effect,
     so the anchor being looked for is the one on the screen it just asked for
     rather than the one that was there before. */
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = (): void => {
      const node = card.anchor
        ? document.querySelector(`[data-tour="${card.anchor}"]`)
        : null;
      if (node) {
        /*
         * Brought on screen before it is measured.
         *
         * A card points at a thing, and a settings section three groups down
         * the page is a thing nobody can see the pointer land on. `nearest`
         * rather than `center`, so an anchor that is already visible does not
         * jump; `instant`, because the rect is read on the next line and a
         * smooth scroll would have it measure the position it is leaving.
         *
         * This is also what keeps the tour honest when a panel gains a section
         * above the one a card names — which is how it broke once already.
         */
        node.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
        setRect(node.getBoundingClientRect());
        return;
      }
      /* A few frames' grace for the view to mount, then give up and centre. */
      if (tries++ < 40) raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [card]);

  /* A plain record rather than `CSSProperties`: motion's style type does not
     accept the optional-undefined members that interface carries. */
  const style = ((): Record<string, string | number> => {
    if (!isDesktop) {
      /* Whichever end the anchor is not at. The card is full width, so there is
         no horizontal choice to make — only which edge it clings to. */
      return card.mobileSide === "bottom"
        ? { left: 12, right: 12, bottom: 92 }
        : { left: 12, right: 12, top: 12 };
    }
    if (!rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
    }
    const side = card.side ?? "right";
    /* Centred on the anchor where it fits, then pushed back inside the window.
       `cardH` is the real height, so the bottom edge lands on the margin rather
       than past it. */
    const height = cardH || 320;
    const top = Math.max(
      12,
      Math.min(
        rect.top + rect.height / 2 - height / 2,
        window.innerHeight - height - 12
      )
    );
    if (side === "left") {
      return { top, left: Math.max(12, rect.left - CARD_W - OFFSET) };
    }
    if (side === "top") {
      return { top: Math.max(12, rect.top - height - OFFSET), left: rect.left };
    }
    if (side === "bottom") {
      return { top: rect.bottom + OFFSET, left: rect.left };
    }
    return {
      top,
      left: Math.min(rect.right + OFFSET, window.innerWidth - CARD_W - 12),
    };
  })();

  return (
    <>
      {/* A ring round the thing being explained, so the words and the widget
          are visibly about each other. Only when it was actually found. */}
      {rect && isDesktop && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="ring-accent pointer-events-none fixed z-[115] rounded-xl ring-2"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={words.title}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={reduced ? { duration: 0 } : { duration: 0.22 }}
        ref={cardRef}
        style={{ ...style, ...(isDesktop ? { width: CARD_W } : {}) }}
        className="bg-surface-raised ring-border fixed z-[120] overflow-hidden rounded-2xl shadow-2xl ring-1"
      >
        <Placeholder className="h-32 w-full" />
        <div className="p-5">
          <h2 className="text-base font-semibold">{words.title}</h2>
          <Body
            text={words.body}
            className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty"
          />
          <Footer
            index={index}
            total={total}
            footer={footer}
            className="mt-5"
            compact
          />
        </div>
      </motion.div>
    </>
  );
}

/* ----------------------------------------------------------------- footer */

/**
 * The one footer every card shares.
 *
 * Position on the left, actions on the right, exactly as the reference has it.
 * Which buttons appear is `footerFor`'s answer, not this component's, so the
 * rule can be checked without rendering anything.
 */
function Footer({
  index,
  total,
  footer,
  className = "",
  compact = false,
}: {
  index: number;
  total: number;
  footer: ReturnType<typeof footerFor>;
  className?: string;
  compact?: boolean;
}): ReactNode {
  const step = `${index + 1} ${copy.of} ${total}`;

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
        {/* No back arrow on the first card: there is nothing behind it, and a
            permanently disabled control is furniture that explains nothing. */}
        {footer.previous && (
          <button
            type="button"
            onClick={tourPrevious}
            aria-label={copy.previous}
            className="focus-ring hover:text-foreground rounded p-0.5"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        )}
        <span>{step}</span>
        {compact && (
          <button
            type="button"
            onClick={() => tourNext(total)}
            disabled={!footer.next}
            aria-label={copy.next}
            className="focus-ring hover:text-foreground rounded p-0.5 disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {footer.skip && (
          <button
            type="button"
            onClick={endTour}
            className="focus-ring ring-border hover:bg-surface-hover rounded-lg px-4 py-2 text-sm font-semibold ring-1 transition-colors"
          >
            {compact ? copy.close : copy.skip}
          </button>
        )}
        <button
          type="button"
          onClick={() => (footer.gotIt ? endTour() : tourNext(total))}
          className="focus-ring bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
        >
          {footer.gotIt ? copy.gotIt : index === 0 ? copy.start : copy.next}
        </button>
      </div>
    </div>
  );
}
