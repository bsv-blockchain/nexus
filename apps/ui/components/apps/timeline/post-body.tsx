"use client";

/**
 * A post's words, with the things inside them that are not words.
 *
 * Two of those: `@handle` runs, which resolve to people, and a command, which
 * resolves to an outcome. Both already have a rendering in Messages, and both
 * are imported rather than rebuilt — a `/pay` that looks one way in a DM and
 * another way in a post is two things the reader has to learn, and the second
 * one teaches them not to trust the first.
 *
 * `{command}` in the body is where the pill goes, so a command can sit
 * mid-sentence the way it does in a bubble rather than always leading. Hovering
 * it opens the same card: the post says what you did, the card says what
 * happened.
 */

import { CommandPill } from "@/components/apps/messages/command-pill";
import { MentionText } from "@/components/apps/messages/mention-text";
import type { TimelinePost } from "@/lib/data/timeline";
import type { ReactNode } from "react";

/** The same placeholder the chat bubble splits on. */
const COMMAND_SLOT = "{command}";

export function PostBody({
  post,
  className = "mt-1 space-y-2 text-sm leading-relaxed",
}: {
  post: TimelinePost;
  className?: string;
}): ReactNode {
  const card = post.command;

  return (
    /* Divs rather than `p`s wherever a pill can appear: the pill's popover is a
       block element, and a block inside a paragraph is invalid HTML that React
       reports as a hydration error. */
    <div className={className}>
      {card && !post.body.includes(COMMAND_SLOT) && <CommandPill card={card} />}
      {post.body.split("\n\n").map((paragraph, index) => (
        <div key={index} className="text-pretty wrap-break-word">
          {card && paragraph.includes(COMMAND_SLOT) ? (
            paragraph.split(COMMAND_SLOT).map((chunk, part) => (
              <span key={part}>
                {part > 0 && <CommandPill card={card} inline />}
                <MentionText text={chunk} />
              </span>
            ))
          ) : (
            /* Strip the slot from paragraphs that do not hold the pill, so a
                 body with one command in its second paragraph does not print
                 the placeholder in its first. */
            <MentionText text={paragraph.split(COMMAND_SLOT).join("")} />
          )}
        </div>
      ))}
    </div>
  );
}
