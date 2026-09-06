"use client";

import { Sheet } from "@/components/apps/messages/sheet";
import { useHub } from "@/components/hub/hub-provider";
import { content, type Complexity } from "@/lib/data";
import { formatSats, handleOf } from "@/lib/messages";
import { profileFor, useProfiles } from "@/lib/profiles-store";
import { suggestFeature } from "@/lib/roadmap-effects";
import {
  consumeFeedbackRequest,
  useFeedbackRequested,
} from "@/lib/feedback-request";
import { Lightbulb, Signature, type LucideIcon } from "lucide-react";
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
/**
 * Which of the two the sheet is showing, or nothing.
 *
 * One sheet rather than two, because they are the same gesture with different
 * stakes: a short form in a bottom sheet with a submit button. Two components
 * would be two places for that frame to drift.
 */
type Mode = "feedback" | "feature" | null;

export function SuggestFeature(): ReactNode {
  const { openDetailPane, activeSpaceId } = useHub();
  const profiles = useProfiles();
  const me = profileFor(profiles, activeSpaceId);
  const [mode, setMode] = useState<Mode>(null);
  /*
   * What the sheet has just done, if anything.
   *
   * Held beside `mode` rather than folded into it, because the sheet is still
   * the same sheet: it stays open, keeps its label, and swaps its body. A third
   * `mode` value would have made "which form is this" and "has it been sent"
   * the same question, and closing the sent state would then have to know which
   * form to go back to.
   */
  const [sent, setSent] = useState<{ id: string; title: string } | null>(null);
  const [note, setNote] = useState("");
  /*
   * The help menu can ask for this sheet from anywhere.
   *
   * Derived rather than copied into state: an effect that answered the request
   * by calling `setMode` would be a synchronous setState in an effect, which is
   * the thing that makes a component render twice to settle. The request IS the
   * open state while it lasts, and closing is what consumes it — so the sheet
   * cannot reopen itself the next time somebody visits the Roadmap.
   */
  const feedbackRequested = useFeedbackRequested();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("medium");

  /* The request wins while it lasts; otherwise it is whatever was clicked. */
  const shown: Mode = feedbackRequested ? "feedback" : mode;

  const ready = title.trim().length > 2 && summary.trim().length > 2;
  const noteReady = summary.trim().length > 2 && note.trim().length > 2;

  const submit = (): void => {
    if (!ready) return;
    const feature = suggestFeature({
      title: title.trim(),
      summary: summary.trim(),
      body: body.trim() || summary.trim(),
      complexity,
      goalSats: SUGGESTED_GOAL[complexity],
    });
    /* The sheet stays open and shows what happened. No toast: a message about
       a thing you are already looking at is a second copy of it. */
    setSent({ id: feature.id, title: feature.title });
    setTitle("");
    setSummary("");
    setBody("");
  };

  /**
   * Feedback, signed.
   *
   * Nothing is charged and nothing lands on the board: this is a note to the
   * people building it, not a proposal to fund. The signature is the whole
   * point of the exchange — free to send, but attributable, so what arrives is
   * from a handle somebody has to keep using afterwards.
   *
   * Mocked. No key is touched here; the sent state names the handle it would
   * have been signed with.
   */
  const sendFeedback = (): void => {
    if (!noteReady) return;
    setSent({ id: "", title: summary.trim() });
    setSummary("");
    setNote("");
  };

  /* One way out, whichever state the sheet is in: shut it, then clear what it
     was showing. Clearing first would flash the empty form on the way down. */
  const close = (): void => {
    if (feedbackRequested) consumeFeedbackRequest();
    setMode(null);
    window.setTimeout(() => setSent(null), 300);
  };

  const field =
    "focus-ring border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none";

  return (
    <>
      {/* Feedback leads. It is free and it is what most people standing at a
          roadmap actually want to do; suggesting a feature costs satoshis and
          is the rarer, heavier act, so it reads as the alternative rather than
          as the only way to say something. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setMode("feedback")}
          className="focus-ring bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <Signature className="size-4" aria-hidden="true" />
          {copy.feedback}
        </button>
        <button
          type="button"
          onClick={() => setMode("feature")}
          className="focus-ring ring-border hover:bg-surface-hover flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition-colors"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {copy.suggest}
        </button>
      </div>

      <Sheet
        open={shown === "feedback"}
        onClose={close}
        label={copy.feedback}
        footer={
          sent ? (
            <button
              type="button"
              onClick={close}
              className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-4 py-2.5 text-sm font-bold"
            >
              {copy.done}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="focus-ring bg-muted hover:bg-surface-hover flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={sendFeedback}
                disabled={!noteReady}
                className="focus-ring bg-accent text-accent-foreground flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Signature className="size-4" aria-hidden="true" />
                {copy.feedbackSign}
              </button>
            </div>
          )
        }
      >
        {sent ? (
          <Sent
            icon={Signature}
            title={copy.feedbackSentTitle}
            detail={copy.feedbackSentDetail.replace("{handle}", handleOf(me))}
            quoted={sent.title}
          />
        ) : (
          <div className="space-y-3 p-4">
            <p className="text-muted-foreground text-xs text-pretty">
              {copy.feedbackHint}
            </p>
            <input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={copy.feedbackSummaryPlaceholder}
              aria-label={copy.feedbackSummaryPlaceholder}
              className={field}
            />
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              placeholder={copy.feedbackBodyPlaceholder}
              aria-label={copy.feedbackBodyLabel}
              className={`${field} resize-none`}
            />
          </div>
        )}
      </Sheet>

      <Sheet
        open={shown === "feature"}
        onClose={close}
        label={copy.suggest}
        footer={
          sent ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="focus-ring bg-muted hover:bg-surface-hover flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {copy.done}
              </button>
              {/* The one thing worth doing next, where the toast used to put
                  it. A card you cannot get to from the message announcing it
                  is a message about somewhere else. */}
              <button
                type="button"
                onClick={() => {
                  const id = sent.id;
                  close();
                  openDetailPane({ kind: "feature", id });
                }}
                className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold"
              >
                {copy.openInRoadmap}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
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
          )
        }
      >
        {sent ? (
          <Sent
            icon={Lightbulb}
            title={copy.suggestedTitle}
            detail={copy.suggestedDetail}
            quoted={sent.title}
          />
        ) : (
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
        )}
      </Sheet>
    </>
  );
}

/**
 * What a sheet shows once it has done the thing.
 *
 * The header is a placeholder: a tinted field with the verb's own icon in it,
 * standing in for artwork nobody has drawn yet. Deliberately flat rather than
 * decorated — a gradient pretending to be an illustration is harder to replace
 * than an obvious gap, because it looks finished.
 *
 * Shared by both sheets so the two confirmations cannot drift into being
 * different sizes saying the same thing.
 */
function Sent({
  icon: Icon,
  title,
  detail,
  quoted,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  /** what was actually submitted, echoed back so it is clear what went */
  quoted: string;
}): ReactNode {
  return (
    <div>
      <div
        aria-hidden="true"
        className="bg-accent/12 ring-border/60 grid h-32 place-items-center ring-1"
      >
        <Icon className="text-accent size-9" strokeWidth={1.5} />
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm text-pretty">{detail}</p>
        {quoted ? (
          <p className="border-border bg-surface text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-sm">
            {quoted}
          </p>
        ) : null}
      </div>
    </div>
  );
}
