"use client";

/**
 * What the Timeline is currently showing.
 *
 * A module store rather than state inside the Timeline, because the Timeline is
 * not one component: its contextual column is rendered by LibraryPanel, over in
 * the shell's left rail, and its feed and right rail are rendered by MainView.
 * They are siblings with the whole shell between them, so a topic picked on the
 * left cannot reach the feed on the right through props. Same shape as
 * {@link file://./settings-store.ts} — a value read through
 * `useSyncExternalStore`, a server snapshot that matches the prerender, and
 * nothing written to disk.
 */

import { useSyncExternalStore } from "react";
import type { TimelineFeed } from "@/lib/data/timeline";
import type { EcosystemId } from "@/lib/data/types";

/**
 * The tabs across the top of the feed.
 *
 * The three feed strips plus Activity, which is not a feed of posts at all but
 * of things that happened in the apps this workspace is connected to. It shares
 * the tab row because it answers the same question — "what is new" — from the
 * other direction.
 */
export type TimelineStrip = TimelineFeed | "activity";

/**
 * A section that has been asked to show everything it had a "show more" for.
 *
 * The rail shows three of each; the rest open in the content area beside the
 * feed rather than in the rail itself, so a list of twenty people does not turn
 * a 300px column into a scroll of its own.
 */
export type TimelineExpansion = "rooms" | "follow" | null;

/**
 * A pane the contextual column opens in place of the feed.
 *
 * Separate from `expanded`, which is the rail's overflow: both replace the
 * centre column, but one is "show me the rest of that rail panel" and this is
 * "show me a thing I keep". Sharing a field would mean a Show more in the rail
 * could silently close Saved.
 */
export type TimelinePane = "saved" | "lists" | "muted" | null;

/**
 * The Timeline's own stand-in slug in the Activity app filter.
 *
 * Not a HubAppSlug: the Timeline is the canvas, not an installed app, so it has
 * no entry to take one from. It still has to be nameable or your own likes and
 * follows would be the one thing on the strip you could not narrow to.
 */
export const TIMELINE_SLUG = "timeline";

/** How far back the Activity strip looks. */
export type ActivityRange = "all" | "hour" | "day" | "week" | "month";

/** Each range in minutes, since that is the unit the fixtures are dated in. */
export const RANGE_MINUTES: Record<ActivityRange, number> = {
  all: Infinity,
  /* The shortest window is an hour rather than a day, because a day is longer
     than anything this log holds — a filter whose every option returns the
     same rows teaches that filtering does nothing. */
  hour: 60,
  day: 60 * 24,
  week: 60 * 24 * 7,
  month: 60 * 24 * 30,
};

/** A list you keep people in. */
export interface TimelineList {
  id: string;
  name: string;
  /** MessagePerson ids */
  members: string[];
}

