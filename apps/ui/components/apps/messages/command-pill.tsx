"use client";

import { CommandCardBody } from "@/components/apps/messages/command-card";
import { FloatingPanel, useDismissOnOutside } from "@/components/apps/messages/floating-panel";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { SealTally, SecretMask } from "@/components/apps/messages/once-seal";
import { commandToast, type ToastSubject } from "@/components/apps/messages/command-toast";
import { useProfileActions } from "@/components/apps/messages/profile-hovercard";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import { TokenMark } from "@/components/apps/wallet/token-mark";
import {
  content,
  getMessagePerson,
  getToken,
  getTokenBySymbol,
  type CommandCard as CommandCardData,
  type CommandVerb,
  type CustomVerb,
  type MessagePerson,
} from "@/lib/data";
import {
  cancelSubscription,
  delegationsFor,
  revokeDelegation,
  setToll,
} from "@/lib/command-effects";
import { formatSats } from "@/lib/messages";
import {
  Ban,
  CircleSlash,
  HandCoins,
  Paperclip,
  PenLine,
  Receipt,
  Repeat,
  RotateCcw,
  UserRoundSearch,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/** The satoshi/BSV mark, so a BSV amount carries an icon like a token does. */
function BsvMark({ size = 14 }: { size?: number }): ReactNode {
  const bsv = getTokenBySymbol("BSV");
  if (!bsv) return null;
  return <TokenMark token={bsv} size={size} />;
}

/**
 * A handle inside the pill: rounded-square avatar, then the bare handle.
 *
 * No `:ecosystem` suffix here. The avatar already says who this is, and in a
 * thread where every participant shares one ecosystem the suffix repeated on
 * every pill was noise. The popover shows the qualified form, which is where it
 * matters — that is the copy you would check before trusting a payment.
 */
function HandleToken({ person }: { person: MessagePerson }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <MemberAvatar person={person} size={14} />
      <span className="font-medium">@{person.handle}</span>
    </span>
  );
}

/** An amount inside the pill: circular currency mark, then the number. */
function AmountToken({ card }: { card: CommandCardData }): ReactNode {
  if (card.token) {
    const token = getToken(card.token.id);
    return (
      <span className="inline-flex items-center gap-1 align-middle">
        {token && <TokenMark token={token} size={14} />}
        <span className="font-medium">
          {card.token.units} {card.token.symbol.toUpperCase()}
        </span>
      </span>
    );
  }
  if (card.amountSats === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <BsvMark />
      <span className="font-medium">{formatSats(card.amountSats)}</span>
    </span>
  );
}

/**
 * The command as it was typed, with every parameter it carried.
 *
 * Modelled on a Slack channel mention: an inline pill, semi-rounded, that sits
 * in the run of the conversation rather than interrupting it. A `/whois` should
 * not occupy the same vertical space as a paragraph, and before this every
 * command did — the transcript read as a stack of receipts with the actual
 * conversation squeezed between them.
 *
 * Rendered from the card's structured fields rather than a stored string, so
 * each parameter can carry its own mark: a rounded-square avatar for a handle,
 * a circular coin for an amount, matching how they appear everywhere else.
 *
 * Parameter order follows the BRC-218 grammar, which puts the recipient before
 * the amount for every verb except `/split`.
 */
