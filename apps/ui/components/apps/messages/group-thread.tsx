"use client";

import { CommandSheet } from "@/components/apps/messages/command-sheet";
import { Composer } from "@/components/apps/messages/composer";
import { GroupAvatar } from "@/components/apps/messages/group-avatar";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { PersonRow } from "@/components/apps/messages/person-row";
import { MessageBubble } from "@/components/apps/messages/message-bubble";
import { MediaPicker } from "@/components/apps/messages/media-picker";
import { useLightbox } from "@/components/apps/messages/media-lightbox";
import {
  ChatTabs,
  ConversationNotes,
  FilesAndLinks,
  type ChatTab,
} from "@/components/apps/messages/chat-tabs";
import { EcosystemMarks } from "@/components/apps/messages/ecosystem-hovercard";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import { toast } from "sonner";
import { capabilities, roleOf } from "@/lib/roles";
import {
  deleteMessage,
  deletedMessages,
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { ReplyBar } from "@/components/apps/messages/reply-bar";
import { useCommandRunner } from "@/components/apps/messages/use-command-runner";
import { useHub } from "@/components/hub/hub-provider";
import { groupIconOf } from "@/lib/group-icon";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getChatMessages,
  getMessagePerson,
  type ChatMessage,
  type ChatThread,
  type MessagePerson,
  type MediaItem,
} from "@/lib/data";

import { ArrowLeft, Settings } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * The member roster, opened from the stacked avatars in the header. A popover
 * with a capped width rather than a full-width band pushed into the transcript,
 * and each row opens that member's own hovercard.
 */
