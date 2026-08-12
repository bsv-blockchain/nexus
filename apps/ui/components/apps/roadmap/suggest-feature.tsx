"use client";

import { Sheet } from "@/components/apps/messages/sheet";
import { useHub } from "@/components/hub/hub-provider";
import { content, type Complexity } from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { suggestFeature } from "@/lib/roadmap-effects";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.roadmap;

const COMPLEXITIES: { id: Complexity; label: string }[] = [
  { id: "low", label: copy.complexityLow },
  { id: "medium", label: copy.complexityMedium },
  { id: "high", label: copy.complexityHigh },
];

/** What a feature of each size tends to cost, so nobody has to guess a goal. */
const SUGGESTED_GOAL: Record<Complexity, number> = {
  low: 10_000_000,
  medium: 30_000_000,
  high: 70_000_000,
};

/**
 * Asking for something that is not on the board.
 *
 * Priced, and the price is the feature. A public board with a free suggestion
 * box fills with one-line restatements of what is already on it; a thousand
 * satoshis is nothing to somebody who means it and enough to stop somebody who
 * does not.
 *
 * It lands in Fundable at zero, like everything else — a suggestion is not a
 * commitment, and the board would be lying if a new card arrived part-funded.
 */
export function SuggestFeature(): ReactNode {
  const { openDetailPane } = useHub();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("medium");

  const ready = title.trim().length > 2 && summary.trim().length > 2;

  const submit = (): void => {
    if (!ready) return;
    const feature = suggestFeature({
      title: title.trim(),
      summary: summary.trim(),
      body: body.trim() || summary.trim(),
      complexity,
      goalSats: SUGGESTED_GOAL[complexity],
    });
    setOpen(false);
    setTitle("");
    setSummary("");
    setBody("");
    toast.success(feature.title, {
      description: `${copy.fundable} · ${formatSats(feature.goalSats)}`,
      action: {
        label: copy.openInRoadmap,
        onClick: () => openDetailPane({ kind: "feature", id: feature.id }),
      },
    });
  };

  const field =
    "focus-ring border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        <Lightbulb className="size-4" aria-hidden="true" />
        {copy.suggest}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={copy.suggest}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="focus-ring bg-muted hover:bg-surface-hover flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {copy.suggest}
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-4">
          <p className="text-muted-foreground text-xs text-pretty">
            {copy.suggestHint}
          </p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What should it do?"
            aria-label="Title"
            className={field}
          />
          <input
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="One line for the card"
            aria-label="Summary"
            className={field}
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Why it is worth building"
            aria-label="Detail"
            className={`${field} resize-none`}
          />
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              {copy.complexity}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {COMPLEXITIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setComplexity(option.id)}
                  aria-pressed={complexity === option.id}
                  className={`focus-ring rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    complexity === option.id
                      ? "bg-accent/15 text-foreground"
                      : "bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* The goal follows the size rather than being asked for. Somebody
                proposing a feature rarely knows what it costs, and a blank
                field invites a number that means nothing. */}
            <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
              {copy.totalGoal}: {formatSats(SUGGESTED_GOAL[complexity])}
            </p>
          </div>
        </div>
      </Sheet>
    </>
  );
}