export interface TimelineState {
  strip: TimelineStrip;
  /** a forum category, or null for everything */
  topic: string | null;
  /** topics pinned to the tab row via `+`, in the order they were pinned */
  pinned: string[];
  expanded: TimelineExpansion;
  /** the search palette is up */
  searchOpen: boolean;
  /**
   * The contextual column, as a sheet, on a phone.
   *
   * Saved, Lists, Muted, the ecosystems and the topics are a column on a
   * desktop and were nothing at all below `md` — the panel that holds them is
   * inside the shell's `hidden md:block`. They are how the feed is narrowed,
   * so a phone had the feed and no way to aim it.
   */
  navOpen: boolean;
  /** the Nexus Sync upgrade sheet is up */
  syncOpen: boolean;
  /** the post being replied to or quoted, by id; null when the composer is shut */
  replyTo: string | null;
  /**
   * Which of the two the composer is doing.
   *
   * One composer rather than two: a quote and a reply are the same box with
   * the same tools, differing only in where the original sits and what the
   * button says. Two components would be two places to fix a placeholder.
   */
  replyMode: "reply" | "quote";
  /** posts you have reposted, by id */
  reposted: string[];
  /** posts you have liked, by id */
  liked: string[];
  /** the post whose activity is being read, by id */
  analyticsFor: string | null;
  /**
   * Replies you have added, by post id, newest last.
   *
   * The text rather than a tally, now that a thread can be read: the count is
   * `.length`, so the figure under a post and the replies inside it cannot
   * disagree. Still a delta — the fixtures own the number a post arrived with
   * and this owns what you did to it, which is what lets a reply move the
   * figure without the store keeping a mutable copy of every post in the feed.
   */
  replied: Record<string, string[]>;
  /** the post whose thread has taken over the centre column, by id */
  thread: string | null;
  /**
   * Narrow the feed to one person, by MessagePerson id.
   *
   * What picking somebody out of search does. A separate axis from `topic`
   * rather than a second use of it, because the two compose — a person's posts
   * under one topic is a question both halves of search can be used to ask.
   */
  author: string | null;
  /**
   * A post to scroll to and mark, by id.
   *
   * Set by search and cleared by the feed once it has done it. Held in the
   * store rather than passed down because the thing that asks for it (the
   * palette, at hub level) and the thing that performs it (the scroller) have
   * the whole shell between them.
   */
  focus: string | null;
  /**
   * People followed from inside the Timeline, by MessagePerson id.
   *
   * Only the ones followed *here*. The fixtures already mark who this account
   * follows (`post.following`), and copying that list into state at boot would
   * mean two places to keep in step; the Following strip reads both instead.
   */
  follows: string[];
  /** what you have done here this session, newest first — see {@link TimelineEvent} */
  events: TimelineEvent[];
  /**
   * The ecosystem the feed is narrowed to, by id, or null for all of them.
   *
   * Held beside `topic` rather than folded into it: a topic is what a post is
   * about and an ecosystem is where its author's handle is answered for, so the
   * two compose — "Build on BSV, on Twetch" is a question either one alone
   * cannot ask.
   */
  ecosystem: EcosystemId | null;
  /** which of Saved / Lists / Muted the column has open, if any */
  pane: TimelinePane;
  /** how far back the Activity strip reaches */
  activityRange: ActivityRange;
  /**
   * Apps the Activity strip is narrowed to, by slug.
   *
   * Empty means every connected app, which is the default and the common case.
   * Storing "all" as an empty list rather than as every slug means a workspace
   * connecting a new app does not have to be remembered about.
   */
  activityApps: string[];
  /** posts you have kept, by id */
  saved: string[];
  lists: TimelineList[];
  /**
   * Posts dismissed with "Not interested", by id.
   *
   * Kept rather than acted on invisibly: the feed filters against this, so a
   * dismissed post stays gone for the session and the undo has something to
   * put back.
   */
  notInterested: string[];
  /**
   * People whose posts you have muted, by MessagePerson id.
   *
   * Muting hides what they say and nothing else — you still follow them, they
   * are still on your card, their rooms still show. Blocking is the one that
   * severs the relationship, which is why the two are separate lists rather
   * than one with a level on it.
   */
  muted: string[];
  blocked: string[];
  /** People whose posts you have subscribed to, by id. */
  subscribed: string[];
}

/**
 * Something you did on the Timeline, for the Activity strip to report.
 *
 * Activity answers "what happened", and following somebody happened. Leaving it
 * out would have made the strip quietly selective: it reports a certificate
 * being issued and a basket being moved, so an action you took two seconds ago
 * on the same screen going unmentioned reads as the log being incomplete rather
 * than as following being uninteresting.
 *
 * Stamped with a real clock rather than the fixtures' minutes-ago, because this
 * one genuinely has a "now" to be relative to. The strip converts it at render.
 */
