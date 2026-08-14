"use client";

import { FloatingPanel, useDismissOnOutside } from "@/components/apps/messages/floating-panel";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { EcosystemHovercard } from "@/components/apps/messages/ecosystem-hovercard";
import { Tooltip } from "@/components/hub/tooltip";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { PresenceDot } from "@/components/apps/messages/presence-dot";
import {
  content,
  getEcosystem,
  type MessagePerson,
} from "@/lib/data";
import { PRESENCE_LABEL, handleOf, namedHandleOf, presenceFor } from "@/lib/messages";
import {
  CircleArrowDown,
  CircleArrowUp,
  ExternalLink,
  HeartHandshake,
  SendHorizontal,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* -------------------------------------------------------------- actions */

/**
 * Every handler is optional, and the card only renders the actions it has been
 * given. A wallet has no composer to prefill, so it supplies fewer — better
 * than showing a button that does nothing.
 */
export interface ProfileActions {
  /** open (or start) a conversation with them */
  message?: (person: MessagePerson) => void;
  /** prefill the composer with a command addressed to their handle */
  prefill?: (person: MessagePerson, verb: string) => void;
  /**
   * Put a line in the composer as written. Not about a person, but supplied by
   * the same host: `/help` uses it to make its examples runnable.
   */
  seed?: (text: string) => void;
  /** show the full BRC-218 §5.7 identity card */
  whois?: (person: MessagePerson) => void;
  /** show only who vouches for them */
  vouches?: (person: MessagePerson) => void;
  /** open their ecosystem's profile page in Browse */
  openWeb?: (person: MessagePerson) => void;
  /** send them value from the wallet */
  pay?: (person: MessagePerson) => void;
}

const ActionsContext = createContext<ProfileActions | null>(null);

export function ProfileActionsProvider({
  actions,
  children,
}: {
  actions: ProfileActions;
  children: ReactNode;
}): ReactNode {
  return (
    <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
  );
}

export function useProfileActions(): ProfileActions | null {
  return useContext(ActionsContext);
}

/**
 * The row of icon-only actions for a person, shared by the hovercard and the
 * identity pane.
 *
 * One definition rather than two: the pane used to end in a single full-width
 * "Open profile on the web" button while the hovercard had six icons, so the two
 * surfaces disagreed about what you could do with a person.
 *
 * Only the actions whose handler was provided are rendered. A wallet has no
 * composer to prefill, so it supplies fewer, which is better than showing a
 * button that does nothing.
 */
export function ProfileActionsRow({
  person,
  onAfter,
  hideProfile = false,
}: {
  person: MessagePerson;
  /** called after an action runs, e.g. to close the hovercard around it */
  onAfter?: () => void;
  /** drop the "open full profile" action, for the profile itself */
  hideProfile?: boolean;
}): ReactNode {
  const copy = content.messages.hovercard;
  const actions = useProfileActions();
  const eco = getEcosystem(person.ecosystem);

  const quick: {
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    show: boolean;
  }[] = [
    {
      key: "profile",
      label: copy.actions.profile,
      /* Same mark as the view-profile control in the chat header: one
         gesture opening one pane should not have two icons. */
      icon: <UserRound className="size-4" />,
      onClick: () => actions?.whois?.(person),
      show: Boolean(actions?.whois) && !hideProfile,
    },
    {
      key: "vouches",
      label: copy.actions.vouches,
      icon: <UserRoundCheck className="size-4" />,
      onClick: () => actions?.vouches?.(person),
      show: Boolean(actions?.vouches),
    },
    {
      key: "message",
      label: copy.actions.message,
      icon: <SendHorizontal className="size-4" />,
      onClick: () => actions?.message?.(person),
      show: Boolean(actions?.message),
    },
    /*
     * Pay, request and vouch write the command into the composer rather than
     * doing anything. The confirmation of BRC-218 4.1 is where a payment is
     * agreed to, and a button in a hovercard is not that. What these save is
     * the part that is actually awkward to type: the fully-qualified handle.
     */
    {
      key: "pay",
      label: copy.actions.pay,
      icon: <CircleArrowUp className="size-4" />,
      onClick: () => actions?.prefill?.(person, "pay"),
      show: Boolean(actions?.prefill),
    },
    {
      key: "request",
      label: copy.actions.request,
      icon: <CircleArrowDown className="size-4" />,
      onClick: () => actions?.prefill?.(person, "request"),
      show: Boolean(actions?.prefill),
    },
    {
      key: "vouch",
      label: copy.actions.vouch,
      icon: <HeartHandshake className="size-4" />,
      onClick: () => actions?.prefill?.(person, "vouch"),
      show: Boolean(actions?.prefill),
    },
    {
      key: "web",
      label: `${copy.actions.openOn} ${eco?.name ?? ""}`.trim(),
      icon: <ExternalLink className="size-4" />,
      onClick: () => actions?.openWeb?.(person),
      show: Boolean(person.profileUrl && actions?.openWeb),
    },
  ];

  const shown = quick.filter((action) => action.show);
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {shown.map((action) => (
        <Tooltip key={action.key} label={action.label}>
          <button
            type="button"
            aria-label={action.label}
            onClick={() => {
              action.onClick();
              onAfter?.();
            }}
            className="focus-ring grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {action.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- hovercard */

/**
 * A Slack-style profile hovercard: portrait, name, handle (with the account
 * number where the ecosystem uses one), bio, and a row of icon-only actions.
 *
 * Deliberately a popover rather than a navigation. Clicking a name in a thread
 * should tell you who someone is without throwing you out of the conversation —
 * the web profile is one of the actions rather than the whole gesture.
 */
function Card({
  person,
  onClose,
}: {
  person: MessagePerson;
  onClose: () => void;
}): ReactNode {
  const named = namedHandleOf(person);
  /* Only a foreign ecosystem renders a suffix in `Handle`, so only a foreign one
     has anything for a card to explain. */
  const foreignEcosystem = Boolean(
    getEcosystem(person.ecosystem) && !getEcosystem(person.ecosystem)?.local
  );
  const presence = presenceFor(person.id);

  return (
    <div className="w-72 max-w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-surface-raised text-foreground shadow-2xl">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="relative shrink-0">
            <MemberAvatar person={person} size={48} />
            <PresenceDot
              id={person.id}
              className="absolute -right-0.5 -bottom-0.5 size-3"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{person.name}</p>
            {/* `Handle` puts the mark between the colon and the ecosystem
                name, which is the format used everywhere else.

                Wrapped where the ecosystem is a foreign one, so the suffix
                explains itself: "@twetch" is the part of a handle a reader is
                least likely to know, and this is the card that answers it. Only
                where there IS a suffix — a local handle renders without one, and
                a hover target over nothing is a promise of an answer that never
                comes.

                Wrapped here rather than inside `Handle` for two reasons: thirty
                other call sites do not all want a hover target, and
                ecosystem-hovercard imports ecosystem-tag, so putting it the
                other way round is a cycle. */}
            {foreignEcosystem ? (
              <EcosystemHovercard ecosystem={person.ecosystem}>
                <Handle
                  person={person}
                  size={11}
                  className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground"
                />
              </EcosystemHovercard>
            ) : (
              <Handle
                person={person}
                size={11}
                className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground"
              />
            )}
            {named && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {named}
              </p>
            )}
          </div>
        </div>

        {/* The opening paragraph only. A hovercard is a glance; the rest is
            what the profile is for. */}
        <p className="mt-3 text-xs leading-relaxed text-pretty text-foreground/80">
          {person.bio.split("\n\n")[0]}
        </p>
        <p className="mt-2 text-[11px] text-foreground/70">
          {person.role}
          {person.organization ? ` · ${person.organization}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {PRESENCE_LABEL[presence]}
        </p>
      </div>

      <div className="rounded-b-2xl border-t border-border bg-surface/60 px-2 py-2">
        <ProfileActionsRow person={person} onAfter={onClose} />
      </div>
    </div>
  );
}

/**
 * Wraps a trigger and shows the card anchored to it. Closes on outside click,
 * Escape, or once an action runs.
 */
export function ProfileHovercard({
  person,
  children,
  className = "",
  align = "start",
  label,
}: {
  person: MessagePerson;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  label?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  /**
   * Which way the panel opens. Measured when it opens rather than fixed, since
   * the same component is used in a header (no room above) and low in a
   * transcript (no room below) — hard-coding one direction breaks the other.
   */
  const ref = useRef<HTMLSpanElement>(null);

  const show = (): void => setOpen(true);

  useDismissOnOutside(open, ref, setOpen);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          label ??
          `${person.name} ${handleOf(person)} — ${content.messages.viewProfile}`
        }
        className={className}
      >
        {children}
      </button>
      {open && (
        <FloatingPanel
          anchor={ref}
          align={align}
          label={`${person.name} — ${content.messages.viewProfile}`}
        >
          <Card person={person} onClose={() => setOpen(false)} />
        </FloatingPanel>
      )}
    </span>
  );
}
