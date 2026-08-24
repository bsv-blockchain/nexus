"use client";

/**
 * The cards beside the App Store: the setups, then the sources.
 *
 * The setups are the first run's five, in the same clothes — the preset's clip
 * behind its name. Somebody who picked Maker on the welcome screen should find
 * a card here that looks like the one they tapped and is already switched on,
 * because it is the same choice; see lib/presets-store, which both read.
 *
 * Below them, the sources worth featuring, wearing their own banner. Those are
 * repositories rather than setups, so their switch adds and removes a catalogue
 * and installs nothing.
 *
 * Either way a card does two things, and they are two controls rather than one:
 *
 *   - tapping it scopes the store to what that card holds, so you can read what
 *     is in one before committing to it
 *   - the switch turns the thing on or off
 *
 * Two geometries, one component each way round: a column on a desktop, where
 * the panel beside the rail is 288px of vertical room, and a scrolling row
 * above the store on a phone, where there is no panel at all.
 *
 * @see lib/data/collections.ts — the cards, built from the presets and the repos
 * @see components/hub/use-apply-presets.ts — what a setup's switch actually does
 */

import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub } from "@/components/hub/hub-provider";
import { RepositoriesButton } from "@/components/hub/repositories-button";
import {
  content,
  getAppCollections,
  getCollectionAppSlugs,
  getHubApp,
  type AppCollection,
  type AppRepository,
} from "@/lib/data";
import { isPresetCollection } from "@/lib/data/collections";
import { useReducedMotion } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useChosenPresets } from "@/lib/presets-store";
import {
  getRepositoriesSnapshot,
  setRepositories,
  useRepositories,
} from "@/lib/repositories-store";
import {
  Briefcase,
  ChevronDown,
  Code2,
  Globe,
  Lock,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export const collectionIcons: Record<string, LucideIcon> = {
  Sparkles,
  Globe,
  Star,
  ShoppingBag,
  Briefcase,
  Palette,
  Code2,
};

const copy = content.appStore;

/** How long one plate of Essentials' sequence is held, in milliseconds. */
const PLATE_MS = 1400;

/**
 * The clip behind a card, and the frame it rests on.
 *
 * At rest this is a still. It plays only while the pointer is on the card, and
 * the card seeks it back to the frame the still was cut from on the way out, so
 * a card looks the same before and after being hovered.
 *
 * A deliberate change from the welcome screen, where all four play at once
 * because they are the screen. Here they sit beside a page somebody came to
 * read, and five clips looping in a sidebar is a laptop fan running for
 * decoration. `preload="none"` follows: the poster is a 20kb JPEG and the clip
 * is not fetched at all until somebody shows interest in it.
 *
 * The handlers are on the card rather than here — see `Card`. Everything in
 * this button is an absolutely positioned sibling stacked over the video, so
 * the pointer is never over the video's own subtree and a `pointerenter` on it
 * would never fire.
 *
 * `object-position` is per card, because the slot is a fifth of a portrait
 * frame and the subject sits at a different height in each — see `focus` in
 * lib/data/collections.ts.
 *
 * `playsInline` and `muted` are not decoration: without both, iOS refuses to
 * play inline and hands back a fullscreen player.
 */
function CardArt({
  collection,
  videoRef,
  hovered,
}: {
  collection: AppCollection;
  videoRef: RefObject<HTMLVideoElement | null>;
  hovered: boolean;
}): ReactNode {
  const position = `50% ${Math.round((collection.focus ?? 0.35) * 100)}%`;

  if (collection.stills) {
    return (
      <Sequence
        stills={collection.stills}
        position={position}
        running={hovered}
      />
    );
  }

  if (!collection.video) {
    return collection.poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={collection.poster}
        alt=""
        aria-hidden="true"
        style={{ objectPosition: position }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : null;
  }

  return (
    <video
      ref={videoRef}
      src={collection.video}
      {...(collection.poster ? { poster: collection.poster } : {})}
      loop
      muted
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
      style={{ objectPosition: position }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/**
 * Essentials' art: the welcome's opening plates, fading one into the next.
 *
 * A stand-in for the clip the other four have, and not an arbitrary one — these
 * are the paintings that flicker behind the logo on the way in, so the card
 * standing for "what Nexus is" wears what Nexus opened with.
 *
 * Only the plates the sequence has actually reached are mounted, so a column
 * nobody hovers costs one image rather than eight. The timer runs only while
 * the pointer is there.
 */
function Sequence({
  stills,
  position,
  running,
}: {
  stills: string[];
  position: string;
  running: boolean;
}): ReactNode {
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(1);

  useEffect(() => {
    if (!running) return;
    /*
     * The position is a local, not a read of state.
     *
     * It used to advance inside a `setIndex` updater and set `reached` from in
     * there too. Updaters have to be pure and React is free to run them more
     * than once, which it does in development — so the sequence stepped two
     * plates per tick and had mounted all eight within a couple of seconds.
     * One timer, one place the number changes.
     */
    let at = 0;
    const timer = setInterval(() => {
      at = (at + 1) % stills.length;
      setIndex(at);
      setReached((seen) => Math.max(seen, at + 1));
    }, PLATE_MS);
    return () => clearInterval(timer);
  }, [running, stills.length]);

  /* Back to the first on the way out, after the fade has had time to land, so
     the card rests on the plate it started on rather than on wherever the
     sequence had got to. */
  useEffect(() => {
    if (running) return;
    const timer = setTimeout(() => setIndex(0), 240);
    return () => clearTimeout(timer);
  }, [running]);

  return (
    <>
      {stills.slice(0, Math.max(1, reached)).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          style={{ objectPosition: position }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}

/** The switch, in the shape every other switch in the app wears. */
function Switch({
  on,
  disabled = false,
}: {
  on: boolean;
  disabled?: boolean;
}): ReactNode {
  return (
    <span
      className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors ${
        on ? "bg-accent" : "bg-black/45 ring-1 ring-white/40"
      } ${disabled ? "opacity-60" : ""}`}
      aria-hidden="true"
    >
      <span
        className={`size-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function Card({
  collection,
  className = "",
}: {
  collection: AppCollection;
  className?: string;
}): ReactNode {
  const {
    isInstalled,
    appsCollection,
    setAppsCollection,
    openCollectionPrompt,
  } = useHub();
  const chosen = useChosenPresets();
  const repositories = useRepositories();
  const reduced = useReducedMotion();
  const clip = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const preset = isPresetCollection(collection.id);
  const isSource = collection.kind === "repository";
  const slugs = getCollectionAppSlugs(collection.id);
  const scoped = appsCollection === collection.id;
  const locked = collection.locked === true;
  /*
   * The apps themselves, for the hover.
   *
   * The card can only afford a count at rest, and a count is the one thing
   * about a setup nobody needs — "4 apps" is true of three of these. Short
   * names, because the column is 288px wide and "Connected Apps" spends a line
   * on a word the rail does not use either.
   */
  const names = slugs
    .map((slug) => getHubApp(slug)?.shortName ?? getHubApp(slug)?.name ?? slug)
    .join(", ");

  /*
   * On means "this thing is applied", which is a different question per kind.
   *
   * For a preset it is the answer the install was set up with rather than a
   * count of connected apps: reading it off the apps would light Maker as soon
   * as somebody connected its three by hand, and leave it dark if they
   * disconnected one — neither of which is what the switch does when pressed.
   * For a source it is simply whether the source is switched on; nothing is
   * installed either way.
   */
  const on = isSource
    ? (repositories.find((repo) => repo.id === collection.id)?.enabled ?? false)
    : preset
      ? chosen.includes(preset)
      : slugs.length > 0 && slugs.every((slug) => isInstalled(slug));

  const toggle = (): void => {
    if (isSource) {
      /* Straight through. A catalogue grants nothing and installs nothing, so
         routing it past an approval sheet would be asking permission to read a
         list. Connecting an app from it still asks, which is where the question
         actually belongs. */
      setRepositories(
        getRepositoriesSnapshot().map((repo: AppRepository) =>
          repo.id === collection.id ? { ...repo, enabled: !on } : repo
        )
      );
      return;
    }
    openCollectionPrompt(collection.id, on ? "uninstall" : "install");
  };

  return (
    <div
      /*
       * The whole card is the hover target, including the corner the switch
       * sits in — the same region `group-hover` already lights, so what starts
       * the clip and what darkens the gradient are one gesture rather than two
       * that nearly agree.
       *
       * Nothing moves under reduced motion. `autoPlay` is what that setting is
       * about, and a clip that starts because you passed over it is the same
       * request by another name.
       */
      onPointerEnter={() => {
        setHovered(true);
        if (!reduced) void clip.current?.play().catch(() => {});
      }}
      onPointerLeave={() => {
        setHovered(false);
        const node = clip.current;
        if (!node) return;
        node.pause();
        /* Back to the frame the poster was cut from, so the card rests on the
           picture it started with rather than on wherever the clip happened to
           be when the pointer left. */
        if (collection.posterAt !== undefined) {
          node.currentTime = collection.posterAt;
        }
      }}
      className={`group relative shrink-0 overflow-hidden rounded-2xl ring-2 transition-shadow ${
        scoped ? "ring-accent" : "ring-transparent"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setAppsCollection(scoped ? "all" : collection.id)}
        aria-pressed={scoped}
        /* A source card carries its own wordmark and draws no name of its own,
           which would otherwise leave the button with nothing to be called. */
        {...(isSource ? { "aria-label": collection.name } : {})}
        className="focus-ring relative block h-24 w-full text-left"
      >
        <CardArt
          collection={collection}
          videoRef={clip}
          hovered={hovered && !reduced}
        />
        {/* No accent wash over the footage. The welcome screen grades each clip
            to its preset's hue because there it is one card filling the window
            and the colour IS the answer being offered. Five of them stacked in
            a 288px column is five saturated blocks arguing with each other, and
            with whatever theme the workspace is wearing. */}
        {/* Two shapes of shade, because the two kinds of card carry their words
            in different places. A setup writes its name across the left, so it
            darkens left to right. A source has its name printed across the
            middle of its own banner, so it darkens from the bottom instead and
            leaves the artwork to say what it is. Both deepen under the pointer,
            where a second line of app names arrives and has to be readable over
            whatever is behind it. */}
        <span
          aria-hidden="true"
          className={
            isSource
              ? "absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-colors group-focus-within:from-black/95 group-focus-within:via-black/45 group-hover:from-black/95 group-hover:via-black/45"
              : "absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20 transition-colors group-focus-within:from-black/90 group-focus-within:via-black/75 group-focus-within:to-black/55 group-hover:from-black/90 group-hover:via-black/75 group-hover:to-black/55"
          }
        />
        {/* Something for the switch to sit on.

            The gradients above leave the top-right corner as the brightest part
            of the card — and that is exactly where the switch is, so a white
            knob was landing on a bright frame of video. A pool of shade in the
            corner rather than a plate behind the control: it darkens what is
            already there instead of adding a second shape to look at. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.6),transparent_62%)]"
        />
        {isSource ? (
          /* No name: it is printed across the banner already, and a label over
             the top of it was two of the same words fighting each other. */
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white">
            <span className="line-clamp-1 text-[11px] leading-snug text-white/85 group-focus-within:hidden group-hover:hidden">
              {collection.note}
            </span>
            <span className="line-clamp-2 hidden text-[11px] leading-snug text-white/85 group-focus-within:block group-hover:block">
              {names || collection.note}
            </span>
          </span>
        ) : (
          <span className="absolute inset-y-0 left-0 flex max-w-[82%] items-center gap-2.5 p-3 text-white">
            {/* Whose setup this is. The three cards below carry somebody else's
                banner, so the ones that ship with the app say so — otherwise
                "Thinker" stands unattributed next to Handcash. The file is a
                fixed off-white and the words beside it are white, so it goes in
                as artwork rather than through the mask other surfaces use to
                ink it in a palette. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/Nexus-logo-white.svg"
              alt=""
              aria-hidden="true"
              className="size-8 shrink-0 opacity-90"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{collection.name}</span>
              {/* Count at rest, names under the pointer. Swapped rather than
                  stacked: the card is a fixed 96px and a third line would
                  either overflow it or shrink the name that identifies it. Two
                  lines at most, so a setup with seven apps trails off rather
                  than growing the card. */}
              <span className="text-[11px] leading-snug text-white/75 group-focus-within:hidden group-hover:hidden">
                {slugs.length} app{slugs.length === 1 ? "" : "s"}
              </span>
              <span className="line-clamp-2 hidden text-[11px] leading-snug text-white/85 group-focus-within:block group-hover:block">
                {names}
              </span>
            </span>
          </span>
        )}
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={locked}
        disabled={locked}
        aria-label={
          locked
            ? `${collection.name} is always on`
            : `${on ? copy.disableAll : copy.enableAll}: ${collection.name}`
        }
        onClick={locked ? undefined : toggle}
        className={`absolute top-3 right-3 rounded-full ${
          locked ? "cursor-not-allowed" : "focus-ring"
        }`}
      >
        {locked ? (
          <span
            className="grid size-6 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/40"
            aria-hidden="true"
          >
            <Lock className="size-3" />
          </span>
        ) : (
          <Switch on={on} />
        )}
      </button>
    </div>
  );
}

/**
 * Whether a card counts as on, for the tally a folded section shows.
 *
 * The same three questions `Card` asks, in one place, because a heading that
 * disagreed with the switches under it would be worse than no heading.
 */
function useActiveCount(cards: AppCollection[]): number {
  const { isInstalled } = useHub();
  const chosen = useChosenPresets();
  const repositories = useRepositories();

  return cards.filter((card) => {
    if (card.kind === "repository") {
      return repositories.find((repo) => repo.id === card.id)?.enabled ?? false;
    }
    if (card.locked) return true;
    const preset = isPresetCollection(card.id);
    if (preset) return chosen.includes(preset);
    const slugs = getCollectionAppSlugs(card.id);
    return slugs.length > 0 && slugs.every((slug) => isInstalled(slug));
  }).length;
}

/**
 * A run of cards under a heading that folds away.
 *
 * Folded, the heading still says how many of the section are on, which is the
 * one thing a reader wants from a section they have closed — a bare title would
 * make folding it a way to lose information rather than a way to save room.
 */
/* The cards arrive one after another rather than all at once: a fold that
   opens onto five finished cards reads as a jump cut, and 45ms of stagger is
   enough to make it read as the section unpacking itself. */
const CARD_LIST = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
};
const CARD_ITEM = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

function Section({
  title,
  cards,
  defaultOpen = true,
}: {
  title: string;
  cards: AppCollection[];
  defaultOpen?: boolean;
}): ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();
  const active = useActiveCount(cards);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="focus-ring hover:bg-surface-hover flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left"
      >
        <ChevronDown
          aria-hidden="true"
          className={`text-muted-foreground size-3.5 shrink-0 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          {copy.collectionsOn
            .replace("{on}", String(active))
            .replace("{total}", String(cards.length))}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="cards"
            className="mt-1.5 space-y-2 overflow-hidden"
            initial="hidden"
            animate="visible"
            exit="hidden"
            {...(reduced ? {} : { variants: CARD_LIST })}
          >
            {cards.map((collection) => (
              <motion.div
                key={collection.id}
                {...(reduced ? {} : { variants: CARD_ITEM })}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card collection={collection} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** The column beside the App Store, on a desktop. */
export function AppCollections(): ReactNode {
  const collections = getAppCollections();
  const setups = collections.filter((entry) => entry.kind !== "repository");
  const sources = collections.filter((entry) => entry.kind === "repository");

  return (
    <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
      {/* `p-1` is not decoration: the selected card wears a 2px ring that sits
          OUTSIDE its box, and an `overflow-y-auto` clips on both axes — so
          without room to spare the ring was sliced off along the top and left
          edges of the scroller. */}
      <div className="scrollbar-slim min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {/* The presets start folded. By the time anybody is in the store that
            question has been answered — on the welcome screen, on the way in —
            and the card that matters here is a source they have not seen. The
            count on the folded heading still says what was chosen. */}
        <Section title={copy.presetsTitle} cards={setups} defaultOpen={false} />
        <Section title={copy.sourcesTitle} cards={sources} />
      </div>

      {/* The same bar every other column ends in: whatever that column keeps
          down here on the left, help on the right. Apps keeps the repositories
          the store pulls its listings from. */}
      <AppHelpBar slug="store">
        <RepositoriesButton />
      </AppHelpBar>
    </div>
  );
}

/**
 * The same cards on a phone, as rows above the store.
 *
 * There is no column below the `md` breakpoint — the rail's panel is hidden
 * there — so without this the setups would simply not exist on a phone. A
 * horizontal scroller per section rather than a stack, because eight full-width
 * cards ahead of the search field is a screen you have to scroll past to reach
 * the thing you came for.
 */
export function CollectionRow(): ReactNode {
  const collections = getAppCollections();
  const groups: [string, AppCollection[]][] = [
    [copy.presetsTitle, collections.filter((e) => e.kind !== "repository")],
    [copy.sourcesTitle, collections.filter((e) => e.kind === "repository")],
  ];

  return (
    <div className="space-y-4 md:hidden">
      {groups.map(([title, cards]) => (
        <div key={title}>
          <h2 className="pb-2 text-sm font-semibold">{title}</h2>
          {/* Bled to the page edges so the row reads as scrollable — a card cut
              off by the screen says "there is more" in a way a tidy margin does
              not. `py-1` for the same reason the column has `p-1`: an overflow
              container clips the selected card's outside ring unless it is
              given the room. */}
          <div className="scrollbar-none -mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 py-1 sm:-mx-10 sm:px-10">
            {cards.map((collection) => (
              <Card
                key={collection.id}
                collection={collection}
                className="w-56 snap-start"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
