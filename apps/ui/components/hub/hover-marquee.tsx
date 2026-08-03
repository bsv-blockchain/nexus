"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A single-line label that truncates by default, but scrolls left to reveal
 * its full length after a short hover delay (looping). No-op for text that
 * already fits.
 */
export function HoverMarquee({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}): ReactNode {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  const start = (): void => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const overflow = inner.scrollWidth - outer.clientWidth;
    if (overflow > 1) setShift(overflow);
  };
  const stop = (): void => setShift(0);

  // ~36px/s, held at both ends by the keyframe; min 1.8s so short titles
  // don't whip past.
  const duration = shift > 0 ? Math.max(1.8, shift / 36) : 0;
  const innerStyle: CSSProperties | undefined =
    shift > 0
      ? ({
          animation: `nexus-marquee ${duration}s ease-in-out 0.5s infinite alternate`,
          "--marquee-shift": `-${shift}px`,
        } as CSSProperties)
      : undefined;

  return (
    <span
      ref={outerRef}
      onMouseEnter={start}
      onMouseLeave={stop}
      className={`block overflow-hidden whitespace-nowrap ${className}`}
    >
      <span ref={innerRef} className="inline-block will-change-transform" style={innerStyle}>
        {text}
      </span>
    </span>
  );
}
