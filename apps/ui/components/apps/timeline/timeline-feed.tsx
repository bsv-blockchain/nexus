"use client";

/**
 * The feed column: the tab row, the composer, and the posts.
 *
 * Split from TimelineApp so the app file stays a layout — three columns and
 * which of them is showing — and everything about what a strip contains lives
 * here.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { ActivityBar } from "@/components/apps/timeline/activity-bar";
import { useComposerTokens } from "@/lib/use-composer-tokens";
import { PostRow } from "@/components/apps/timeline/post-row";
import { TimelineRail } from "@/components/apps/timeline/timeline-rail";
import { AppTile } from "@/components/hub/app-icon";
import { JumpingDots } from "@/components/hub/jumping-dots";
import { PopoverMenu, MenuItem } from "@/components/hub/popover-menu";
import { Tab, TabRow } from "@/components/hub/tab-row";
import { Tooltip } from "@/components/hub/tooltip";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import { content, getHubApp, getMessagePerson } from "@/lib/data";
import type { MessagePerson } from "@/lib/data";
import { profileFeeds, profilePosts } from "@/lib/data/profiles";
import { profileFor, useProfiles } from "@/lib/profiles-store";
import {
  incomingActivity,
  incomingPosts,
  timelineActivity,
  timelinePosts,
  type TimelinePost,
} from "@/lib/data/timeline";
import { agoLabel, satsLabel } from "@/lib/timeline";
import {
  RANGE_MINUTES,
  TIMELINE_SLUG,
  clearFocus,
  openNav,
  pinTopic,
  selectAuthor,
  selectStrip,
  selectTopic,
  useTimeline,
  type TimelineStrip,
} from "@/lib/timeline-store";
import {
  ArrowUp,
  CalendarClock,
  Coins,
  Hash,
  Image as ImageIcon,
  ListPlus,
  MapPin,
  Plus,
  SlidersHorizontal,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";

const copy = content.timeline;

const STRIPS: TimelineStrip[] = ["for-you", "following", "posts", "activity"];

/** "Show 3 activities" / "Show 1 activity". */
function activityLabel(count: number): string {
  return count === 1
    ? content.timeline.refreshActivityOne
    : content.timeline.refreshActivity.replace("{count}", String(count));
}

/** "Show 3 posts" / "Show 1 post". */
function refreshLabel(count: number): string {
  return count === 1
    ? copy.refreshOne
    : copy.refresh.replace("{count}", String(count));
}

/**
 * How often a post might arrive, and how likely it is to.
 *
 * Sporadic rather than metronomic: a counter that goes up every four seconds
 * exactly is read as a progress bar, not as other people typing. Checking often
 * and landing sometimes is what irregular arrival actually looks like.
 */
const ARRIVAL_TICK = 4200;
const ARRIVAL_CHANCE = 0.55;

/** How far the feed has to be dragged past its top before a release refreshes. */
const PULL_TRIGGER = 64;
/** Where the pull stops growing, so a long drag does not open a gap. */
const PULL_MAX = 96;
/** How long the dots hold before the new posts appear. */
const REFRESH_MS = 700;

/** The composer's affordance row. Mocked, per the brief. */
const COMPOSER_TOOLS: { icon: LucideIcon; key: keyof typeof copy.composer }[] =
  [
    { icon: ImageIcon, key: "attach" },
    { icon: ListPlus, key: "poll" },
    { icon: Smile, key: "emoji" },
    { icon: CalendarClock, key: "schedule" },
    { icon: MapPin, key: "location" },
    { icon: Coins, key: "pay" },
  ];

/** Every topic that has posts behind it, for the `+` menu. */
function allTopics(): string[] {
  const seen = new Set<string>();
  for (const post of [...timelinePosts, ...incomingPosts]) {
    if (post.topic) seen.add(post.topic);
  }
  return [...seen].sort();
}

