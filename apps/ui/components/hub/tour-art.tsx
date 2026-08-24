"use client";

/**
 * The pictures a Guided Tour card can carry, where a picture says something.
 *
 * Most cards get the placeholder field, which is honest: an obvious gap is
 * easier to replace later than a gradient that looks finished. A card gets one
 * of these instead only when the thing it is explaining has a shape — the Vault
 * is a door, and a door that shuts is the whole argument.
 *
 * @see lib/data/tour.ts — `art`, which is how a card asks for one
 */

import {
  STEEL_DARK,
  STEEL_DEEP,
  STEEL_EDGE,
  STEEL_LIGHT,
  STEEL_MID,
} from "@/components/apps/vault/vault-doors";
import { useReducedMotion } from "@/lib/motion";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export type TourArt = "vault-doors";

/**
 * Two leaves closing on a lit recess.
 *
 * Open at rest and shut a beat after the card arrives, because the card is
 * about a thing that shuts itself: watching it happen is the sentence. Under
 * reduced motion they are simply shut — the closed state is the one carrying
 * the meaning, and the movement is the part somebody asked not to see.
 *
 * The steel is the app's own, imported from the Vault's door rather than
 * guessed at, so the picture on the card and the door it is about are made of
 * the same thing. Drawn small and flat next to that one: this sits above three
 * lines of type in a 360px card, where the full door's engraved rings and
 * eleven bolts would be texture rather than detail.
 */
function VaultDoors(): ReactNode {
  const reduced = useReducedMotion();
  /* Slower than a UI transition, because a vault door is heavy and the weight
     is the point. Held open first so the open state is seen at all. */
  const leaf = reduced
    ? { duration: 0 }
    : { duration: 0.95, delay: 0.4, ease: [0.32, 0, 0.16, 1] as const };

  return (
    <div
      aria-hidden="true"
      className="relative h-32 w-full overflow-hidden"
      style={{ background: STEEL_DEEP }}
    >
      {/* The recess. Whatever the leaves are covering has to look like
          somewhere, or they read as two rectangles sliding over a panel. */}
      <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--accent)_45%,transparent),transparent_70%)]" />

      {[-1, 1].map((side) => (
        <motion.span
          key={side}
          className="absolute inset-y-0 w-1/2"
          style={{
            ...(side === -1 ? { left: 0 } : { right: 0 }),
            /* Lit from the seam outwards, so the two leaves read as one face
               with a join down the middle rather than two flat blocks. */
            background: `linear-gradient(${
              side === -1 ? "100deg" : "260deg"
            }, ${STEEL_DEEP} 0%, ${STEEL_DARK} 38%, ${STEEL_MID} 78%, ${STEEL_LIGHT} 100%)`,
          }}
          /* Off their own edge to start, meeting in the middle. Percentages of
             the leaf rather than pixels, so this is the same movement whatever
             width the card ends up at. */
          initial={reduced ? false : { x: `${side * 100}%` }}
          animate={{ x: 0 }}
          transition={leaf}
        >
          {/* The bright machined edge where the two meet. */}
          <span
            className={`absolute inset-y-0 w-px ${side === -1 ? "right-0" : "left-0"}`}
            style={{ background: STEEL_EDGE, opacity: 0.55 }}
          />
          {/* Bolt-work down the inner edge, as the real door has. Three rather
              than eleven: at this size more is a dotted line. */}
          {[0.3, 0.5, 0.7].map((at) => (
            <span
              key={at}
              className="absolute size-1.5 rounded-full"
              style={{
                top: `calc(${at * 100}% - 3px)`,
                ...(side === -1 ? { right: 7 } : { left: 7 }),
                background: STEEL_LIGHT,
                boxShadow: `0 1px 0 ${STEEL_DEEP}`,
              }}
            />
          ))}
          {/* One engraved ring per leaf, centred on the seam so the two halves
              line up into a single circle once they are shut. */}
          <span
            className="absolute top-1/2 size-24 -translate-y-1/2 rounded-full"
            style={{
              ...(side === -1 ? { right: -48 } : { left: -48 }),
              border: `1px solid ${STEEL_MID}`,
            }}
          />
        </motion.span>
      ))}

      {/* The wheel, turning as the leaves land. Above both, because a handle is
          on the door rather than behind it. Spokes at 45 degrees so it reads as
          something you turn instead of as a plus sign. */}
      <motion.span
        className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        style={{
          background: `radial-gradient(circle at 34% 28%, ${STEEL_LIGHT}, ${STEEL_DARK} 72%)`,
          border: `1px solid ${STEEL_EDGE}`,
          boxShadow: `0 2px 6px ${STEEL_DEEP}`,
        }}
        initial={reduced ? false : { rotate: -150, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.85, delay: 1.05 }}
      >
        {[45, 135].map((angle) => (
          <span
            key={angle}
            className="absolute h-7 w-0.5 rounded-full"
            style={{
              background: STEEL_EDGE,
              opacity: 0.75,
              transform: `rotate(${angle}deg)`,
            }}
          />
        ))}
        <span
          className="absolute size-3 rounded-full"
          style={{ background: STEEL_DARK, border: `1px solid ${STEEL_MID}` }}
        />
      </motion.span>
    </div>
  );
}

/** The picture a card asked for, or nothing when it asked for none. */
export function TourArtwork({ art }: { art: TourArt }): ReactNode {
  return art === "vault-doors" ? <VaultDoors /> : null;
}
