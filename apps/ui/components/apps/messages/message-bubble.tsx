"use client";

import { CommandPill } from "@/components/apps/messages/command-pill";
import { EscrowCard } from "@/components/apps/messages/escrow-card";
import { TransferCard } from "@/components/apps/messages/transfer-card";
import { WhoisInline } from "@/components/apps/messages/whois-inline";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { MentionText } from "@/components/apps/messages/mention-text";
import { HelpCard } from "@/components/apps/messages/help-card";
import { StandingCard } from "@/components/apps/messages/standing-card";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { MessageStatusIcon } from "@/components/apps/messages/message-status-icon";
import { MessageImageSheet } from "@/components/apps/messages/message-image";
import {
  MessageMenu,
  type MenuPoint,
} from "@/components/apps/messages/message-menu";
import { sealView } from "@/components/apps/messages/once-seal";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import { Tooltip } from "@/components/hub/tooltip";
import { MediaAttachment } from "@/components/apps/messages/media-attachment";
import {
  content,
  getMessagePerson,
  type ChatMessage,
  type MediaItem,
  type MessagePerson,
} from "@/lib/data";
import { SenderLabel } from "@/components/apps/messages/ecosystem-tag";
import { formatMessageTime } from "@/lib/messages";
import {
  ArrowUpRight,
  Download,
  File as FileIcon,
  Reply,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/** Marker in a message's text where its command pill is rendered. */
const COMMAND_SLOT = "{command}";

function Attachment({
  message,
  mine,
  onOpenMedia,
}: {
  message: ChatMessage;
  mine: boolean;
  onOpenMedia?: ((items: MediaItem[], index: number) => void) | undefined;
}): ReactNode {
  const attachment = message.attachment;
  if (!attachment) return null;

  if (attachment.kind === "media") {
    return (
      <MediaAttachment
        items={attachment.items}
        mine={mine}
        onOpen={(index) =>
          onOpenMedia?.(
            attachment.items.filter(
              (item) => item.kind === "image" || item.kind === "video",
            ),
            index,
          )
        }
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-2.5 ${
        mine ? "bg-black/10" : "bg-background/60"
      }`}
    >
      <FileIcon
        className="size-8 shrink-0 opacity-60"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
        <p className="text-xs opacity-70">{attachment.fileSize}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.info("Coming soon")}
        aria-label={content.messages.download}
        className="focus-ring shrink-0 rounded-full p-1.5 transition-colors hover:bg-surface-hover"
      >
        <Download className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Resolves an `app:<slug>` message link to the hub app it points at. */
function useLinkAction(href: string): (() => void) | null {
  const { openApp } = useHub();
  if (!href.startsWith("app:")) return null;
  const slug = href.slice(4) as AppSlug;
  return () => openApp(slug);
}

function MessageLink({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}): ReactNode {
  const link = message.link;
  const action = useLinkAction(link?.href ?? "");
  if (!link) return null;
  return (
    <button
      type="button"
      onClick={() => (action ? action() : toast.info("Coming soon"))}
      className={`focus-ring inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        mine
          ? "border-current/25 bg-black/10 hover:bg-black/15"
          : "border-border bg-background/60 hover:bg-surface-hover"
      }`}
    >
      <span className="truncate">{link.label}</span>
      <ArrowUpRight className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
    </button>
  );
}

/**
 * One message. In a group, other people's messages carry a sender avatar and
 * first name (`showSender`); in a DM the header already says who you're talking
 * to, so they don't. Tapping a sender's avatar opens their profile.
 */
export function MessageBubble({
  message,
  sender,
  showSender = false,
  onReply,
  onDelete,
  onDismiss,
  onOpenMedia,
  onPostCommand,
  focused = false,
}: {
  message: ChatMessage;
  sender?: MessagePerson | undefined;
  showSender?: boolean;
  /** briefly ringed, after being jumped to from the saved list */
  focused?: boolean;
  /** bind the next command to this message (`/tip`, `/sign`, `/receipt`) */
  onReply?: () => void;
  /** remove this message as a moderator, where the reader is one */
  onDelete?: (() => void) | undefined;
  /** remove an ephemeral reply from the thread */
  onDismiss?: () => void;
  /** open the thread's media viewer at this item */
  onOpenMedia?: ((items: MediaItem[], index: number) => void) | undefined;
  /** append the follow-up command a card's quick action produced */
  onPostCommand?: ((card: NonNullable<ChatMessage["command"]>) => void) | undefined;
}): ReactNode {
  const mine = message.senderId === "me";
  const withSender = showSender && !mine && Boolean(sender);
  const [menu, setMenu] = useState<MenuPoint | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = (): void => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  /*
   * A withdrawn request stops reading as owed.
   *
   * `/cancel` posts its own card, but leaving the original showing "Pending"
   * next to it would say the money is still expected. The withdrawal is state
   * about that message, so it is applied where the message is rendered rather
   * than by rewriting the transcript.
   */
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const withdrawn = effects.withdrawnRequests.includes(message.id);
  /*
   * A one-time secret that has been opened, burned or left to lapse stops
   * reading as available.
   *
   * Same reasoning as the withdrawn request: it is state about the message
   * rather than a change to what was said, so it is applied where the message
   * renders. Deriving it once here means the pill's mask, the card's status
   * badge and the seal all agree without any of them consulting the store
   * separately and disagreeing about the answer.
   */
  const secretId = message.command?.secretId;
  const sealStatus = secretId
    ? sealView(
        effects.secrets.filter((entry) => entry.secretId === secretId),
        new Date().toISOString(),
      ).status
    : undefined;
  const whoisSubject =
    message.command?.verb === "whois"
      ? getMessagePerson(message.command.recipientIds?.[0] ?? "")
      : undefined;
  const card = !message.command
    ? undefined
    : withdrawn
      ? {
          ...message.command,
          status: "withdrawn" as const,
          note: content.messages.standing.withdrawnNote,
        }
      : sealStatus
        ? { ...message.command, status: sealStatus }
        : message.command;

  // The `/standing` reply, like `/help`: the client answering its own user.
  if (message.standing) {
    return <StandingCard onDismiss={() => onDismiss?.()} />;
  }

  // The `/help` reply: the client answering locally, not a message in the thread.
  if (message.help) {
    return (
      <HelpCard
        onDismiss={() => onDismiss?.()}
        {...(message.helpVerb ? { verb: message.helpVerb } : {})}
      />
    );
  }

  return (
    <div
      /* Addressable, so the saved list can send a reader straight here. The id
         is on every message rather than only on focused ones: whether a message
         is a scroll target is not known until somebody saves it. */
      id={`msg-${message.id}`}
      className={`group flex scroll-mt-6 items-end gap-2 rounded-xl transition-shadow ${
        mine ? "justify-end" : "justify-start"
      } ${focused ? "ring-accent/70 ring-2 ring-offset-2 ring-offset-transparent" : ""}`}
      /*
       * Right-click on a pointer, long-press on a touch screen.
       *
       * The handlers sit on the whole row rather than on the bubble so the
       * gesture works on the avatar and the timestamp too — a context menu that
       * only responds to part of the thing it describes reads as broken.
       * `preventDefault` on the native menu is the point of the feature, and the
       * long-press timer is cancelled by any move so a scroll never opens it.
       */
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        const { clientX: x, clientY: y } = touch;
        pressTimer.current = setTimeout(() => setMenu({ x, y }), 450);
      }}
      onTouchMove={cancelPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
    >
      {withSender && sender && (
        <ProfileHovercard
          person={sender}
          className="focus-ring mb-5 shrink-0 rounded-lg transition-transform hover:scale-105"
        >
          <MemberAvatar person={sender} size={28} />
        </ProfileHovercard>
      )}

      <div className="max-w-[min(85%,34rem)] space-y-0.5">
        {withSender && sender && (
          <ProfileHovercard
            person={sender}
            className="focus-ring -mx-0.5 flex max-w-full items-center rounded px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <SenderLabel person={sender} />
          </ProfileHovercard>
        )}
        <div
          className={`space-y-1.5 rounded-2xl px-3.5 py-1.5 ${
            mine
              ? "rounded-br-sm bg-accent text-accent-foreground"
              : "rounded-bl-sm bg-surface text-foreground"
          }`}
        >
          {/*
            A command reads as the line the user typed. The pill carries its
            parameters; the card it opens carries the outcome.

            `{command}` in the text is where the pill goes, so a command can sit
            mid-sentence the way a channel mention does — "sent it just now,
            {command}, shout if the memo is wrong" — rather than always being a
            block above or below the words. Without the placeholder the pill
            leads and the text follows.
          */}
          {card && !message.text.includes(COMMAND_SLOT) && (
            <CommandPill card={card} mine={mine} onPost={onPostCommand} />
          )}
          {message.text &&
            (card && message.text.includes(COMMAND_SLOT) ? (
              /* A div rather than a p: the pill's popover is a block element,
                 and a div inside a p is invalid HTML that React reports as a
                 hydration error. Same typography either way. */
              <div className="text-sm leading-snug wrap-break-word text-pretty">
                {message.text.split(COMMAND_SLOT).map((chunk, index) => (
                  <span key={index}>
                    {index > 0 && (
                      <CommandPill
                        card={card}
                        mine={mine}
                        inline
                        onPost={onPostCommand}
                      />
                    )}
                    <MentionText text={chunk} mine={mine} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-snug wrap-break-word text-pretty">
                <MentionText text={message.text} mine={mine} />
              </p>
            ))}
          <Attachment message={message} mine={mine} onOpenMedia={onOpenMedia} />
          <MessageLink message={message} mine={mine} />
        </div>

        {/* The resolution, under the command that asked for it, and outside the
            bubble: it is a record rather than something said. A /whois answer
            living only in a side pane turns the command into a navigation step
            and leaves the thread with no trace of what was resolved. */}
        {card?.verb === "whois" && whoisSubject && (
          <WhoisInline person={whoisSubject} messageId={message.id} />
        )}

        {/* What moved, under the line that moved it. */}
        {card?.verb === "send" && card.assetId && <TransferCard card={card} />}

        {/* What has not moved yet, and who has to decide. */}
        {card?.verb === "escrow" && card.escrowId && (
          <EscrowCard
            card={card}
            {...(onPostCommand ? { onPost: onPostCommand } : {})}
          />
        )}
        <div
          className={`flex items-center gap-1 ${
            mine ? "justify-end" : "justify-start"
          }`}
        >
          <time
            dateTime={message.createdAt}
            className="text-[10px] text-muted-foreground"
          >
            {formatMessageTime(message.createdAt)}
          </time>
          {mine && <MessageStatusIcon status={message.status} />}
          {onDelete && (
            <Tooltip label={content.messages.group.roles.deleteMessage}>
              <button
                type="button"
                onClick={onDelete}
                aria-label={content.messages.group.roles.deleteMessage}
                className="focus-ring text-muted-foreground hover:text-negative rounded-full p-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          {onReply && (
            <Tooltip label={content.messages.replyForCommand}>
              <button
                type="button"
                onClick={onReply}
                aria-label={content.messages.replyForCommand}
                /* Visible on touch, revealed on hover elsewhere. Hover-only made every
                   bound verb — /tip, /sign, /receipt — unreachable on a phone,
                   since binding one is the only way to issue it. */
                className="focus-ring rounded-full p-0.5 text-muted-foreground transition-opacity hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
              >
                <Reply className="size-3.5" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {menu && (
        <MessageMenu
          message={message}
          {...(sender ? { sender } : {})}
          point={menu}
          onClose={() => setMenu(null)}
          onRenderImage={() => setImageOpen(true)}
        />
      )}

      {/* Mounted only once asked for: the still paints on a canvas and loads an
          avatar, and doing that for every message in the transcript would be
          work nobody requested. */}
      {imageOpen && (
        <MessageImageSheet
          message={message}
          {...(sender ? { sender } : {})}
          open
          onClose={() => setImageOpen(false)}
        />
      )}
    </div>
  );
}