function Composer({ me }: { me: MessagePerson }): ReactNode {
  const [draft, setDraft] = useState("");
  /* The same `@` and `/` lists the Messages composer offers. A handle that
     completes in a DM and not in a post would be a handle the reader has to
     remember two rules about. */
  const {
    ref: fieldRef,
    popover,
    onChange: onTokenChange,
    onKeyDown: onTokenKeyDown,
    onSelect: onTokenSelect,
  } = useComposerTokens({ draft, setDraft });

  return (
    <div className="border-border/60 hover:bg-surface-hover flex gap-3 border-b px-4 py-3 transition-colors">
      <MemberAvatar person={me} size={40} />
      <div className="min-w-0 flex-1">
        {/* `relative` round the field alone, so the list hangs off the text it
            is completing rather than off the bottom of the tool row. */}
        <div className="relative">
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
            placeholder={copy.composer.placeholder}
            aria-label={copy.composer.placeholder}
            rows={draft ? 3 : 1}
            className="placeholder:text-muted-foreground w-full resize-none bg-transparent py-1.5 text-base outline-none"
          />
        </div>
        <div className="mt-1 flex items-center gap-0.5">
          {COMPOSER_TOOLS.map(({ icon: Icon, key }) => (
            <Tooltip key={key} label={copy.composer[key]}>
              <button
                type="button"
                aria-label={copy.composer[key]}
                className="focus-ring text-accent hover:bg-accent/10 rounded-full p-1.5 transition-colors"
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </button>
            </Tooltip>
          ))}
          <button
            type="button"
            disabled={draft.trim() === ""}
            className="focus-ring bg-accent text-accent-foreground ml-auto rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {copy.composer.post}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The tab row: four strips, any pinned topics, then `+`. */
function StripTabs(): ReactNode {
  const { strip, topic, pinned } = useTimeline();
  /* The trigger's rect, captured on click — PopoverMenu takes a rect rather
     than a ref so it never has to measure in an effect. */
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const unpinned = allTopics().filter((name) => !pinned.includes(name));

  return (
    <TabRow
      /* `rounded-tr-xl` to match the canvas: whenever the rail is away this
         row is the canvas's top edge, and its background would otherwise fill
         the rounded corner square. */
      className="border-border/60 bg-surface/80 sticky top-0 z-20 rounded-tr-xl border-b backdrop-blur"
      fade="from-surface"
      action={
        <>
          {/*
            The contextual column, on a phone.

            Saved, Lists, Muted, the ecosystems and the topics live in a panel
            that is `hidden md:block` two components up, so below that width
            the feed had no way to be aimed. Here rather than in the browse bar
            at the bottom because it narrows THIS list, and it sits in the row
            the list is already labelled by.
          */}
          <button
            type="button"
            onClick={openNav}
            aria-label={content.timeline.title}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 px-3 md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) =>
              setAnchor(event.currentTarget.getBoundingClientRect())
            }
            aria-label={copy.pin}
            /* `rounded-tr-xl` to match the canvas it sits in. Whenever the rail
               is away — under 768px, where it does not render — this button is
               the canvas's top-right corner, and a square hover fill in a
               rounded corner is the one place a 12px radius is visible. */
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-tr-xl px-3"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <PopoverMenu
            open={anchor !== null}
            onClose={() => setAnchor(null)}
            {...(anchor ? { anchor } : {})}
            label={copy.pin}
            width={240}
          >
            {unpinned.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-xs">
                {copy.pinNone}
              </p>
            ) : (
              unpinned.map((name) => (
                <MenuItem
                  key={name}
                  icon={Hash}
                  label={name}
                  onClick={() => {
                    pinTopic(name);
                    setAnchor(null);
                  }}
                />
              ))
            )}
          </PopoverMenu>
        </>
      }
    >
      {STRIPS.map((name) => (
        <Tooltip key={name} label={copy.stripHints[name]}>
          <Tab
            group="timeline"
            label={copy.strips[name]}
            active={strip === name && topic === null}
            onClick={() => selectStrip(name)}
          />
        </Tooltip>
      ))}
      {pinned.map((name) => (
        <Tab
          key={name}
          group="timeline"
          label={name}
          active={topic === name}
          onClick={() => selectTopic(name)}
        />
      ))}
    </TabRow>
  );
}

/**
 * One row of the Activity strip, flattened.
 *
 * The strip has two sources with different shapes — the fixtures, which are
 * app events dated in minutes-ago, and your own follows, which are Timeline
 * events dated with a real clock. Normalising here rather than widening
 * ActivityItem keeps the fixture honest about being a fixture, and leaves the
 * row with one shape to render instead of a branch per source.
 */
interface ActivityRowData {
  id: string;
  /** the app it came from, or null when the Timeline itself did it */
  app: AppSlug | null;
  ago: number;
  text: string;
  personId?: string;
  amount?: number;
}

