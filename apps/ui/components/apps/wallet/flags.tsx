import type { ReactNode } from "react";

/**
 * Minimal 4:3 flags for the pegged fiats, drawn inline.
 *
 * Vela uses the `flag-icons` package; adding a dependency and its CSS for two
 * flags is not worth it, and inline paths inherit nothing from a stylesheet so
 * they cannot break under a custom theme.
 */
export const FLAGS: Record<string, ReactNode> = {
  us: (
    <>
      <rect width="4" height="3" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect
          key={i}
          y={(i * 3) / 6.5}
          width="4"
          height={3 / 13}
          fill="#B22234"
        />
      ))}
      <rect width="1.7" height={3 / 13 * 7} fill="#3C3B6E" />
    </>
  ),
  eu: (
    <>
      <rect width="4" height="3" fill="#039" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6;
        return (
          <circle
            key={i}
            cx={2 + Math.sin(angle) * 0.75}
            cy={1.5 - Math.cos(angle) * 0.75}
            r="0.14"
            fill="#FC0"
          />
        );
      })}
    </>
  ),
};
