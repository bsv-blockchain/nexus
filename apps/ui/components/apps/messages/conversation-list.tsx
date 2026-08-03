"use client";

import { GroupAvatar } from "@/components/apps/messages/group-avatar";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { MessageStatusIcon } from "@/components/apps/messages/message-status-icon";
import { EcosystemMarks } from "@/components/apps/messages/ecosystem-hovercard";
import { PresenceDot } from "@/components/apps/messages/presence-dot";
import { useHub } from "@/components/hub/hub-provider";
import { groupIconOf } from "@/lib/group-icon";
import {
  content,
  getChatMessages,
  getChatThreads,
  getMessagePerson,
  getUnreadCount,
  type ChatMessage,
  type ChatThread,
  type MessagePerson,
} from "@/lib/data";
import { firstName, formatMessageDate } from "@/lib/messages";
import { BellOff, Paperclip, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type Row =
  | {
      kind: "dm";
      id: string;
      name: string;
      person: MessagePerson;
      messages: ChatMessage[];
    }
  | {
      kind: "group";
      id: string;
      name: string;
      thread: ChatThread;
      members: MessagePerson[];
      messages: ChatMessage[];
    };

export function previewLabel(message: ChatMessage): string {
  // A command outcome has no body text, so name the verb instead of showing
  // an empty preview.
  if (message.command) return `/${message.command.verb}`;
  if (!message.attachment) return message.text;
  if (message.attachment.kind === "media") {
    // Say which it was: "Photo" for a still, "Video" for a clip, and the count
    // when there are several, since the preview is all you see in the list.
    const items = message.attachment.items;
    const videos = items.filter((item) => item.kind === "video").length;
    const label =
      videos === items.length
        ? content.messages.video
        : videos > 0
          ? content.messages.mediaMixed
          : content.messages.photo;
    return items.length > 1 ? `${label} (${items.length})` : label;
  }
  return message.attachment.fileName;
}

/** Preview line: own messages are prefixed "You:", group messages by sender. */
function preview(
  row: Row,
): { text: string; hasAttachment: boolean; own: boolean } {
  const last = row.messages[row.messages.length - 1];
  if (!last) {
    return { text: content.messages.emptyList, hasAttachment: false, own: false };
  }
  const own = last.senderId === "me";
  const label = previewLabel(last);
  if (row.kind === "dm") {
    return {
      text: own ? `${content.messages.you}: ${label}` : label,
      hasAttachment: Boolean(last.attachment),
      own,
    };
  }
  const who = own
    ? content.messages.you
    : firstName(getMessagePerson(last.senderId)?.name ?? content.messages.someone);
  return {
    text: `${who}: ${label}`,
    hasAttachment: Boolean(last.attachment),
    own,
  };
}

/** Every conversation as a row, newest activity first. */
export function useConversationRows(): Row[] {
  // Re-reads the data layer when a conversation is created this session.
  const { conversationsVersion } = useHub();
  return useMemo(() => {
    return getChatThreads()
      .map((thread): Row | null => {
        const messages = getChatMessages(thread.id);
        if (thread.group) {
          const members = thread.group.memberIds
            .map((id) => getMessagePerson(id))
            .filter((person): person is MessagePerson => Boolean(person));
          return {
            kind: "group",
            id: thread.id,
            name: thread.group.title,
            thread,
            members,
            messages,
          };
        }
        const person = thread.personId
          ? getMessagePerson(thread.personId)
          : undefined;
        if (!person) return null;
        return {
          kind: "dm",
          id: thread.id,
          name: person.name,
          person,
          messages,
        };
      })
      .filter((row): row is Row => Boolean(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationsVersion]);
}

/**
 * One conversation in the list.
 *
 * Lifted out of the map so the Starred section can render the same row rather
 * than a near-copy of it — two renderings of a conversation is two places for
 * the unread badge to drift.
 */
function ConversationRow({ row }: { row: Row }): ReactNode {
  const { messageThread, setMessageThread, conversationFlags, conversationIcons } =
    useHub();
  const last = row.messages[row.messages.length - 1];
  const active = row.id === messageThread;
  const unread = getUnreadCount(row.id);
  const line = preview(row);
  const muted = Boolean(conversationFlags[row.id]?.muted);
  // A group's marks are its members' ecosystems, not just the group's own — a
  // room spanning several is worth showing as such.
  const ecosystems =
    row.kind === "dm"
      ? [row.person.ecosystem]
      : [
          row.thread.group!.ecosystem,
          ...row.members.map((member) => member.ecosystem),
        ];

  return (
    <button
      type="button"
      onClick={() => setMessageThread(row.id)}
      aria-current={active ? "true" : undefined}
      className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
        active ? "bg-accent/10" : "hover:bg-surface-hover"
      }`}
    >
      <span className="relative shrink-0">
        {row.kind === "dm" ? (
          <>
            <MemberAvatar person={row.person} size={40} />
            <PresenceDot
              id={row.person.id}
              className="absolute -right-0.5 -bottom-0.5 size-2.5"
            />
          </>
        ) : (
          <GroupAvatar
            members={row.members}
            size={40}
            icon={groupIconOf(row.thread, conversationIcons)}
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1">
            <span
              className={`min-w-0 truncate text-sm ${
                unread > 0 && !muted ? "font-bold" : "font-semibold"
              }`}
            >
              {row.name}
            </span>
            {muted && (
              <BellOff
                className="size-3 shrink-0 text-muted-foreground"
                aria-label={content.messages.menu.mutedBadge}
              />
            )}
          </span>
          {last && (
            <time
              dateTime={last.createdAt}
              className="shrink-0 text-[11px] text-muted-foreground"
            >
              {formatMessageDate(last.createdAt)}
            </time>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          {line.own && last?.status && <MessageStatusIcon status={last.status} />}
          {line.hasAttachment && (
            <Paperclip
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span
            className={`min-w-0 flex-1 truncate text-xs ${
              unread > 0 && !muted ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {line.text}
          </span>
          <EcosystemMarks ecosystems={ecosystems} />
          {unread > 0 && (
            /* A muted conversation still counts, it just stops shouting. */
            <span
              className={`flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                muted
                  ? "bg-surface-hover text-muted-foreground"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * The searchable conversation list. Rendered both in the desktop contextual
 * sidebar and as the mobile root view, so it owns no chrome of its own.
 */
export function ConversationList(): ReactNode {
  const { messagesUnreadOnly, conversationFlags } = useHub();
  const [query, setQuery] = useState("");
  const rows = useConversationRows();
  const copy = content.messages;

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const flags = conversationFlags[row.id];
    // Archived and deleted are the two flags that take a conversation out of
    // the list; the rest only change how it is shown.
    if (flags?.deleted || flags?.archived) return false;
    if (messagesUnreadOnly && getUnreadCount(row.id) === 0) return false;
    if (!needle) return true;
    const last = row.messages[row.messages.length - 1];
    const handle = row.kind === "dm" ? row.person.handle : "";
    return (
      row.name.toLowerCase().includes(needle) ||
      handle.toLowerCase().includes(needle) ||
      (last ? previewLabel(last).toLowerCase().includes(needle) : false)
    );
  });

  const starred = visible.filter((row) => conversationFlags[row.id]?.starred);
  const rest = visible.filter((row) => !conversationFlags[row.id]?.starred);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
        <Search
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {messagesUnreadOnly && !needle ? copy.noUnread : copy.noResults}
          </p>
        ) : (
          <>
            {/* Only when there is something in it. An empty "Starred" heading
                is a label for a feature rather than a way into anything. */}
            {starred.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {copy.menu.starredSection}
                </p>
                {starred.map((row) => (
                  <ConversationRow key={`starred-${row.id}`} row={row} />
                ))}
                <p className="px-2 pt-3 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {copy.menu.allSection}
                </p>
              </>
            )}
            {rest.map((row) => (
              <ConversationRow key={row.id} row={row} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
