"use client";

import type { MessagePerson } from "@/lib/data";
import type { ReactNode } from "react";

/** Initials for the generated fallback tile — "Els Verheijen" → "EV". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A person's avatar: their photo when we have one, otherwise a gradient tile
 * built from their colour stops with their initials on top. Square-rounded
 * rather than circular, matching the app tiles in the rail.
 */
export function MemberAvatar({
  person,
  size,
  className = "",
  radius: radiusOverride,
}: {
  person: MessagePerson;
  size: number;
  className?: string;
  /** corner radius in px; the group mosaic squares its cells off */
  radius?: number;
}): ReactNode {
  const radius = radiusOverride ?? Math.max(6, Math.round(size * 0.28));

  if (person.photo) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={person.photo}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`shrink-0 object-cover ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const [from, via, to] = person.avatarColors;
  const stops = [from ?? "#4353ff", via ?? from ?? "#7c3aed", to]
    .filter(Boolean)
    .join(", ");

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundImage: `linear-gradient(140deg, ${stops})`,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials(person.name)}
    </span>
  );
}
