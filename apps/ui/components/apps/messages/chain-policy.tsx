"use client";

import {
  FloatingPanel,
  useDismissOnOutside,
} from "@/components/apps/messages/floating-panel";
import { Sheet } from "@/components/apps/messages/sheet";
import {
  acknowledgePermanence,
  getEffects,
  getEffectsServerSnapshot,
  hydrateChainPolicy,
  setChainPolicy,
  setConversationChainPolicy,
  subscribeEffects,
  type ChainPolicy,
} from "@/lib/command-effects";
import { content } from "@/lib/data";
import { Anchor, Check, Link2Off, ReceiptText } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * The three settings, in descending order of what survives.
 *
 * Ordered by permanence rather than alphabetically: the axis a reader is
 * choosing along is how much of this conversation outlives it, so a list that
 * walks down that axis can be read once instead of three times.
 */
const OPTIONS: {
  id: ChainPolicy;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    id: "messages",
    label: content.messages.chain.messages,
    hint: content.messages.chain.messagesHint,
    icon: <Anchor className="size-3.5" />,
  },
  {
    id: "receipts",
    label: content.messages.chain.receipts,
    hint: content.messages.chain.receiptsHint,
    icon: <ReceiptText className="size-3.5" />,
  },
  {
    id: "nothing",
    label: content.messages.chain.nothing,
    hint: content.messages.chain.nothingHint,
    icon: <Link2Off className="size-3.5" />,
  },
];

function optionFor(policy: ChainPolicy): (typeof OPTIONS)[number] {
  return OPTIONS.find((option) => option.id === policy) ?? OPTIONS[1]!;
}

/**
 * The effective policy, and the saved one loaded in on first mount.
 *
 * Every reader goes through this, so the hydration happens wherever the first
 * one lands — the bar under the conversation list on desktop, the thread's own
 * mark on a phone — rather than depending on a particular component being
 * mounted for the saved choice to take effect.
 */
function useChainPolicy(conversationId?: string): {
  policy: ChainPolicy;
  overridden: boolean;
} {
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  useEffect(() => hydrateChainPolicy(), []);
  const override = conversationId
    ? effects.conversationChainPolicy[conversationId]
    : undefined;
  return {
    policy: override ?? effects.chainPolicy,
    overridden: Boolean(override),
  };
}

/** The rows, shared by the editable popover and the read-only mark. */
function PolicyRows({
  policy,
  options = OPTIONS,
  onPick,
}: {
  policy: ChainPolicy;
  /** narrowed where a setting cannot offer everything the type allows */
  options?: typeof OPTIONS;
  /** absent for the read-only mark, where the rows are an explanation */
  onPick?: (next: ChainPolicy) => void;
}): ReactNode {
  return (
    <span
      role={onPick ? "radiogroup" : undefined}
      aria-label={content.messages.chain.title}
      className="block p-1"
    >
      {options.map((option) => {
        const selected = option.id === policy;
        /* Read-only: only the one in force is worth the space, since the other
           two are not choices here — they are somewhere else's settings. */
        if (!onPick && !selected) return null;
        const body = (
          <>
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {selected && <Check className="size-2.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {/* The radio dot is the only accent in a row: the leading icon
                    labels the option rather than marking the selection. */}
                <span className="text-muted-foreground" aria-hidden="true">
                  {option.icon}
                </span>
                {option.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                {option.hint}
              </span>
            </span>
          </>
        );
        if (!onPick) {
          return (
            <span key={option.id} className="flex items-start gap-2 p-2">
              {body}
            </span>
          );
        }
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(option.id)}
            className={`focus-ring flex w-full items-start gap-2 rounded-xl p-2 text-left transition-colors ${
              selected ? "bg-accent/10" : "hover:bg-surface-hover"
            }`}
          >
            {body}
          </button>
        );
      })}
    </span>
  );
}

const PANEL =
  "block w-64 max-w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised text-foreground shadow-2xl";

/**
 * The control for what this client writes to the chain.
 *
 * Without `conversationId` it edits the default, under the conversation list.
 * With one it edits that conversation's own policy and offers the way back to
 * the default, because an override you cannot clear is a setting you can only
 * ever add to.
 *
 * A radio group rather than switches — the options are exclusive, and switches
 * would let somebody build a state the client has no meaning for.
 */
