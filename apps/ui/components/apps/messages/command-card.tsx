"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { OnceSeal } from "@/components/apps/messages/once-seal";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import {
  content,
  getMessagePerson,
  type CommandCard as CommandCardData,
  type CommandVerb,
  type CustomVerb,
  type MessagePerson,
} from "@/lib/data";
import { TokenAmount } from "@/components/apps/wallet/token-mark";
import { formatFiat, formatSats } from "@/lib/messages";
import {
  CircleArrowDown,
  CircleArrowUp,
  BadgeCheck,
  Handshake,
  PackageOpen,
  Bot,
  CircleSlash,
  Eye,
  ListChecks,
  Undo2,
  Ban,
  Check,
  CircleQuestionMark,
  Clock,
  Coins,
  EyeOff,
  FileSignature,
  Flame,
  HeartCrack,
  Lock,
  LockOpen,
  HeartHandshake,
  Inbox,
  KeyRound,
  PenLine,
  Radio,
  Receipt,
  Map as MapIcon,
  Repeat,
  Split,
  TriangleAlert,
  UserRoundCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const ICONS: Record<CommandVerb | CustomVerb, ReactNode> = {
  pay: <CircleArrowUp className="size-4" />,
  message: <Inbox className="size-4" />,
  request: <CircleArrowDown className="size-4" />,
  tip: <Coins className="size-4" />,
  split: <Split className="size-4" />,
  subscribe: <Repeat className="size-4" />,
  whois: <UserRoundCheck className="size-4" />,
  roadmap: <MapIcon className="size-4" />,
  attest: <BadgeCheck className="size-4" />,
  scope: <Radio className="size-4" />,
  refund: <Undo2 className="size-4" />,
  send: <PackageOpen className="size-4" />,
  escrow: <Handshake className="size-4" />,
  once: <EyeOff className="size-4" />,
  cancel: <CircleSlash className="size-4" />,
  standing: <ListChecks className="size-4" />,
  watch: <Eye className="size-4" />,
  agent: <Bot className="size-4" />,
  trolltoll: <Coins className="size-4" />,
  delegate: <KeyRound className="size-4" />,
  revoke: <Ban className="size-4" />,
  handoff: <PenLine className="size-4" />,
  sign: <FileSignature className="size-4" />,
  receipt: <Receipt className="size-4" />,
  vouch: <HeartHandshake className="size-4" />,
  renounce: <HeartCrack className="size-4" />,
  /* `/help` never produces a card — it answers with an ephemeral reply — but the
     map is exhaustive over the verb union, so it needs an entry. */
  help: <CircleQuestionMark className="size-4" />,
};

function StatusPill({ status }: { status: CommandCardData["status"] }): ReactNode {
  const copy = content.messages.card.status;
  /* `sealed` is accent rather than positive: something is waiting, and calling
     that a success would read as delivered-and-done when the whole point is
     that it has not been opened yet. `revealed`, `burned` and `expired` are all
     muted, because a spent or destroyed secret is an empty envelope rather than
     an achievement — and a green tick on "Expired" was reading as one. */
  const tone =
    status === "failed"
      ? "bg-negative/15 text-negative"
      : status === "partial"
        ? "bg-warning/15 text-warning"
        : status === "sealed"
          ? "bg-accent/15 text-accent"
          : status === "pending" ||
              status === "revealed" ||
              status === "burned" ||
              status === "expired"
            ? "bg-surface text-muted-foreground"
            : "bg-positive/15 text-positive";
  const icon =
    status === "failed" ? (
      <X className="size-3" />
    ) : status === "partial" ? (
      <TriangleAlert className="size-3" />
    ) : status === "sealed" ? (
      <Lock className="size-3" />
    ) : status === "revealed" ? (
      <LockOpen className="size-3" />
    ) : status === "burned" ? (
      <Flame className="size-3" />
    ) : status === "pending" || status === "expired" ? (
      <Clock className="size-3" />
    ) : (
      <Check className="size-3" />
    );
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {icon}
      {copy[status]}
    </span>
  );
}

function PersonChip({ person }: { person: MessagePerson }): ReactNode {
  const openProfile = useOpenProfile();
  return (
    <button
      type="button"
      onClick={() => openProfile(person)}
      className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface px-1.5 py-0.5 hover:bg-surface-hover"
    >
      <MemberAvatar person={person} size={16} />
      <Handle person={person} size={10} className="truncate text-[11px]" />
    </button>
  );
}

/**
 * What a command did, as a self-contained card.
 *
 * The transcript no longer shows this inline. A command reads as a line the user
 * typed, so the message carries the command as a pill and this is what the pill
 * opens — which keeps the receipt available without giving every `/whois` the
 * same weight in the thread as a paragraph of conversation.
 */
