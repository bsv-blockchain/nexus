"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import type { MessagePerson } from "@/lib/data";
import type { ReactNode } from "react";

/**
 * A person as a two-line list entry: avatar, name, handle.
 *
 * One definition, used by the mention autocomplete and the group member list.
 * They were built separately and drifted — different avatar sizes, different
 * leading — which is visible the moment you see both in the same session.
 */
export function PersonRow({
  person,
  trailing,
}: {
  person: MessagePerson;
  /** optional right-aligned adornment, e.g. the `enter` key hint */
  trailing?: ReactNode;
}): ReactNode {
  return (
    <>
      <MemberAvatar person={person} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-4">
          {person.name}
        </span>
        <Handle
          person={person}
          size={11}
          className="mt-px max-w-full truncate text-[11px] leading-3.5 text-muted-foreground"
        />
      </span>
      {trailing}
    </>
  );
}
