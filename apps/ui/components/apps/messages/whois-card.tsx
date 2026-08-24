"use client";

import {
  EcosystemMark,
  Handle,
} from "@/components/apps/messages/ecosystem-tag";
import { previewLabel } from "@/components/apps/messages/conversation-list";
import { GroupAvatar } from "@/components/apps/messages/group-avatar";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { PresenceDot } from "@/components/apps/messages/presence-dot";
import { ProfileActionsRow } from "@/components/apps/messages/profile-hovercard";
import {
  RenounceList,
  VouchFacepile,
} from "@/components/apps/messages/whois-inline";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { Favicon } from "@/components/hub/favicon";
import { useHub } from "@/components/hub/hub-provider";
import { groupIconOf } from "@/lib/group-icon";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getChatMessages,
  getEcosystem,
  getMessagePerson,
  getUnreadCount,
  getThreadsWithPerson,
  socialProviders,
  type MessagePerson,
} from "@/lib/data";
import {
  PRESENCE_LABEL,
  ageFrom,
  formatFullDate,
  formatMessageDate,
  formatSats,
  presenceFor,
  whoisFor,
} from "@/lib/messages";
import {
  ExternalLink,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Coins,
  Copy,
  Github,
  HeartHandshake,
  Inbox,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useSyncExternalStore, type ReactNode } from "react";

/** One titled block, separated from the previous by a rule. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** optional trailing link, e.g. "See all" */
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="border-t border-border py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** A copyable contact line with its own icon. */
function ContactLine({
  icon,
  label,
  value,
  copyable = true,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
}): ReactNode {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span className="block truncate text-sm">{value}</span>
      </span>
      {copyable && (
        <Tooltip label={content.wallet.copyHandle}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(value);
              toast.success(content.wallet.copied);
            }}
            aria-label={`${content.wallet.copyHandle} ${label}`}
            className="focus-ring shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm wrap-break-word">{children}</dd>
      </div>
    </div>
  );
}

/**
 * The attested identity of a handle.
 *
 * Ordered by what a reader actually wants first: who they are, what you can do
 * about it, then the human facts, and only then the cryptographic ones. Section
 * 5.7 of BRC-218 requires the technical set — both handle forms, resolving
 * domain, identity key, certificate status with the age of the revocation check,
 * messagebox, address-book and key-change state, attestations — but requiring it
 * to be *present* is not the same as leading with it. It sits behind one
 * disclosure so the pane opens on something legible.
 *
 * Two things are deliberately not dressed up. The revocation check is reported
 * as an observation with an age, because SPV cannot prove a non-spend. And the
 * display name, avatar and contact details are labelled unverified, since the
 * ecosystem host supplies them without attesting to them.
 */
