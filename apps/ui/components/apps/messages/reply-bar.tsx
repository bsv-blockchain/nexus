"use client";

import { content, type ChatMessage, type MessagePerson } from "@/lib/data";
import { Reply, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shows which message the next command will bind to.
 *
 * BRC-218 section 4.9 says a command that needs a binding must report an error
 * rather than quietly applying itself to the thread's most recent message, so
 * the binding has to be visible before you send. This is that.
 */
export function ReplyBar({
  message,
  sender,
  onClear,
}: {
  message: ChatMessage;
  sender?: MessagePerson | undefined;
  onClear: () => void;
}): ReactNode {
  const copy = content.messages;
  return (
    <div className="flex shrink-0 items-start gap-2.5 border-t border-border bg-surface/60 px-3 py-2 sm:px-4">
      <Reply
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {copy.replyingTo} {sender ? sender.name : copy.you}
        </p>
        <p className="truncate text-xs">
          {message.command
            ? `/${message.command.verb}`
            : message.text || copy.photo}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={copy.clearReply}
        className="focus-ring shrink-0 rounded-full p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
