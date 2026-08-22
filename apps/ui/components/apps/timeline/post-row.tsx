"use client";

/**
 * One post.
 *
 * The author's face and name open the same hovercard they open in Messages —
 * imported rather than reimplemented, because a person who looks one way in a
 * conversation and another way in a feed is two people as far as anybody
 * reading is concerned.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { ActionIcon } from "@/components/apps/timeline/action-icon";
import { BlockStamp } from "@/components/apps/timeline/block-stamp";
import { PostBody } from "@/components/apps/timeline/post-body";
import { PostMenu } from "@/components/apps/timeline/post-menu";
import { RepostMenu } from "@/components/apps/timeline/repost-menu";
import { Tooltip } from "@/components/hub/tooltip";
import { content } from "@/lib/data";
import { usePersonLookup } from "@/lib/profiles-store";
import type { TimelinePost } from "@/lib/data/timeline";
import {
  openAnalytics,
  openReply,
  openThread,
  toggleLike,
  selectTopic,
  useTimeline,
} from "@/lib/timeline-store";
import { countLabel, satsLabel } from "@/lib/timeline";
import {
  ChartNoAxesColumn,
  Coins,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.timeline.post;

const ICON = "size-[17px]";

/**
 * One count under a post.
 *
 * The icon carries the meaning and the number sits beside it; the word is the
 * accessible name only. A row that spelled out "34 replies · 61 reposts · 412
 * likes" would be wider than most of the posts it sits under.
 */
function Action({
  icon: Icon,
  label,
  value,
  hover,
  active,
  filled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  /** the tint the icon and count take on hover, as a Tailwind text colour */
  hover: string;
  /** the tint it keeps once the action has been taken */
  active?: string | undefined;
  /** solid rather than outlined once taken — a like is a state, not a stroke */
  filled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}): ReactNode {
  return (
    <button
      type="button"
      {...(onClick ? { onClick } : {})}
      aria-label={value === undefined ? label : `${label}, ${value}`}
      aria-pressed={active ? true : undefined}
      className={`focus-ring group/action -m-1 flex items-center gap-1.5 rounded-md p-1 transition-colors ${
        active ?? "text-muted-foreground"
      } ${hover}`}
    >
      <ActionIcon icon={Icon} size={ICON} filled={filled} />
      {value === undefined ? null : (
        <span className="text-xs tabular-nums">{countLabel(value)}</span>
      )}
    </button>
  );
}

export function PostRow({ post }: { post: TimelinePost }): ReactNode {
  const lookup = usePersonLookup();
  const { replied, reposted, liked } = useTimeline();
  const [repost, setRepost] = useState<DOMRect | null>(null);
  /* The trigger's rect, captured at click — the menu never measures during
     render, the same contract the rail and the lock policy use. */
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const author = lookup(post.authorId);
  if (!author) return null;

  return (
    <article
      /* The handle search jumps to. A data attribute rather than an `id`,
         because the same post can be rendered twice on one page — once in the
         feed and once in a "show more" list — and two elements sharing an id
         is a document that no longer answers getElementById honestly. */
      data-post={post.id}
      /*
        The whole row opens the thread, not just the text.

        Guarded on `closest`, because the row is full of things that already
        mean something: every action button, the More menu, the topic chip and
        both hovercard triggers. Without the guard, liking a post would also
        navigate away from it — the click reaching the article after the button
        has had it is the default, not an accident to be caught later.
      */
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button, a, [role='menuitem'], [role='dialog']"
          )
        ) {
          return;
        }
        openThread(post.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openThread(post.id);
      }}
      tabIndex={0}
      className="hover:bg-surface-hover border-border/60 focus-ring flex cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors"
    >
      <ProfileHovercard person={author} label={author.name}>
        <MemberAvatar person={author} size={40} />
      </ProfileHovercard>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          {/* flex-1, so the name block takes the width and the More button is
              pushed to the edge. `ml-auto` on the button alone did nothing: it
              sits inside Tooltip's own wrapper, which is the actual flex child
              and had no margin of its own. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
            <ProfileHovercard person={author} label={author.name}>
              <span className="hover:decoration-border truncate text-sm font-semibold hover:underline">
                {author.name}
              </span>
            </ProfileHovercard>
            <div className="text-muted-foreground min-w-0 truncate text-xs">
              <Handle person={author} />
            </div>
            <span className="text-muted-foreground text-xs" aria-hidden="true">
              ·
            </span>
            <BlockStamp ago={post.ago} />
          </div>

          <Tooltip label={copy.more}>
            <button
              type="button"
              aria-label={copy.more}
              aria-haspopup="menu"
              onClick={(event) =>
                setMenu(event.currentTarget.getBoundingClientRect())
              }
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -mt-0.5 shrink-0 rounded-md p-1"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <PostMenu
            post={post}
            author={author}
            anchor={menu}
            onClose={() => setMenu(null)}
          />
          <RepostMenu
            postId={post.id}
            authorId={post.authorId}
            anchor={repost}
            onClose={() => setRepost(null)}
          />
        </div>

        {/* Paragraphs, not a `whitespace-pre-line` blob: the fixtures use blank
            lines to separate a claim from its punchline, and pre-line renders
            that gap at the line height rather than the paragraph's. */}
        <PostBody post={post} />

        {(post.topic || post.tipped) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.topic && (
              /* The forum category, and a way into it: the chip is the fastest
                 route to "more like this", which is otherwise buried in the
                 contextual column. */
              <button
                type="button"
                onClick={() => selectTopic(post.topic ?? null)}
                className="focus-ring border-border/70 text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
              >
                {post.topic}
              </button>
            )}
            {post.tipped ? (
              <span className="text-accent bg-accent/10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                <Coins className="size-3" aria-hidden="true" />
                {copy.tipped.replace("{amount}", satsLabel(post.tipped))}
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-2.5 flex max-w-md items-center justify-between">
          <Action
            icon={MessageCircle}
            label={copy.reply}
            value={post.replies + (replied[post.id]?.length ?? 0)}
            hover="hover:text-sky-500"
            onClick={() => openReply(post.id)}
          />
          <Action
            icon={Repeat2}
            label={copy.repost}
            value={post.reposts + (reposted.includes(post.id) ? 1 : 0)}
            hover="hover:text-emerald-500"
            /* Lit once it is yours, the way the follow button latches: a count
               that went up with nothing else changing reads as somebody else
               having reposted it. */
            active={reposted.includes(post.id) ? "text-emerald-500" : undefined}
            onClick={(event) =>
              setRepost(event.currentTarget.getBoundingClientRect())
            }
          />
          <Action
            icon={Heart}
            label={copy.like}
            value={post.likes + (liked.includes(post.id) ? 1 : 0)}
            hover="hover:text-rose-500"
            active={liked.includes(post.id) ? "text-rose-500" : undefined}
            filled={liked.includes(post.id)}
            onClick={() => toggleLike(post.id, post.authorId)}
          />
          <Action
            icon={ChartNoAxesColumn}
            label={copy.views}
            value={post.views}
            hover="hover:text-sky-500"
            onClick={() => openAnalytics(post.id)}
          />
          <Action icon={Share} label={copy.share} hover="hover:text-sky-500" />
        </div>
      </div>
    </article>
  );
}
