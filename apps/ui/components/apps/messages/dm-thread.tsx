"use client";

import { CommandSheet } from "@/components/apps/messages/command-sheet";
import { Composer } from "@/components/apps/messages/composer";
import {
  ChatTabs,
  ConversationNotes,
  FilesAndLinks,
  type ChatTab,
} from "@/components/apps/messages/chat-tabs";
import { ConversationMenu } from "@/components/apps/messages/conversation-menu";
import { EcosystemHovercard } from "@/components/apps/messages/ecosystem-hovercard";
import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { useOpenProfile } from "@/components/apps/messages/profile-view";
import { Tooltip } from "@/components/hub/tooltip";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { MessageBubble } from "@/components/apps/messages/message-bubble";
import { MediaPicker } from "@/components/apps/messages/media-picker";
import { useLightbox } from "@/components/apps/messages/media-lightbox";
import { PresenceDot } from "@/components/apps/messages/presence-dot";
import { ReplyBar } from "@/components/apps/messages/reply-bar";
import { useCommandRunner } from "@/components/apps/messages/use-command-runner";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getChatMessages,
  getEcosystem,
  getMessagePerson,
  type ChatMessage,
  type MediaItem,
} from "@/lib/data";
import {
  PRESENCE_LABEL,
  firstName,
  handleOf,
  presenceFor,
} from "@/lib/messages";
import { ArrowLeft, MessageSquare, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A 1:1 conversation: header with presence, message list, composer. */
export function DmThread({
  conversationId,
  personId,
  seed,
  seedKey,
  focusOnOpen,
}: {
  conversationId: string;
  personId: string;
  seed?: string;
  seedKey?: number;
  focusOnOpen?: boolean;
}): ReactNode {
  const { setMessageThread } = useHub();
  const openProfile = useOpenProfile();
  const person = getMessagePerson(personId);
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ChatTab>("messages");
  const [picker, setPicker] = useState<"media" | "files" | null>(null);
  // Chosen but not yet sent, so `/sign` can cover them.
  const [staged, setStaged] = useState<MediaItem[]>([]);
  const lightbox = useLightbox();
  const endRef = useRef<HTMLDivElement>(null);
  const copy = content.messages;

  const messages = [...getChatMessages(conversationId), ...sent];
  const replyTarget = messages.find((message) => message.id === replyId);

  const append = (message: ChatMessage): void =>
    setSent((current) => [...current, message]);

  const runner = useCommandRunner({
    conversationId,
    onCard: (message) => {
      append(message);
      setReplyId(null);
    },
    participants: person ? [person] : [],
    attachments: staged,
    ...(person ? { implicitRecipient: person } : {}),
    ...(replyTarget
      ? {
          replyTo: {
            message: replyTarget,
            ...(replyTarget.senderId === "me"
              ? {}
              : { sender: person ?? undefined }),
          },
        }
      : {}),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversationId, messages.length]);

  if (!person) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {copy.notFound}
      </div>
    );
  }

  const presence = presenceFor(person.id);
  const eco = getEcosystem(person.ecosystem);

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

        <ProfileHovercard
          person={person}
          className="focus-ring relative shrink-0 rounded-lg"
        >
          <MemberAvatar person={person} size={40} />
          <PresenceDot
            id={person.id}
            className="absolute -right-0.5 -bottom-0.5 size-2.5"
          />
        </ProfileHovercard>

        <div className="min-w-0 flex-1">
          {/* Name leads, handle sits beside it — the name is what you scan for,
              the handle is what confirms you have the right person. Both are the
              hovercard's trigger: the name is the obvious thing to reach for,
              and leaving it inert made the card look like it was not there. */}
          <ProfileHovercard
            person={person}
            className="focus-ring flex min-w-0 items-baseline gap-1.5 rounded-md text-left"
          >
            <span className="min-w-0 truncate text-sm font-bold">
              {person.name}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {handleOf(person)}
            </span>
          </ProfileHovercard>
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {/* Same gesture as the marks in the conversation list: who runs
                this ecosystem, and what resolving through it means, is the
                question the name raises. */}
            {eco && !eco.local && (
              <EcosystemHovercard
                ecosystem={person.ecosystem}
                className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-md hover:text-foreground"
              >
                <EcosystemMark ecosystem={person.ecosystem} size={11} />
                {eco.name}
              </EcosystemHovercard>
            )}
            <span className="truncate">
              {eco && !eco.local ? "· " : ""}
              {PRESENCE_LABEL[presence]}
            </span>
          </p>
        </div>

        {/* Straight to the pane. A hovercard here was the wrong gesture: this is
            the header's one explicit "show me this person" control, and it was
            opening the same summary you get by hovering their name. */}
        <Tooltip label={copy.viewProfile} side="bottom" className="shrink-0">
          <button
            type="button"
            onClick={() => openProfile(person)}
            aria-label={copy.viewProfile}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <UserRound className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>

        <ConversationMenu conversationId={conversationId} person={person} />
        </div>

        <ChatTabs
          active={tab}
          onChange={setTab}
          conversationId={conversationId}
        />
      </header>

      {tab === "files" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FilesAndLinks messages={messages} onOpenMedia={lightbox.open} />
        </div>
      )}
      {tab === "notes" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationNotes conversationId={conversationId} />
        </div>
      )}

      {tab === "messages" && (
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MessageSquare className="size-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold">
                {copy.sayHello} {firstName(person.name)}!
              </p>
              <p className="text-sm text-muted-foreground">{copy.breakIce}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                sender={message.senderId === "me" ? undefined : person}
                onReply={() => setReplyId(message.id)}
                onDismiss={() =>
                  setSent((current) => current.filter((m) => m.id !== message.id))
                }
                onOpenMedia={lightbox.open}
                onPostCommand={(card) =>
                  append({
                    id: `act-${Date.now()}`,
                    conversationId,
                    senderId: "me",
                    text: "",
                    createdAt: new Date().toISOString(),
                    status: "sent",
                    command: card,
                  })
                }
              />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
      )}

      {replyTarget && (
        <ReplyBar
          message={replyTarget}
          sender={replyTarget.senderId === "me" ? undefined : person}
          onClear={() => setReplyId(null)}
        />
      )}

      {tab === "messages" && (
      <Composer
        key={seedKey ?? 0}
        {...(focusOnOpen ? { focusOnOpen } : {})}
        {...(seed ? { seed } : {})}
        placeholder={`${copy.messagePlaceholder} ${firstName(person.name)}`}
        attachments={staged}
        onRemoveAttachment={(index) =>
          setStaged((current) => current.filter((_, i) => i !== index))
        }
        onSend={(text) => {
          append({
            id: `local-${Date.now()}`,
            conversationId,
            senderId: "me",
            text,
            createdAt: new Date().toISOString(),
            status: "sent",
            ...(staged.length > 0
              ? { attachment: { kind: "media" as const, items: staged } }
              : {}),
          });
          setStaged([]);
        }}
        onCommand={runner.start}
        implicitRecipient
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