function MemberList({
  members,
  onOpen,
}: {
  members: MessagePerson[];
  onOpen: (person: MessagePerson) => void;
}): ReactNode {
  return (
    <div className="w-64 max-w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl">
      <p className="border-b border-border px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        {content.messages.hovercard.members} ({members.length})
      </p>
      <ul className="max-h-64 overflow-y-auto p-1.5">
        {members.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => onOpen(member)}
              className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-surface-hover"
            >
              <PersonRow person={member} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A group conversation: header with the group title and member avatars, a
 * message list where other people's messages carry sender attribution, and a
 * composer. Group name and membership are editable via the settings dialog.
 */
export function GroupThread({
  thread,
  seed,
  seedKey,
  focusOnOpen,
}: {
  thread: ChatThread & { group: NonNullable<ChatThread["group"]> };
  seed?: string;
  seedKey?: number;
  focusOnOpen?: boolean;
}): ReactNode {
  const {
    setMessageThread,
    openDetailPane,
    conversationTitles,
    conversationMembers,
    conversationIcons,
  } = useHub();
  const copy = content.messages;
  const openProfile = useOpenProfile();
  useSyncExternalStore(subscribeEffects, getEffects, getEffectsServerSnapshot);

  /* Moderation reads the same role the settings pane shows, so the two can
     never disagree about what this reader may do. */
  const can = capabilities(roleOf("me", thread));
  const removed = deletedMessages();

  // Seeded values unless this conversation has been edited in the pane.
  const title = conversationTitles[thread.id] ?? thread.group.title;
  const memberIds = conversationMembers[thread.id] ?? thread.group.memberIds;
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ChatTab>("messages");
  const [picker, setPicker] = useState<"media" | "files" | null>(null);
  // Chosen but not yet sent, so `/sign` can cover them.
  const [staged, setStaged] = useState<MediaItem[]>([]);
  const lightbox = useLightbox();
  const endRef = useRef<HTMLDivElement>(null);
  const rosterRef = useRef<HTMLSpanElement>(null);

  const messages = [...getChatMessages(thread.id), ...sent];
  const members = memberIds
    .map((id) => getMessagePerson(id))
    .filter((person): person is MessagePerson => Boolean(person));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const replyTarget = messages.find((message) => message.id === replyId);
  const replySender = replyTarget
    ? memberById.get(replyTarget.senderId)
    : undefined;

  const runner = useCommandRunner({
    conversationId: thread.id,
    onCard: (message) => {
      setSent((current) => [...current, message]);
      setReplyId(null);
    },
    participants: members,
    attachments: staged,
    ...(replyTarget
      ? {
          replyTo: {
            message: replyTarget,
            ...(replySender ? { sender: replySender } : {}),
          },
        }
      : {}),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.id, messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center gap-3 px-3 pt-3 pb-2 sm:px-4">
        <button
          type="button"
          onClick={() => setMessageThread(null)}
          aria-label={copy.back}
          className="focus-ring -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>

        <GroupAvatar
          members={members}
          size={40}
          icon={groupIconOf(thread, conversationIcons)}
        />

        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-sm font-bold">{title}</p>
          {/* The interesting fact about a group is which ecosystems its people
              come from, not which one the thread was created in — so the marks
              sit with the member count and carry one hovercard each, as they do
              in the conversation list. */}
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <EcosystemMarks
              ecosystems={[
                thread.group.ecosystem,
                ...members.map((member) => member.ecosystem),
              ]}
              size={12}
            />
            <span className="truncate">
              {members.length + 1} {content.messages.hovercard.members.toLowerCase()}
            </span>
          </p>
        </div>

        <span className="relative hidden shrink-0 sm:block" ref={rosterRef}>
          <button
            type="button"
            onClick={() => setRosterOpen((open) => !open)}
            aria-expanded={rosterOpen}
            aria-haspopup="dialog"
            aria-label={`${members.length} ${content.messages.hovercard.members}`}
            className="focus-ring flex items-center rounded-full p-0.5 hover:bg-surface-hover"
          >
            <span className="flex -space-x-2">
              {members.slice(0, 4).map((member) => (
                <MemberAvatar
                  key={member.id}
                  person={member}
                  size={26}
                  className="ring-2 ring-background"
                />
              ))}
            </span>
          </button>
          {rosterOpen && (
            <span className="absolute top-full right-0 z-40 mt-2 block">
              <MemberList members={members} onOpen={openProfile} />
            </span>
          )}
        </span>

        <Tooltip label={copy.editConversation} side="bottom" className="shrink-0">
          <button
            type="button"
            onClick={() =>
              openDetailPane({ kind: "conversation", id: thread.id })
            }
            aria-label={copy.editConversation}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Settings className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>
        </div>

        <ChatTabs
          active={tab}
          onChange={setTab}
          conversationId={thread.id}
        />
      </header>

      {tab === "files" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FilesAndLinks messages={messages} onOpenMedia={lightbox.open} />
        </div>
      )}
      {tab === "notes" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationNotes conversationId={thread.id} />
        </div>
      )}

      {tab === "messages" && (
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={
                /* A removed message leaves its outline behind. Vanishing it
                   would rewrite the transcript for everyone who read it, and
                   the fact that a moderator acted is part of the record. */
                removed.includes(message.id)
                  ? (() => {
                      const {
                        command: _command,
                        attachment: _attachment,
                        link: _link,
                        ...rest
                      } = message;
                      return {
                        ...rest,
                        text: content.messages.group.roles.deletedMessage,
                      };
                    })()
                  : message
              }
              sender={memberById.get(message.senderId)}
              showSender
              {...(can.deleteMessages && !removed.includes(message.id)
                ? {
                    onDelete: () => {
                      deleteMessage(message.id);
                      toast.success(
                        content.messages.group.roles.deletedMessage,
                      );
                    },
                  }
                : {})}
              onReply={() => setReplyId(message.id)}
              onDismiss={() =>
                setSent((current) => current.filter((m) => m.id !== message.id))
              }
              onOpenMedia={lightbox.open}
              onPostCommand={(card) =>
                setSent((current) => [
                  ...current,
                  {
                    id: `act-${Date.now()}`,
                    conversationId: thread.id,
                    senderId: "me",
                    text: "",
                    createdAt: new Date().toISOString(),
                    status: "sent" as const,
                    command: card,
                  },
                ])
              }
            />
          ))}
          <div ref={endRef} />
        </div>
      </div>
      )}

      {replyTarget && (
        <ReplyBar
          message={replyTarget}
          sender={replySender}
          onClear={() => setReplyId(null)}
        />
      )}

      {tab === "messages" && (
      <Composer
        key={seedKey ?? 0}
        {...(focusOnOpen ? { focusOnOpen } : {})}
        {...(seed ? { seed } : {})}
        placeholder={`${copy.messagePlaceholder} ${title}`}
        attachments={staged}
        onRemoveAttachment={(index) =>
          setStaged((current) => current.filter((_, i) => i !== index))
        }
        onSend={(text) => {
          setSent((current) => [
            ...current,
            {
              id: `local-${Date.now()}`,
              conversationId: thread.id,
              senderId: "me",
              text,
              createdAt: new Date().toISOString(),
              status: "sent" as const,
              ...(staged.length > 0
                ? { attachment: { kind: "media" as const, items: staged } }
                : {}),
            },
          ]);
          setStaged([]);
        }}
        onCommand={runner.start}
        onAttach={() => setPicker("media")}
        onAttachFile={() => setPicker("files")}
      />
      )}

      <MediaPicker
        open={picker !== null}
        mode={picker ?? "media"}
        onClose={() => setPicker(null)}
        /* No toast: the tray appearing above the composer already says it
           worked, and a notification for something visible is just noise. */
        onAttach={(items) => setStaged((current) => [...current, ...items])}
      />

      {lightbox.viewer}

      <CommandSheet
        command={runner.pending?.command ?? null}
        boundMessage={runner.pending?.boundMessage}
        boundSender={runner.pending?.boundSender}
        onCancel={runner.cancel}
        onConfirm={runner.confirm}
      />

    </div>
  );
}
