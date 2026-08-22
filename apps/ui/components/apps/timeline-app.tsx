"use client";

/**
 * Timeline — the feed, and the two columns that frame it.
 *
 * Always here and never in the App Store, which is why it is a view rather than
 * an app slug: a slug would put it in the rail, in the store's grid and in a
 * workspace's connection list, and then every one of those would need a special
 * case to keep it out. A view has no icon by construction. It is reached from
 * Workspaces ("Show Timeline"), from `?view=timeline`, and by finishing the
 * first run — which is what replaced the old wall of app tiles.
 *
 * Three columns:
 *
 *   the contextual one   rendered by LibraryPanel, over in the shell's left
 *                        panel, alongside every other app's — see
 *                        {@link file://./timeline/timeline-sidebar.tsx}
 *   the feed             tabs, composer, posts
 *   the help rail        search, Nexus Sync, On air now, Who to follow
 *
 * Only the last two live in this file, because only those two are inside the
 * content card.
 */

import { TimelineFeed } from "@/components/apps/timeline/timeline-feed";
import { MessagesProfileProvider } from "@/components/apps/messages/profile-view";
import { TimelinePaneView } from "@/components/apps/timeline/timeline-pane";
import { PostThread } from "@/components/apps/timeline/post-thread";
import { incomingPosts, postReplies, timelinePosts } from "@/lib/data/timeline";
import { profilePosts } from "@/lib/data/profiles";
import { TimelineSearch } from "@/components/apps/timeline/timeline-search";
import { PostAnalytics } from "@/components/apps/timeline/post-analytics";
import { ReplyComposer } from "@/components/apps/timeline/reply-composer";
import { SyncUpgrade } from "@/components/apps/timeline/sync-upgrade";
import {
  TimelineExpanded,
  TimelineRail,
} from "@/components/apps/timeline/timeline-rail";
import { ProfileActionsProvider } from "@/components/apps/messages/profile-hovercard";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import { DetailPane } from "@/components/hub/detail-pane";
import { useHub } from "@/components/hub/hub-provider";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useTimeline } from "@/lib/timeline-store";
import type { ReactNode } from "react";

export function TimelineApp(): ReactNode {
  const { expanded, pane, thread } = useTimeline();
  /* Looked up here rather than inside the thread, so a post id that no longer
     matches anything falls back to the feed instead of rendering an empty
     thread that has a back button and nothing else. */
  const threadPost = thread
    ? [
        ...timelinePosts,
        ...incomingPosts,
        ...Object.values(profilePosts).flat(),
      ]
        .concat(Object.values(postReplies).flat())
        .find((post) => post.id === thread)
    : undefined;
  const { detailPane } = useHub();
  const isDesktop = useIsDesktop();
  const paneOpen = detailPane !== null;
  /*
   * The same actions the pane beside any app offers.
   *
   * Without a provider the hovercard found no handlers and rendered its action
   * row empty — a person in the feed could be looked at and not messaged, paid
   * or vouched for, while the identical card in Messages could do all three.
   * This is the hub-level set, so it is the same one, not a second definition
   * that will drift from it.
   */
  const actions = useProfileQuickActions();

  return (
    /* The Messages provider too, because the pieces borrowed from that app —
       `MentionText` in a post body, and the command pill's person chips — route
       a click on a person through it. It resolves to `openDetailPane`, which is
       the same pane the Timeline's own hovercards already open, so this is
       wiring an import to the behaviour it expected rather than adding one. */
    <MessagesProfileProvider>
      <ProfileActionsProvider actions={actions}>
        <div className="flex min-h-0 flex-1">
          {/*
        The feed, or whatever a "Show more" opened in its place.

        In its place rather than beside it: the rail's overflow is a different
        answer to the same question the feed is answering, and putting them side
        by side would leave the reader to work out which column they asked for.
        The back arrow at the top of the expansion is the way home.
      */}
          {/* On `--surface`, the same sheet the contextual column is drawn on, so
          the two read as one document with the rail floating beside it rather
          than three strips of canvas. The rail keeps `--background` on purpose:
          its cards are `--surface`, and a surface panel on a surface field has
          no edge. */}
          <div className="border-border/60 bg-surface flex min-h-0 min-w-0 flex-1 flex-col rounded-tr-xl md:border-r">
            {threadPost ? (
              <PostThread post={threadPost} />
            ) : pane ? (
              <TimelinePaneView pane={pane} />
            ) : expanded ? (
              <TimelineExpanded section={expanded} />
            ) : (
              <TimelineFeed />
            )}
          </div>

          {/*
        The second column of the desktop grid, and the guide that borrows its
        slot.

        Borrows rather than sits beside: both are the right-hand column, and a
        1280px window cannot hold a readable feed, a 340px rail and a pane at
        once — the feed would pay for it. The rail is a standing offer and the
        guide is a thing you just asked for, so the guide wins while it is open
        and the rail comes back when it closes.

        Below the desktop breakpoint neither renders: a squeezed rail takes the
        width from the thing people came for.
      */}
          {isDesktop ? paneOpen ? <DetailPane /> : <TimelineRail /> : null}

          {/* The search command bar. Mounted here rather than in the rail so it
          still exists below the desktop breakpoint, where the rail does not —
          search is the one thing on that column a narrow window still wants. */}
          <TimelineSearch />

          {/* The upgrade sheet. Mounted here for the same reason search is: the
          rail it is launched from does not exist on a narrow window, and the
          sheet is the one thing on that column a phone still wants. */}
          <SyncUpgrade />

          {/* The reply composer, mounted beside the other sheets rather than inside
          a row: it is opened from a post, but it belongs to the app, and a
          modal owned by a list item would unmount the moment that item
          scrolled out of the feed. */}
          <ReplyComposer />
          <PostAnalytics />
        </div>
      </ProfileActionsProvider>
    </MessagesProfileProvider>
  );
}
