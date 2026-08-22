"use client";

/**
 * Search, as the command bar Browse already taught.
 *
 * Same object as {@link file://../../hub/command-palette.tsx} — one centred
 * card, a query at the top, rows below, arrows and Enter — because a shell that
 * searches two ways is a shell with two search boxes. What differs is what is
 * in it: this one knows about topics, people, posts and rooms rather than tabs
 * and URLs.
 *
 * The part worth arguing about is the state before you type. A palette that
 * opens empty asks you to already know what you want, which on a timeline you
 * mostly do not — so it opens on the things worth going to: the busiest topics,
 * a few people, and whatever is on air. It is the pre-query state that makes
 * this a way in rather than a filter.
 */

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useHostOverlay } from "@/lib/wallet-data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { content, getMessagePerson } from "@/lib/data";
import {
  incomingPosts,
  liveRooms,
  timelinePosts,
  whoToFollow,
  type LiveRoom,
  type TimelinePost,
} from "@/lib/data/timeline";
import { agoLabel, countLabel } from "@/lib/timeline";
import {
  closeSearch,
  expandSection,
  focusPost,
  selectAuthor,
  selectTopic,
  useTimeline,
} from "@/lib/timeline-store";
import type { MessagePerson } from "@/lib/data";
import { ArrowRight, Hash, Radio, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const copy = content.timeline.search;

/** How many of each kind a group shows. Past this, type more. */
const GROUP_CAP = 4;

type Entry =
  | { kind: "topic"; id: string; topic: string; count: number }
  | { kind: "person"; id: string; person: MessagePerson; reason?: string }
  | { kind: "post"; id: string; post: TimelinePost; author: MessagePerson }
  | { kind: "room"; id: string; room: LiveRoom };

/** Everything the timeline holds, flattened once and searched many times. */
function corpus(): {
  topics: { topic: string; count: number }[];
  people: MessagePerson[];
  posts: { post: TimelinePost; author: MessagePerson }[];
} {
  const all = [...timelinePosts, ...incomingPosts];

  const counts = new Map<string, number>();
  for (const post of all) {
    if (post.topic) counts.set(post.topic, (counts.get(post.topic) ?? 0) + 1);
  }
  const topics = [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  const posts = all.flatMap((post) => {
    const author = getMessagePerson(post.authorId);
    return author ? [{ post, author }] : [];
  });

  /*
   * People who are actually on this timeline, plus the ones it suggests.
   *
   * Not the whole address book: searching a feed and being offered somebody who
   * has never posted on it is the kind of result that teaches people the search
   * is matching a database rather than the thing in front of them.
   */
  const seen = new Map<string, MessagePerson>();
  for (const { author } of posts) seen.set(author.id, author);
  for (const room of liveRooms) {
    const host = getMessagePerson(room.hostId);
    if (host) seen.set(host.id, host);
  }
  for (const suggestion of whoToFollow) {
    const person = getMessagePerson(suggestion.personId);
    if (person) seen.set(person.id, person);
  }

  return { topics, people: [...seen.values()], posts };
}

export function TimelineSearch(): ReactNode {
  const { searchOpen } = useTimeline();

  /*
   * Take the native tab layer away while this is up.
   *
   * The Timeline can be open with Browse as the active app (?app=browser&
   * view=timeline), and a browsed page is a native view that always paints
   * above this document — the same reason the browser's own palette calls this.
   * Refcounted, so closing here cannot uncover a page another sheet still
   * wants hidden. Called before the early return, because a hook cannot sit
   * behind one.
   */
  useHostOverlay(searchOpen);

  if (!searchOpen) return null;
  return <SearchContent />;
}

function SearchContent(): ReactNode {
  const { follows } = useTimeline();
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { topics, people, posts } = useMemo(() => corpus(), []);

  const entries = useMemo<Entry[]>(() => {
    const needle = query.trim().toLowerCase();

    if (needle === "") {
      /*
       * The pre-query state: the busiest topics, then people, then what is on.
       *
       * Ordered by how likely each is to be the thing you opened this for.
       * Topics lead because they are the only one of the three that changes
       * what the whole column shows.
       */
      const suggestedPeople = whoToFollow
        .flatMap((suggestion) => {
          const person = getMessagePerson(suggestion.personId);
          return person
            ? [
                {
                  kind: "person" as const,
                  id: `person-${person.id}`,
                  person,
                  reason: suggestion.reason,
                },
              ]
            : [];
        })
        .slice(0, 3);

      return [
        ...topics.slice(0, GROUP_CAP).map((entry) => ({
          kind: "topic" as const,
          id: `topic-${entry.topic}`,
          topic: entry.topic,
          count: entry.count,
        })),
        ...suggestedPeople,
        ...liveRooms.slice(0, 3).map((room) => ({
          kind: "room" as const,
          id: `room-${room.id}`,
          room,
        })),
      ];
    }

    const topicHits: Entry[] = topics
      .filter((entry) => entry.topic.toLowerCase().includes(needle))
      .slice(0, GROUP_CAP)
      .map((entry) => ({
        kind: "topic",
        id: `topic-${entry.topic}`,
        topic: entry.topic,
        count: entry.count,
      }));

    const personHits: Entry[] = people
      .filter(
        (person) =>
          person.name.toLowerCase().includes(needle) ||
          person.handle.toLowerCase().includes(needle) ||
          (person.username ?? "").toLowerCase().includes(needle)
      )
      .slice(0, GROUP_CAP)
      .map((person) => ({ kind: "person", id: `person-${person.id}`, person }));

    const postHits: Entry[] = posts
      .filter(({ post }) => post.body.toLowerCase().includes(needle))
      .slice(0, GROUP_CAP)
      .map(({ post, author }) => ({
        kind: "post",
        id: `post-${post.id}`,
        post,
        author,
      }));

    const roomHits: Entry[] = liveRooms
      .filter((room) => room.title.toLowerCase().includes(needle))
      .slice(0, GROUP_CAP)
      .map((room) => ({ kind: "room", id: `room-${room.id}`, room }));

    return [...topicHits, ...personHits, ...postHits, ...roomHits];
  }, [query, topics, people, posts]);

  const selected = Math.min(selectedIndex, Math.max(0, entries.length - 1));

  const activate = (entry: Entry | undefined): void => {
    if (!entry) return;
    if (entry.kind === "topic") {
      selectTopic(entry.topic);
      closeSearch();
    } else if (entry.kind === "person") {
      selectAuthor(entry.person.id);
    } else if (entry.kind === "post") {
      focusPost(entry.post.id, entry.post.authorId);
    } else {
      expandSection("rooms");
      closeSearch();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /*
   * The heading a row sits under, or null when it is not the first of its kind.
   *
   * Derived from the run of entries rather than by rendering four lists,
   * because the arrow keys move through one flat list — two structures for one
   * sequence is how a palette ends up with a selection that skips a row.
   */
  const headingFor = (index: number): string | null => {
    const entry = entries[index];
    if (!entry) return null;
    if (index > 0 && entries[index - 1]?.kind === entry.kind) return null;
    /* Named by kind before a query as well as after it. A single "Start here"
       over all three groups left topics, people and rooms running together as
       one list of ten unlike things — the headings are what make the pre-query
       state readable, so they are exactly what it should not drop. */
    if (entry.kind === "topic") return copy.groupTopics;
    if (entry.kind === "person") return copy.groupPeople;
    if (entry.kind === "post") return copy.groupPosts;
    return copy.groupRooms;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        /* Bottom-anchored on a phone, where the thumb and the keyboard both
           are; the desktop palette hangs from the top like every other command
           bar. One component either way — a second mobile search would be a
           second set of results to keep in step. */
        isDesktop
          ? "items-start justify-center px-4 pt-[12vh]"
          : "items-end justify-center"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={copy.placeholder}
      onClick={closeSearch}
    >
      <div
        className={`w-full overflow-hidden bg-white text-neutral-900 shadow-[0_12px_90px_-8px_rgba(0,0,0,0.85)] ring-1 ring-black/10 dark:bg-black dark:text-white dark:shadow-[0_12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10 ${
          isDesktop
            ? "max-w-2xl rounded-2xl"
            : "max-h-[85vh] rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Search className="size-5 shrink-0 opacity-50" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((index) =>
                  Math.min(index + 1, entries.length - 1)
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                activate(entries[selected]);
              }
            }}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-50"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t border-black/10 p-2 dark:border-white/10">
          {entries.length === 0 && (
            <p className="px-3 py-4 text-sm opacity-50">{copy.noResults}</p>
          )}
          {entries.map((entry, index) => {
            const isSelected = index === selected;
            const heading = headingFor(index);
            const rowClass = `focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
              isSelected
                ? "bg-accent text-accent-foreground"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`;
            const trailingClass = `flex shrink-0 items-center gap-1.5 text-xs ${
              isSelected ? "text-accent-foreground/90" : "opacity-50"
            }`;

            return (
              <div key={entry.id}>
                {heading && (
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase opacity-40">
                    {heading}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => activate(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={rowClass}
                >
                  <Row entry={entry} following={follows} />
                  <span className={trailingClass}>
                    {entry.kind === "topic"
                      ? copy.hintTopic
                      : entry.kind === "person"
                        ? copy.hintPerson
                        : entry.kind === "post"
                          ? copy.hintPost
                          : copy.hintRoom}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The leading half of a row — everything except the hint on the right. */
function Row({
  entry,
  following,
}: {
  entry: Entry;
  following: string[];
}): ReactNode {
  if (entry.kind === "topic") {
    return (
      <>
        <Hash className="size-5 shrink-0 opacity-60" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {entry.topic}
        </span>
        <span className="shrink-0 text-xs tabular-nums opacity-50">
          {entry.count}
        </span>
      </>
    );
  }

  if (entry.kind === "person") {
    return (
      <>
        <MemberAvatar person={entry.person} size={20} radius={6} />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{entry.person.name}</span>{" "}
          <span className="text-xs opacity-50">
            <Handle person={entry.person} size={10} />
          </span>
          {/* Why they are worth following, when the pre-query state is the one
              offering them. A search hit has earned its place by matching. */}
          {entry.reason ? (
            <span className="block truncate text-xs opacity-50">
              {entry.reason}
            </span>
          ) : null}
        </span>
        {following.includes(entry.person.id) ? (
          <span className="shrink-0 text-xs opacity-50">
            {content.timeline.rail.follow.following}
          </span>
        ) : null}
      </>
    );
  }

  if (entry.kind === "post") {
    return (
      <>
        <MemberAvatar person={entry.author} size={20} radius={6} />
        <span className="min-w-0 flex-1 truncate">
          {/* The author before the words, because on a timeline who said it is
              half of what makes a line of text findable again. */}
          <span className="font-medium">{entry.author.name}</span>{" "}
          <span className="opacity-70">
            {entry.post.body.replace(/\n+/g, " ")}
          </span>
        </span>
        <span className="shrink-0 text-xs opacity-50">
          {agoLabel(entry.post.ago)}
        </span>
      </>
    );
  }

  return (
    <>
      <Radio className="size-5 shrink-0 opacity-60" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {entry.room.title}
      </span>
      <span className="shrink-0 text-xs tabular-nums opacity-50">
        {content.timeline.rail.onAir.listeners.replace(
          "{count}",
          countLabel(entry.room.listeners)
        )}
      </span>
    </>
  );
}
