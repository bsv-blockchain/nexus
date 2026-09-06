"use client";

/**
 * The three things worth interrupting somebody about, and nothing else.
 *
 * Not a queue of invented submissions — there are none to review, and a
 * screen that pretends otherwise describes a process this build does not
 * have. What it does have is three states that quietly cost money if nobody
 * notices; `attentionNotes` in lib/admin-analytics works out which of them
 * apply, so this strip is empty exactly when there is nothing to do.
 */

import { attentionNotes } from "@/lib/admin-analytics";
import type { AdminPromoState } from "@/lib/admin-store";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function AttentionStrip({
  admin,
  onOpenAnalytics,
}: {
  admin: AdminPromoState;
  onOpenAnalytics: () => void;
}): ReactNode {
  const notes = attentionNotes(admin);
  if (notes.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpenAnalytics}
      className="border-warning/40 bg-warning/10 focus-ring mt-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left"
    >
      <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden="true" />
      <span className="text-warning min-w-0 flex-1 text-xs font-medium text-pretty">
        {notes.join(" · ")}
      </span>
      <span className="text-warning/80 shrink-0 text-[11px] font-semibold">
        See what is free
      </span>
    </button>
  );
}
