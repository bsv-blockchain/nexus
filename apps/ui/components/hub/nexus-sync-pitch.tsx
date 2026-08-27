"use client";

/**
 * The case for Nexus Sync, without the frame around it.
 *
 * Two columns show this now — the Timeline's rail and Focus's — and they put it
 * in different shells: the rail's `Panel` and Focus's `Card`. Only the argument
 * is shared, because the argument is the part that must not drift, and the
 * shells are each column's own idiom. Extracting the whole panel instead would
 * have made one of the two columns render a card from the other.
 *
 * The list is the argument; the price is deliberately absent. This is here to
 * make the features legible, and a number does the opposite until somebody has
 * decided they want one — which is what the sheet behind the button is for.
 */

import { content } from "@/lib/data";
import { nexusSyncFeatures } from "@/lib/data/timeline";
import { openSync } from "@/lib/timeline-store";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.timeline.rail.sync;

export function NexusSyncPitch(): ReactNode {
  return (
    <>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {copy.blurb}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {nexusSyncFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs">
            <Check
              className="text-accent mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={openSync}
        className="focus-ring bg-accent text-accent-foreground mt-3 w-full rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        {copy.cta}
      </button>
    </>
  );
}
