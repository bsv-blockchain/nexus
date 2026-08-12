"use client";

import type { ReactNode } from "react";

/** A version-1 QR's module count, so the finder patterns land where they do. */
const QR_SIZE = 21;

/** Stable 32-bit hash, so the same string always draws the same code. */
function seedOf(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Whether one module of a decorative code is dark.
 *
 * Not a real encoder — nothing here has anything to encode yet — but the three
 * finder squares are drawn properly, because those are what makes a block of
 * noise read as a QR rather than as a barcode. The rest is a hash of the
 * coordinates and the value: deterministic, so the code does not reshuffle on
 * every render and look like a live token expiring while you line up your
 * camera, and different per value, so two people's codes are not the same
 * picture with a different face in the middle.
 */
export function qrCell(row: number, col: number, seed = 0): boolean {
  const inFinder = (top: number, left: number): boolean =>
    row >= top && row < top + 7 && col >= left && col < left + 7;
  for (const [top, left] of [
    [0, 0],
    [0, QR_SIZE - 7],
    [QR_SIZE - 7, 0],
  ] as const) {
    if (!inFinder(top, left)) continue;
    const r = row - top;
    const c = col - left;
    const ring = r === 0 || r === 6 || c === 0 || c === 6;
    const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    return ring || core;
  }
  // The one-module gap that separates a finder from the data around it.
  const nearFinder =
    (row < 8 && col < 8) ||
    (row < 8 && col >= QR_SIZE - 8) ||
    (row >= QR_SIZE - 8 && col < 8);
  if (nearFinder) return false;
  const hash =
    (row * 73856093) ^ (col * 19349663) ^ ((row + col) * 83492791) ^ seed;
  return ((hash >>> 4) & 7) < 4;
}

/**
 * A code you point a camera at, framed as an object.
 *
 * The frame goes around the whole code rather than round the modules: a code is
 * something you hold up to a phone, and the border is what separates its white
 * from whatever it is sitting on — the inner shadow gives that edge depth
 * rather than leaving a flat rule that reads as a rendering artefact.
 *
 * `children` is the mark in the middle, which every code people have been
 * trained by carries. It is given a white plate and ring so it reads as
 * something laid on the code rather than a hole punched in it.
 */
export function QrBlock({
  value,
  label,
  className = "size-44",
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children?: ReactNode;
}): ReactNode {
  const seed = seedOf(value);
  return (
    <div className="relative">
      <div
        className={`grid grid-cols-21 gap-px rounded-2xl bg-white p-2.5 ${className}`}
        role="img"
        aria-label={label}
        style={{
          border: "3px solid #17111f",
          boxShadow:
            "inset 0 1px 3px rgba(23, 17, 31, 0.35), 0 2px 6px rgba(23, 17, 31, 0.4)",
        }}
      >
        {Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => (
          <span
            key={index}
            className={
              qrCell(Math.floor(index / QR_SIZE), index % QR_SIZE, seed)
                ? "bg-black"
                : "bg-transparent"
            }
          />
        ))}
      </div>
      {children && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {children}
        </span>
      )}
    </div>
  );
}
