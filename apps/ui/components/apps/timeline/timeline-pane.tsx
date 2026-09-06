"use client";

/**
 * Saved, Lists and Muted.
 *
 * The three rows in the contextual column that used to be labels. Each opens
 * in the feed's place rather than in a sheet, because each is a list of the
 * same things the feed is made of — posts and people — and reading them in a
 * narrower box than the feed would be worse for no reason.
 *
 * They share one component because they share one shape: a bar with a way back,
 * then rows, then an honest empty state. Three files would have been three
 * chances for the back arrow to end up somewhere different.
 */

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { PostRow } from "@/components/apps/timeline/post-row";
import { content } from "@/lib/data";
import { incomingPosts, timelinePosts } from "@/lib/data/timeline";
import type { TimelinePost } from "@/lib/data/timeline";
import { profilePosts } from "@/lib/data/profiles";
import { usePersonLookup } from "@/lib/profiles-store";
import {
  openPane,
  toggleListMember,
  toggleMute,
  useTimeline,
  type TimelinePane,
} from "@/lib/timeline-store";
import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.timeline.panes;

/** Every post, wherever it lives — Saved holds ids from any of the three. */
function allPosts(): TimelinePost[] {
  return [
    ...timelinePosts,
    ...incomingPosts,
    ...Object.values(profilePosts).flat(),
  ];
}

export function TimelinePaneView({
  pane,
}: {
  pane: Exclude<TimelinePane, null>;
}): ReactNode {
  const title =
    pane === "saved"
      ? copy.savedTitle
      : pane === "lists"
        ? copy.listsTitle
        : copy.mutedTitle;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-surface/80 sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => openPane(null)}
          aria-label={copy.back}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pane === "saved" ? (
          <Saved />
        ) : pane === "lists" ? (
          <Lists />
        ) : (
          <Muted />
        )}
      </div>
    </div>
  );
}

function Saved(): ReactNode {
  const { saved } = useTimeline();
  /* In the order you kept them, newest first — `saved` is maintained that way,
     so this does not re-sort and disagree with it. */
  const posts = saved
    .map((id) => allPosts().find((post) => post.id === id))
    .filter((post): post is TimelinePost => Boolean(post));

  if (posts.length === 0) return <Empty line={copy.savedEmpty} />;
  return (
    <>
      {posts.map((post) => (
        <PostRow key={post.id} post={post} />
      ))}
    </>
  );
}

function Lists(): ReactNode {
  const { lists } = useTimeline();
  const lookup = usePersonLookup();

  if (lists.length === 0) return <Empty line={copy.listsEmpty} />;
  return (
    <>
      {lists.map((list) => (
        <section key={list.id} className="border-border/60 border-b">
          <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
            <h3 className="text-sm font-bold">{list.name}</h3>
            <span className="text-muted-foreground text-xs">
              {copy.listMembers.replace("{count}", String(list.members.length))}
            </span>
          </div>
          {list.members.map((id) => {
            const person = lookup(id);
            if (!person) return null;
            return (
              <div
                key={id}
                className="hover:bg-surface-hover group flex items-center gap-2.5 px-4 py-2 transition-colors"
              >
                <ProfileHovercard person={person} label={person.name}>
                  <MemberAvatar person={person} size={28} />
                </ProfileHovercard>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {person.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    <Handle person={person} size={11} />
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleListMember(list.id, id)}
                  aria-label={`${copy.remove}: ${person.name}`}
                  className="focus-ring text-muted-foreground hover:text-negative hover:bg-surface-hover shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

function Muted(): ReactNode {
  const { muted } = useTimeline();
  const lookup = usePersonLookup();

  if (muted.length === 0) return <Empty line={copy.mutedEmpty} />;
  return (
    <>
      {muted.map((id) => {
        const person = lookup(id);
        if (!person) return null;
        return (
          <div
            key={id}
            className="hover:bg-surface-hover border-border/60 flex items-center gap-2.5 border-b px-4 py-2.5 transition-colors"
          >
            <MemberAvatar person={person} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {person.name}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                <Handle person={person} size={11} />
              </span>
            </span>
            <button
              type="button"
              onClick={() => toggleMute(id)}
              className="focus-ring ring-border hover:bg-surface-hover shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1"
            >
              {copy.unmute}
            </button>
          </div>
        );
      })}
    </>
  );
}

function Empty({ line }: { line: string }): ReactNode {
  return (
    <p className="text-muted-foreground px-6 py-16 text-center text-sm">
      {line}
    </p>
  );
}
