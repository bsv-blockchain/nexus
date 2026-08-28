"use client";

/**
 * The drifting, crossfading ground behind wallet setup.
 *
 * Two effects the app already owns, put together for the one screen that had
 * neither. The parallax is the share modal's — a pointer-tracked layer on
 * springs, so it eases toward the cursor instead of tracking it exactly, which
 * is what reads as depth rather than as something welded to the mouse. See
 * components/hub/share-backdrop, which does the same thing with app tiles.
 *
 * The pictures are the welcome deck's plates. They are blue duotones at source,
 * which is why they can sit under white type without being fought back with a
 * scrim heavy enough to make them pointless — and it is the same set somebody
 * saw thirty seconds ago on the way in, so the setup screen belongs to the
 * product rather than being the one screen drawn by a different hand.
 *
 * Calm is the whole brief. One plate at a time, held for seven seconds and
 * dissolved over three, at eighteen per cent, under a veil of the background
 * colour. Nothing here should be readable as a photograph — it should read as
 * weather. The deck's own five plates are deliberately NOT in this set: those
 * three are the choice cards on top of it, and a card sitting on a blown-up
 * copy of itself is a coincidence nobody would read as one.
 *
 * @see components/hub/wallet-gate.tsx — the only caller
 */

import { useReducedMotion } from "@/lib/motion";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/**
 * The plates the choice cards do not use.
 *
 * Five, so the cycle is long enough that nobody sitting through wallet setup
 * sees the same picture twice.
 */
const PLATES = [
  "/first-run/art/rock.webp",
  "/first-run/art/swiss.webp",
  "/first-run/art/buffalo.webp",
  "/first-run/art/fishing.webp",
  "/first-run/art/mill.webp",
] as const;

/** How long one plate is held before the next begins arriving, in ms. */
const HOLD_MS = 7_000;
/** How long the dissolve itself takes, in seconds. */
const FADE_S = 3;
/** As faint as it can be and still be there. */
const PLATE_OPACITY = 0.18;
/** How far the layer travels corner to corner, in px. */
const DRIFT = 26;

export function WalletGateBackdrop({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  /* Springs, for the reason the share backdrop gives: a layer that tracks the
     pointer exactly feels attached to it. */
  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 100 });
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 100 });
  const driftX = useTransform(smoothX, [-1, 1], [-DRIFT, DRIFT]);
  const driftY = useTransform(smoothY, [-1, 1], [-DRIFT * 0.7, DRIFT * 0.7]);

  useEffect(() => {
    /* Reduced motion holds the first plate. The crossfade is the whole of the
       motion here, so there is nothing left of it to show somebody who has
       asked not to be shown motion — and a still photograph is a perfectly
       good background. */
    if (still) return;
    const timer = window.setInterval(
      () => setIndex((at) => (at + 1) % PLATES.length),
      HOLD_MS,
    );
    return () => window.clearInterval(timer);
  }, [still]);

  const onMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (still) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    mouseY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  return (
    <div
      className="bg-background relative isolate min-h-full w-full"
      onMouseMove={onMouseMove}
    >
      {/* Scaled past the frame so the drift never uncovers an edge. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={still ? {} : { x: driftX, y: driftY }}
      >
        <div className="absolute -inset-8">
          {PLATES.map((plate, at) => (
            <motion.div
              key={plate}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${plate})` }}
              initial={false}
              animate={{ opacity: at === index ? PLATE_OPACITY : 0 }}
              transition={{ duration: still ? 0 : FADE_S, ease: "easeInOut" }}
            />
          ))}
        </div>
      </motion.div>

      {/* The accent bloom the share modal carries, so the two backdrops are
          lit the same way — and a veil at the foot, so type that reaches the
          bottom of a long form has somewhere quiet to sit. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(120% 70% at 50% -10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)," +
            "linear-gradient(to top, var(--background), transparent 45%)",
        }}
      />

      {children}
    </div>
  );
}