export interface TimelineEvent {
  id: string;
  kind:
    | "follow"
    | "unfollow"
    | "like"
    | "unlike"
    | "repost"
    | "unrepost"
    | "reply"
    | "quote";
  /**
   * Whose post, or who you followed.
   *
   * A post event names its author rather than the post: Activity is read as
   * "you liked Rhea's post", and a row that named an id nobody has seen would
   * be a row about nothing.
   */
  personId: string;
  /** epoch ms */
  at: number;
}

/**
 * How many of your own actions the strip keeps.
 *
 * Following and unfollowing the same person repeatedly is a real thing people
 * do to a demo, and every toggle is honestly a separate event — so the list is
 * bounded rather than de-duplicated. Twenty is past anything the strip shows
 * above the fixtures.
 */
const MAX_EVENTS = 20;

const INITIAL: TimelineState = {
  strip: "for-you",
  topic: null,
  pinned: [],
  expanded: null,
  searchOpen: false,
  navOpen: false,
  syncOpen: false,
  replyTo: null,
  replyMode: "reply",
  reposted: [],
  liked: [],
  analyticsFor: null,
  replied: {},
  thread: null,
  author: null,
  focus: null,
  follows: [],
  events: [],
  ecosystem: null,
  pane: null,
  activityRange: "all",
  activityApps: [],
  saved: [],
  /* Two, seeded. An empty Lists pane cannot show what a list is for, and the
     names are the argument: a list is a lens on the feed, not a folder. */
  lists: [
    {
      id: "list-builders",
      name: "Builders",
      members: ["darren-kellenschwiler", "asgeir-oskarsson", "kenji-watanabe"],
    },
    { id: "list-shops", name: "Shops and tills", members: ["mohammad-jaber"] },
  ],
  notInterested: [],
  muted: [],
  blocked: [],
  subscribed: [],
};

let state: TimelineState = INITIAL;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<TimelineState>): void {
  state = { ...state, ...patch };
  emit();
}

export function useTimeline(): TimelineState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  );
}

/**
 * Move to a strip.
 *
 * Clears any expansion: "show all rooms" is a thing you asked the *current*
 * view for, and leaving it up while the tab underneath changes would leave two
 * unrelated answers side by side.
 */
export function selectStrip(strip: TimelineStrip): void {
  set({ strip, topic: null, author: null, expanded: null, pane: null, navOpen: false });
}

/** Narrow to one forum category, or `null` to stop narrowing. */
/* Picking a topic is a request of the feed, so it uncovers it. */
export function selectTopic(topic: string | null): void {
  set({ topic, expanded: null, pane: null, navOpen: false });
}

/**
 * Pin a topic to the tab row.
 *
 * Selecting it as well, because pinning something and then not being taken to
 * it is the kind of thing that reads as a failed click.
 */
export function pinTopic(topic: string): void {
  if (state.pinned.includes(topic)) {
    set({ topic, expanded: null });
    return;
  }
  set({ pinned: [...state.pinned, topic], topic, expanded: null });
}

export function unpinTopic(topic: string): void {
  set({
    pinned: state.pinned.filter((name) => name !== topic),
    topic: state.topic === topic ? null : state.topic,
  });
}

export function expandSection(expanded: TimelineExpansion): void {
  set({ expanded });
}

export function openSearch(): void {
  set({ searchOpen: true });
}

export function closeSearch(): void {
  set({ searchOpen: false });
}

export function openNav(): void {
  set({ navOpen: true });
}

export function closeNav(): void {
  set({ navOpen: false });
}

export function openSync(): void {
  set({ syncOpen: true });
}

export function closeSync(): void {
  set({ syncOpen: false });
}

/**
 * Reply to a post.
 *
 * Held by id rather than by the post itself, so the composer reads the same
 * copy of it the feed is showing — a snapshot taken at click could go stale
 * against a counter that ticked while the sheet was open.
 */
export function openReply(postId: string): void {
  set({
    replyTo: postId,
    replyMode: "reply",
    searchOpen: false,
    navOpen: false,
    syncOpen: false,
  });
}

