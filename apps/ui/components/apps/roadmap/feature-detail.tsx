"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  ComplexityBar,
  progressOf,
} from "@/components/apps/roadmap/feature-card";
import { InfoPopover } from "@/components/apps/roadmap/info-popover";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getMessagePerson,
  type RoadmapFeature,
} from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { comment, pledge } from "@/lib/roadmap-effects";
import { Check, Coins, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.roadmap;

/** Round figures somebody might actually pick, in satoshis. */
const PRESETS = [1_000_000, 5_000_000, 25_000_000];

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

/**
 * The bar, the numbers, and the way to change them.
 *
 * Shows what is still needed rather than only what has arrived: a feature at
 * 12 of 30 million is asking for 18, and that is the figure somebody deciding
 * whether to close the gap actually wants.
 */
function Funding({ feature }: { feature: RoadmapFeature }): ReactNode {
  const { setWalletIntent, openApp } = useHub();
  const [amount, setAmount] = useState<number>(PRESETS[0]!);
  const [custom, setCustom] = useState("");
  const full = feature.pledgedSats >= feature.goalSats;
  const remaining = Math.max(0, feature.goalSats - feature.pledgedSats);
  const progress = progressOf(feature);

  const chosen = custom.trim()
    ? Math.max(0, Math.round(Number(custom.replace(/[^\d]/g, ""))))
    : amount;

  const fund = (): void => {
    if (chosen <= 0) return;
    pledge(feature.id, chosen);
    /* The money leaves the wallet, so the wallet is where it is confirmed.
       Funding that never touches Payments would be a second, quieter
       way to spend, and the point of one wallet is that there is one. */
    setWalletIntent({ kind: "send" });
    toast.success(
      copy.pledged.replace("{amount}", formatSats(chosen)),
      {
        description: feature.title,
        action: {
          label: content.wallet.openMessages.replace("Messages", "Wallet"),
          onClick: () => openApp("wallet"),
        },
      },
    );
    setCustom("");
  };

  return (
    <section className="border-border/60 border-b p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold tabular-nums">
          {formatSats(feature.pledgedSats)}
        </span>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {copy.ofGoal} {formatSats(feature.goalSats)}
        </span>
      </div>
      <div
        className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Same fixed colour as the board's bars — this is the same number,
            and it should not change meaning when you open the card. */}
        <div
          className="nexus-fund-fill h-full rounded-full bg-[#FFAF00]"
          style={{ "--fund-width": `${progress * 100}%` } as React.CSSProperties}
        />
      </div>
      <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
        {full ? (
          <span className="text-foreground inline-flex items-center gap-1 font-semibold">
            <Check className="size-3.5" aria-hidden="true" />
            {copy.fundedAlready}
          </span>
        ) : (
          <>
            {formatSats(remaining)} {copy.remaining}
          </>
        )}
      </p>

      {feature.status !== "shipped" && (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset);
                  setCustom("");
                }}
                aria-pressed={!custom && amount === preset}
                className={`focus-ring rounded-lg px-2 py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                  !custom && amount === preset
                    ? "bg-accent/15 text-foreground"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {formatSats(preset)}
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            inputMode="numeric"
            placeholder={copy.custom}
            aria-label={copy.custom}
            className="focus-ring border-border bg-surface mt-1.5 w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums outline-none"
          />
          <button
            type="button"
            onClick={fund}
            disabled={chosen <= 0}
            className="focus-ring bg-accent text-accent-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Coins className="size-4" aria-hidden="true" />
            {full ? copy.fundAgain : copy.fund}
          </button>
          {/* Said where the money is about to move, not only in the guide.
              Somebody about to pay is the one person who has to know this,
              and they are the least likely to have read a help pane. */}
          <p className="text-muted-foreground mt-1.5 text-[10px] leading-relaxed text-pretty">
            {copy.fundCaveat}
          </p>
        </div>
      )}
    </section>
  );
}

function Backers({ feature }: { feature: RoadmapFeature }): ReactNode {
  const { openDetailPane } = useHub();
  if (feature.pledges.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-xs">{copy.noBackers}</p>
    );
  }
  return (
    <ul className="divide-border/60 divide-y">
      {feature.pledges.map((entry, index) => {
        const person = getMessagePerson(entry.personId);
        if (!person) return null;
        return (
          <li key={`${entry.personId}-${index}`}>
            <button
              type="button"
              onClick={() =>
                openDetailPane({ kind: "person", id: person.id })
              }
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 px-4 py-2.5 text-left"
            >
              <MemberAvatar person={person} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {person.name}
                </span>
                {/* The handle, not the display name, is the thing that was
                    paid from — BRC-169 is what makes this attributable. */}
                <Handle
                  person={person}
                  size={10}
                  className="text-muted-foreground mt-0.5 max-w-full truncate text-[10px]"
                />
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {formatSats(entry.sats)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What people have said, and who is allowed to say it.
 *
 * Posting is for backers. Not to keep people quiet, but because a public board
 * with an open comment box becomes a queue of "+1" that buries the one person
 * who explained why a feature is wrong. Money is a cheap filter and an even one:
 * it costs the same whether you are agreeing or objecting, and the objection is
 * usually the more valuable of the two.
 *
 * Reading stays open to everybody. A discussion nobody outside can read is a
 * private roadmap wearing a public one's clothes.
 */
function Discussion({ feature }: { feature: RoadmapFeature }): ReactNode {
  const [draft, setDraft] = useState("");
  const backed = feature.pledges.some((entry) => entry.personId === "me");
  const post = (): void => {
    const body = draft.trim();
    if (!body) return;
    comment(feature.id, body);
    setDraft("");
  };
  return (
    <section className="p-4">
      <h4 className="text-xs font-bold">{copy.comments}</h4>
      {feature.comments.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">{copy.noComments}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {feature.comments.map((entry) => {
            const person = getMessagePerson(entry.personId);
            return (
              <li key={entry.id} className="flex gap-2.5">
                {person && <MemberAvatar person={person} size={24} />}
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold">
                      {person?.name ?? entry.personId}
                    </span>
                    <time
                      dateTime={entry.at}
                      className="text-muted-foreground text-[10px]"
                    >
                      {entry.at}
                    </time>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-pretty">
                    {entry.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {backed ? (
        <>
          <div className="border-border bg-surface mt-3 flex items-end gap-1.5 rounded-xl border p-1.5">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  post();
                }
              }}
              rows={2}
              placeholder={copy.commentPlaceholder}
              aria-label={copy.commentPlaceholder}
              className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-xs outline-none"
            />
            <button
              type="button"
              onClick={post}
              disabled={!draft.trim()}
              aria-label={copy.commentSend}
              className="focus-ring bg-accent text-accent-foreground shrink-0 rounded-lg p-1.5 disabled:opacity-40"
            >
              <Send className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-muted-foreground mt-1.5 text-[10px] text-pretty">
            {copy.commentCost}
          </p>
        </>
      ) : (
        /* Says what would open it rather than only that it is shut. A locked
           control with no stated way through is just a wall. */
        <div className="border-border/60 bg-surface mt-3 flex items-start gap-2 rounded-xl border p-3">
          <Lock
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-pretty">
            <span className="font-semibold">{copy.commentBackersOnly}</span>{" "}
            <span className="text-muted-foreground">
              {copy.commentBackersWhy}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * One feature, in full.
 *
 * The same body for both surfaces: a side pane beside the board on desktop, a
 * bottom sheet on a phone. Two layouts would mean two places to forget to show
 * the funding bar.
 */
export function FeatureDetail({
  feature,
}: {
  feature: RoadmapFeature;
}): ReactNode {
  const complexityLabel =
    feature.complexity === "low"
      ? copy.complexityLow
      : feature.complexity === "medium"
        ? copy.complexityMedium
        : copy.complexityHigh;

  return (
    <div>
      <div className="border-border/60 border-b p-4">
        <h3 className="text-base font-bold text-pretty">{feature.title}</h3>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          {feature.summary}
        </p>
      </div>

      <Funding feature={feature} />

      <section className="border-border/60 border-b p-4">
        <p className="text-xs leading-relaxed text-pretty">{feature.body}</p>
      </section>

      <section className="border-border/60 border-b p-4">
        <Row label={copy.status}>
          {feature.status === "fundable"
            ? copy.fundable
            : feature.status === "funded"
              ? copy.funded
              : copy.shipped}
        </Row>
        <Row label={copy.complexity}>
          {/* Hover or click. "Medium" tells a reader almost nothing on its own;
              what the levels mean and what the person who scoped this one said
              about it are the useful parts, and both are too long for a
              tooltip. */}
          <InfoPopover
            label={`${copy.complexity}: ${complexityLabel}`}
            trigger={
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <ComplexityBar complexity={feature.complexity} />
                {complexityLabel}
              </span>
            }
          >
            <span className="block text-xs font-bold">{copy.complexity}</span>
            <span className="text-muted-foreground mt-1 block text-[11px] leading-relaxed text-pretty">
              {copy.complexityHint}
            </span>
            <span className="mt-2 block space-y-1">
              {copy.complexityLevels.map((level) => (
                <span key={level.label} className="block text-[11px] text-pretty">
                  <span className="font-semibold">{level.label}:</span>{" "}
                  <span className="text-muted-foreground">{level.body}</span>
                </span>
              ))}
            </span>
            {feature.devNote && (
              <span className="border-border/60 mt-2.5 block border-t pt-2.5">
                <span className="text-muted-foreground block text-[10px] font-bold tracking-wide uppercase">
                  {copy.devNoteTitle}
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-pretty italic">
                  {feature.devNote}
                </span>
              </span>
            )}
          </InfoPopover>
        </Row>
        <Row label={copy.created}>
          <time dateTime={feature.createdAt}>{feature.createdAt}</time>
        </Row>
        {feature.fundedAt && (
          <Row label={copy.funded_}>
            <time dateTime={feature.fundedAt}>{feature.fundedAt}</time>
          </Row>
        )}
        {feature.release && (
          <Row label={copy.inRelease}>v{feature.release}</Row>
        )}
        {feature.reference && (
          <Row label="Reference">
            <span className="font-mono text-[10px]">{feature.reference}</span>
          </Row>
        )}
      </section>

      <section className="border-border/60 border-b">
        <h4 className="px-4 pt-4 text-xs font-bold">
          {copy.backers}{" "}
          <span className="text-muted-foreground tabular-nums">
            {feature.pledges.length}
          </span>
        </h4>
        <div className="mt-1">
          <Backers feature={feature} />
        </div>
      </section>

      <Discussion feature={feature} />
    </div>
  );
}
