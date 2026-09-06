"use client";

/**
 * A post's age, and the block it settled in.
 *
 * The timestamp was the one piece of a post that said nothing about the chain
 * underneath it. Hovering names the block; clicking opens it on WhatsOnChain.
 *
 * The number lives in the tooltip and the link is the timestamp itself, rather
 * than a link inside the tooltip. A hover tooltip closes when the pointer
 * leaves the thing it describes, so a link inside one can only be reached by
 * crossing a gap it does not survive — the tooltip tells you the block, the
 * stamp takes you to it, and there is nothing to chase.
 */

import { Tooltip } from "@/components/hub/tooltip";
import { content } from "@/lib/data";
import { agoLabel, blockForAge, blockLabel, blockUrl } from "@/lib/timeline";
import type { ReactNode } from "react";

export function BlockStamp({
  ago,
  className = "text-muted-foreground text-xs",
}: {
  /** minutes ago, the same figure the row prints */
  ago: number;
  className?: string;
}): ReactNode {
  const height = blockForAge(ago);
  const label = content.timeline.inBlock.replace(
    "{height}",
    blockLabel(height)
  );

  return (
    <Tooltip label={label}>
      <a
        href={blockUrl(height)}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        /* Stops the row's own click, which would otherwise open the thread
           behind the new tab — the guard in PostRow lets anchors through so
           they can do their own job, and this is that job. */
        onClick={(event) => event.stopPropagation()}
        className={`focus-ring hover:text-foreground rounded-sm underline-offset-2 transition-colors hover:underline ${className}`}
      >
        {agoLabel(ago)}
      </a>
    </Tooltip>
  );
}