function PillContent({
  card,
  inline,
}: {
  card: CommandCardData;
  /** the pill sits inside the message's own sentence */
  inline: boolean;
}): ReactNode {
  const copy = content.messages.card;
  // A split names its recipients per leg rather than in `recipientIds`, so the
  // pill would otherwise show an amount with nobody to send it to.
  const ids = card.legs?.length
    ? card.legs.map((leg) => leg.personId)
    : (card.recipientIds ?? []);
  const people = ids
    .map((id) => getMessagePerson(id))
    .filter((p): p is MessagePerson => Boolean(p));

  const amount = <AmountToken card={card} />;
  const handles = people.map((person) => (
    <HandleToken key={person.id} person={person} />
  ));
  // Recipients then amount, for every verb: BRC-218 section 5.5 puts the
  // amount last in `/split` too, which the pill used to contradict.
  const args = [...handles, amount];

  /*
   * `/once` reads as `/once @handle… ●●●●● note`, in the payload's own slot.
   *
   * The mask is what the sender typed, rendered as the line the reader is
   * allowed to see — which makes the pill itself the state of the secret. Filled
   * and hopping while it is still there, hollow once it has been opened, struck
   * through if it was burned or lapsed unopened, and nobody has to open the card
   * to know which. The status is derived where the message renders, so the pill,
   * the badge and the seal cannot disagree.
   */
  if (card.verb === "once") {
    args.push(
      <SecretMask
        key="seal"
        state={
          card.status === "revealed"
            ? "opened"
            : card.status === "withdrawn" ||
                card.status === "burned" ||
                card.status === "expired"
              ? "void"
              : "sealed"
        }
      />,
      <SealTally key="tally" secretId={card.secretId} />,
    );
    /* A sealed document is a different errand from a sealed password, and the
       reader decides whether to go and find their machine from the pill. The
       count survives the opening because it describes the envelope. */
    if (card.sealedFiles) {
      args.push(
        <span
          key="files"
          className="inline-flex items-center gap-0.5 align-middle font-medium"
        >
          <Paperclip className="size-3" aria-hidden="true" />
          {card.sealedFiles}
        </span>,
      );
    }
  }

  const extras: ReactNode[] = [];
  // `/trolltoll [recipient] <amount>|off` — lifting a toll takes the literal
  // `off` rather than an amount, so without it the pill read as a bare verb.
  if (card.verb === "trolltoll" && card.amountSats === undefined) {
    extras.push(
      <span key="off" className="font-mono font-medium">
        off
      </span>,
    );
  }
  if (card.period) {
    extras.push(
      <span key="period" className="font-medium">
        {card.period}
      </span>,
    );
  }
  if (card.scope) {
    extras.push(
      <span key="scope" className="font-medium">
        {card.scope}
      </span>,
    );
  }
  if (card.duration) {
    extras.push(
      <span key="duration" className="font-medium">
        {card.duration}
      </span>,
    );
  }
  if (card.serial) {
    extras.push(
      <span key="serial" className="font-medium">
        {card.serial}
      </span>,
    );
  }
  /*
   * The memo is the one free-text argument, and it is the message's job once the
   * message has words of its own — repeating it inside the pill made a `/sign`
   * carrying a whole quoted paragraph swamp the sentence around it. Standalone
   * it still shows, clamped, because otherwise the pill would lose the only part
   * that says what the payment was for.
   */
  /* `/once` is the exception, and it is the reason the note exists as its own
     argument: the dots say nothing about what was sealed, so a mask with no
     label beside it is a pill a reader cannot act on. Same clamp either way. */
  if (card.memo && (!inline || card.verb === "once")) {
    const memo =
      card.memo.length > 64 ? `${card.memo.slice(0, 64).trimEnd()}…` : card.memo;
    extras.push(
      <span key="memo" className="opacity-80">
        {memo}
      </span>,
    );
  }

  return (
    <>
      <span className="font-mono font-semibold">/{card.verb}</span>
      {[...args, ...extras].filter(Boolean).map((node, index) => (
        <span key={index} className="contents">
          {node}
        </span>
      ))}
      {card.status === "failed" && (
        <span className="font-medium text-negative">{copy.status.failed}</span>
      )}
      {card.status === "partial" && (
        <span className="font-medium text-warning">{copy.status.partial}</span>
      )}
      {card.status === "pending" && (
        <span className="font-medium opacity-70">{copy.status.pending}</span>
      )}
      {/* A withdrawn request has to say so where the "Pending" badge was.
          Dropping the badge would read as paid rather than as withdrawn. A
          burned seal is the same problem: the struck-through mask alone says
          "empty" without saying nobody ever got it. */}
      {(card.status === "withdrawn" || card.status === "burned") && (
        <span className="font-medium line-through opacity-70">
          {card.status === "burned" ? copy.status.burned : copy.status.withdrawn}
        </span>
      )}
    </>
  );
}


/**
 * What you can do about a command, from inside its own receipt.
 *
 * Three kinds, and the kind is what decides whether an action belongs here at
 * all. A standing state the command created can be undone (`/trolltoll` set a
 * toll, `/subscribe` set a recurrence, `/delegate` issued a certificate) — that
 * is where an action in the receipt genuinely saves a trip to Settings. An
 * inbound command is waiting on you (`/request`, `/sign`, `/receipt`), so the
 * action is the obvious next step. And a repeatable one just re-runs with the
 * same parameters.
 *
 * Everything here re-enters the normal confirmation path rather than moving
 * value directly: BRC-218 section 4.1 wants a structured confirmation before
 * anything of value moves, and a button inside a hovercard is not that.
 */
