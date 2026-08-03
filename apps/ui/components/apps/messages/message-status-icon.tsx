import type { MessageStatus } from "@/lib/data";
import { Check, CheckCheck } from "lucide-react";
import type { ReactNode } from "react";

/** Delivery indicator on the user's own messages. */
export function MessageStatusIcon({
  status = "sent",
  className = "",
}: {
  status?: MessageStatus | undefined;
  className?: string;
}): ReactNode {
  if (status === "read") {
    return (
      <CheckCheck
        className={`size-3.5 shrink-0 text-accent ${className}`}
        aria-label="Read"
      />
    );
  }
  if (status === "delivered") {
    return (
      <CheckCheck
        className={`size-3.5 shrink-0 opacity-60 ${className}`}
        aria-label="Delivered"
      />
    );
  }
  return (
    <Check
      className={`size-3.5 shrink-0 opacity-60 ${className}`}
      aria-label="Sent"
    />
  );
}