export function WhoisCard({
  person,
  compact = false,
}: {
  person: MessagePerson;
  compact?: boolean;
}): ReactNode {
  const copy = content.messages;
  const {
    openApp,
    closeDetailPane,
    setMessageThread,
    conversationIcons,
    openLinkInBrowser,
    activeSpaceId,
  } = useHub();
  /* Somebody else's site opens where somebody else's sites open — a tab in
     Browse, with the address bar and the back button that come with it. */
  const openLink = (url: string): void => {
    openLinkInBrowser(activeSpaceId, url.startsWith("http") ? url : `https://${url}`);
    closeDetailPane();
  };
  const who = whoisFor(person);
  const eco = getEcosystem(person.ecosystem);
  const presence = presenceFor(person.id);
  const [showAll, setShowAll] = useState(false);

  const contact = person.contact ?? {};
  const hasContact = Boolean(contact.email ?? contact.phone ?? contact.github);
  const vouchCount = who.vouches;
  const renounceCount = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  ).renounces.filter((r) => r.personId === person.id).length;
  /** Open a conversation from the pane, and get out of its way. */
  const openConversation = (id: string): void => {
    openApp("messages");
    setMessageThread(id);
    closeDetailPane();
  };

  const threads = getThreadsWithPerson(person.id);
  const recent = threads.slice(0, 2);

  return (
    <div className={compact ? "" : "p-5 pt-6"}>
      <div className="flex items-start gap-4">
        <span className="relative shrink-0">
          <MemberAvatar person={person} size={compact ? 44 : 60} />
          <PresenceDot
            id={person.id}
            className="absolute -right-0.5 -bottom-0.5 size-3.5"
          />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-base font-bold">{person.name}</h2>
          <Handle
            person={person}
            className="mt-0.5 text-xs text-muted-foreground"
          />
          {/* Same size as the handle above it, and closer to it: the two are
              one block of identification, not a heading and a sentence. */}
          <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
            {person.role}
          </p>
        </div>
      </div>

      {who.keyChanged && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-pretty">
          <TriangleAlert
            className="mt-px size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <span>{copy.whois.keyChanged}</span>
        </p>
      )}

      <Section title={copy.whois.about}>
        {/* As written, breaks included: people write their own bio in
            paragraphs, and running them together is not our call. */}
        <p className="text-sm leading-relaxed whitespace-pre-line text-pretty">
          {person.bio}
        </p>
        {/* Actions sit directly under the bio: once you know who someone is, the
            next thing you want is to do something about it. The web profile is
            one of these rather than a full-width button of its own. */}
        <div className="mt-3">
          {/* No "open full profile" here: this is it. */}
          <ProfileActionsRow person={person} hideProfile />
        </div>
      </Section>

      {person.registeredAt && (
        <Section title={copy.whois.registered}>
          <div className="flex items-center gap-2.5">
            <CalendarDays
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm">
              {formatFullDate(person.registeredAt)}{" "}
              <span className="text-muted-foreground">
                ({ageFrom(person.registeredAt, copy.whois.age)})
              </span>
            </p>
          </div>
        </Section>
      )}

      <Section title={copy.whois.expertise}>
        {person.expertise?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {person.expertise.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-surface px-2 py-0.5 text-xs"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.whois.noExpertise}
          </p>
        )}
      </Section>

      {/*
        The places somebody points people at.

        Buttons rather than a list of addresses: the label is the useful half —
        "Portfolio" says what is on the other side where `https://…` makes you
        work it out — and pressing it is what anybody wants to do with it.
        Absent when nobody has set any, rather than a heading over "None yet",
        because an empty section on a stranger's card is a fact about the form
        rather than about them.
      */}
      {person.links?.length ? (
        <Section title={copy.whois.links}>
          {/* One per line and full width, rather than pills that wrap. Two
              labels of different lengths on one row read as a tag cloud — a
              description of somebody — where these are destinations, and a
              destination wants to look like a thing you press. */}
          <ul className="flex flex-col gap-1.5">
            {person.links.map((link) => (
              <li key={`${link.label}${link.url}`}>
                <button
                  type="button"
                  onClick={() => openLink(link.url)}
                  className="focus-ring border-border bg-surface hover:bg-surface-hover relative flex w-full items-center justify-center rounded-full border px-9 py-1.5 text-xs font-semibold"
                >
                  {/* Absolute, so the label is centred on the BUTTON rather
                      than on what is left of it once a mark and a chevron have
                      taken their share. */}
                  <Favicon
                    url={link.url}
                    letter={(link.label || link.url).slice(0, 1).toUpperCase()}
                    color="#4353ff"
                    size={16}
                    rounded="rounded-full"
                    className="absolute left-2"
                  />
                  <span className="truncate">{link.label || link.url}</span>
                  <ExternalLink
                    className="text-muted-foreground absolute right-3 size-3"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={copy.whois.lastSeen}>
        <p className="flex items-center gap-2 text-sm">
          <PresenceDot id={person.id} className="size-2.5" />
          {PRESENCE_LABEL[presence]}
          {person.city && (
            <span className="text-muted-foreground">· {person.city}</span>
          )}
        </p>
      </Section>

      {/* Attested accounts, above the vouches. A vouch is somebody's opinion of
          a person; this is proof that an account you already know is the same
          key — the cheaper check, and the one a reader can make for themselves
          by going and looking. */}
      {person.socials && person.socials.length > 0 && (
        <Section title={copy.whois.attested}>
          <ul className="divide-border/60 bg-surface -mx-3 divide-y overflow-hidden rounded-lg">
            {person.socials.map((social) => {
              const meta = socialProviders.find(
                (entry) => entry.id === social.provider,
              );
              if (!meta) return null;
              return (
                <li
                  key={social.provider}
                  className="flex items-center gap-2.5 px-3 py-2"
                >
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: meta.colour }}
                    aria-hidden="true"
                  >
                    {meta.mark}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {social.handle}
                  </span>
                  <BadgeCheck
                    className="text-positive size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* The same facepile the /whois card leaves in the thread. Reputation is
          the one thing on this pane a reader is likely to want to interrogate,
          and a count on its own invites exactly the wrong reading. */}
      {vouchCount > 0 && (
        <Section title={copy.whois.reputation}>
          <VouchFacepile
            person={person}
            className="-mx-3 rounded-lg bg-surface"
          />
        </Section>
      )}

      {/* Below the vouches, deliberately: regard first, then its withdrawal.
          Absent entirely for the (usual) person nobody has renounced. */}
      {renounceCount > 0 && (
        <Section title={copy.whois.renounced}>
          <RenounceList
            person={person}
            className="-mx-3 rounded-lg bg-surface"
          />
        </Section>
      )}

      <Section title={copy.whois.contactInfo}>
        {hasContact ? (
          <div>
            {contact.email && (
              <ContactLine
                icon={<Mail className="size-4" />}
                label={copy.whois.email}
                value={contact.email}
              />
            )}
            {contact.phone && (
              <ContactLine
                icon={<Phone className="size-4" />}
                label={copy.whois.phone}
                value={contact.phone}
              />
            )}
            {contact.github && (
              <ContactLine
                icon={<Github className="size-4" />}
                label={copy.whois.github}
                value={`@${contact.github}`}
              />
            )}
            <p className="mt-2 text-[11px] text-pretty text-muted-foreground">
              {copy.whois.contactNote}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.whois.noContact}</p>
        )}
      </Section>

      <Section title={copy.whois.recentConversations}>
        {recent.length > 0 ? (
          <ul className="-mx-2 space-y-0.5">
            {recent.map((thread) => {
              const messages = getChatMessages(thread.id);
              const last = messages[messages.length - 1];
              const title = thread.group?.title ?? person.name;
              const unread = getUnreadCount(thread.id);
              const members = (thread.group?.memberIds ?? [])
                .map((id) => getMessagePerson(id))
                .filter((p): p is MessagePerson => Boolean(p));
              return (
                <li key={thread.id}>
                  {/* Reads and behaves like a row in the conversation list,
                      because that is what it is: a way into the conversation,
                      not a fact about it. */}
                  <button
                    type="button"
                    onClick={() => openConversation(thread.id)}
                    className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover"
                  >
                    <span className="shrink-0">
                      {thread.group ? (
                        <GroupAvatar
                          members={members}
                          size={28}
                          icon={groupIconOf(thread, conversationIcons)}
                        />
                      ) : (
                        <MemberAvatar person={person} size={28} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          unread > 0 ? "font-bold" : "font-medium"
                        }`}
                      >
                        {title}
                      </span>
                      {last && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {previewLabel(last)}
                        </span>
                      )}
                    </span>
                    {last && (
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <time
                          dateTime={last.createdAt}
                          className="text-[11px] text-muted-foreground"
                        >
                          {formatMessageDate(last.createdAt)}
                        </time>
                        {unread > 0 && (
                          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                            {unread}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.whois.noConversations}
          </p>
        )}
        {threads.length > recent.length && (
          <button
            type="button"
            onClick={() => {
              openApp("messages");
              closeDetailPane();
            }}
            className="focus-ring mt-2 rounded text-xs font-semibold text-accent hover:underline"
          >
            {copy.whois.showMore.replace(
              "{count}",
              String(threads.length - recent.length),
            )}
          </button>
        )}
      </Section>

      {/*
       * The verification set. Required by section 5.7, and the least readable
       * thing here, so it expands in place rather than pushing the human facts
       * off the top of the pane.
       */}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
          className="focus-ring flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-sm font-semibold hover:text-accent"
        >
          {showAll ? copy.whois.hideAllDetails : copy.whois.seeAllDetails}
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${
              showAll ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {showAll && (
          <dl className="mt-2">
            <Row
              icon={<EcosystemMark ecosystem={person.ecosystem} size={16} />}
              label={copy.whois.addresses}
            >
              <span className="block font-mono text-xs">
                {who.qualifiedHandle}
              </span>
              {who.namedHandle && (
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                  {who.namedHandle}
                  <span className="ml-1.5 font-sans not-italic">
                    {copy.whois.sameIdentity}
                  </span>
                </span>
              )}
            </Row>

            <Row
              icon={
                who.certificate === "valid" ? (
                  <ShieldCheck className="size-4 text-positive" />
                ) : (
                  <ShieldAlert className="size-4 text-warning" />
                )
              }
              label={copy.whois.certificate}
            >
              {who.certificate === "valid"
                ? copy.whois.certValid
                : copy.whois.certUnverified}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {copy.whois.revocationChecked} {who.revocationCheckedAgo}.{" "}
                {copy.whois.revocationCaveat}
              </span>
            </Row>

            <Row
              icon={<KeyRound className="size-4" />}
              label={copy.whois.identityKey}
            >
              <span className="block font-mono text-[11px] break-all text-muted-foreground">
                {who.identityKey}
              </span>
            </Row>

            <Row icon={<Inbox className="size-4" />} label={copy.whois.messagebox}>
              <span className="font-mono text-xs break-all">
                {who.messagebox}
              </span>
            </Row>

            {who.tollSats !== null && (
              <Row icon={<Coins className="size-4" />} label={copy.whois.toll}>
                {formatSats(who.tollSats)} {copy.whois.tollPerMessage}
              </Row>
            )}

            <Row
              icon={<BadgeCheck className="size-4" />}
              label={copy.whois.attestations}
            >
              {who.attestations > 0
                ? `${who.attestations} ${copy.whois.peerAttestations}`
                : copy.whois.noAttestations}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {who.inAddressBook
                  ? copy.whois.inAddressBook
                  : copy.whois.notInAddressBook}
              </span>
            </Row>

            <Row
              icon={<HeartHandshake className="size-4" />}
              label={copy.whois.reputation}
            >
              {who.vouches > 0
                ? `${who.vouches} ${copy.whois.vouches}`
                : copy.whois.noVouches}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {copy.whois.vouchNote}
              </span>
            </Row>

            <p className="pt-2 text-[11px] text-pretty text-muted-foreground">
              {copy.whois.unverifiedNote}
            </p>
          </dl>
        )}
      </div>

      {!person.profileUrl && eco?.local && (
        <p className="mt-3 text-xs text-muted-foreground">
          {copy.whois.localIdentity}
        </p>
      )}
    </div>
  );
}
