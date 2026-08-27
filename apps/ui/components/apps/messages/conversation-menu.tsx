"use client";

import { useProfileActions } from "@/components/apps/messages/profile-hovercard";
import { useHub } from "@/components/hub/hub-provider";
import {
  MenuItem,
  MenuSeparator,
  PopoverMenu,
} from "@/components/hub/popover-menu";
import { Tooltip } from "@/components/hub/tooltip";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { content, type MessagePerson } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { handleOf } from "@/lib/messages";
import {
  Archive,
  Bell,
  BellOff,
  Coins,
  CircleArrowUp,
  HeartHandshake,
  HeartCrack,
  Columns2,
  MoreVertical,
  X,
  Sparkles,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

/**
 * The conversation's overflow menu.
 *
 * Three groups, because the actions differ in what they touch. Filing (star,
 * summarise) changes only your view. Attention (mute, toll) changes what
 * reaches you. The last group leaves a mark: a vouch is signed and public, and
 * archive and delete change what you can still find.
 *
 * The two that carry weight — the toll and the vouch — do not fire from here.
 * They seed the composer with the command, so they go through the confirmation
 * BRC-218 section 4.1 requires and land in the transcript as the command they
 * are. A control in a menu is not a structured confirmation.
 */
export function ConversationMenu({
  conversationId,
  person,
}: {
  conversationId: string;
  /** the other party in a one-to-one, whose toll and vouch this menu offers */
  person: MessagePerson;
}): ReactNode {
  const copy = content.messages.menu;
  const {
    conversationFlags,
    setConversationFlag,
    setMessageThread,
    splitApp,
    setSplitApp,
  } = useHub();
  const isDesktop = useIsDesktop();
  const seed = useProfileActions()?.seed;
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot
  );
  const flags = conversationFlags[conversationId] ?? {};
  const tolled = effects.tolls.some((toll) => toll.personId === person.id);
  const vouched = effects.vouches.some((v) => v.personId === person.id);

  const run = (action: () => void): void => {
    setOpen(false);
    action();
  };

  /* `flex`, not the default inline. The tooltip inside is `inline-flex`, and an
     inline-level box sits on the text baseline — which left this button a few
     pixels below the one beside it, in a row where every other item is a flex
     child. */
  return (
    <span className="relative flex shrink-0">
      <Tooltip label={copy.open} side="bottom">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={copy.open}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full p-2"
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </button>
      </Tooltip>

      <PopoverMenu
        open={open}
        onClose={() => setOpen(false)}
        label={copy.open}
        className="top-full right-0 mt-1"
      >
        <MenuItem
          icon={flags.starred ? StarOff : Star}
          label={flags.starred ? copy.unstar : copy.star}
          onClick={() =>
            run(() => {
              setConversationFlag(conversationId, "starred", !flags.starred);
              toast.success(flags.starred ? copy.unstarred : copy.starred);
            })
          }
        />
        <MenuItem
          icon={Sparkles}
          label={copy.summarise}
          onClick={() => run(() => toast.info(copy.summariseSoon))}
        />

        <MenuSeparator />

        <MenuItem
          icon={flags.muted ? Bell : BellOff}
          label={flags.muted ? copy.unmute : copy.mute}
          onClick={() =>
            run(() => {
              setConversationFlag(conversationId, "muted", !flags.muted);
              toast.success(flags.muted ? copy.unmuted : copy.muted);
            })
          }
        />
        <MenuItem
          icon={tolled ? Coins : CircleArrowUp}
          label={tolled ? copy.untoll : copy.toll}
          onClick={() =>
            run(() =>
              seed?.(
                tolled
                  ? `/trolltoll ${handleOf(person)} off`
                  : `/trolltoll ${handleOf(person)}`
              )
            )
          }
        />

        <MenuSeparator />

        <MenuItem
          icon={vouched ? HeartCrack : HeartHandshake}
          label={vouched ? copy.unvouch : copy.vouch}
          onClick={() => run(() => seed?.(`/vouch ${handleOf(person)}`))}
        />
        <MenuItem
          icon={Archive}
          label={copy.archive}
          onClick={() =>
            run(() => {
              setConversationFlag(conversationId, "archived", true);
              setMessageThread(null);
              // Archiving is reversible and the undo is the only route back:
              // there is no archived view to dig it out of.
              toast.success(copy.archived, {
                action: {
                  label: copy.unarchive,
                  onClick: () =>
                    setConversationFlag(conversationId, "archived", false),
                },
              });
            })
          }
        />
        <MenuItem
          icon={Trash2}
          label={copy.delete}
          destructive
          onClick={() =>
            run(() => {
              setConfirmDelete(true);
            })
          }
        />
        {/* The one app-level action worth reaching from here. A second
            ellipsis beside this one would be two identical buttons meaning
            different things; the group thread has room for its own because its
            header carries only a gear. */}
        {isDesktop && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={splitApp === null ? Columns2 : X}
              label={
                splitApp === null
                  ? content.appMenu.openSplit
                  : content.appMenu.closeSplit
              }
              onClick={() =>
                run(() => setSplitApp(splitApp === null ? "" : null))
              }
            />
          </>
        )}
      </PopoverMenu>

      {confirmDelete && (
        <ConfirmDelete
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            setConversationFlag(conversationId, "deleted", true);
            setMessageThread(null);
            toast.success(copy.deleted);
          }}
        />
      )}
    </span>
  );
}

/**
 * Deleting is the one action here with no undo, so it asks — and says what it
 * actually does. "Delete" in a chat app reads as "unsend", and it is not that:
 * the other side keeps everything, and payments are on chain.
 */
function ConfirmDelete({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): ReactNode {
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(true);

  const copy = content.messages.menu;
  return (
    <div className="fixed inset-0 z-100 grid place-items-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={copy.deleteTitle}
        className="border-border bg-surface-raised text-foreground w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
      >
        <p className="text-sm font-bold">{copy.deleteTitle}</p>
        <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
          {copy.deleteBody}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring hover:bg-surface-hover rounded-full px-3 py-1.5 text-sm font-medium"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="focus-ring bg-negative rounded-full px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {copy.deleteConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
