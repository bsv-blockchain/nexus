"use client";

import { previewLabel } from "@/components/apps/messages/conversation-list";
import { MenuItem, MenuSeparator } from "@/components/hub/popover-menu";
import {
  anchorTxid,
  chainPolicyFor,
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
  toggleSavedMessage,
  togglePersonMute,
} from "@/lib/command-effects";
import { content, type ChatMessage, type MessagePerson } from "@/lib/data";
import { handleOf } from "@/lib/messages";
import {
  Bookmark,
  BookmarkX,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  VolumeX,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Where the menu was summoned, in viewport coordinates. */
export interface MenuPoint {
  x: number;
  y: number;
}

const EDGE = 8;
const WIDTH = 232;

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard unavailable */
  }
}

/**
 * The link to one message.
 *
 * Built from the current origin rather than a configured host, so a link copied
 * out of a local build points at the local build. A deep link nobody can open is
 * worse than no link, and silently pointing at production would be exactly that.
 */
function permalink(conversationId: string, messageId: string): string {
  const base =
    typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/?app=messages&thread=${encodeURIComponent(
    conversationId,
  )}&m=${encodeURIComponent(messageId)}`;
}

/**
 * What you can do with one message, on right-click or long-press.
 *
 * Positioned at the pointer and portalled to the root: the bubbles live inside
 * the thread's `overflow-y-auto`, so a menu positioned inside one is clipped the
 * moment it extends past the scroller, and no z-index undoes clipping.
 *
 * The contents are deliberately not the same list on every message. "View on
 * chain" appears only where there is a transaction to open — a link to a
 * transaction that does not exist teaches the reader to distrust every other one
 * — and muting somebody only makes sense on somebody else's message.
 */
export function MessageMenu({
  message,
  sender,
  point,
  onClose,
  onRenderImage,
}: {
  message: ChatMessage;
  /** absent on the user's own messages */
  sender?: MessagePerson | undefined;
  point: MenuPoint;
  onClose: () => void;
  /** hand off to the still, which the message owns rather than this menu */
  onRenderImage: () => void;
}): ReactNode {
  const copy = content.messages.messageMenu;
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    // `capture`, so a click that would also open something else closes this
    // first rather than leaving two menus on screen.
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const saved = effects.savedMessages.some(
    (entry) => entry.messageId === message.id,
  );
  const muted = sender ? effects.mutedPeople.includes(sender.id) : false;

  /*
   * A transaction to open, where there is one.
   *
   * Either the command settled in its own — a `/send` transfer — or the
   * conversation anchors messages, in which case this one is in a transaction of
   * its own. Anything else has nothing on chain to show, so the item is absent
   * rather than present and dead.
   */
  const anchors = chainPolicyFor(message.conversationId) === "messages";
  const txid =
    message.command?.txid ?? (anchors ? anchorTxid(message.id) : undefined);

  const run = (action: () => void): (() => void) => () => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={(node) => {
        ref.current = node;
        if (!node) return;
        // Measured after mount, so a menu opened near an edge moves inward
        // rather than off screen. The height is only known once it is rendered.
        const box = node.getBoundingClientRect();
        node.style.left = `${Math.max(
          EDGE,
          Math.min(point.x, window.innerWidth - box.width - EDGE),
        )}px`;
        node.style.top = `${Math.max(
          EDGE,
          Math.min(point.y, window.innerHeight - box.height - EDGE),
        )}px`;
        node.style.visibility = "visible";
      }}
      role="menu"
      aria-label={copy.label}
      style={{ width: WIDTH, visibility: "hidden" }}
      className="border-border bg-surface-raised fixed z-100 rounded-2xl border p-1.5 shadow-2xl"
    >
      <MenuItem
        icon={Copy}
        label={copy.copyLink}
        onClick={run(() => {
          copyToClipboard(permalink(message.conversationId, message.id));
          toast.success(copy.linkCopied);
        })}
      />
      <MenuItem
        icon={ImageIcon}
        label={copy.renderImage}
        onClick={run(onRenderImage)}
      />
      <MenuItem
        icon={saved ? BookmarkX : Bookmark}
        label={saved ? copy.unsave : copy.save}
        onClick={run(() => {
          /* The row is written now rather than looked up later, so a message
             sent this session — which lives in the thread's own state and not in
             the data layer — is still there in the saved list afterwards. */
          const on = toggleSavedMessage({
            messageId: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            preview: previewLabel(message),
            createdAt: message.createdAt,
          });
          toast.success(on ? copy.saved : copy.unsaved);
        })}
      />

      {txid && (
        <a
          role="menuitem"
          href={`https://whatsonchain.com/tx/${txid}`}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onClose}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm"
        >
          <ExternalLink
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span className="flex-1 truncate">{copy.viewOnChain}</span>
        </a>
      )}

      {/* Muting a person is about them rather than about this message, so it is
          separated from the four things that act on the message itself. */}
      {sender && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={muted ? Volume2 : VolumeX}
            label={`${muted ? copy.unmute : copy.mute} ${handleOf(sender)}`}
            onClick={run(() => {
              const on = togglePersonMute(sender.id);
              toast.info(
                on
                  ? `${copy.muted} ${handleOf(sender)}`
                  : `${copy.unmuted} ${handleOf(sender)}`,
              );
            })}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