/** One row of the Activity strip. */
function ActivityRow({ row }: { row: ActivityRowData }): ReactNode {
  const app = row.app ? getHubApp(row.app) : undefined;
  const person = row.personId ? getMessagePerson(row.personId) : undefined;

  return (
    <div className="hover:bg-surface-hover border-border/60 flex items-start gap-3 border-b px-4 py-3 transition-colors">
      {/* The app's own tile, so a row is identifiable before it is read — this
          strip is scanned by app far more often than it is read by sentence.
          The Timeline has no store entry to take a tile from, so it wears the
          Nexus mark: these are the shell's own events, not a mod's. */}
      {app ? (
        <AppTile app={app} size={36} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/Nexus-logo-solid-BG2.png"
          alt=""
          aria-hidden="true"
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-[22%]"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {app?.name ?? content.timeline.events.app}
        </p>
        <p className="text-sm">
          {row.text}
          {person ? (
            <ProfileHovercard person={person} label={person.name}>
              <span className="ml-1 font-semibold hover:underline">
                {person.name}
              </span>
            </ProfileHovercard>
          ) : null}
          {row.amount ? (
            <span className="text-accent ml-1 font-semibold">
              {satsLabel(row.amount)}
            </span>
          ) : null}
        </p>
      </div>
      <span className="text-muted-foreground shrink-0 text-xs">
        {agoLabel(row.ago)}
      </span>
    </div>
  );
}

export function TimelineFeed(): ReactNode {
  const {
    strip,
    topic,
    author,
    focus,
    follows,
    events,
    notInterested,
    muted,
    blocked,
    ecosystem,
    activityApps,
    activityRange,
  } = useTimeline();
  const { installedApps, activeSpaceId } = useHub();
  const profiles = useProfiles();
  const me = profileFor(profiles, activeSpaceId);
  const scroller = useRef<HTMLDivElement>(null);

  /* Posts that have landed since the page opened, newest first. Kept separate
     from the fixtures so "how many are waiting" is a length, not a diff. */
  const [arrived, setArrived] = useState<TimelinePost[]>([]);
  const [shown, setShown] = useState<TimelinePost[]>([]);
  /* The Activity strip's own pair. Ids rather than rows on the shown side:
     the rows are rebuilt every tick as their ages change, so holding objects
     would compare stale copies against fresh ones. */
  const [arrivedActivity, setArrivedActivity] = useState<
    { id: string; at: number }[]
  >([]);
  const [shownActivity, setShownActivity] = useState<string[]>([]);
  const [pull, setPull] = useState(0);
  /* The window the dots live in. See `refresh` below for why it exists. */
  const [refreshing, setRefreshing] = useState(false);
  /*
   * The clock the Activity strip ages your own events against.
   *
   * In state rather than read at render, because `Date.now()` during render is
   * impure — two renders in the same paint could disagree about what "now" is.
   *
   * Starts at 0 and is first written by the interval below rather than on
   * mount, which keeps the effect free of a synchronous setState. Zero is not a
   * placeholder that has to be handled: it dates every event you could have
   * made as "now", and until the first tick that is exactly what they are.
   */
  const [now, setNow] = useState(0);

  /*
   * The feed filling up behind you, and the clock moving with it.
   *
   * One interval for the whole strip rather than a timeout per post: the pool
   * is finite, and five nested timeouts that each schedule the next one is five
   * things to clear on unmount instead of one. The clock rides along because it
   * wants exactly the same cadence — a second interval to move a minutes-ago
   * label would be a second thing to clear for no extra accuracy.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setArrived((current) => {
        const next = incomingPosts[current.length];
        if (!next) return current;
        if (Math.random() > ARRIVAL_CHANCE) return current;
        return [...current, next];
      });
      /* Its own roll, so the two strips do not fill in lockstep — an app event
         landing at the same instant as every post would read as one system
         event rather than a day going on around you. */
      setArrivedActivity((current) => {
        const next = incomingActivity[current.length];
        if (!next) return current;
        if (Math.random() > ARRIVAL_CHANCE) return current;
        return [...current, { id: next.id, at: Date.now() }];
      });
    }, ARRIVAL_TICK);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = arrived.filter(
    (post) => !shown.some((seen) => seen.id === post.id)
  );

  /*
   * Show what has arrived.
   *
   * The pull path goes through a brief refreshing window first, which is what
   * the dots occupy. There is nothing to wait for — the posts are already
   * here — but a pull that snaps back with the rows silently swapped reads as
   * the gesture having failed and gets repeated. The pause is the gesture being
   * acknowledged, not a fake network call: it is the same length whether one
   * post landed or five.
   */
  function reveal(): void {
    setShown(arrived);
    setPull(0);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* No refreshing window: the pull gesture is the feed's, and the bar on
     Activity is a click that has nothing to acknowledge. */
  function revealActivity(): void {
    setShownActivity(arrivedActivity.map((item) => item.id));
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refresh(): void {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      reveal();
    }, REFRESH_MS);
  }

  /*
   * Pull to refresh, on a wheel as well as a finger.
   *
   * Only while the scroller is already at the top and only on upward content
   * movement, so a fast scroll back up does not fire it the instant it lands.
   * Touch is handled by the same state via onTouchMove below.
   */
  function onWheel(event: WheelEvent<HTMLDivElement>): void {
    const node = scroller.current;
    if (!node || node.scrollTop > 0 || event.deltaY >= 0) {
      if (pull !== 0) setPull(0);
      return;
    }
    setPull((current) => Math.min(PULL_MAX, current - event.deltaY * 0.6));
  }

  function releasePull(): void {
    if (pull >= PULL_TRIGGER && waiting.length > 0) {
      refresh();
      return;
    }
    setPull(0);
  }

  const touchStart = useRef<number | null>(null);

  const posts = useMemo(() => {
    /*
     * The pool, plus whatever this profile has posted.
     *
     * Merged rather than kept in a separate strip, because your own posts are
     * part of your timeline — a feed that hid what you just said would be the
     * first thing anybody noticed about it.
     */
    const mine = profilePosts[me.id] ?? [];
    /*
     * Everything the overflow menu took out, taken out once.
     *
     * Before the strips rather than inside each of them: a post you said you
     * did not want to see is not a property of For you, and filtering per strip
     * would mean four places to forget it.
     */
    const all = [...shown, ...mine, ...timelinePosts].filter(
      (post) =>
        !notInterested.includes(post.id) &&
        !muted.includes(post.authorId) &&
        !blocked.includes(post.authorId) &&
        /* Whose namespace answers for the author's handle. Applied to the pool
           rather than inside each strip, so every path below it — an author
           page, a topic, Posts — is narrowed by it for free. */
        (ecosystem === null ||
          getMessagePerson(post.authorId)?.ecosystem === ecosystem)
    );
    const feed = profileFeeds[me.id];
    /*
     * The author filter wins over the strip.
     *
     * It is the narrower question and the one most recently asked — picking a
     * name out of search and then seeing it re-ranked by For you would be the
     * feed answering something else. It still composes with a topic, which is
     * the one combination worth having: this person, on this subject.
     */
    if (author) {
      const theirs = all.filter((post) => post.authorId === author);
      return topic ? theirs.filter((post) => post.topic === topic) : theirs;
    }
    if (topic) return all.filter((post) => post.topic === topic);
    /*
     * An ecosystem outranks the ranked strip, the way a topic does.
     *
     * `all` is already narrowed to it, so this is really "stop here". Without
     * the early return, For you would intersect the ecosystem with a hand-
     * written list of promoted ids and usually come back empty — a filter that
     * says "2" in the sidebar and then shows nothing.
     */
    if (ecosystem) return all;
    if (strip === "posts") return all.filter((post) => post.authorId === me.id);
    /*
     * Which shared posts reach this profile is decided per profile.
     *
     * An overlay engineer's ranked strip is about the network and a designer's
     * is about what people see; a switcher that put the same column under a
     * different name would be a rename button. A profile with no feed written
     * for it — one you just created — gets its own posts and nothing else,
     * which is what a new persona actually has.
     */
    if (strip === "following") {
      const listed = new Set(feed?.following ?? []);
      return all.filter(
        (post) =>
          post.authorId === me.id ||
          listed.has(post.id) ||
          follows.includes(post.authorId)
      );
    }
    const ranked = new Set(feed?.forYou ?? []);
    return all.filter((post) => post.authorId === me.id || ranked.has(post.id));
  }, [
    shown,
    strip,
    topic,
    author,
    follows,
    me.id,
    notInterested,
    muted,
    blocked,
    ecosystem,
  ]);

  /*
   * The Activity strip: your own actions, then the apps'.
   *
   * Merged and sorted by age rather than concatenated, so a follow from four
   * minutes ago sits below a payment from two — a log that put everything you
   * did in a block at the top would be two lists sharing a scrollbar.
   *
   * Only the Timeline's own events are dated absolutely; the fixtures are
   * already minutes-ago, and are the ones the connection filter applies to —
   * the Timeline is never disconnected, so filtering its rows by
   * `installedApps` would drop every one of them.
   */
  const activity = useMemo((): ActivityRowData[] => {
    const mine: ActivityRowData[] =
      /* The Timeline is not in `installedApps` — it is the canvas, not a mod —
         so the app filter names it with its own sentinel. Empty still means
         everything, here as everywhere. */
      (
        activityApps.length === 0 || activityApps.includes(TIMELINE_SLUG)
          ? events
          : []
      ).map((event) => ({
        id: event.id,
        app: null,
        ago: Math.max(0, Math.round((now - event.at) / 60_000)),
        text: content.timeline.events[event.kind],
        personId: event.personId,
      }));
    /* Landed this session, aged against the same clock as your own actions.
       Kept out of the fixture list rather than spliced into it, so "how many
       are waiting" stays a length. */
    const landed: ActivityRowData[] = arrivedActivity.flatMap((item) => {
      const fixture = incomingActivity.find((entry) => entry.id === item.id);
      if (!fixture) return [];
      if (!installedApps.includes(fixture.app)) return [];
      if (activityApps.length > 0 && !activityApps.includes(fixture.app)) {
        return [];
      }
      return [
        {
          id: fixture.id,
          app: fixture.app,
          ago: Math.max(0, Math.round((now - item.at) / 60_000)),
          text: fixture.text,
          ...(fixture.personId ? { personId: fixture.personId } : {}),
          ...(fixture.amount ? { amount: fixture.amount } : {}),
        },
      ];
    });
    const theirs: ActivityRowData[] = timelineActivity
      .filter(
        (item) =>
          installedApps.includes(item.app) &&
          /* Empty means every connected app — see the store. */
          (activityApps.length === 0 || activityApps.includes(item.app))
      )
      .map((item) => ({
        id: item.id,
        app: item.app,
        ago: item.ago,
        text: item.text,
        ...(item.personId ? { personId: item.personId } : {}),
        ...(item.amount ? { amount: item.amount } : {}),
      }));
    /* The window applies to both halves: your own actions are dated by the
       same clock as the apps' events once they are rows. */
    const within = RANGE_MINUTES[activityRange];
    return [...mine, ...landed, ...theirs]
      .filter((row) => row.ago <= within)
      .sort((a, b) => a.ago - b.ago);
  }, [
    events,
    installedApps,
    now,
    activityApps,
    activityRange,
    arrivedActivity,
  ]);

  /*
   * App events that have landed since you last looked, and the ones on screen.
   *
   * Only the apps' half queues. Your own like or reply appears at once, because
   * you just did it — making somebody click "show" to see their own action reads
   * as the app not having registered it. The bar is for things that happened
   * without you.
   */
  const waitingActivity = arrivedActivity.filter(
    (item) => !shownActivity.some((seen) => seen === item.id)
  );

  const activityRows = activity.filter(
    (row) =>
      !arrivedActivity.some((item) => item.id === row.id) ||
      shownActivity.includes(row.id)
  );

  /* An author filter outranks the Activity tab: Activity is not a list of
     posts, so "this person's activity" is a question this strip cannot answer
     and the filter would silently do nothing. */
  const showActivity = strip === "activity" && topic === null && !author;
  const emptyLine =
    topic || author
      ? copy.topicEmpty
      : copy.empty[showActivity ? "activity" : strip];
  const filteredBy = author ? getMessagePerson(author) : undefined;

  /*
   * Take the reader to the post search sent them to.
   *
   * By id off the scroller rather than by index, because the list it lands in
   * is filtered — the post's position is not knowable from anything the palette
   * had. Cleared immediately after: `focus` is an instruction, and one that
   * stayed set would re-scroll the column on every unrelated re-render.
   */
  useEffect(() => {
    if (!focus) return;
    const node = scroller.current?.querySelector(`[data-post="${focus}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    clearFocus();
  }, [focus, posts]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StripTabs />

      <div
        ref={scroller}
        onWheel={onWheel}
        onMouseUp={releasePull}
        onMouseLeave={releasePull}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current =
            touch && scroller.current?.scrollTop === 0 ? touch.clientY : null;
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touchStart.current === null || !touch) return;
          const delta = touch.clientY - touchStart.current;
          if (delta > 0) setPull(Math.min(PULL_MAX, delta * 0.5));
        }}
        onTouchEnd={() => {
          touchStart.current = null;
          releasePull();
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {/*
          The pull gap. Height only — nothing inside it moves, so the rows below
          travel as one sheet rather than sliding against a label.

          It holds itself open at the trigger height while refreshing, because
          the dots need somewhere to be: collapsing the gap on release and then
          animating in the space where it used to be is two motions arguing.
        */}
        <div
          style={{ height: refreshing ? PULL_TRIGGER : pull }}
          className="grid place-items-center overflow-hidden transition-[height] duration-200"
        >
          {/*
            The gesture, said in dots rather than in words.

            One arrives for each third of the pull, so the third landing IS the
            signal that letting go will do something — the caption that used to
            say so was a sentence explaining a thing the motion could state on
            its own. They sit still while they are being gathered and start
            jumping when the work does, which is the only moment there is
            anything to wait for.
          */}
          {refreshing || pull > 8 ? (
            <JumpingDots
              className={
                refreshing || pull >= PULL_TRIGGER
                  ? "text-accent"
                  : "text-muted-foreground"
              }
              label={copy.pullToRefresh}
              count={refreshing ? 3 : Math.ceil((pull / PULL_TRIGGER) * 3)}
              jumping={refreshing}
            />
          ) : null}
        </div>

        {/*
          What the column has been narrowed to, and the way out of it.

          Above the composer rather than in the tab row: the tabs are a fixed
          set of four and a fifth that appears and disappears would move the
          other four under the reader's cursor. This is a state the feed is in,
          so it says so at the top of the feed.
        */}
        {filteredBy ? (
          <div className="border-border/60 bg-surface-raised/50 flex items-center gap-2 border-b px-4 py-2.5">
            <MemberAvatar person={filteredBy} size={20} radius={6} />
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="text-muted-foreground">
                {content.timeline.search.byline}{" "}
              </span>
              <span className="font-semibold">{filteredBy.name}</span>
            </p>
            <button
              type="button"
              onClick={() => selectAuthor(null)}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium"
            >
              {content.timeline.search.clear}
            </button>
          </div>
        ) : null}

        {showActivity ? <ActivityBar /> : <Composer me={me} />}

        {/*
          What has landed while you were reading, as a row of the list.

          Its own row under the composer rather than a pill floating over the
          column: a notice that overlaps the first post is covering the thing it
          is talking about, and it sat at a fixed offset that the composer's
          height — which grows as you type — could push out from under it. In
          the flow it is always exactly between what you are writing and what
          everyone else wrote.
        */}
        <AnimatePresence initial={false}>
          {(showActivity ? waitingActivity.length : waiting.length) > 0 ? (
            <motion.button
              type="button"
              onClick={showActivity ? revealActivity : refresh}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="focus-ring text-accent hover:bg-surface-hover border-border/60 flex w-full items-center justify-center gap-1.5 overflow-hidden border-b text-sm font-semibold transition-colors"
            >
              <span className="flex items-center gap-1.5 py-2.5">
                <ArrowUp className="size-3.5" aria-hidden="true" />
                {showActivity
                  ? activityLabel(waitingActivity.length)
                  : refreshLabel(waiting.length)}
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {showActivity ? (
          activityRows.length === 0 ? (
            <Empty line={emptyLine} />
          ) : (
            activityRows.map((row) => <ActivityRow key={row.id} row={row} />)
          )
        ) : posts.length === 0 ? (
          <Empty line={emptyLine} />
        ) : (
          posts.map((post) => <PostRow key={post.id} post={post} />)
        )}

        {/*
          What the rail carries, at the end of the reading.

          The right-hand column does not render below `md`, so Nexus Sync, who
          is on air and who to follow were three things a phone could not see
          at all. Not in the nav sheet with the filters: those are things you
          go looking for and these are things to notice, and the place you
          notice something is where you stopped scrolling. `md:hidden` lives
          inside the component, so the column never renders twice.
        */}
        <TimelineRail asCards />
      </div>
    </div>
  );
}

function Empty({ line }: { line: string }): ReactNode {
  return (
    <p className="text-muted-foreground px-6 py-16 text-center text-sm">
      {line}
    </p>
  );
}