export function openQuote(postId: string): void {
  set({
    replyTo: postId,
    replyMode: "quote",
    searchOpen: false,
    navOpen: false,
    syncOpen: false,
  });
}

/**
 * Repost, or take it back.
 *
 * A delta on the fixture's number, like replies: the post owns the count it
 * arrived with and this owns what you did to it.
 */
export function toggleRepost(postId: string, authorId: string): void {
  const on = state.reposted.includes(postId);
  set({
    reposted: on
      ? state.reposted.filter((id) => id !== postId)
      : [...state.reposted, postId],
    events: withEvent(on ? "unrepost" : "repost", authorId),
  });
}

/**
 * Like, or take it back.
 *
 * Undoing logs its own row rather than deleting the first, the way unfollow
 * already does. A log that quietly erased what you undid would be a log you
 * could not trust to have been complete a minute ago.
 */
export function toggleLike(postId: string, authorId: string): void {
  const on = state.liked.includes(postId);
  set({
    liked: on
      ? state.liked.filter((id) => id !== postId)
      : [...state.liked, postId],
    events: withEvent(on ? "unlike" : "like", authorId),
  });
}

/** A quote is a repost with something added, so it counts as one. */
export function commitQuote(postId: string, authorId: string): void {
  set({
    reposted: state.reposted.includes(postId)
      ? state.reposted
      : [...state.reposted, postId],
    replyTo: null,
    events: withEvent("quote", authorId),
  });
}

export function closeReply(): void {
  set({ replyTo: null });
}

/** Keep one reply against a post, and shut the composer. */
export function commitReply(
  postId: string,
  body: string,
  authorId: string
): void {
  set({
    replied: {
      ...state.replied,
      [postId]: [...(state.replied[postId] ?? []), body],
    },
    replyTo: null,
    events: withEvent("reply", authorId),
  });
}

/**
 * Read a post's numbers.
 *
 * Reached from the views count on the row and from the overflow menu, because
 * both are the same question asked two ways — one by pressing the figure, one
 * by asking for it by name.
 */
export function openAnalytics(postId: string): void {
  set({ analyticsFor: postId, replyTo: null });
}

export function closeAnalytics(): void {
  set({ analyticsFor: null });
}

/**
 * Narrow the feed to one person, and close search if it was open.
 *
 * Clears the strip's own filters on the way in: "Rhea's posts, but only the
 * ones For you already ranked" is not what anybody means by picking a name out
 * of a search box.
 */
export function selectAuthor(personId: string | null): void {
  set({
    author: personId,
    topic: null,
    strip: "for-you",
    expanded: null,
    searchOpen: false,
  });
}

/**
 * Go to a post.
 *
 * Via its author rather than by hunting for a strip that contains it: a post
 * found in search may not be in any of the four, and "jump to it" failing
 * because the ranked strip happened not to promote it would be the search
 * lying. Their posts always contain their post.
 */
export function focusPost(postId: string, authorId: string): void {
  set({
    author: authorId,
    topic: null,
    strip: "for-you",
    expanded: null,
    searchOpen: false,
    focus: postId,
  });
}

/** Called by the feed once it has scrolled to whatever `focus` named. */
export function clearFocus(): void {
  if (state.focus === null) return;
  set({ focus: null });
}

/**
 * Follow or unfollow somebody, by MessagePerson id.
 *
 * Records the act as well as the result: the Following strip reads `follows`,
 * and the Activity strip reads `events`. One call writes both so the two can
 * never disagree about whether it happened.
 */
export function toggleFollow(personId: string): void {
  const following = state.follows.includes(personId);
  set({
    follows: following
      ? state.follows.filter((id) => id !== personId)
      : [...state.follows, personId],
    events: withEvent(following ? "unfollow" : "follow", personId),
  });
}

/**
 * One event, on the front of the log.
 *
 * Shared because following is not the only thing that changes who you follow —
 * blocking does too, and a block that quietly dropped a follow without a row
 * would leave Activity claiming you still follow somebody the Following strip
 * has stopped showing.
 */