export function CommandCardBody({
  card,
  bare = false,
  mine = false,
}: {
  card: CommandCardData;
  /** drop the frame, for when the caller supplies one (and appends actions) */
  bare?: boolean;
  /**
   * The card sits on the user's own message. Only `/once` needs it, and it
   * needs it for a reason the card cannot infer: a secret is openable by its
   * recipient and by nobody else, including whoever sealed it.
   */
  mine?: boolean;
}): ReactNode {
  const copy = content.messages.card;
  const people = (card.recipientIds ?? [])
    .map((id) => getMessagePerson(id))
    .filter((p): p is MessagePerson => Boolean(p));

  return (
    <div
      className={
        bare
          ? "w-72 max-w-[min(22rem,calc(100vw-1.5rem))] text-foreground"
          : "w-72 max-w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised text-foreground shadow-2xl"
      }
    >
      <div>
        <div>
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent"
              aria-hidden="true"
            >
              {ICONS[card.verb]}
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs font-bold">
              /{card.verb}
            </code>
            <StatusPill status={card.status} />
          </div>

          <div className="space-y-2 px-3 py-2.5">
            {/* Headline: the amount, where there is one. */}
            {card.token ? (
              <p className="text-base font-bold">
                <TokenAmount
                  tokenId={card.token.id}
                  units={card.token.units}
                  size={16}
                />
              </p>
            ) : (
              card.amountSats !== undefined && (
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-bold">
                    {formatSats(card.amountSats)}
                  </span>
                  {card.fiat && (
                    <span className="text-xs text-muted-foreground">
                      {formatFiat(card.fiat.amount, card.fiat.currency)}
                    </span>
                  )}
                </p>
              )
            )}

            {card.tollSats !== undefined && card.tollSats > 0 && (
              <p className="text-xs text-muted-foreground">
                {copy.plusToll} {formatSats(card.tollSats)}
              </p>
            )}

            {people.length > 0 && !card.legs && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {card.verb === "request"
                    ? copy.from
                    : card.verb === "once"
                      ? copy.sealedFor
                      : copy.to}
                </span>
                {people.map((person) => (
                  <PersonChip key={person.id} person={person} />
                ))}
              </div>
            )}

            {/* Per-leg outcomes: a split reports each leg, never just a total. */}
            {card.legs && (
              <ul className="space-y-1">
                {card.legs.map((leg) => {
                  const person = getMessagePerson(leg.personId);
                  if (!person) return null;
                  return (
                    <li
                      key={leg.personId}
                      className="flex items-center justify-between gap-2"
                    >
                      <PersonChip person={person} />
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                        {leg.units !== undefined && card.token ? (
                          <TokenAmount
                            tokenId={card.token.id}
                            units={leg.units}
                            size={12}
                          />
                        ) : (
                          formatSats(leg.sats)
                        )}
                        {leg.ok ? (
                          <Check
                            className="size-3.5 text-positive"
                            aria-label={copy.status.sent}
                          />
                        ) : (
                          <X
                            className="size-3.5 text-negative"
                            aria-label={copy.status.failed}
                          />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {card.period && (
              <p className="text-xs">
                {copy.every} {card.period}
                {card.fiat ? ` · ${copy.varies}` : ""}
              </p>
            )}
            {card.scope && (
              <p className="text-xs">
                {copy.scope}{" "}
                <code className="font-mono">{card.scope}</code>
                {card.duration ? ` · ${copy.expires} ${card.duration}` : ""}
              </p>
            )}
            {card.serial && (
              <p className="font-mono text-[11px] break-all text-muted-foreground">
                {copy.serial} {card.serial}
              </p>
            )}
            {card.signature && (
              <p className="font-mono text-[11px] break-all text-muted-foreground">
                {copy.signature} {card.signature.slice(0, 32)}…
              </p>
            )}
            {card.memo && <p className="text-sm text-pretty">{card.memo}</p>}

            {/* The seal comes after the note deliberately. The note is the half
                that survives, and it is the last thing worth reading before an
                irreversible click. */}
            {card.verb === "once" && card.secretId && (
              <OnceSeal card={card} mine={mine} />
            )}
            {card.note && (
              <p className="flex items-start gap-1.5 text-[11px] text-pretty text-muted-foreground">
                <TriangleAlert
                  className="mt-px size-3 shrink-0"
                  aria-hidden="true"
                />
                {card.note}
              </p>
            )}
            {card.capEnforced === false && (
              <p className="flex items-start gap-1.5 text-[11px] text-pretty text-muted-foreground">
                <TriangleAlert
                  className="mt-px size-3 shrink-0 text-warning"
                  aria-hidden="true"
                />
                {copy.capNotEnforced}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
