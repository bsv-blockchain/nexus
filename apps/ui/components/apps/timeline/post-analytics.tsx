"use client";

/**
 * What a post did.
 *
 * Adapted from X's post-analytics dialog: the post itself at the top, the
 * three counts already on its action bar gathered into one row, then
 * impressions given the width it deserves beside the three smaller figures.
 *
 * Every metric label carries an (i) that says what it counts. That is not
 * decoration — "engagements" and "detail expands" are terms this product has
 * invented, and a number nobody can define is a number nobody can act on.
 *
 * X's video section is not here: nothing in this feed carries media, so a
 * retention chart would be a graph of an empty set.
 */

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { InfoPopover } from "@/components/apps/roadmap/info-popover";
import { content } from "@/lib/data";
import { incomingPosts, timelinePosts } from "@/lib/data/timeline";
import type { TimelinePost } from "@/lib/data/timeline";
import { profilePosts } from "@/lib/data/profiles";
import { usePersonLookup } from "@/lib/profiles-store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { agoLabel } from "@/lib/timeline";
import { closeAnalytics, useTimeline } from "@/lib/timeline-store";
import { Heart, Info, MessageCircle, Repeat2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.timeline.analytics;

/**
 * The figures a post does not carry, derived from the ones it does.
 *
 * Deterministic and self-consistent rather than four more fields on thirty
 * fixtures: engagements is the actual sum of its parts, so the big number and
 * the small ones can never contradict each other, and the two rates are fixed
 * fractions of impressions so the same post always reports the same thing.
 */
function figures(post: TimelinePost): {
  impressions: number;
  engagements: number;
  expands: number;
  visits: number;
} {
  const expands = Math.round(post.views * 0.016);
  const visits = Math.round(post.views * 0.005);
  return {
    impressions: post.views,
    engagements: post.likes + post.reposts + post.replies + expands + visits,
    expands,
    visits,
  };
}

function findPost(id: string): TimelinePost | undefined {
  const mine = Object.values(profilePosts).flat();
  return [...timelinePosts, ...incomingPosts, ...mine].find(
    (post) => post.id === id
  );
}

/** Full precision, with separators. An analytics screen is where you want it. */
function exact(value: number): string {
  return value.toLocaleString("en-US");
}

export function PostAnalytics(): ReactNode {
  const { analyticsFor } = useTimeline();
  return (
    <AnimatePresence>
      {analyticsFor && <Sheet key="analytics" postId={analyticsFor} />}
    </AnimatePresence>
  );
}

function Sheet({ postId }: { postId: string }): ReactNode {
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(true);

  const isDesktop = useIsDesktop();
  const lookup = usePersonLookup();
  const post = findPost(postId);
  const author = post ? lookup(post.authorId) : undefined;
  if (!post || !author) return null;

  const stats = figures(post);
  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeAnalytics}
        className="fixed inset-0 z-75 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className={
          isDesktop
            ? `fixed top-1/2 left-1/2 max-h-[86vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl ${frame}`
            : `fixed inset-x-0 top-10 bottom-0 rounded-t-3xl ${frame}`
        }
      >
        <div className="border-border/60 flex items-center gap-3 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={closeAnalytics}
            aria-label={copy.close}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full p-1.5"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <h2 className="text-base font-bold">{copy.title}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {/* The post, so the numbers below have something to be about. */}
          <div className="border-border bg-surface-raised rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <MemberAvatar person={author} size={24} radius={8} />
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
            {/* Clamped: this is a reference to the post, not the post. */}
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">
              {post.body.replace(/\n+/g, " ")}
            </p>
          </div>

          {/* The three already on the row, gathered. */}
          <div className="border-border/60 mt-4 flex items-center gap-6 border-b pb-4">
            <Tally
              icon={<Heart className="size-4" aria-hidden="true" />}
              value={post.likes}
              label={copy.likes}
            />
            <Tally
              icon={<Repeat2 className="size-4" aria-hidden="true" />}
              value={post.reposts}
              label={copy.reposts}
            />
            <Tally
              icon={<MessageCircle className="size-4" aria-hidden="true" />}
              value={post.replies}
              label={copy.replies}
            />
          </div>

          {/* Impressions takes a column of its own: it is the denominator every
              other figure here is a fraction of, and setting it beside them at
              the same size would make it one of four equals. */}
          <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,1fr)_2fr]">
            <Metric
              label={copy.impressions}
              why={copy.impressionsWhy}
              value={stats.impressions}
              big
            />
            <div className="grid gap-6 sm:grid-cols-3">
              <Metric
                label={copy.engagements}
                why={copy.engagementsWhy}
                value={stats.engagements}
              />
              <Metric
                label={copy.expands}
                why={copy.expandsWhy}
                value={stats.expands}
              />
              <Metric
                label={copy.visits}
                why={copy.visitsWhy}
                value={stats.visits}
              />
            </div>
          </div>

          <p className="text-muted-foreground mt-6 text-[11px] text-pretty">
            {copy.note}
          </p>
        </div>
      </motion.div>
    </>
  );
}

function Tally({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}): ReactNode {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
      {icon}
      <span className="text-foreground font-semibold tabular-nums">
        {exact(value)}
      </span>
      {label}
    </span>
  );
}

function Metric({
  label,
  why,
  value,
  big = false,
}: {
  label: string;
  why: string;
  value: number;
  big?: boolean;
}): ReactNode {
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        {/* Hover or click, both — the same control answers a pointer passing
            over it and a finger landing on it. */}
        <InfoPopover
          label={`${label} — ${copy.more}`}
          trigger={
            <Info
              className="text-muted-foreground size-3.5"
              aria-hidden="true"
            />
          }
        >
          <span className="block text-xs font-bold">{label}</span>
          <span className="text-muted-foreground mt-1 block text-xs text-pretty">
            {why}
          </span>
        </InfoPopover>
      </div>
      <p
        className={`mt-1 font-bold tabular-nums ${big ? "text-4xl" : "text-2xl"}`}
      >
        {exact(value)}
      </p>
    </div>
  );
}
