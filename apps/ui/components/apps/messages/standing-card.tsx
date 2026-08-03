"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { content, getMessagePerson } from "@/lib/data";
import { formatSats, handleOf } from "@/lib/messages";
import { X } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The `/standing` reply: everything still acting for you.
 *
 * The point of this card is that all of it keeps working without asking again.
 * A certificate you signed in March spends in July; a subscription runs whether
 * or not you remember starting it; a toll charges people you have forgotten you
 * were charging. A grammar that hands out standing authority and never offers a
 * way to enumerate it is how people end up holding authority they would revoke
 * if they could see it.
 *
 * So every row states its bound — cap and expiry — rather than only naming the
 * thing, and authority that has already lapsed is listed too. "Nothing is
 * standing" has to be a statement the card can make, not an empty screen the
 * reader has to interpret.
 *
 * Local, like `/help`: nothing is sent, and a list of your own certificates is
 * the last thing to post into a shared room.
 */
function Row({
  title,
  bound,
  personId,
}: {
  title: string;
  bound: string;
  personId?: string | undefined;
}): ReactNode {
  const person = personId ? getMessagePerson(personId) : undefined;
  return (
    <li className="flex items-start gap-2 py-1.5">
      {person ? (
        <span className="mt-0.5 shrink-0">
          <MemberAvatar person={person} size={20} />
        </span>
      ) : (
        <span className="mt-0.5 size-5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{title}</span>
        <span className="block text-[11px] text-pretty text-muted-foreground">
          {bound}
        </span>
      </span>
    </li>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: ReactNode[];
}): ReactNode {
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-border px-3.5 py-2 first:border-t-0">
      <p className="text-[10px] font-bold tracking-wide text-foreground uppercase">
        {title}
      </p>
      <ul className="mt-0.5 divide-y divide-border/60">{rows}</ul>
    </div>
  );
}

export function StandingCard({ onDismiss }: { onDismiss: () => void }): ReactNode {
  const copy = content.messages.standing;
  const bot = getMessagePerson("nexus-bot");
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );

  const live = effects.delegations.filter((d) => !d.revokedAt);
  const lapsed = effects.delegations.filter((d) => d.revokedAt);

  const certificates = live.map((d) => {
    const person = getMessagePerson(d.personId);
    const bounds = [
      d.scope,
      d.perActionCapSats
        ? `${formatSats(d.perActionCapSats)} ${copy.perAction}`
        : copy.noCap,
      d.expiry ? `${copy.expires} ${d.expiry}` : copy.noExpiry,
      ...(d.threadId ? [copy.thisThreadOnly] : []),
    ];
    return (
      <Row
        key={d.serial}
        title={`${person?.name ?? d.personId} · ${d.serial}`}
        bound={bounds.join(" · ")}
        personId={d.personId}
      />
    );
  });

  const subscriptions = effects.subscriptions.map((sub) => {
    const person = getMessagePerson(sub.personId);
    return (
      <Row
        key={sub.id}
        title={`${formatSats(sub.amountSats)} ${copy.every} ${sub.period}`}
        bound={`${copy.to} ${person ? handleOf(person) : sub.personId} · ${copy.nextRun} ${new Date(sub.nextRunAt).toLocaleDateString()}`}
        personId={sub.personId}
      />
    );
  });

  const tolls = effects.tolls.map((toll, index) => {
    const person = toll.personId ? getMessagePerson(toll.personId) : undefined;
    return (
      <Row
        key={`${toll.personId ?? "all"}-${index}`}
        title={`${formatSats(toll.sats)} ${copy.perMessage}`}
        bound={person ? `${copy.from} ${handleOf(person)}` : copy.fromAnyone}
        {...(toll.personId ? { personId: toll.personId } : {})}
      />
    );
  });

  const watches = effects.watches.map((id) => {
    const person = getMessagePerson(id);
    return (
      <Row
        key={id}
        title={person?.name ?? id}
        bound={copy.watchBound}
        personId={id}
      />
    );
  });

  const revoked = lapsed.map((d) => (
    <Row
      key={d.serial}
      title={`${getMessagePerson(d.personId)?.name ?? d.personId} · ${d.serial}`}
      bound={copy.revokedBound}
      personId={d.personId}
    />
  ));

  const nothing =
    certificates.length === 0 &&
    subscriptions.length === 0 &&
    tolls.length === 0 &&
    watches.length === 0;

  return (
    <div className="flex items-start gap-2">
      {bot && (
        <span className="mt-0.5 shrink-0">
          <MemberAvatar person={bot} size={28} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold">{bot?.name}</span>
          <span className="rounded bg-surface-hover px-1 py-px text-[9px] font-bold tracking-wide text-muted-foreground uppercase">
            {content.messages.help.app}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {content.messages.help.onlyYou}
          </span>
        </div>

        <div className="relative mt-1 max-w-[min(100%,44rem)] overflow-hidden rounded-2xl border border-border bg-surface-raised">
          <button
            type="button"
            onClick={onDismiss}
            aria-label={content.messages.help.dismiss}
            className="focus-ring absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>

          <div className="px-3.5 pt-3 pr-10 pb-2">
            <p className="text-sm font-bold">{copy.title}</p>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
              {content.messages.help.private}
            </p>
          </div>

          {nothing ? (
            <p className="border-t border-border px-3.5 py-3 text-xs text-pretty text-muted-foreground">
              {copy.empty}
            </p>
          ) : (
            <>
              <Section title={copy.certificates} rows={certificates} />
              <Section title={copy.subscriptions} rows={subscriptions} />
              <Section title={copy.tolls} rows={tolls} />
              <Section title={copy.watching} rows={watches} />
            </>
          )}

          <div className="border-t border-border px-3.5 py-2">
            <p className="text-[10px] font-bold tracking-wide text-foreground uppercase">
              {copy.reach}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {copy.reachValue} {effects.reach}
            </p>
          </div>

          {/* Lapsed authority is listed rather than dropped: "it expired" and
              "it was never there" are different answers to the same question. */}
          <Section title={copy.lapsed} rows={revoked} />

          <p className="border-t border-border px-3.5 py-2 text-[11px] text-pretty text-muted-foreground">
            {copy.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
