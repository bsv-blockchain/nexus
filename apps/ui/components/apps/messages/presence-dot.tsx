"use client";

import {
  PRESENCE_COLOR,
  PRESENCE_LABEL,
  presenceFor,
} from "@/lib/messages";
import type { ReactNode } from "react";

/**
 * Presence indicator: green = seen today, amber = this week, grey = a long time
 * ago. The label rides along as a native tooltip, and clicks are swallowed so
 * tapping the dot never activates the row it sits inside.
 */
export function PresenceDot({
  id,
  className = "",
}: {
  id: string;
  className?: string;
}): ReactNode {
  const presence = presenceFor(id);
  const label = PRESENCE_LABEL[presence];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className={`block rounded-full ring-2 ring-background ${PRESENCE_COLOR[presence]} ${className}`}
    />
  );
}
