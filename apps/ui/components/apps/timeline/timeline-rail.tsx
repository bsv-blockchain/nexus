"use client";

/**
 * The Timeline's help rail, and the overflow it opens.
 *
 * Four panels — search, Nexus Sync, On air now, Who to follow — each capped at
 * three rows. The cap is the point: a rail that scrolls is a second feed, and
 * two feeds competing for the same eye is how a timeline stops being read. The
 * fourth row onwards lives behind "Show more", which opens the full list in the
 * content area rather than growing the rail, so a list of twenty people gets a
 * column wide enough to hold twenty people.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { NexusSyncPitch } from "@/components/hub/nexus-sync-pitch";
import { content, getMessagePerson } from "@/lib/data";
import {
  liveRooms,
  whoToFollow,
  type LiveRoom,
  type Suggestion,
} from "@/lib/data/timeline";
import { countLabel } from "@/lib/timeline";
import {
  expandSection,
  openSearch,
  toggleFollow,
  useTimeline,
  type TimelineExpansion,
} from "@/lib/timeline-store";
import { ArrowLeft, Check, CloudSync, Radio, Search } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.timeline.rail;

/** How many rows a rail panel shows before it defers to "Show more". */
const RAIL_ROWS = 3;

/** The rounded block every rail panel sits in. */
function Panel({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: typeof Radio;
  children: ReactNode;
}): ReactNode {
  return (
    /* shrink-0, because the rail is a flex column: without it the panels are
       compressed to fit and their last row spills past the rounded edge. */
    <section className="bg-surface ring-border/60 shrink-0 overflow-hidden rounded-2xl ring-1">
      {title ? (
        <h3 className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-base font-bold">
          {Icon ? (
            <Icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          ) : null}
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function ShowMore({
  section,
  label,
}: {
  section: Exclude<TimelineExpansion, null>;
  label: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={() => expandSection(section)}
      className="focus-ring text-accent hover:bg-surface-hover w-full px-4 py-2.5 text-center text-sm transition-colors"
    >
      {label}
    </button>
  );
}

/** One room. Same row in the rail and in the expanded list. */
function RoomRow({ room }: { room: LiveRoom }): ReactNode {
  const host = getMessagePerson(room.hostId);
  if (!host) return null;

  return (
    <div className="hover:bg-surface-hover flex items-center gap-3 px-4 py-2.5 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MemberAvatar person={host} size={16} radius={5} />
          <span className="truncate">
            {host.name} {room.verb}
          </span>
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold">{room.title}</p>
        <div className="mt-1 flex items-center gap-2">
          {/*
            The faces before the number, because a room is worth joining for
            who is in it — the count is the evidence, the faces are the reason.
          */}
          <div className="flex -space-x-1.5">
            {room.facepile.map((id) => {
              const person = getMessagePerson(id);
              return person ? (
                <MemberAvatar
                  key={id}
                  person={person}
                  size={18}
                  radius={9}
                  className="ring-surface ring-2"
                />
              ) : null;
            })}
          </div>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {copy.onAir.listeners.replace(
              "{count}",
              countLabel(room.listeners)
            )}
          </span>
        </div>
      </div>
      {/* The live dot. Red and pulsing is the one convention nobody has to be
          taught, and it is the only red on this surface. */}
      <span className="relative flex size-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
      </span>
    </div>
  );
}

/** One suggestion, with a Follow that actually latches. */
function SuggestionRow({ suggestion }: { suggestion: Suggestion }): ReactNode {
  const { follows } = useTimeline();
  const person = getMessagePerson(suggestion.personId);
  if (!person) return null;
  const following = follows.includes(person.id);

  return (
    <div className="hover:bg-surface-hover flex items-center gap-2.5 px-4 py-2.5 transition-colors">
      <ProfileHovercard person={person} label={person.name}>
        <MemberAvatar person={person} size={36} />
      </ProfileHovercard>
      <div className="min-w-0 flex-1">
        <ProfileHovercard person={person} label={person.name}>
          <span className="block truncate text-sm font-semibold hover:underline">
            {person.name}
          </span>
        </ProfileHovercard>
        {/*
          Clipped by a wrapper, not by a class passed down: Handle sets its own
          `inline-flex`, and two display utilities on one element is a coin toss
          decided by stylesheet order rather than by intent.

          A point smaller than the same handle in a post, because a foreign one
          spells out its ecosystem — `@marcelvansilfhout@mycelia` — and 12px of
          that does not fit a 340px column beside a face and a Follow button.
          Clipping the suffix would be worse than setting it small: the suffix
          is the part that says this person is not from here.
        */}
        <div className="text-muted-foreground truncate text-[11px]">
          <Handle person={person} size={11} />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
          {suggestion.reason}
        </p>
      </div>
      <button
        type="button"
        onClick={() => toggleFollow(person.id)}
        aria-pressed={following}
        className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          following
            ? "ring-border text-muted-foreground hover:text-foreground ring-1"
            : "bg-foreground text-background hover:opacity-90"
        }`}
      >
        {following ? (
          <span className="flex items-center gap-1">
            <Check className="size-3" aria-hidden="true" />
            {copy.follow.following}
          </span>
        ) : (
          copy.follow.action
        )}
      </button>
    </div>
  );
}

export function TimelineRail(): ReactNode {
  return (
    <div className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto px-3 pt-3 pb-6">
      {/*
        Search first and sticky, because it is the only thing here you arrive
        with an intention for; everything below it is something to notice.

        A button wearing a field's clothes, not a field. Typing here would give
        the shell a second search that behaves differently from the one Browse
        opens with the same gesture; this raises that same command bar, scoped
        to the timeline. The shape stays because a search box is what people
        look for, and a button labelled "Search" in this corner would be the
        one control on the rail nobody found.

        pb-3, so the space under search matches the space between two cards. At
        pb-1 it sat 4px off Nexus Sync while the cards below were 12px apart,
        which read as search belonging to the Sync panel rather than standing
        on its own.
      */}
      <div className="bg-background sticky top-0 z-10 -mt-3 shrink-0 pt-3 pb-3">
        <button
          type="button"
          onClick={openSearch}
          className="focus-ring bg-surface ring-border/60 hover:ring-accent/60 text-muted-foreground flex w-full items-center gap-2 rounded-full px-3.5 py-2 text-left text-sm ring-1 transition-shadow"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{copy.search}</span>
        </button>
      </div>
      {/*
        Nexus Sync — the paid tier, named for what it does rather than for how
        much it costs. The list is the argument; the price is not here because
        this panel's job is to make the features legible, and a number does the
        opposite until somebody wants one.
      */}
      {/* Through Panel's own heading rather than one written here, so this mark
          and On air's are the same element with the same tone by construction.
          It had picked up `--accent`, which made it the only panel title in the
          rail shouting — and the one it was shouting over was the live one. */}
      <Panel title={copy.sync.title} icon={CloudSync}>
        {/* The argument itself is shared with Focus's column, which shows the
            same case in its own card — see components/hub/nexus-sync-pitch. */}
        <div className="px-4 pt-1 pb-4">
          <NexusSyncPitch />
        </div>
      </Panel>
      <Panel title={copy.onAir.title} icon={Radio}>
        <div className="pt-1">
          {liveRooms.slice(0, RAIL_ROWS).map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </div>
        {liveRooms.length > RAIL_ROWS ? (
          <ShowMore section="rooms" label={copy.onAir.showMore} />
        ) : null}
      </Panel>
      <Panel title={copy.follow.title}>
        <div className="pt-1">
          {whoToFollow.slice(0, RAIL_ROWS).map((suggestion) => (
            <SuggestionRow key={suggestion.personId} suggestion={suggestion} />
          ))}
        </div>
        {whoToFollow.length > RAIL_ROWS ? (
          <ShowMore section="follow" label={copy.follow.showMore} />
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * A "Show more" opened out.
 *
 * Renders in the content area beside the feed, not in the rail — which is what
 * makes the second column of the desktop grid earn its width instead of being
 * whitespace waiting for something to happen.
 */
export function TimelineExpanded({
  section,
}: {
  section: Exclude<TimelineExpansion, null>;
}): ReactNode {
  const title =
    section === "rooms" ? copy.onAir.allTitle : copy.follow.allTitle;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-background/80 sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => expandSection(null)}
          aria-label={copy.back}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === "rooms"
          ? liveRooms.map((room) => (
              <div key={room.id} className="border-border/60 border-b">
                <RoomRow room={room} />
              </div>
            ))
          : whoToFollow.map((suggestion) => (
              <div
                key={suggestion.personId}
                className="border-border/60 border-b"
              >
                <SuggestionRow suggestion={suggestion} />
              </div>
            ))}
      </div>
    </div>
  );
}
