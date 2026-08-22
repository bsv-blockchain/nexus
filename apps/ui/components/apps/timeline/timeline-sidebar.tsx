"use client";

/**
 * The Timeline's contextual column.
 *
 * The reference screenshot has no left column at all — X puts its navigation
 * there and this shell already has a rail for that, so copying it would have
 * given the Timeline a second rail. What this column does instead is the one
 * job the other two cannot: it says what the timeline is *scoped to*.
 *
 * That matters more here than it would on X, because in Nexus a post is signed
 * by a handle and a handle belongs to a workspace. "Who am I posting as" is a
 * live question every time you switch workspace, and the feed itself has no
 * room to answer it. So: the identity at the top, the topics that narrow the
 * feed under it, and a way back to the workspaces this all hangs off.
 *
 * Rendered by LibraryPanel, not by TimelineApp — it sits in the shell's left
 * panel where every other app's contextual column sits, which is why the two
 * halves talk through {@link file://../../../lib/timeline-store.ts} rather than
 * through props.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub } from "@/components/hub/hub-provider";
import { COLUMN_TILE } from "@/components/hub/profiles-sidebar";
import { ProfileSwitcher } from "@/components/apps/timeline/profile-switcher";
import { content } from "@/lib/data";
import { profileFor, useProfiles } from "@/lib/profiles-store";
import { timelinePosts } from "@/lib/data/timeline";
import { activeHandleFor } from "@/lib/settings-store";
import { timelineEcosystems } from "@/lib/timeline";
import {
  openPane,
  selectEcosystem,
  selectTopic,
  unpinTopic,
  useTimeline,
  type TimelinePane,
} from "@/lib/timeline-store";
import {
  Bookmark,
  Hash,
  List,
  PanelLeftClose,
  Pencil,
  VolumeX,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const copy = content.timeline.sidebar;

/**
 * The topics, counted off the posts themselves.
 *
 * Derived rather than listed, so a topic cannot appear in this column with
 * nothing behind it — the one way a filter column reliably loses trust.
 */