export function ChainPolicyButton({
  conversationId,
}: {
  conversationId?: string;
}): ReactNode {
  const copy = content.messages.chain;
  const { policy, overridden } = useChainPolicy(conversationId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismissOnOutside(open, ref, setOpen);

  const pick = (next: ChainPolicy): void => {
    if (conversationId) setConversationChainPolicy(conversationId, next);
    else setChainPolicy(next);
    setOpen(false);
  };

  /*
   * Anchoring whole messages is a per-conversation decision, not a default.
   *
   * Making every conversation permanent in one click is the kind of choice that
   * should be made about a room you are looking at, with its name in front of
   * you — so the bar's popover offers the two reversible settings and the
   * conversation pane offers all three.
   *
   * Unless the default already *is* `messages`, in which case it stays on the
   * list: hiding the option that is currently in force would leave the popover
   * showing nothing selected and no way to read the state it is in.
   */
  const choices =
    conversationId || policy === "messages"
      ? OPTIONS
      : OPTIONS.filter((option) => option.id !== "messages");

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        /* The icon is the setting, not a gear: this is the only place the state
           is visible without opening anything, and a gear would make you click
           to find out what you had chosen. The label carries it too. */
        aria-label={`${copy.button}: ${optionFor(policy).label}`}
        title={`${copy.button}: ${optionFor(policy).label}`}
        className={`focus-ring rounded-md p-1.5 transition-colors ${
          open
            ? "bg-surface-hover text-foreground"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        {optionFor(policy).icon}
      </button>

      {open && (
        <FloatingPanel anchor={ref} align="end" label={copy.title}>
          <span className={PANEL}>
            {/* Only the conversation pane gets a heading, and only because it
                has something to say beyond its own name: whether this room is
                following the default or has been set away from it. The bar's
                popover is a short list under a gear, which needs no label. */}
            {conversationId && (
              <span className="border-border/60 flex items-baseline justify-between gap-2 border-b px-3 py-2">
                <span className="text-[10px] font-bold tracking-wide uppercase">
                  {copy.forConversation}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {overridden ? copy.overridden : copy.usingDefault}
                </span>
              </span>
            )}
            <PolicyRows policy={policy} options={choices} onPick={pick} />
            {/* The way back, offered only when there is something to undo. */}
            {conversationId && overridden && (
              <button
                type="button"
                onClick={() => {
                  setConversationChainPolicy(conversationId, null);
                  setOpen(false);
                }}
                className="focus-ring border-border hover:bg-surface-hover text-muted-foreground hover:text-foreground block w-full border-t px-3 py-2 text-left text-[11px] font-semibold"
              >
                {copy.reset}
              </button>
            )}
            <span className="border-border text-muted-foreground block border-t px-3 py-2 text-[11px] text-pretty">
              {conversationId ? copy.noteConversation : copy.note}
            </span>
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}

/**
 * The gate in front of the first permanent message in a conversation.
 *
 * Returns the composer's placeholder and a `beforeSend` veto, plus the sheet to
 * render — packaged together because the three are one behaviour and splitting
 * them across the two thread components would mean two chances for the wording
 * and the gate to drift apart.
 *
 * Asked once per conversation. A confirmation on every message would be trained
 * away inside a day, and the thing being agreed to does not change between the
 * first message and the second.
 */
export function usePermanenceGate(
  conversationId: string,
  /** what to do with the message once it has been agreed to */
  send: (text: string) => void,
): {
  placeholder: string | null;
  beforeSend: (text: string) => boolean;
  /**
   * Bumped when a held message is finally sent, for the composer's `key`.
   *
   * The veto leaves the draft untouched — which is what makes cancelling safe —
   * so once the sheet has sent it, something has to clear the box. Remounting is
   * how this composer is already reset when it is seeded, and it beats adding an
   * imperative handle just to empty one field.
   */
  resetKey: number;
  sheet: ReactNode;
} {
  const copy = content.messages.chain;
  const { policy } = useChainPolicy(conversationId);
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const [held, setHeld] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const anchoring = policy === "messages";
  const owed =
    anchoring && effects.permanenceAck[conversationId] !== "messages";

  return {
    placeholder: anchoring ? copy.placeholder : null,
    resetKey,
    beforeSend: (text: string) => {
      if (!owed) return true;
      setHeld(text);
      return false;
    },
    sheet: (
      <Sheet
        open={held !== null}
        onClose={() => setHeld(null)}
        label={copy.ackTitle}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeld(null)}
              className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold"
            >
              {copy.ackCancel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (held !== null) {
                  acknowledgePermanence(conversationId);
                  send(held);
                  setResetKey((value) => value + 1);
                }
                setHeld(null);
              }}
              className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            >
              {copy.ackConfirm}
            </button>
          </div>
        }
      >
        <div className="space-y-2 px-5 pt-3 pb-4">
          <h2 className="flex items-start gap-2 text-base font-bold">
            <Anchor
              className="text-warning mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {copy.ackTitle}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {copy.ackBody}
          </p>
          {/* The message itself, so the agreement is about these words rather
              than about the idea of writing something permanent. */}
          {held && (
            <p className="bg-surface rounded-lg p-2.5 text-sm text-pretty">
              {held}
            </p>
          )}
          <p className="text-muted-foreground text-[11px] text-pretty">
            {copy.ackAgain}
          </p>
        </div>
      </Sheet>
    ),
  };
}

/**
 * The inline mark in a thread's header: what is in force here.
 *
 * The state icon rather than a gear, because this one is a fact rather than a
 * control — and it is in the header because the other participants need it too.
 * Somebody typing into a room has to be able to see, without opening anything,
 * whether what they say is about to become permanent.
 */
export function ChainPolicyMark({
  conversationId,
}: {
  conversationId: string;
}): ReactNode {
  const copy = content.messages.chain;
  const { policy } = useChainPolicy(conversationId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismissOnOutside(open, ref, setOpen);
  const option = optionFor(policy);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${copy.markLabel}: ${option.label}`}
        title={option.label}
        /* Sized and coloured to sit in a line of metadata rather than to be
           clicked: the point is that it is always there, not that it is loud.
           `messages` is the one state worth colouring, because it is the one
           with a consequence nobody can undo. */
        className={`focus-ring rounded p-0.5 transition-colors ${
          policy === "messages"
            ? "text-warning hover:bg-surface-hover"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
        }`}
      >
        {option.icon}
      </button>

      {open && (
        <FloatingPanel anchor={ref} align="start" label={copy.markLabel}>
          <span className={PANEL}>
            <span className="border-border/60 block border-b px-3 py-2 text-[10px] font-bold tracking-wide uppercase">
              {copy.markLabel}
            </span>
            <PolicyRows policy={policy} />
            <span className="border-border text-muted-foreground block border-t px-3 py-2 text-[11px] text-pretty">
              {copy.bothSides}
            </span>
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}