function withEvent(
  kind: TimelineEvent["kind"],
  personId: string
): TimelineEvent[] {
  const event: TimelineEvent = {
    /* The timestamp is in the id as well as the field: two follows of the same
       person a minute apart are two rows, and a key of just the person id would
       make React treat the second as the first moving. */
    id: `ev-${personId}-${state.events.length}-${Date.now()}`,
    kind,
    personId,
    at: Date.now(),
  };
  return [event, ...state.events].slice(0, MAX_EVENTS);
}

/** Hide one post, and put it back. */
export function dismissPost(postId: string): void {
  if (state.notInterested.includes(postId)) return;
  set({ notInterested: [...state.notInterested, postId] });
}

export function restorePost(postId: string): void {
  set({
    notInterested: state.notInterested.filter((id) => id !== postId),
  });
}

/** Stop seeing what somebody says, without changing anything else. */
export function toggleMute(personId: string): void {
  set({
    muted: state.muted.includes(personId)
      ? state.muted.filter((id) => id !== personId)
      : [...state.muted, personId],
  });
}

/**
 * Block somebody, which also stops following them.
 *
 * A block that left you following the person would leave the Following strip
 * quietly filtering out somebody it still counts as followed — two answers to
 * "do I follow them" in one store.
 */
export function toggleBlock(personId: string): void {
  const blocked = state.blocked.includes(personId);
  const wasFollowing = !blocked && state.follows.includes(personId);
  set({
    blocked: blocked
      ? state.blocked.filter((id) => id !== personId)
      : [...state.blocked, personId],
    follows: blocked
      ? state.follows
      : state.follows.filter((id) => id !== personId),
    /* The unfollow a block performs is logged like any other, so Activity and
       the Following strip cannot end up telling different stories. */
    ...(wasFollowing ? { events: withEvent("unfollow", personId) } : {}),
  });
}

export function toggleSubscribe(personId: string): void {
  set({
    subscribed: state.subscribed.includes(personId)
      ? state.subscribed.filter((id) => id !== personId)
      : [...state.subscribed, personId],
  });
}

/** Open one of the contextual column's panes, or close whatever is open. */
export function openPane(pane: TimelinePane): void {
  set({ pane, expanded: null, navOpen: false });
}

export function toggleSaved(postId: string): void {
  set({
    saved: state.saved.includes(postId)
      ? state.saved.filter((id) => id !== postId)
      : [postId, ...state.saved],
  });
}

/** Put somebody in a list, or take them out. */
export function toggleListMember(listId: string, personId: string): void {
  set({
    lists: state.lists.map((list) =>
      list.id !== listId
        ? list
        : {
            ...list,
            members: list.members.includes(personId)
              ? list.members.filter((id) => id !== personId)
              : [...list.members, personId],
          }
    ),
  });
}

export function setActivityRange(range: ActivityRange): void {
  set({ activityRange: range });
}

/** Tick one app, or clear back to all of them. */
export function toggleActivityApp(slug: string): void {
  set({
    activityApps: state.activityApps.includes(slug)
      ? state.activityApps.filter((id) => id !== slug)
      : [...state.activityApps, slug],
  });
}

export function clearActivityApps(): void {
  set({ activityApps: [] });
}

/**
 * Read one post on its own, with its replies under it.
 *
 * Takes the centre column rather than opening a sheet, and closes the panes
 * while it is there: a thread is the same kind of thing the feed is — posts,
 * full width, scrolled — so putting it anywhere else would make it a smaller
 * version of what you were already reading.
 */
export function openThread(postId: string): void {
  set({ thread: postId, expanded: null, pane: null });
}

export function closeThread(): void {
  set({ thread: null });
}

/** Narrow the feed to one ecosystem, or widen it back to all of them. */
export function selectEcosystem(ecosystem: EcosystemId | null): void {
  set({ ecosystem, expanded: null, pane: null, thread: null, navOpen: false });
}
