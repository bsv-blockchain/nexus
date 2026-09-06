"use client";

/**
 * Replying to a post.
 *
 * Adapted from X's reply modal, and the part worth adapting is the layout
 * argument: the post you are answering sits above the box, with a line running
 * from its face down to yours. That line is the whole idea — it says the two
 * are one thread before you have written anything, which is what stops a reply
 * box from reading as a second, unrelated composer.
 *
 * A modal on a pointer and a bottom sheet on a phone, like every other sheet in
 * the shell. What did not come across: X's Drafts button, because nothing here
 * keeps drafts, and its toolbar, because the Timeline's own composer already
 * has one and two different rows of the same affordances would be two answers
 * to what you can attach.
 */

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useHub } from "@/components/hub/hub-provider";
import { useComposerTokens } from "@/lib/use-composer-tokens";
import { useHostOverlay } from "@/lib/wallet-data";
import { content } from "@/lib/data";
import { incomingPosts, timelinePosts } from "@/lib/data/timeline";
import type { TimelinePost } from "@/lib/data/timeline";
import { profilePosts } from "@/lib/data/profiles";
import { profileFor, useProfiles, usePersonLookup } from "@/lib/profiles-store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { agoLabel } from "@/lib/timeline";
import {
  closeReply,
  commitQuote,
  commitReply,
  useTimeline,
} from "@/lib/timeline-store";
import {
  CalendarClock,
  Coins,
  Globe,
  Image as ImageIcon,
  ListPlus,
  MapPin,
  Smile,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.timeline.replyTo;

/** The same affordances the Timeline's own composer offers. */
const TOOLS: {
  icon: LucideIcon;
  key: keyof typeof content.timeline.composer;
}[] = [
  { icon: ImageIcon, key: "attach" },
  { icon: ListPlus, key: "poll" },
  { icon: Smile, key: "emoji" },
  { icon: CalendarClock, key: "schedule" },
  { icon: MapPin, key: "location" },
  { icon: Coins, key: "pay" },
];

/**
 * Every post that could be replied to, wherever it lives.
 *
 * The pool, the ones that arrived while you were reading, and every profile's
 * own — the sheet is opened by id from a row that may have come from any of
 * the three, and a lookup that knew about only one would fail on the others
 * without saying why.
 */
function findPost(id: string): TimelinePost | undefined {
  const mine = Object.values(profilePosts).flat();
  return [...timelinePosts, ...incomingPosts, ...mine].find(
    (post) => post.id === id
  );
}

export function ReplyComposer(): ReactNode {
  const { replyTo } = useTimeline();

  /* Take the native tab layer away while this is up: the Timeline can be open
     with Browse as the active app, and a browsed page paints above this
     document. Refcounted, and before the early return because a hook cannot
     sit behind one. */
  useHostOverlay(replyTo !== null);

  return (
    <AnimatePresence>
      {replyTo && <Sheet key="reply" postId={replyTo} />}
    </AnimatePresence>
  );
}

function Sheet({ postId }: { postId: string }): ReactNode {
  const isDesktop = useIsDesktop();
  const { replyMode } = useTimeline();
  const quoting = replyMode === "quote";
  const { activeSpaceId } = useHub();
  const profiles = useProfiles();
  const lookup = usePersonLookup();
  const [draft, setDraft] = useState("");
  const {
    ref: fieldRef,
    popover,
    onChange: onTokenChange,
    onKeyDown: onTokenKeyDown,
    onSelect: onTokenSelect,
  } = useComposerTokens({ draft, setDraft });

  const post = findPost(postId);
  const author = post ? lookup(post.authorId) : undefined;
  const me = profileFor(profiles, activeSpaceId);
  if (!post || !author) return null;

  const send = (): void => {
    if (draft.trim() === "") return;
    if (quoting) {
      toast.success(copy.quoteSent);
      commitQuote(post.id, post.authorId);
      return;
    }
    toast.success(copy.sent);
    commitReply(post.id, draft.trim(), post.authorId);
  };

  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeReply}
        className="fixed inset-0 z-75 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={quoting ? copy.quoteTitle : copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className={
          isDesktop
            ? `fixed top-1/2 left-1/2 max-h-[86vh] w-[min(600px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl ${frame}`
            : `fixed inset-x-0 top-12 bottom-0 rounded-t-3xl ${frame}`
        }
      >
        {/* The bar. Close on the left, where X puts it and where a sheet's
            dismiss belongs on a phone; the send button is at the foot with the
            thing it sends. */}
        <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={closeReply}
            aria-label={copy.close}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full p-1.5"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
          {/*
            Replying threads; quoting encloses.

            A reply is the next thing in a conversation, so the original sits
            above with a line running into your face. A quote is a post of your
            own that happens to carry somebody else's inside it, so the original
            goes underneath your text in a box — which is exactly where it will
            be once the thing is published. The composer should look like what
            it is about to make.
          */}
          {!quoting && (
            <div className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <MemberAvatar person={author} size={40} />
                {/* The thread line. Runs from this face to yours, so the two are
                  visibly one exchange before a word is typed. */}
                <span
                  aria-hidden="true"
                  className="bg-border mt-1 w-px flex-1 rounded-full"
                />
              </div>
              {/* No bottom padding: the line beside it is `flex-1` of this row,
                so anything below the text here is a gap the line stops short
                of — and a thread line that does not reach the next face is
                just a tick. The space comes from the reply row instead. */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="truncate text-sm font-semibold">
                    {author.name}
                  </span>
                  <div className="text-muted-foreground min-w-0 truncate text-xs">
                    <Handle person={author} />
                  </div>
                  <span
                    className="text-muted-foreground text-xs"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {agoLabel(post.ago)}
                  </span>
                </div>
                <div className="mt-1 space-y-2 text-sm leading-relaxed">
                  {post.body.split("\n\n").map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                <p className="text-muted-foreground mt-3 pb-1 text-xs">
                  {copy.replyingTo}{" "}
                  <span className="text-accent">
                    <Handle person={author} />
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Your half. */}
          <div className="flex gap-3 pt-2">
            <MemberAvatar person={me} size={40} />
            <div className="min-w-0 flex-1">
              <div className="relative">
                {popover}
                <textarea
                  autoFocus
                  ref={fieldRef}
                  value={draft}
                  onChange={(event) => {
                    onTokenChange(event);
                    setDraft(event.target.value);
                  }}
                  onKeyDown={onTokenKeyDown}
                  onSelect={onTokenSelect}
                  placeholder={
                    quoting ? copy.quotePlaceholder : copy.placeholder
                  }
                  aria-label={
                    quoting ? copy.quotePlaceholder : copy.placeholder
                  }
                  rows={3}
                  className="placeholder:text-muted-foreground min-h-24 w-full resize-none bg-transparent py-2 text-base outline-none"
                />
              </div>
              {quoting && (
                <div className="border-border bg-surface-raised mt-1 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <MemberAvatar person={author} size={20} radius={7} />
                    <span className="truncate text-sm font-semibold">
                      {author.name}
                    </span>
                    <div className="text-muted-foreground min-w-0 truncate text-xs">
                      <Handle person={author} size={11} />
                    </div>
                    <span
                      className="text-muted-foreground text-xs"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {agoLabel(post.ago)}
                    </span>
                  </div>
                  {/* Clamped: the quote is a reference, and a long one would
                      push your own line off the top of the sheet. */}
                  <p className="text-muted-foreground mt-1.5 line-clamp-4 text-sm">
                    {post.body.replace(/\n+/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-border/60 border-t px-3 py-2.5">
          {/* Who may answer, above the tools: it is a decision about the reply
              rather than something to attach to it. */}
          <button
            type="button"
            className="focus-ring text-accent hover:bg-accent/10 mb-1 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold"
          >
            <Globe className="size-3.5" aria-hidden="true" />
            {copy.audience}
          </button>
          <div className="flex items-center gap-0.5">
            {TOOLS.map(({ icon: Icon, key }) => (
              <button
                key={key}
                type="button"
                aria-label={content.timeline.composer[key]}
                title={content.timeline.composer[key]}
                className="focus-ring text-accent hover:bg-accent/10 rounded-full p-1.5 transition-colors"
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={send}
              disabled={draft.trim() === ""}
              className="focus-ring bg-accent text-accent-foreground ml-auto rounded-full px-5 py-1.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {quoting ? copy.quoteAction : copy.action}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
