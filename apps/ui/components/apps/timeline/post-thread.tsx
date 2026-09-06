"use client";

/**
 * One post, on its own, with its replies under it.
 *
 * Opens in the centre column rather than in a sheet. A thread is made of the
 * same things the feed is — posts, full width, scrolled — so a sheet would be
 * a smaller, more awkward version of the surface you were already reading on,
 * with the added problem that the feed behind it stays visible and irrelevant.
 *
 * The focal post is set larger than the rows below it, which is the whole
 * layout doing one job: saying which post you asked for. Everything under it is
 * an ordinary PostRow, so a reply and a post cannot drift apart visually.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { ActionIcon } from "@/components/apps/timeline/action-icon";
import { BlockStamp } from "@/components/apps/timeline/block-stamp";
import { PostBody } from "@/components/apps/timeline/post-body";
import { PostMenu } from "@/components/apps/timeline/post-menu";
import { PostRow } from "@/components/apps/timeline/post-row";
import { RepostMenu } from "@/components/apps/timeline/repost-menu";
import { Tooltip } from "@/components/hub/tooltip";
import { useHub } from "@/components/hub/hub-provider";
import { useComposerTokens } from "@/lib/use-composer-tokens";
import { content } from "@/lib/data";
import { postReplies, type TimelinePost } from "@/lib/data/timeline";
import { profileFor, useProfiles, usePersonLookup } from "@/lib/profiles-store";
import {
  closeThread,
  commitReply,
  openAnalytics,
  openReply,
  selectTopic,
  toggleLike,
  useTimeline,
} from "@/lib/timeline-store";
import { countLabel, satsLabel } from "@/lib/timeline";
import {
  ArrowLeft,
  ChartNoAxesColumn,
  ChevronDown,
  Coins,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

const copy = content.timeline.thread;
const postCopy = content.timeline.post;

export function PostThread({ post }: { post: TimelinePost }): ReactNode {
  const lookup = usePersonLookup();
  const { replied, reposted, liked, muted, blocked } = useTimeline();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [repost, setRepost] = useState<DOMRect | null>(null);
  const [newest, setNewest] = useState(false);

  /* Memoised because the `?? []` would otherwise be a fresh array every render
     and the memo below would never hold. */
  const mine = useMemo(() => replied[post.id] ?? [], [replied, post.id]);
  const author = lookup(post.authorId);

  const replies = useMemo(() => {
    const theirs = (postReplies[post.id] ?? []).filter(
      (reply) =>
        !muted.includes(reply.authorId) && !blocked.includes(reply.authorId)
    );
    /* Yours are turned into posts here rather than kept as posts in the store,
       so the store holds what you typed and nothing else. Dated `now`, because
       you wrote them this session and any other number would be a fiction. */
    const ours: TimelinePost[] = mine.map((body, index) => ({
      id: `${post.id}-mine-${index}`,
      authorId: "me",
      ago: 0,
      body,
      replies: 0,
      reposts: 0,
      likes: 0,
      views: 0,
      mine: true,
    }));
    const all = [...theirs, ...ours];
    /* Relevant is the default and means most-liked, which is what "relevant"
       has always quietly meant in a feed. Newest is the honest alternative. */
    return newest
      ? [...all].sort((a, b) => a.ago - b.ago)
      : [...all].sort((a, b) => b.likes - a.likes);
  }, [post.id, mine, muted, blocked, newest]);

  if (!author) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-surface/80 sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={closeThread}
          aria-label={copy.back}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold">{copy.title}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The focal post. Not a PostRow: the face sits beside the name rather
            than beside the body, the text is a size up, and the counts get a
            line of their own — the three differences that say "this is the one
            you asked for" without a highlight colour having to. */}
        <article className="border-border/60 border-b px-4 py-3">
          <div className="flex items-start gap-3">
            <ProfileHovercard person={author} label={author.name}>
              <MemberAvatar person={author} size={40} />
            </ProfileHovercard>
            <div className="min-w-0 flex-1">
              <ProfileHovercard person={author} label={author.name}>
                <span className="hover:decoration-border block max-w-full truncate text-sm font-semibold hover:underline">
                  {author.name}
                </span>
              </ProfileHovercard>
              <div className="text-muted-foreground min-w-0 truncate text-xs">
                <Handle person={author} />
              </div>
            </div>
            <Tooltip label={postCopy.more}>
              <button
                type="button"
                aria-label={postCopy.more}
                aria-haspopup="menu"
                onClick={(event) =>
                  setMenu(event.currentTarget.getBoundingClientRect())
                }
                className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1"
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

          <PostBody
            post={post}
            className="mt-3 space-y-3 text-[17px] leading-relaxed"
          />

          {(post.topic || post.tipped) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {post.topic && (
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
                  {postCopy.tipped.replace("{amount}", satsLabel(post.tipped))}
                </span>
              ) : null}
            </div>
          )}

          {/* Relative rather than a clock time and a date: the fixtures are
              dated in minutes from whenever the app is opened, so an absolute
              stamp here would be a number invented at render. */}
          <p className="text-muted-foreground border-border/60 mt-3 flex flex-wrap items-center gap-1 border-b pb-3 text-sm">
            <BlockStamp
              ago={post.ago}
              className="text-muted-foreground text-sm"
            />
            <span aria-hidden="true">·</span>
            <span>
              {copy.metaViews.replace("{views}", countLabel(post.views))}
            </span>
          </p>

          <div className="flex items-center justify-between px-6 py-2">
            <Big
              icon={MessageCircle}
              label={postCopy.reply}
              value={post.replies + mine.length}
              hover="hover:text-sky-500"
              onClick={() => openReply(post.id)}
            />
            <Big
              icon={Repeat2}
              label={postCopy.repost}
              value={post.reposts + (reposted.includes(post.id) ? 1 : 0)}
              hover="hover:text-emerald-500"
              active={
                reposted.includes(post.id) ? "text-emerald-500" : undefined
              }
              onClick={(event) =>
                setRepost(event.currentTarget.getBoundingClientRect())
              }
            />
            <Big
              icon={Heart}
              label={postCopy.like}
              value={post.likes + (liked.includes(post.id) ? 1 : 0)}
              hover="hover:text-rose-500"
              active={liked.includes(post.id) ? "text-rose-500" : undefined}
              filled={liked.includes(post.id)}
              onClick={() => toggleLike(post.id, post.authorId)}
            />
            <Big
              icon={ChartNoAxesColumn}
              label={postCopy.views}
              value={post.views}
              hover="hover:text-sky-500"
              onClick={() => openAnalytics(post.id)}
            />
            <Big
              icon={Share}
              label={postCopy.share}
              hover="hover:text-sky-500"
            />
          </div>
        </article>

        <InlineReply post={post} />

        <div className="border-border/60 flex items-center justify-between border-b px-4 py-1.5">
          <button
            type="button"
            onClick={() => setNewest((value) => !value)}
            className="focus-ring text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium transition-colors"
          >
            {newest ? copy.sortNewest : copy.sortRelevant}
            <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => toast.message(copy.quotesSoon)}
            className="focus-ring text-muted-foreground hover:text-foreground rounded-md px-1 py-0.5 text-sm font-medium transition-colors"
          >
            {copy.quotes}
          </button>
        </div>

        {replies.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">
            {copy.noReplies}
          </p>
        ) : (
          replies.map((reply) => <PostRow key={reply.id} post={reply} />)
        )}
      </div>
    </div>
  );
}

