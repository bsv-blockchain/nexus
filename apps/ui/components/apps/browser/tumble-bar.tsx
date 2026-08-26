"use client";

/**
 * TumbleUpon: a button that takes you somewhere you did not know to look for.
 *
 * StumbleUpon's idea, aimed at a web where the interesting thing about a site
 * is that it can hold a wallet. Press Tumble! and the tab goes to a metanet app
 * you have not blocked — not a search result, not a recommendation from
 * something watching you, just the next one.
 *
 * It is a toolbar under the address bar rather than a panel or a page, because
 * that is the shape of the thing it replaces and because discovery has to be
 * one press away from whatever you are already reading. It costs the page 44
 * pixels, which is the honest price of a button that is always there.
 *
 * @see lib/tumbleupon-store.ts for what it remembers
 * @see lib/data/tumbleupon.ts for who is in it
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { Tooltip } from "@/components/hub/tooltip";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getMessagePeople,
  getTumbleCatalogue,
  getTumbleInbox,
  storeCategories,
  type HubApp,
  type MessagePerson,
  type StoreCategory,
} from "@/lib/data";
import { agoLabel } from "@/lib/timeline";
import {
  addCategory,
  blockApp,
  blockCategory,
  markInboxRead,
  recordSent,
  removeCategory,
  setQuery,
  toggleLike,
  useTumble,
} from "@/lib/tumbleupon-store";
import {
  ChevronDown,
  Inbox,
  Instagram,
  Send,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const copy = content.tumbleupon;

/** Breathing room between a menu's top edge and whatever is above it. */
const TOP_MARGIN = 8;

/**
 * Where the chrome stops and a menu may begin.
 *
 * The workspaces strip is the one thing above these menus that is not part of
 * the browser: it holds the window controls and the tabs you switch identity
 * with, and a filter list sliding under it looks like a rendering fault rather
 * than a long list. Measured rather than assumed, because its height is a CSS
 * variable somebody can change. Falls back to the window top, which is the
 * right answer on a build with no title bar at all.
 */
function ceilingY(): number {
  const bar = document.querySelector("[data-nexus-title-bar]");
  return bar ? bar.getBoundingClientRect().bottom : 0;
}

/**
 * Menus open upward, and only as far as the window lets them.
 *
 * Downward is where a dropdown belongs and is the one direction that cannot
 * work here: below this toolbar is the page, and a browsed page is a native
 * view painting above the whole document — a menu over it is a menu behind it.
 * The first attempt pushed the page down to make room, which worked and meant
 * the site jumped every time a filter took focus.
 *
 * Upward there is nothing but chrome — the address bar, the tabs, the title bar
 * — all ordinary DOM a menu can simply cover. What it must not do is run off
 * the top of the window, so its height is capped at the distance from its own
 * bottom edge to the top.
 *
 * Written straight onto the node in a ref callback rather than measured into
 * state, which is the pattern Tooltip already uses for the same kind of
 * correction: the measurement and the fix are both writes to the element that
 * just mounted, so there is no round-trip and no second render. Anchored on
 * `bottom` rather than height, so the cap is the same however long the list
 * inside gets.
 */
function capBelowTitleBar(node: HTMLElement | null): void {
  if (!node) return;
  const bottom = node.getBoundingClientRect().bottom;
  node.style.maxHeight = `${Math.max(0, Math.round(bottom - ceilingY() - TOP_MARGIN))}px`;
}

/* ------------------------------------------------------------------ pieces */

/** The bar's buttons, all one shape so the row reads as one control strip. */
function BarButton({
  onClick,
  children,
  tone = "quiet",
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "quiet" | "loud" | "active";
  label?: string;
}): ReactNode {
  const skin =
    tone === "loud"
      ? "bg-accent text-accent-foreground hover:opacity-90"
      : tone === "active"
        ? "bg-accent/15 text-foreground"
        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      {...(label ? { "aria-label": label } : {})}
      className={`focus-ring flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors ${skin}`}
    >
      {children}
    </button>
  );
}

/**
 * WhatsApp's mark, which lucide does not carry.
 *
 * Drawn rather than pulled from a brand pack: one glyph is not worth a
 * dependency, and a brand pack is a licence question nobody wants attached to
 * a share button.
 */
