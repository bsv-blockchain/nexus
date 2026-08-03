"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import { findMentions } from "@/lib/mentions";
import { handleOf } from "@/lib/messages";
import type { MessagePerson } from "@/lib/data";
import type { ReactNode } from "react";

/**
 * Shared chip geometry, so a mention looks the same whether it is being typed
 * in the composer or read back in a message. The composer builds its chips as
 * plain DOM, so this string is the contract between the two.
 */
export const MENTION_CHIP =
  "mx-px inline-flex items-center gap-1 rounded px-1 align-middle";

/** A resolved mention: `@`, the person's avatar, then their handle. */
export function MentionChip({
  person,
  label,
  mine = false,
  onClick,
}: {
  person: MessagePerson;
  /** the handle as written, which may be a named alias of a numeric one */
  label?: string;
  /** on the user's own bubble, which is already accent-filled */
  mine?: boolean;
  onClick?: () => void;
}): ReactNode {
  const tone = mine
    ? "bg-white/20 text-accent-foreground hover:bg-white/30"
    : "bg-accent/15 text-accent hover:bg-accent/25";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring ${MENTION_CHIP} ${tone} font-medium transition-colors`}
    >
      <span aria-hidden="true">@</span>
      <MemberAvatar person={person} size={14} />
      {/* The qualified form as fallback: a foreign handle without its
          ecosystem is only half an address. */}
      <span>{label ?? handleOf(person).slice(1)}</span>
    </button>
  );
}

/**
 * Message text with every resolved `@handle` drawn as a chip.
 *
 * Only handles that resolve become chips — an unresolved one stays plain text,
 * because a chip is a claim that the mention points at somebody real, and
 * dressing up a typo as a person is the wrong kind of confident.
 */
export function MentionText({
  text,
  mine = false,
}: {
  text: string;
  mine?: boolean;
}): ReactNode {
  const openProfile = useOpenProfile();
  const spans = findMentions(text);
  if (spans.length === 0) return <>{text}</>;

  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) out.push(text.slice(cursor, span.start));
    out.push(
      <MentionChip
        key={`${span.person.id}-${index}`}
        person={span.person}
        label={span.label}
        mine={mine}
        onClick={() => openProfile(span.person)}
      />,
    );
    cursor = span.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
