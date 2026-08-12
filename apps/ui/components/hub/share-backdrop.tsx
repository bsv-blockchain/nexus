"use client";

import { useReducedMotion } from "@/lib/motion";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { MouseEvent, ReactNode } from "react";

/**
 * The drifting collage behind the share modal.
 *
 * The landing page's mid-page CTA treatment, brought inside: faint rotated cards
 * on a deepened ground, each drifting a different distance as the pointer moves,
 * which reads as depth rather than as decoration sliding about.
 *
 * The cards here are app tiles rather than the landing page's photography. Two
 * reasons. A 384px modal cannot hold six 192px photographs without them becoming
 * texture, and what somebody is sharing when they send this link is the apps —
 * so the background is the subject at low volume rather than mood.
 *
 * Everything is `aria-hidden` and `pointer-events-none`: this sits under a
 * dialog, and nothing in it should be reachable by a pointer or a screen reader.
 */

/** Each card's place, angle, weight, and how far it drifts. */
const CARDS = [
  { icon: "chat.png", x: "6%", y: "8%", rotate: -14, size: 76, opacity: 0.16, depth: 0.03 },
  { icon: "spend.png", x: "72%", y: "5%", rotate: 10, size: 68, opacity: 0.2, depth: 0.05 },
  { icon: "identity.png", x: "80%", y: "44%", rotate: -8, size: 84, opacity: 0.13, depth: 0.02 },
  { icon: "browse.png", x: "2%", y: "48%", rotate: 12, size: 72, opacity: 0.15, depth: 0.045 },
  { icon: "market.png", x: "62%", y: "80%", rotate: -12, size: 64, opacity: 0.14, depth: 0.03 },
  { icon: "vault.png", x: "12%", y: "82%", rotate: 16, size: 60, opacity: 0.12, depth: 0.055 },
] as const;

type Card = (typeof CARDS)[number];

function BackgroundCard({
  card,
  index,
  mouseX,
  mouseY,
  still,
}: {
  card: Card;
  index: number;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  still: boolean;
}): ReactNode {
  const driftX = useTransform(mouseX, [-1, 1], [-28 * card.depth * 10, 28 * card.depth * 10]);
  const driftY = useTransform(mouseY, [-1, 1], [-20 * card.depth * 10, 20 * card.depth * 10]);

  return (
    <motion.div
      className="absolute"
      style={{
        left: card.x,
        top: card.y,
        rotate: card.rotate,
        ...(still ? {} : { x: driftX, y: driftY }),
      }}
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: card.opacity, scale: 1 }}
      transition={
        still
          ? { duration: 0 }
          : { duration: 0.7, delay: 0.05 + index * 0.06, ease: [0.4, 0, 0.2, 1] }
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/icons/${card.icon}`}
        alt=""
        aria-hidden="true"
        width={card.size}
        height={card.size}
        className="rounded-[22%] shadow-xl"
        style={{ width: card.size, height: card.size }}
      />
    </motion.div>
  );
}

/**
 * Wraps the modal's contents, tracking the pointer for the parallax.
 *
 * The tracking lives here rather than on the dialog so the modal keeps one
 * mouse handler and the children stay unaware of any of it — they render into
 * `z-10` above the collage and are otherwise unchanged.
 */
export function ShareBackdrop({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const still = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  /* Springs, so the cards ease toward the pointer instead of tracking it
     exactly. Tracking exactly makes the layer feel welded to the cursor. */
  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 100 });
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 100 });

  const onMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (still) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    mouseY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  return (
    <div className="relative isolate" onMouseMove={onMouseMove}>
      {/* Deepened ground. The dialog's own surface is the flat card colour, and
          the collage needs something darker behind it or the tiles read as
          smudges on paper rather than as objects in a space. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-surface"
        aria-hidden="true"
      />
      {/* Accent bloom from the top, the same light the share card carries. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(120% 70% at 50% -10%, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />
      {/* Clipped, so a card rotated past the corner does not escape the modal's
          rounded edge. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {CARDS.map((card, index) => (
          <BackgroundCard
            key={card.icon}
            card={card}
            index={index}
            mouseX={smoothX}
            mouseY={smoothY}
            still={still}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