function WhatsAppMark({ className = "" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.91-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.25-4.36c0-4.54 3.7-8.23 8.23-8.23a8.18 8.18 0 0 1 5.81 2.42 8.16 8.16 0 0 1 2.41 5.82c-.01 4.54-3.7 8.23-8.23 8.23z" />
    </svg>
  );
}

/** X's mark, likewise. */
function XMark({ className = "" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.96 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ filter */

/**
 * What Tumble! is allowed to land on.
 *
 * One field doing two jobs, because they are the same question asked at two
 * grains: type a word and it narrows by name and description, or pick a
 * category and it becomes a chip you can take back off. Chips rather than a
 * second control — a filter you cannot see the whole of is a filter that
 * eventually surprises you.
 */
function FilterField({
  query,
  categories,
}: {
  query: string;
  categories: StoreCategory[];
}): ReactNode {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return storeCategories.filter(
      (category) =>
        !categories.includes(category.id) &&
        (!needle ||
          category.label.toLowerCase().includes(needle) ||
          category.description.toLowerCase().includes(needle)),
    );
  }, [query, categories]);

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <div className="border-border bg-surface focus-within:ring-accent/40 flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 focus-within:ring-2">
        {categories.map((id) => {
          const label =
            storeCategories.find((entry) => entry.id === id)?.label ?? id;
          return (
            <span
              key={id}
              className="bg-accent/15 flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[11px] font-semibold"
            >
              {label}
              <button
                type="button"
                onClick={() => removeCategory(id)}
                aria-label={`${copy.removeFilter} ${label}`}
                className="focus-ring hover:bg-surface-hover rounded-full p-0.5"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={categories.length === 0 ? copy.filterPlaceholder : ""}
          aria-label={copy.filterLabel}
          className="min-w-16 flex-1 bg-transparent text-xs outline-none"
        />
        {(query || categories.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              for (const id of categories) removeCategory(id);
            }}
            aria-label={copy.clearFilter}
            className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded-full p-0.5"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          ref={capBelowTitleBar}
          className="border-border bg-surface-raised absolute right-0 bottom-full left-0 z-30 mb-1 overflow-y-auto rounded-xl border p-1 shadow-2xl"
        >
          <p className="text-muted-foreground px-1.5 pt-1 pb-1.5 text-[10px] font-bold tracking-wide uppercase">
            {copy.filterCategories}
          </p>
          {/*
            Chips that wrap, not a row each.

            Opening upward leaves this menu about a hundred pixels, and twelve
            categories one to a line is a list you scroll through three at a
            time. As chips the whole shelf is visible at once, which is what
            makes it a picker rather than a queue — and they are the same shape
            the chosen ones take in the field below, so choosing one is
            visibly the same object moving.
          */}
          <div className="flex flex-wrap gap-1 px-1 pb-1">
            {suggestions.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  addCategory(category.id);
                  setQuery("");
                }}
                className="focus-ring border-border hover:bg-surface-hover hover:border-accent rounded-full border px-2 py-1 text-[11px] font-semibold"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- share */

/** Pick a handle, say a word, send the page. */
function SharePopover({
  app,
  onClose,
}: {
  app: HubApp | null;
  onClose: () => void;
}): ReactNode {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<MessagePerson | null>(null);
  const [note, setNote] = useState("");
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const people = useMemo(() => {
    const needle = search.trim().replace(/^@/, "").toLowerCase();
    if (!needle) return getMessagePeople().slice(0, 6);
    return getMessagePeople()
      .filter(
        (person) =>
          person.handle.toLowerCase().includes(needle) ||
          person.name.toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [search]);

  function send(): void {
    if (!picked) return;
    recordSent({
      toPersonId: picked.handle,
      appSlug: app?.slug ?? "",
      message: note.trim(),
    });
    toast.success(`${copy.sentTo} @${picked.handle}`);
    onClose();
  }

  return (
    <div
      ref={capBelowTitleBar}
      className="border-border bg-surface-raised absolute right-0 bottom-full z-40 mb-1.5 w-80 overflow-y-auto rounded-xl border p-3 shadow-2xl"
    >
      <p className="text-sm font-bold">{copy.shareTitle}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
        {app ? app.name : copy.sharePageFallback}
      </p>

      {picked ? (
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="focus-ring border-border hover:bg-surface-hover mt-2.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left"
        >
          <MemberAvatar person={picked} size={22} />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            @{picked.handle}
          </span>
          <X className="text-muted-foreground size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <>
          <input
            ref={field}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.sharePlaceholder}
            aria-label={copy.shareTo}
            className="focus-ring border-border bg-surface mt-2.5 w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
          />
          <div className="mt-1 max-h-40 overflow-y-auto">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setPicked(person)}
                className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
              >
                <MemberAvatar person={person} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">
                    @{person.handle}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {person.name}
                  </span>
                </span>
              </button>
            ))}
            {people.length === 0 && (
              <p className="text-muted-foreground px-2 py-3 text-center text-[11px]">
                {copy.shareNobody}
              </p>
            )}
          </div>
        </>
      )}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={copy.shareNote}
        rows={2}
        aria-label={copy.shareNote}
        className="focus-ring border-border bg-surface mt-2.5 w-full resize-none rounded-lg border px-2.5 py-2 text-xs outline-none"
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={!picked}
          className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {copy.send}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          {copy.cancel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- inbox */

/**
 * The row that opens under the bar: who sent what, and why.
 *
 * One message at a time, the way the original did it. A list would make this a
 * feed, and a feed is the thing a tumble button is an alternative to.
 */
function InboxRow({ onClose }: { onClose: () => void }): ReactNode {
  const { openLinkInBrowser, activeSpaceId } = useHub();
  const items = getTumbleInbox();
  const item = items[0];
  const person = getMessagePeople().find(
    (entry) => entry.handle === item?.fromPersonId,
  );
  /* The slug is a string in the fixture — an inbox item can name an app this
     build does not carry, and a lookup that returns nothing is the honest way
     to find that out. */
  const app = getTumbleCatalogue().find((entry) => entry.slug === item?.appSlug);

  if (!item || !person) {
    return (
      <div className="border-border/60 bg-surface flex items-center gap-3 border-b px-3 py-2">
        <p className="text-muted-foreground flex-1 text-xs">{copy.inboxEmpty}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeInbox}
          className="focus-ring text-muted-foreground hover:text-foreground rounded-md p-1"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-border/60 bg-surface flex items-start gap-2.5 border-b px-3 py-2">
      <MemberAvatar person={person} size={22} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-pretty">
        {/* The handle in full, ecosystem and all. This is somebody reaching you
            from outside your own contacts, and which Nexus they are on is part
            of who they are. */}
        <span className="inline-flex items-center font-mono font-semibold">
          {`@${person.handle}@`}
          <EcosystemMark
            ecosystem={person.ecosystem}
            size={12}
            className="mx-0.5"
          />
          nexus.free
        </span>{" "}
        <span className="text-muted-foreground">{copy.says}</span> {item.message}{" "}
        <span className="text-muted-foreground">
          · {agoLabel(item.minutesAgo)}
        </span>
      </p>
      {app?.web && (
        <button
          type="button"
          onClick={() => {
            markInboxRead(item.id);
            openLinkInBrowser(activeSpaceId, app.web!.url);
            onClose();
          }}
          className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold"
        >
          {copy.openIt.replace("{app}", app.name)}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={copy.closeInbox}
        className="focus-ring text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded-md p-1"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- bar */

/** The app the current tab is on, if it is one of ours. */
function appForUrl(url: string): HubApp | null {
  const host = (value: string): string => {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  const here = host(url);
  if (!here) return null;
  return (
    getTumbleCatalogue().find(
      (app) => app.web && host(app.web.url) === here,
    ) ?? null
  );
}

export function TumbleBar({
  url,
  onNavigate,
}: {
  url: string;
  /** replaces the current tab, which is what Tumble! is */
  onNavigate: (url: string) => void;
}): ReactNode {
  const tumble = useTumble();
  const { createTab } = useHub();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [dislikeOpen, setDislikeOpen] = useState(false);
  const here = appForUrl(url);
  const inbox = getTumbleInbox();
  const unread = inbox.filter(
    (item) => !item.read && !tumble.readInbox.includes(item.id),
  ).length;

  /**
   * What Tumble! is allowed to land on, after everything you have said.
   *
   * Blocked apps and categories come out, then the filter narrows what is
   * left. Falling back to the unfiltered catalogue when a filter matches
   * nothing is deliberate: a random button that does nothing looks broken, and
   * "there was nothing in Gaming" is better said by going somewhere and saying
   * so than by not moving.
   */
  const pool = useMemo(() => {
    const allowed = getTumbleCatalogue().filter(
      (app) =>
        !tumble.blockedApps.includes(app.slug) &&
        !app.categories.some((category) =>
          tumble.blockedCategories.includes(category),
        ),
    );
    const needle = tumble.query.trim().toLowerCase();
    const narrowed = allowed.filter((app) => {
      const byCategory =
        tumble.categories.length === 0 ||
        app.categories.some((category) => tumble.categories.includes(category));
      const byText =
        !needle ||
        app.name.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle) ||
        app.tagline.toLowerCase().includes(needle);
      return byCategory && byText;
    });
    return { narrowed, allowed };
  }, [tumble]);

  function doTumble(): void {
    const list = pool.narrowed.length > 0 ? pool.narrowed : pool.allowed;
    /* Never the one you are on: pressing a button that lands you where you
       already are is the button failing, however random it was. */
    const choices = list.filter((app) => app.slug !== here?.slug);
    const pick = (choices.length > 0 ? choices : list)[
      Math.floor(Math.random() * (choices.length > 0 ? choices.length : list.length))
    ];
    if (!pick?.web) {
      toast.info(copy.nothingToTumble);
      return;
    }
    if (pool.narrowed.length === 0) toast.info(copy.filterEmpty);
    onNavigate(pick.web.url);
  }

  const liked = here ? tumble.liked.includes(here.slug) : false;

  /* The three off-platform shares. Each one does the most a browser can
     honestly do: X takes a compose URL, and the other two have no web intent
     worth the name, so the message goes to the clipboard and the toast says
     where to put it. */
  function shareOut(where: "whatsapp" | "x" | "instagram"): void {
    const title = here?.name ?? copy.thisPage;
    const line = copy.shareLine.replace("{app}", title).replace("{url}", url);
    if (where === "x") {
      createTab(
        `https://x.com/intent/post?text=${encodeURIComponent(line)}`,
      );
      return;
    }
    void navigator.clipboard?.writeText(line);
    toast.success(
      where === "whatsapp" ? copy.copiedWhatsApp : copy.copiedInstagram,
    );
  }

  return (
    <div className="border-border/60 shrink-0 border-b">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <BarButton onClick={doTumble} tone="loud">
          <Shuffle className="size-3.5" aria-hidden="true" />
          {copy.tumble}
        </BarButton>

        <Tooltip label={copy.inboxTooltip}>
          <button
            type="button"
            onClick={() => setInboxOpen((open) => !open)}
            aria-label={copy.inboxTooltip}
            aria-expanded={inboxOpen}
            className={`focus-ring flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-colors ${
              inboxOpen
                ? "bg-accent/15 text-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Inbox className="size-3.5" aria-hidden="true" />
            {unread > 0 && (
              <span className="bg-accent text-accent-foreground grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold">
                {unread}
              </span>
            )}
          </button>
        </Tooltip>

        <span className="bg-border h-4 w-px shrink-0" aria-hidden="true" />

        <BarButton
          onClick={() => {
            if (!here) return;
            toggleLike(here.slug);
            toast.success(liked ? copy.unliked : copy.likedIt);
          }}
          tone={liked ? "active" : "quiet"}
        >
          <ThumbsUp className="size-3.5" aria-hidden="true" />
          {copy.like}
        </BarButton>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setDislikeOpen((open) => !open)}
            aria-label={copy.dislike}
            aria-expanded={dislikeOpen}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex h-7 items-center gap-0.5 rounded-full px-2 text-xs font-semibold"
          >
            <ThumbsDown className="size-3.5" aria-hidden="true" />
            <ChevronDown className="size-3" aria-hidden="true" />
          </button>
          {dislikeOpen && (
            <div
              ref={capBelowTitleBar}
              className="border-border bg-surface-raised absolute bottom-full left-0 z-40 mb-1 w-56 overflow-y-auto rounded-xl border p-1 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => {
                  setDislikeOpen(false);
                  if (!here) return;
                  blockApp(here.slug);
                  toast.success(copy.blockedApp.replace("{app}", here.name));
                  doTumble();
                }}
                disabled={!here}
                className="focus-ring hover:bg-surface-hover w-full rounded-lg px-2.5 py-2 text-left text-xs disabled:opacity-40"
              >
                {copy.notThisApp}
              </button>
              {here?.categories.map((category) => {
                const label =
                  storeCategories.find((entry) => entry.id === category)
                    ?.label ?? category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setDislikeOpen(false);
                      blockCategory(category);
                      toast.success(copy.blockedCategory.replace("{name}", label));
                      doTumble();
                    }}
                    className="focus-ring hover:bg-surface-hover w-full rounded-lg px-2.5 py-2 text-left text-xs"
                  >
                    <span className="block">{copy.notThisCategory}</span>
                    <span className="text-muted-foreground block text-[10px]">
                      {label}
                    </span>
                  </button>
                );
              })}
              {/* Neither button can do anything from a page the catalogue has
                  never heard of, and a menu of two greyed rows says less than
                  one sentence explaining why. */}
              {!here && (
                <p className="text-muted-foreground px-2.5 py-2 text-[11px] leading-relaxed text-pretty">
                  {copy.offCatalogue}
                </p>
              )}
            </div>
          )}
        </div>

        <span className="bg-border h-4 w-px shrink-0" aria-hidden="true" />

        {/* The three off-platform doors, in the order people reach for them. */}
        <Tooltip label={copy.shareWhatsApp}>
          <button
            type="button"
            onClick={() => shareOut("whatsapp")}
            aria-label={copy.shareWhatsApp}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <WhatsAppMark className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip label={copy.shareX}>
          <button
            type="button"
            onClick={() => shareOut("x")}
            aria-label={copy.shareX}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <XMark className="size-3" />
          </button>
        </Tooltip>
        <Tooltip label={copy.shareInstagram}>
          <button
            type="button"
            onClick={() => shareOut("instagram")}
            aria-label={copy.shareInstagram}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <Instagram className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>

        <span className="bg-border h-4 w-px shrink-0" aria-hidden="true" />

        <div className="relative shrink-0">
          <BarButton
            onClick={() => setShareOpen((open) => !open)}
            tone={shareOpen ? "active" : "quiet"}
          >
            <Send className="size-3.5" aria-hidden="true" />
            {copy.share}
          </BarButton>
          {shareOpen && (
            <SharePopover app={here} onClose={() => setShareOpen(false)} />
          )}
        </div>

        <FilterField query={tumble.query} categories={tumble.categories} />

        <BarButton
          onClick={() => createTab("nexus://tumbleupon")}
          tone="quiet"
        >
          <Users className="size-3.5" aria-hidden="true" />
          {copy.connections}
        </BarButton>

        {/*
          Whether anybody has written this one up.

          Full strength means BSV Radar has an entry and the icon opens it;
          half means it does not, and the icon says so rather than doing
          nothing quietly. Dimmed rather than hidden, because "no review exists"
          is a fact about a page worth knowing — an icon that vanished would
          leave you unsure whether you had looked.
        */}
        <Tooltip
          label={
            here?.bsvRadar
              ? copy.radarListed.replace("{app}", here.name)
              : copy.radarUnlisted
          }
        >
          <button
            type="button"
            disabled={!here?.bsvRadar}
            onClick={() => {
              if (here?.bsvRadar) {
                createTab(`https://bsvradar.com/apps/${here.bsvRadar}`);
              }
            }}
            aria-label={
              here?.bsvRadar
                ? copy.radarListed.replace("{app}", here.name)
                : copy.radarUnlisted
            }
            className={`focus-ring flex size-7 shrink-0 items-center justify-center rounded-full transition-opacity ${
              here?.bsvRadar
                ? "hover:bg-surface-hover"
                : "cursor-default opacity-50"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/app-icons/bsv-radar.png"
              alt=""
              className="size-4 rounded"
            />
          </button>
        </Tooltip>
      </div>

      {inboxOpen && <InboxRow onClose={() => setInboxOpen(false)} />}

    </div>
  );
}
