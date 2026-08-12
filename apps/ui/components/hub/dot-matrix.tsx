import type { ReactNode } from "react";

/**
 * A square drawn as an 11×11 dot matrix.
 *
 * The mark for a step nobody has opened yet: a shape rather than a picture, so
 * a column of them reads as a list of the same kind of thing instead of a row
 * of unrelated icons. Dots inherit `currentColor`, so the caller sets the
 * colour and this only decides the shape.
 *
 * Circles on a whole-number grid, and the whole thing scales from the viewBox —
 * so the dots stay round and evenly spaced at any size, including the fractional
 * device pixels a phone will render them at.
 */

const GRID = 11;
const CELL = 4;
/** Inset by one cell, so the ring has a margin inside the box it sits in. */
const LOW = 1;
const HIGH = GRID - 2;

/**
 * True on the ring itself — the outline, not a filled block.
 *
 * Every second cell. A dot in all eleven leaves gaps thinner than the dots at
 * the size this renders at, and the ring closes up into a plain drawn square:
 * the whole point of a matrix is that you can see it is made of dots.
 */
function onRing(x: number, y: number): boolean {
  const inside = x >= LOW && x <= HIGH && y >= LOW && y <= HIGH;
  if (!inside) return false;
  const edge = x === LOW || x === HIGH || y === LOW || y === HIGH;
  return edge && (x - LOW) % 2 === 0 && (y - LOW) % 2 === 0;
}

const DOTS: { x: number; y: number }[] = [];
for (let y = 0; y < GRID; y += 1) {
  for (let x = 0; x < GRID; x += 1) {
    if (onRing(x, y)) DOTS.push({ x, y });
  }
}

export function DotSquare({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}): ReactNode {
  const span = GRID * CELL;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {DOTS.map((dot) => (
        <circle
          key={`${dot.x}-${dot.y}`}
          cx={dot.x * CELL + CELL / 2}
          cy={dot.y * CELL + CELL / 2}
          r={CELL * 0.42}
        />
      ))}
    </svg>
  );
}
