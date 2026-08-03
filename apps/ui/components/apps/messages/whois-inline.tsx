"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useProfileActions } from "@/components/apps/messages/profile-hovercard";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { content, getMessagePerson, type MessagePerson } from "@/lib/data";
import { whoisFor } from "@/lib/messages";
import {
  BadgeCheck,
  ChevronRight,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Who vouches for someone, as a facepile that opens.
 *
 * Shared by the `/whois` card in the thread and the identity pane, because it
 * answers the same question in both and two copies would answer it differently
 * within a week. A row of circles says "four people"; the useful part is which
 * four, and what each of them actually signed, so it opens.
 */
/** How long a resolution is shown as in flight. */
export const RESOLVE_MS = 1000;

/** The card's shape while the lookup is still out. */
function WhoisSkeleton(): ReactNode {
  return (
    <div
      aria-busy="true"
      aria-label={content.messages.whoisInline.resolving}
      className="mt-1.5 max-w-[min(100%,26rem)] animate-pulse overflow-hidden rounded-xl border border-border bg-surface-raised"
    >
      <div className="flex items-center gap-2.5 p-3">
        <span className="size-9 shrink-0 rounded-lg bg-surface-hover" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-3 w-28 rounded bg-surface-hover" />
          <span className="block h-2.5 w-20 rounded bg-surface-hover" />
        </span>
        <span className="h-3 w-20 rounded bg-surface-hover" />
      </div>
      <div className="space-y-1.5 border-t border-border px-3 py-2.5">
        <span className="block h-2.5 w-52 rounded bg-surface-hover" />
        <span className="block h-2.5 w-44 rounded bg-surface-hover" />
        <span className="block h-2.5 w-24 rounded bg-surface-hover" />
      </div>
      <div className="border-t border-border px-3 py-2.5">
        <span className="block h-2.5 w-32 rounded bg-surface-hover" />
      </div>
    </div>
  );
}

/** Faces shown before the count takes over. */
const FACES = 9;

export function VouchFacepile({
  person,
  open = false,
  className = "",
}: {
  person: MessagePerson;
  /** start expanded, where the list is the whole point of the surface */
  open?: boolean;
  className?: string;
}): ReactNode {
  const copy = content.messages.whoisInline;
  const actions = useProfileActions();
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const vouchers = effects.vouches
    .filter((v) => v.personId === person.id)
    .map((vouch) => ({
      vouch,
      person: vouch.byPersonId ? getMessagePerson(vouch.byPersonId) : undefined,
    }));

  return (
    <details open={open} className={`group/v ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3 shrink-0 text-muted-foreground transition-transform group-open/v:rotate-90"
          aria-hidden="true"
        />
        <span className="text-[11px] text-muted-foreground">
          {vouchers.length === 0
            ? copy.noVouches
            : `${copy.vouchedBy} ${vouchers.length}`}
        </span>
        {vouchers.length > 0 && (
          <span className="ml-auto flex -space-x-1.5">
            {vouchers.slice(0, FACES).map(({ vouch, person: voucher }, index) =>
              voucher ? (
                <MemberAvatar
                  key={`${vouch.byPersonId}-${index}`}
                  person={voucher}
                  size={20}
                  className="ring-2 ring-surface-raised"
                />
              ) : (
                /* Yours. Shown as a filled mark rather than your own avatar,
                   which would read as a stranger in your own list. */
                <span
                  key={`me-${index}`}
                  title={copy.yours}
                  className="grid size-5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground ring-2 ring-surface-raised"
                >
                  {copy.youShort}
                </span>
              ),
            )}
            {vouchers.length > FACES && (
              /* The overflow is a count rather than another face: a tenth
                 avatar you cannot pick out says less than the number it
                 stands for. */
              <span className="grid size-5 place-items-center rounded-[6px] bg-surface-hover text-[9px] font-bold text-foreground ring-2 ring-surface-raised">
                +{vouchers.length - FACES}
              </span>
            )}
          </span>
        )}
      </summary>

      {vouchers.length > 0 && (
        <ul className="divide-y divide-border/60 px-3 pb-2">
          {vouchers.map(({ vouch, person: voucher }, index) => {
            const row = (
              <>
                {voucher ? (
                  <MemberAvatar person={voucher} size={22} />
                ) : (
                  <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                    {copy.youShort}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {voucher ? (
                    <Handle
                      person={voucher}
                      size={11}
                      className="max-w-full truncate text-[11px] font-medium"
                    />
                  ) : (
                    <p className="text-[11px] font-medium">{copy.yours}</p>
                  )}
                  <p className="mt-0.5 text-[11px] leading-relaxed text-pretty text-muted-foreground">
                    {vouch.note ?? copy.noNote}
                  </p>
                </div>
              </>
            );
            return (
              <li key={`${vouch.byPersonId ?? "me"}-${index}`}>
                {/* A vouch is somebody's opinion, and the next thing you tend
                    to want is to ask them about it. Your own is not someone
                    you can message, so it stays inert. */}
                {voucher ? (
                  <button
                    type="button"
                    onClick={() => actions?.message?.(voucher)}
                    className="focus-ring flex w-full items-start gap-2 rounded-lg py-2 text-left hover:bg-surface-hover"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-start gap-2 py-2">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

/** The generic mark an anonymous renouncer wears instead of a face. */
function AnonMark({ size = 20 }: { size?: number }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-surface-hover text-muted-foreground ring-2 ring-surface-raised"
      style={{ width: size, height: size }}
    >
      <UserRoundX style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

/**
 * Who has renounced someone, under the vouches.
 *
 * The mirror of {@link VouchFacepile}, with one deliberate asymmetry: a
 * renounce is anonymous unless the renouncer opted in with `p`/`public`, so
 * most rows carry a generic mark rather than a face. The reason is shown
 * either way — a warning with no reason would be unanswerable, and a reason
 * with no name is still worth reading. Renders nothing when there is nothing:
 * "nobody has renounced them" is the resting state of almost everyone, and
 * saying it out loud would make every clean profile read like an acquittal.
 */
export function RenounceList({
  person,
  open = false,
  className = "",
}: {
  person: MessagePerson;
  /** start expanded, where the list is the whole point of the surface */
  open?: boolean;
  className?: string;
}): ReactNode {
  const copy = content.messages.whoisInline;
  const actions = useProfileActions();
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const renouncers = effects.renounces
    .filter((r) => r.personId === person.id)
    .map((renounce) => ({
      renounce,
      person:
        renounce.public && renounce.byPersonId
          ? getMessagePerson(renounce.byPersonId)
          : undefined,
    }));

  if (renouncers.length === 0) return null;

  return (
    <details open={open} className={`group/r ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3 shrink-0 text-muted-foreground transition-transform group-open/r:rotate-90"
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium text-warning">
          {copy.renouncedBy} {renouncers.length}
        </span>
        <span className="ml-auto flex -space-x-1.5">
          {renouncers.slice(0, FACES).map(({ renounce, person: renouncer }, index) =>
            renouncer ? (
              <MemberAvatar
                key={`${renounce.byPersonId}-${index}`}
                person={renouncer}
                size={20}
                className="ring-2 ring-surface-raised"
              />
            ) : (
              <AnonMark key={`anon-${index}`} />
            ),
          )}
          {renouncers.length > FACES && (
            <span className="grid size-5 place-items-center rounded-[6px] bg-surface-hover text-[9px] font-bold text-foreground ring-2 ring-surface-raised">
              +{renouncers.length - FACES}
            </span>
          )}
        </span>
      </summary>

      <ul className="divide-y divide-border/60 px-3">
        {renouncers.map(({ renounce, person: renouncer }, index) => {
          const mine = !renounce.byPersonId;
          const row = (
            <>
              {renouncer ? (
                <MemberAvatar person={renouncer} size={22} />
              ) : mine ? (
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-warning text-[9px] font-bold text-background">
                  {copy.youShort}
                </span>
              ) : (
                <AnonMark size={22} />
              )}
              <div className="min-w-0 flex-1">
                {renouncer ? (
                  <Handle
                    person={renouncer}
                    size={11}
                    className="max-w-full truncate text-[11px] font-medium"
                  />
                ) : (
                  <p className="text-[11px] font-medium">
                    {mine ? copy.yourRenounce : copy.renouncedAnon}
                    {mine && renounce.public && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {copy.renounceSignedOpenly}
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] leading-relaxed text-pretty text-muted-foreground">
                  {renounce.reason ?? copy.renounceNoReason}
                </p>
              </div>
            </>
          );
          return (
            <li key={`${renounce.byPersonId ?? "me"}-${index}`}>
              {/* Only a renouncer who signed openly can be asked about it. An
                  anonymous row stays inert on purpose: making it tappable
                  would promise a conversation with someone who chose not to
                  be identified. */}
              {renouncer ? (
                <button
                  type="button"
                  onClick={() => actions?.message?.(renouncer)}
                  className="focus-ring flex w-full items-start gap-2 rounded-lg py-2 text-left hover:bg-surface-hover"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-start gap-2 py-2">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-3 pt-1 pb-2.5 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        {copy.renounceNote}
      </p>
    </details>
  );
}

/**
 * The answer to `/whois`, inline under the command that asked it.
 *
 * A resolution is worth reading where it was asked for. Sending the user off to
 * a side pane to see what they just looked up makes the command a navigation
 * step, and the next person scrolling the thread cannot see what was resolved
 * at all — which matters, because the whole point of running `/whois` in a
 * shared room is often to show someone else the answer.
 *
 * Reputation is the part that needs care. Attestation and vouching are
 * different claims — one says a key belongs to a handle, the other says a
 * person is worth dealing with — so they are counted separately and never
 * summed. A vouch is only worth as much as whoever signed it, which is why the
 * facepile opens: a row of anonymous circles says "three people", and the
 * useful thing is which three, and what each of them actually said.
 */
export function WhoisInline({
  person,
  messageId,
}: {
  person: MessagePerson;
  /** the card this belongs to, so an in-flight lookup can be recognised */
  messageId?: string;
}): ReactNode {
  const copy = content.messages.whoisInline;
  const who = whoisFor(person);
  const openProfile = useOpenProfile();

  /*
   * Resolution takes a moment, and showing that is more honest than a card
   * that appears complete the instant it is asked for. A handle is looked up
   * over the network, and a client that paints the answer before it could have
   * arrived teaches the user that resolution is free — the assumption that
   * makes a stale or substituted key easy to miss later.
   *
   * Only a lookup still in flight waits. Scrolling back to one from this
   * morning shows what it found.
   */
  const resolving = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  ).resolving.includes(messageId ?? "");

  if (resolving) return <WhoisSkeleton />;

  return (
    <div className="mt-1.5 max-w-[min(100%,26rem)] overflow-hidden rounded-xl border border-border bg-surface-raised text-foreground">
      <div className="flex items-start gap-2.5 p-3">
        <button
          type="button"
          onClick={() => openProfile(person)}
          aria-label={`${person.name} — ${content.messages.viewProfile}`}
          className="focus-ring shrink-0 rounded-lg"
        >
          <MemberAvatar person={person} size={36} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{person.name}</p>
          <Handle
            person={person}
            size={11}
            className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground"
          />
        </div>
        {who.keyChanged ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-warning">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {copy.keyChanged}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-positive">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {copy.certified}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11px]">
        <dt className="text-muted-foreground">{copy.key}</dt>
        <dd className="truncate font-mono">{who.identityKey.slice(0, 22)}…</dd>
        <dt className="text-muted-foreground">{copy.messagebox}</dt>
        <dd className="truncate font-mono">{who.messagebox}</dd>
        <dt className="text-muted-foreground">{copy.attestations}</dt>
        {/* Counted apart from vouches on purpose: one is arithmetic about a
            key, the other is an opinion about a person. */}
        <dd>{who.attestations}</dd>
      </dl>

      <VouchFacepile person={person} className="border-t border-border" />
      <RenounceList person={person} className="border-t border-border" />
    </div>
  );
}