/**
 * The composer that sits under the post you are reading.
 *
 * The same reply the modal makes, without the modal: you are already looking at
 * the post, so quoting it back at you in a sheet would be showing you a copy of
 * what is on screen.
 */
function InlineReply({ post }: { post: TimelinePost }): ReactNode {
  const [draft, setDraft] = useState("");
  const {
    ref: fieldRef,
    popover,
    onChange: onTokenChange,
    onKeyDown: onTokenKeyDown,
    onSelect: onTokenSelect,
  } = useComposerTokens({ draft, setDraft });
  const profiles = useProfiles();
  const { activeSpaceId } = useHub();
  const me = profileFor(profiles, activeSpaceId);

  const send = (): void => {
    if (draft.trim() === "") return;
    commitReply(post.id, draft.trim(), post.authorId);
    setDraft("");
    toast.success(content.timeline.replyTo.sent);
  };

  return (
    <div className="border-border/60 flex items-start gap-3 border-b px-4 py-3">
      <MemberAvatar person={me} size={40} />
      <div className="relative min-w-0 flex-1">
        {popover}
        <textarea
          ref={fieldRef}
          value={draft}
          onChange={(event) => {
            onTokenChange(event);
            setDraft(event.target.value);
          }}
          onKeyDown={onTokenKeyDown}
          onSelect={onTokenSelect}
          placeholder={copy.replyPlaceholder}
          aria-label={copy.replyPlaceholder}
          rows={1}
          className="placeholder:text-muted-foreground min-h-10 w-full resize-none bg-transparent py-2 text-base outline-none"
        />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={draft.trim() === ""}
        className="focus-ring bg-accent text-accent-foreground shrink-0 self-center rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
      >
        {copy.reply}
      </button>
    </div>
  );
}

/** The focal post's action row: same actions, given room. */
function Big({
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
  hover: string;
  active?: string | undefined;
  filled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}): ReactNode {
  return (
    <button
      type="button"
      {...(onClick ? { onClick } : {})}
      aria-label={value === undefined ? label : `${label}, ${value}`}
      aria-pressed={active ? true : undefined}
      className={`focus-ring flex items-center gap-2 rounded-md p-1.5 transition-colors ${
        active ?? "text-muted-foreground"
      } ${hover}`}
    >
      <ActionIcon icon={Icon} size="size-[19px]" filled={filled} />
      {value === undefined ? null : (
        <span className="text-sm tabular-nums">{countLabel(value)}</span>
      )}
    </button>
  );
}