function PillActions({
  card,
  onRan,
  onPost,
}: {
  card: CommandCardData;
  onRan: () => void;
  /** append a command message to the thread, as if it had just been run */
  onPost?: ((next: CommandCardData) => void) | undefined;
}): ReactNode {
  const copy = content.messages.card.act;
  const openProfile = useOpenProfile();
  const actions = useProfileActions();
  const first = (card.recipientIds ?? [])
    .map((id) => getMessagePerson(id))
    .find((person): person is MessagePerson => Boolean(person));

  const subject: ToastSubject = first
    ? { kind: "person", person: first }
    : { kind: "ecosystem", ecosystem: "nexus" };

  /** Post the follow-up command, so the thread records what the button did. */
  const post = (next: CommandCardData): void => onPost?.(next);

  const acts: { key: string; label: string; icon: ReactNode; run: () => void }[] =
    [];

  const repeatable: (CommandVerb | CustomVerb)[] = ["pay", "tip", "split"];

  switch (card.verb) {
    case "trolltoll": {
      // Already lifted: nothing to undo, so no button is offered.
      if (card.amountSats !== undefined) {
        acts.push({
          key: "lift",
          label: copy.liftToll,
          icon: <CircleSlash className="size-3.5" />,
          run: () => {
            setToll(first?.id, null);
            post({
              verb: "trolltoll",
              status: "lifted",
              ...(first ? { recipientIds: [first.id] } : {}),
            });
            commandToast({
              verb: "trolltoll",
              title: copy.tollLifted,
              detail: copy.tollLiftedNote,
              subject,
              tone: "info",
            });
          },
        });
      }
      break;
    }
    case "subscribe": {
      acts.push({
        key: "cancel",
        label: copy.cancelSubscription,
        icon: <Ban className="size-3.5" />,
        run: () => {
          if (first) cancelSubscription(first.id);
          post({
            verb: "subscribe",
            status: "cancelled",
            ...(first ? { recipientIds: [first.id] } : {}),
            ...(card.amountSats !== undefined
              ? { amountSats: card.amountSats }
              : {}),
            ...(card.period ? { period: card.period } : {}),
          });
          commandToast({
            verb: "subscribe",
            title: copy.subCancelled,
            detail: copy.subCancelledNote,
            subject,
            tone: "info",
          });
        },
      });
      break;
    }
    case "delegate": {
      acts.push({
        key: "revoke",
        label: copy.revoke,
        icon: <Ban className="size-3.5" />,
        run: () => {
          const serial =
            card.serial ?? (first ? delegationsFor(first.id)[0]?.serial : null);
          if (!serial) {
            commandToast({
              verb: "revoke",
              title: copy.nothingToUndo,
              subject,
              tone: "warning",
            });
            return;
          }
          revokeDelegation(serial);
          post({
            verb: "revoke",
            status: "revoked",
            ...(first ? { recipientIds: [first.id] } : {}),
            serial,
          });
          commandToast({
            verb: "revoke",
            title: copy.revoked,
            detail: copy.revokedNote,
            subject,
            tone: "warning",
          });
        },
      });
      break;
    }
    case "request": {
      // Value moves, so this cannot execute from a hovercard: BRC-218 section
      // 4.1 wants a structured confirmation first. The composer is seeded with
      // the matching `/pay` and the user confirms it there, which is also what
      // puts the card in the thread.
      acts.push({
        key: "pay",
        label: copy.payRequest,
        icon: <HandCoins className="size-3.5" />,
        run: () => {
          if (first) actions?.prefill?.(first, "pay");
          commandToast({
            verb: "pay",
            title: copy.readyTitle,
            detail: copy.readyNote,
            subject,
            tone: "info",
          });
        },
      });
      break;
    }
    case "sign": {
      acts.push({
        key: "countersign",
        label: copy.countersign,
        icon: <PenLine className="size-3.5" />,
        run: () => {
          post({
            verb: "sign",
            status: "signed",
            ...(first ? { recipientIds: [first.id] } : {}),
            ...(card.boundMessageId
              ? { boundMessageId: card.boundMessageId }
              : {}),
          });
          commandToast({
            verb: "sign",
            title: copy.signedTitle,
            detail: copy.signedNote,
            subject,
          });
        },
      });
      break;
    }
    case "receipt": {
      acts.push({
        key: "ack",
        label: copy.acknowledge,
        icon: <Receipt className="size-3.5" />,
        run: () => {
          post({
            verb: "receipt",
            status: "resolved",
            ...(first ? { recipientIds: [first.id] } : {}),
          });
          commandToast({
            verb: "receipt",
            title: copy.ackTitle,
            detail: copy.ackNote,
            subject,
          });
        },
      });
      break;
    }
    case "whois":
    case "attest":
    case "vouch": {
      // Navigational, so nothing is posted: opening a profile is not an event
      // the other participants should see in the transcript.
      if (first) {
        acts.push({
          key: "identity",
          label: copy.viewIdentity,
          icon: <UserRoundSearch className="size-3.5" />,
          run: () => openProfile(first),
        });
      }
      break;
    }
    default:
      break;
  }

  if (repeatable.includes(card.verb)) {
    acts.push({
      key: "again",
      label: copy.again,
      icon:
        card.verb === "tip" ? (
          <Repeat className="size-3.5" />
        ) : (
          <RotateCcw className="size-3.5" />
        ),
      run: () => {
        // Same reason as `/request`: it moves value, so it goes back through the
        // composer rather than firing from inside a popover.
        if (first) actions?.prefill?.(first, card.verb);
        commandToast({
          verb: card.verb,
          title: copy.readyTitle,
          detail: copy.readyNote,
          subject,
          tone: "info",
        });
      },
    });
  }

  if (acts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2.5">
      {acts.map((act) => (
        <button
          key={act.key}
          type="button"
          onClick={() => {
            act.run();
            onRan();
          }}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {act.icon}
          {act.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The pill, and the card it opens.
 *
 * Opens on hover and on click, like the profile hovercards, and flips to
 * whichever side has room — a command near the top of the transcript has none
 * above it.
 */
export function CommandPill({
  card,
  mine = false,
  inline = false,
  onPost,
}: {
  card: CommandCardData;
  /** on the user's own bubble, which is already accent-filled */
  mine?: boolean;
  /** rendered inside the message's own sentence rather than on its own line */
  inline?: boolean;
  /** append the follow-up command a quick action produced */
  onPost?: ((next: CommandCardData) => void) | undefined;
}): ReactNode {
  const [open, setOpen] = useState(false);

  /*
   * Closing is delayed so the pointer can cross the gap between the trigger and
   * the panel, which is portalled and therefore not a child that would keep the
   * trigger's hover alive. Entering either cancels the pending close.
   */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = (): void => {
    keepOpen();
    closeTimer.current = setTimeout(() => setOpen(false), 400);
  };
  const ref = useRef<HTMLSpanElement>(null);

  const show = (): void => setOpen(true);

  useDismissOnOutside(open, ref, setOpen);

  return (
    <span
      ref={ref}
      className="relative inline-flex max-w-full"
      onPointerEnter={() => {
        keepOpen();
        show();
      }}
      onPointerLeave={closeSoon}
    >
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`/${card.verb} — ${content.messages.card.details}`}
        /* Semi-rounded and tinted, the way a channel mention reads: clearly a
           reference to something structured, still part of the sentence.
           On the user's own bubble the tint has to come off the bubble colour
           rather than the accent, which is what that bubble already is. */
        className={`focus-ring inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md px-1.5 py-0.5 text-left text-[13px] leading-6 transition-colors ${
          mine
            ? "bg-white/20 text-accent-foreground hover:bg-white/30"
            : "bg-accent/15 text-accent hover:bg-accent/25"
        }`}
      >
        <PillContent card={card} inline={inline} />
      </button>

      {open && (
        <FloatingPanel
          anchor={ref}
          onPointerEnter={keepOpen}
          onPointerLeave={closeSoon}
          align={mine ? "end" : "start"}
          label={`/${card.verb} — ${content.messages.card.details}`}
        >
          <span className="block overflow-hidden rounded-2xl border border-border bg-surface-raised text-foreground shadow-2xl">
            <CommandCardBody card={card} bare mine={mine} />
            <PillActions
              card={card}
              onRan={() => setOpen(false)}
              onPost={onPost}
            />
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}
