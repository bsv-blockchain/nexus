import { DotSquare } from "@/components/hub/dot-matrix";
import type { ReactNode } from "react";

/**
 * The mark on a numbered item — an explainer step, or one update in a release.
 *
 * Two forms of the same object. Where the item can be closed it starts as a
 * dot-matrix square on the accent and becomes its number on a glow lifted from
 * the share card; where the item is always open it is simply the number. The
 * numeral earns its place by telling the reader where they are, so it appears
 * where that is true and the closed rows stay a quiet column of identical marks.
 *
 * The disclosure form is driven entirely by the parent `<details open>` through
 * `group-open/feat`, so there is no state, no effect and nothing that can fall
 * out of step with the disclosure itself. Both layers stay mounted and cross-fade
 * on opacity and scale only: those are the two properties every mobile browser
 * composites off the main thread, which is what keeps this smooth on a phone
 * instead of lurching mid-expand.
 */

/**
 * Two accent blooms over the raised surface — the share card's treatment, small.
 * Written with `color-mix` against the live token rather than a fixed colour, so
 * switching theme re-tints the marks along with everything else.
 */
const GLOW = {
  backgroundImage: [
    "radial-gradient(circle at 24% 16%, color-mix(in oklab, var(--accent) 72%, transparent), transparent 64%)",
    "radial-gradient(circle at 82% 90%, color-mix(in oklab, var(--accent) 42%, transparent), transparent 68%)",
  ].join(", "),
} as const;

/*
  `scale`, not `transform`: Tailwind's `scale-*` utilities set the standalone
  `scale` property, so a transition naming `transform` leaves the size change to
  snap while the fade eases. Both of these are still compositor-only.
*/
const SWAP =
  "transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none";

export function StepMark({
  step,
  size = 32,
  disclosure = true,
  className = "",
}: {
  step: number;
  /** Box size in px. The glyph and numeral are proportions of it. */
  size?: number;
  /** False where the item cannot be collapsed, so the number is all there is. */
  disclosure?: boolean;
  className?: string;
}): ReactNode {
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg ${className}`}
      aria-hidden="true"
    >
      {/* Closed: the mark. Scales down a touch on the way out so the two states
          feel like one object changing rather than two images swapping. */}
      {disclosure && (
        <span
          className={`bg-accent absolute inset-0 grid scale-100 place-items-center place-self-stretch opacity-100 group-open/feat:scale-75 group-open/feat:opacity-0 ${SWAP}`}
        >
          <DotSquare
            size={Math.round(size * 0.7)}
            className="text-accent-foreground"
          />
        </span>
      )}

      {/* Open: the glow, then the numeral over it. */}
      <span
        style={GLOW}
        className={`bg-surface-raised absolute inset-0 place-self-stretch ${
          disclosure
            ? `opacity-0 group-open/feat:opacity-100 ${SWAP}`
            : "opacity-100"
        }`}
      />
      <span
        style={{ fontSize: Math.round(size * 0.47) }}
        className={`text-foreground relative leading-none font-bold tabular-nums ${
          disclosure
            ? `scale-75 opacity-0 group-open/feat:scale-100 group-open/feat:opacity-100 ${SWAP}`
            : ""
        }`}
      >
        {step}
      </span>
    </span>
  );
}
