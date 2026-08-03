"use client";

import { DocumentCard } from "@/components/apps/messages/document-card";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  NotesEditor,
  noteHasContent,
} from "@/components/apps/messages/notes-editor";
import { useHub } from "@/components/hub/hub-provider";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getMessagePerson,
  type ChatMessage,
  type MediaItem,
} from "@/lib/data";
import { formatMessageDate } from "@/lib/messages";
import { Files, MessageSquare, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

export type ChatTab = "messages" | "files" | "notes";

/**
 * The conversation's tab bar, sitting on the bottom edge of the header.
 *
 * The active tab's underline is the header's bottom border, which is what makes
 * the bar read as part of the header rather than a strip floating under it —
 * hence `-mb-px` on the tabs and no border of their own.
 */
export function ChatTabs({
  active,
  onChange,
  conversationId,
}: {
  active: ChatTab;
  onChange: (tab: ChatTab) => void;
  conversationId: string;
}): ReactNode {
  const copy = content.messages.tabs;
  const { conversationNotes } = useHub();
  // A note you wrote is easy to forget you wrote. The dot is the only thing
  // distinguishing a tab holding three weeks of context from an empty one.
  const written = noteHasContent(conversationNotes[conversationId]);
  const tabs: { id: ChatTab; label: string; icon: ReactNode }[] = [
    { id: "messages", label: copy.messages, icon: <MessageSquare className="size-4" /> },
    { id: "files", label: copy.files, icon: <Files className="size-4" /> },
    { id: "notes", label: copy.notes, icon: <NotebookPen className="size-4" /> },
  ];

  return (
    <div className="flex items-center gap-1 px-3 sm:px-4">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={selected ? "page" : undefined}
            className={`focus-ring -mb-px flex items-center gap-1.5 border-b-2 px-2 py-2 text-sm transition-colors ${
              selected
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "notes" && written && (
              <span
                aria-label={copy.notesWritten}
                title={copy.notesWritten}
                className="size-1.5 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
      <Tooltip label={copy.add} className="shrink-0">
        <button
          type="button"
          onClick={() => toast.info(copy.addSoon)}
          aria-label={copy.add}
          className="focus-ring -mb-px rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * Everything shared in this conversation, newest first.
 *
 * Built from the transcript rather than a separate store, because that is where
 * the truth is: a file is "in" a conversation exactly when a message carried it.
 */
export function FilesAndLinks({
  messages,
  onOpenMedia,
}: {
  messages: ChatMessage[];
  onOpenMedia: (items: MediaItem[], index: number) => void;
}): ReactNode {
  const copy = content.messages.tabs;

  const entries = [...messages]
    .reverse()
    .flatMap((message) => {
      const who = getMessagePerson(message.senderId);
      const at = message.createdAt;
      const rows: ReactNode[] = [];

      if (message.attachment?.kind === "media") {
        const visual = message.attachment.items.filter(
          (item) => item.kind === "image" || item.kind === "video",
        );
        message.attachment.items.forEach((item, index) => {
          rows.push(
            <li key={`${message.id}-${item.src}`} className="flex gap-3 py-2">
              {item.kind === "image" || item.kind === "video" ? (
                <button
                  type="button"
                  onClick={() => onOpenMedia(visual, visual.indexOf(item))}
                  className="focus-ring size-14 shrink-0 overflow-hidden rounded-lg bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.poster ?? item.src}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              ) : (
                <span className="w-full max-w-56 shrink-0">
                  <DocumentCard item={item} mine={false} />
                </span>
              )}
              <span className="min-w-0 flex-1 self-center">
                <span className="block truncate text-sm font-medium">
                  {item.fileName ?? item.alt ?? copy.attachment}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {who?.name ?? ""} · {formatMessageDate(at)}
                </span>
              </span>
            </li>,
          );
          void index;
        });
      }

      if (message.link) {
        rows.push(
          <li key={`${message.id}-link`} className="flex gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {message.link.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {message.link.href} · {formatMessageDate(at)}
              </span>
            </span>
          </li>,
        );
      }
      return rows;
    });

  if (entries.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {copy.noFiles}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border px-3 py-2 sm:px-4">{entries}</ul>
  );
}

/**
 * A scratchpad for the conversation.
 *
 * Local to this client and clearly labelled as such: notes that look shared but
 * are not would be worse than no notes at all.
 */
export function ConversationNotes({
  conversationId,
}: {
  conversationId: string;
}): ReactNode {
  const copy = content.messages.tabs;
  const { conversationNotes, setConversationNote } = useHub();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground sm:px-4">
        {copy.notesHint}
      </p>
      {/*
       * Keyed by conversation so switching threads builds a fresh editor rather
       * than pushing new content into the open one, which would fight whatever
       * the user was doing in it and put the caret somewhere arbitrary.
       */}
      <NotesEditor
        key={conversationId}
        value={conversationNotes[conversationId] ?? ""}
        onChange={(html) => setConversationNote(conversationId, html)}
      />
    </div>
  );
}

/** The member avatars shown beside a group's title. */
export function MemberFacepile({
  ids,
  size = 20,
}: {
  ids: string[];
  size?: number;
}): ReactNode {
  const people = ids
    .map((id) => getMessagePerson(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));
  return (
    <span className="flex -space-x-1.5">
      {people.slice(0, 4).map((person) => (
        <MemberAvatar
          key={person.id}
          person={person}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
    </span>
  );
}
