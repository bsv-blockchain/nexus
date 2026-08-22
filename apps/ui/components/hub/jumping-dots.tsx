"use client";

/**
 * Three dots, taking turns.
 *
 * A spinner says "something is happening and you cannot tell how far along".
 * These say the same thing without pretending to be a measurement, which is
 * right for a refresh: there is no progress to report, only the fact that it
 * has been asked for.
 *
 * Negative delays rather than positive ones so the cycle is already underway on
 * the first frame — starting them at zero makes all three sit still for a beat
 * before the first hop, which reads as the animation failing to start.
 */

import type { ReactNode } from "react";

const DELAYS = ["-0.32s", "-0.16s", "0s"] as const;

export function JumpingDots({
  className = "",
  label,
  count = 3,
  jumping = true,
}: {
  className?: string;
  /** the accessible name; the dots themselves are decoration */
  label?: string;
  /**
   * How many of the three are present.
   *
   * For the pull-to-refresh, where they arrive one at a time as the gesture
   * gets closer to firing — the third landing IS the signal that letting go
   * will do something, which a caption had to say in words.
   */
  count?: number;
  /** still while they are being gathered, jumping once the work has started */
  jumping?: boolean;
}): ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="status"
      {...(label ? { "aria-label": label } : {})}
    >
      {DELAYS.slice(0, Math.max(0, Math.min(3, count))).map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className={`size-1.5 rounded-full bg-current transition-transform ${
            jumping ? "animate-bounce" : "scale-100"
          }`}
          style={jumping ? { animationDelay: delay } : undefined}
        />
      ))}
    </span>
  );
}