function useTopics(): { name: string; count: number }[] {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of timelinePosts) {
      if (!post.topic) continue;
      counts.set(post.topic, (counts.get(post.topic) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, []);
}

/**
 * A row that opens a pane in the feed's place.
 *
 * Carries its own count where it has one: a Muted row that says nothing is the
 * same row whether you have muted nobody or eleven people, which is the one
 * thing somebody opens it to find out.
 */
function NavRow({
  icon: Icon,
  label,
  pane,
  count,
  active,
}: {
  icon: typeof Bookmark;
  label: string;
  pane: Exclude<TimelinePane, null>;
  count?: number;
  active: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={() => openPane(active ? null : pane)}
      aria-pressed={active}
      className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent/15 text-foreground font-medium"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count ? (
        <span className="shrink-0 text-[11px] tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}

export function TimelineSidebar(): ReactNode {
  const { toggleRail, activeSpaceId, setMainView } = useHub();
  const { topic, pinned, pane, saved, lists, muted, ecosystem } = useTimeline();
  const topics = useTopics();
  const profiles = useProfiles();
  const me = profileFor(profiles, activeSpaceId);
  const handle = activeHandleFor(activeSpaceId);
  /* The row's rect, captured at click, so the popover never measures during
     render. Same contract the rail and the lock-policy button use. */
  const [switcher, setSwitcher] = useState<DOMRect | null>(null);

  return (
    <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
      <div className="flex items-center gap-2 px-1.5 pb-2">
        <button
          type="button"
          onClick={toggleRail}
          aria-label={content.hub.collapsePanel}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-0.5 shrink-0 rounded-md p-1"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {content.timeline.title}
        </h2>
      </div>

      {/*
        The way out, in the same place and the same shape as the way in.

        Workspaces puts "Show Timeline" at the top of its column; this is the
        return leg of that trip, so it sits at the top of this one wearing the
        identical box. Two buttons that undo each other looking like each other
        is what makes the pair legible as one movement rather than as two
        unrelated controls that happen to swap the screen.
      */}
      <button
        type="button"
        onClick={() => setMainView("profiles")}
        className={`focus-ring ${COLUMN_TILE} bg-surface-raised hover:bg-surface-hover mx-0.5 text-center text-sm font-bold transition-colors`}
      >
        {copy.backToHub}
      </button>

      <div className="mt-2 space-y-0.5">
        <NavRow
          icon={Bookmark}
          label={copy.saved}
          pane="saved"
          count={saved.length}
          active={pane === "saved"}
        />
        <NavRow
          icon={List}
          label={copy.lists}
          pane="lists"
          count={lists.length}
          active={pane === "lists"}
        />
        <NavRow
          icon={VolumeX}
          label={copy.muted}
          pane="muted"
          count={muted.length}
          active={pane === "muted"}
        />
      </div>

      {/* The scroller, because these two lists are the only things here that
          grow with the fixtures. Everything above is fixed height and stays. */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {/*
          Ecosystems above topics, because they are the coarser cut.

          A handle is `@name@ecosystem` and the ecosystem is the authority that
          answers for it, so this is "whose namespace am I reading" — a question
          that comes before "about what". The two compose: pick Twetch and then
          Build on BSV and you get both.
        */}
        <p className="text-muted-foreground px-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
          {copy.ecosystems}
        </p>
        <div className="mb-3 space-y-0.5">
          <TopicRow
            label={copy.allEcosystems}
            count={timelinePosts.length}
            active={ecosystem === null}
            onSelect={() => selectEcosystem(null)}
          />
          {timelineEcosystems().map((entry) => (
            <TopicRow
              key={entry.id}
              label={entry.name}
              count={entry.count}
              active={ecosystem === entry.id}
              icon={
                entry.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.icon}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    className="size-4 shrink-0 rounded-[22%] object-contain"
                    style={
                      entry.iconPlate
                        ? { backgroundColor: entry.iconPlate }
                        : undefined
                    }
                  />
                ) : undefined
              }
              onSelect={() => selectEcosystem(entry.id)}
            />
          ))}
        </div>

        <p className="text-muted-foreground px-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
          {copy.topics}
        </p>
        <div className="space-y-0.5">
          <TopicRow
            label={copy.allTopics}
            count={timelinePosts.length}
            active={topic === null}
            onSelect={() => selectTopic(null)}
          />
          {topics.map((entry) => (
            <TopicRow
              key={entry.name}
              label={entry.name}
              count={entry.count}
              active={topic === entry.name}
              pinned={pinned.includes(entry.name)}
              onSelect={() => selectTopic(entry.name)}
              onUnpin={() => unpinTopic(entry.name)}
            />
          ))}
        </div>
      </div>

      {/*
        Who this workspace posts as, at the foot of the column.

        Not decoration and no longer only a statement: the same person holds a
        different profile in every workspace, so this is both the answer to
        "who am I here" and the way to change it. The pencil says so — it
        replaced the workspace glyph, which was answering a question the rail
        already answers and made the row look like a label.

        Last rather than first: it is the column's standing context, so it
        reads better as the thing the list is grounded on than as the thing the
        list starts with.
      */}
      <button
        type="button"
        onClick={(event) =>
          setSwitcher(event.currentTarget.getBoundingClientRect())
        }
        aria-haspopup="dialog"
        aria-expanded={switcher !== null}
        className="focus-ring bg-surface-raised ring-border/60 hover:bg-surface-hover mx-0.5 mt-2 flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 transition-colors"
      >
        <MemberAvatar person={me} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {copy.postingAs}
          </p>
          <p className="truncate font-mono text-xs font-semibold">
            @{me.handle || handle}
          </p>
        </div>
        <Pencil
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </button>
      <ProfileSwitcher anchor={switcher} onClose={() => setSwitcher(null)} />

      {/* The same bar every other contextual column ends with, so the way into
          a guide is in one place across the shell rather than in one place per
          app. Below the route out, because help is the least urgent thing here
          and belongs furthest from the content. */}
      <div className="shrink-0">
        <AppHelpBar slug="timeline" />
      </div>
    </div>
  );
}

function TopicRow({
  label,
  count,
  active,
  pinned = false,
  icon,
  onSelect,
  onUnpin,
}: {
  label: string;
  count: number;
  active: boolean;
  pinned?: boolean;
  /** an ecosystem's mark, where the row has one; topics get the hash */
  icon?: ReactNode;
  onSelect: () => void;
  onUnpin?: () => void;
}): ReactNode {
  return (
    <div className="group/topic relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
          active
            ? "bg-accent/15 text-foreground font-medium"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        {icon ?? (
          <Hash className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {/* The count steps aside for the unpin control rather than sitting
            beside it — two numbers-worth of furniture in a 300px column reads
            as clutter, and the count is the less urgent of the two. */}
        <span
          className={`text-muted-foreground shrink-0 text-[11px] tabular-nums ${
            pinned ? "group-hover/topic:invisible" : ""
          }`}
        >
          {count}
        </span>
      </button>
      {pinned && onUnpin ? (
        <button
          type="button"
          onClick={onUnpin}
          aria-label={`${content.timeline.unpin} ${label}`}
          className="focus-ring text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded px-1 text-[10px] font-semibold group-hover/topic:block"
        >
          {content.timeline.unpin}
        </button>
      ) : null}
    </div>
  );
}
