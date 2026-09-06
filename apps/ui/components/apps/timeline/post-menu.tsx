"use client";

/**
 * What else you can do with a post.
 *
 * A popover on a pointer and a bottom sheet on a phone, like every other menu
 * in the shell — `PopoverMenu` is desktop-shaped only, so this carries its own
 * frame and borrows its `MenuItem` for the rows.
 *
 * Most of these actually do something rather than toast: not-interested, mute
 * and block all filter the feed, and follow writes to the Activity strip the
 * way it does everywhere else. The ones that cannot — Lists, and the analytics
 * pane behind "post activity" — say so or say what they know, instead of
 * pretending. A menu of eight items where six are theatre teaches nothing about
 * the two that are not.
 */

import { MenuItem, MenuSeparator } from "@/components/hub/popover-menu";
import { handleText } from "@/components/apps/messages/ecosystem-tag";
import { content, type MessagePerson } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import type { TimelinePost } from "@/lib/data/timeline";
import {
  dismissPost,
  openAnalytics,
  restorePost,
  toggleBlock,
  toggleFollow,
  toggleListMember,
  toggleMute,
  toggleSaved,
  toggleSubscribe,
  useTimeline,
} from "@/lib/timeline-store";
import {
  Ban,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Check,
  Code2,
  Frown,
  ChartNoAxesColumn,
  ListPlus,
  UserRoundMinus,
  UserRoundPlus,
  VolumeX,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.timeline.postMenu;

export function PostMenu({
  post,
  author,
  anchor,
  onClose,
}: {
  post: TimelinePost;
  author: MessagePerson;
  /** the trigger's rect, captured at click; null when shut */
  anchor: DOMRect | null;
  onClose: () => void;
}): ReactNode {
  return (
    <AnimatePresence>
      {anchor && (
        <Sheet
          key="post-menu"
          post={post}
          author={author}
          anchor={anchor}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function Sheet({
  post,
  author,
  anchor,
  onClose,
}: {
  post: TimelinePost;
  author: MessagePerson;
  anchor: DOMRect;
  onClose: () => void;
}): ReactNode {
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(true);

  const isDesktop = useIsDesktop();
  const { follows, muted, blocked, subscribed, saved, lists } = useTimeline();

  const at = handleText(author, true);
  const following = follows.includes(author.id);
  const isMuted = muted.includes(author.id);
  const isBlocked = blocked.includes(author.id);
  const isSubscribed = subscribed.includes(author.id);
  const isSaved = saved.includes(post.id);
  /* Nothing on this menu makes sense pointed at yourself: you cannot follow,
     mute or block your own posts, and offering it would be the menu not knowing
     whose post it is on. */
  const mine = post.authorId === author.id && Boolean(post.mine);

  const run = (fn: () => void): void => {
    fn();
    onClose();
  };

  /* Menus open downward from the trigger, and flip up when there is no room —
     a post near the foot of the feed is the common case, not the edge one. */
  const width = 264;
  const below = window.innerHeight - anchor.bottom > 360;
  const pos = {
    left: Math.max(
      8,
      Math.min(anchor.right - width, window.innerWidth - width - 8)
    ),
    ...(below
      ? { top: anchor.bottom + 8 }
      : { bottom: window.innerHeight - anchor.top + 8 }),
  };

  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.label}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-75 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="menu"
        aria-label={copy.label}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(isDesktop ? { style: { ...pos, width } } : {})}
        className={
          isDesktop
            ? `fixed rounded-2xl p-1.5 ${frame}`
            : `fixed inset-x-0 bottom-0 rounded-t-3xl p-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${frame}`
        }
      >
        {!isDesktop && (
          <div className="flex justify-center pb-2" aria-hidden="true">
            <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
          </div>
        )}

        <MenuItem
          icon={Frown}
          label={copy.notInterested}
          onClick={() =>
            run(() => {
              dismissPost(post.id);
              /* Reversible, and the undo is the only way back — there is no
                 "dismissed posts" view to dig it out of. */
              toast.success(copy.dismissed, {
                action: {
                  label: copy.undo,
                  onClick: () => restorePost(post.id),
                },
              });
            })
          }
        />

        {!mine && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={following ? UserRoundMinus : UserRoundPlus}
              label={`${following ? copy.unfollow : copy.follow} ${at}`}
              onClick={() => run(() => toggleFollow(author.id))}
            />
            <MenuItem
              icon={BellRing}
              label={`${isSubscribed ? copy.unsubscribe : copy.subscribe} ${at}`}
              onClick={() =>
                run(() => {
                  toggleSubscribe(author.id);
                  toast.success(
                    isSubscribed ? copy.unsubscribed : copy.subscribed
                  );
                })
              }
            />
          </>
        )}

        <MenuSeparator />
        <MenuItem
          icon={isSaved ? BookmarkCheck : Bookmark}
          label={isSaved ? copy.unsave : copy.save}
          onClick={() =>
            run(() => {
              toggleSaved(post.id);
              toast.success(isSaved ? copy.unsaved : copy.saved);
            })
          }
        />

        {!mine && lists.length > 0 && (
          <>
            <MenuSeparator />
            <p className="text-muted-foreground px-2.5 pt-1 pb-1 text-[10px] font-semibold tracking-wide uppercase">
              {copy.lists}
            </p>
            {/* The lists themselves rather than a row that opens a second
                sheet: with a handful of them, the choice IS the menu, and a
                sheet on top of a menu to tick two boxes is a step for its own
                sake. */}
            {lists.map((list) => (
              <MenuItem
                key={list.id}
                icon={list.members.includes(author.id) ? Check : ListPlus}
                label={list.name}
                onClick={() => run(() => toggleListMember(list.id, author.id))}
              />
            ))}
          </>
        )}

        {!mine && (
          <>
            <MenuItem
              icon={isMuted ? Volume2 : VolumeX}
              label={`${isMuted ? copy.unmute : copy.mute} ${at}`}
              onClick={() =>
                run(() => {
                  toggleMute(author.id);
                  toast.success(isMuted ? copy.unmuted : copy.muted);
                })
              }
            />
            <MenuItem
              icon={Ban}
              label={`${isBlocked ? copy.unblock : copy.block} ${at}`}
              destructive={!isBlocked}
              onClick={() =>
                run(() => {
                  toggleBlock(author.id);
                  toast.success(isBlocked ? copy.unblocked : copy.blocked);
                })
              }
            />
          </>
        )}

        <MenuSeparator />
        <MenuItem
          icon={ChartNoAxesColumn}
          label={copy.activity}
          /* The same sheet the views count opens. It used to summarise the
             numbers in a toast because there was nowhere to send you; there is
             now, and a toast beside a real screen would be the lesser of two
             answers to one question. */
          onClick={() => run(() => openAnalytics(post.id))}
        />
        <MenuItem
          icon={Code2}
          label={copy.embed}
          onClick={() =>
            run(() => {
              /* A real snippet with the real handle in it, so what lands on the
                 clipboard is the thing somebody would paste. */
              void navigator.clipboard?.writeText(
                `<blockquote class="nexus-post" data-post="${post.id}" data-author="${at}"></blockquote>\n<script async src="https://nexus.example/embed.js"></script>`
              );
              toast.success(copy.embedded);
            })
          }
        />
      </motion.div>
    </>
  );
}
