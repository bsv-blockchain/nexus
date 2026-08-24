"use client";

import { AppTile, SiteTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { GroupSettingsDialog } from "@/components/hub/group-settings-dialog";
import {
  useHub,
  type AppSlug,
  type LibraryTab,
  type RailEntry,
  type RailRef,
} from "@/components/hub/hub-provider";
import {
  content,
  getChatThreads,
  getHubApps,
  getEssentialAppSlugs,
  getMailMessages,
  getUnreadCount,
  type HubApp,
} from "@/lib/data";
import { refKey, sameRef } from "@/lib/rail/layout";
import { useSettings } from "@/lib/settings-store";
import { displayOrigin } from "@/lib/rail/origin";
import { sameUrl } from "@/lib/tabs";
import type { PinnedSite } from "@/lib/rail/sites";
import {
  Cog,
  Folder,
  FolderMinus,
  Gift,
  Globe,
  Layers,
  LayoutGrid,
  type LucideIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A drag carries the dragged slot's `refKey`, under a MIME type of our own so
 * a file or a link dragged in from outside the rail cannot read as a slot.
 */
const DRAG_MIME = "application/x-nexus-rail-ref";
const LONG_PRESS_MS = 500;
/**
 * Soft dark outer glow, a touch stronger at the bottom — inactive app tiles.
 *
 * A tile is a rounded square of artwork, so a drop-shadow reads as the tile
 * lifting off the rail. It does not read on a stroke glyph, where the same
 * filter traces every line of the drawing and comes out as a smudge — which is
 * why the chrome icons above the tiles do not take it.
 */
const ICON_GLOW =
  "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.22))_drop-shadow(0_3px_3px_rgba(0,0,0,0.32))]";

const systemTabs: {
  id: LibraryTab;
  label: string;
  icon: LucideIcon;
  desc: string;
}[] = [
  {
    id: "spaces",
    label: "Workspaces",
    icon: Layers,
    desc: "Switch between your workspaces. Each keeps its own browser tabs, balances and identities.",
  },
  {
    id: "apps",
    label: content.library.apps.title,
    icon: LayoutGrid,
    desc: "Browse, connect and manage the apps in your Nexus.",
  },
];

type Tip = { top: number; left: number; label: string; desc: string };
type GroupSettings = { id: string; name: string; color?: string | undefined };

/**
 * Slots with fresh activity — surfaced as a dot on the left of the rail.
 *
 * Keyed by `refKey` so the dot lookup is the same for both kinds of slot. Only
 * apps ever land in here: a pinned site is a website, and nothing in this
 * process knows whether it has news.
 */
function getUnreadRefs(): Set<string> {
  const unread = new Set<string>();
  const mark = (slug: AppSlug): void => {
    unread.add(refKey({ kind: "app", slug }));
  };
  if (getChatThreads().some((thread) => getUnreadCount(thread.id) > 0))
    mark("messages");
  if (getMailMessages().some((mail) => !mail.read)) mark("mail");
  return unread;
}

/**
 * What a slot needs to draw itself, whichever kind of ref it holds.
 *
 * The chrome around a tile — label, tooltip, drag, drop, highlight — is the
 * same for an app and for a site, so it is flattened here and the rendering
 * code below asks the kind exactly once, when it picks the tile.
 */
type Resolved =
  /* `label` is a node and `name` is not: the caption under a tile is the one
     place a name is drawn rather than read, and the tooltip, the aria-label and
     the remove button all want the plain string. See components/hub/app-name. */
  | { kind: "app"; label: ReactNode; name: string; desc: string; app: HubApp }
  | {
      kind: "site";
      label: ReactNode;
      name: string;
      desc: string;
      site: PinnedSite;
    };

/**
 * Look a ref up in what actually exists, or null.
 *
 * Null is routine, not a bug: a stored layout can name an app this build does
 * not carry, or a site another tab has just unpinned. The app half resolves
 * through the catalog rather than casting the slug into it, for the same
 * reason.
 */
function resolveRef(ref: RailRef, sites: PinnedSite[]): Resolved | null {
  if (ref.kind === "app") {
    const app = getHubApps().find((candidate) => candidate.slug === ref.slug);
    return app
      ? {
          kind: "app",
          label: <AppName app={app} short />,
          name: app.name,
          desc: app.description,
          app,
        }
      : null;
  }
  const site = sites.find((candidate) => candidate.id === ref.id);
  if (!site) return null;
  /* The listing behind a pinned URL, if the store has one. Connecting a web
     listing pins its URL, so from here on the rail holds a site and knows only
     a title — which is the plain string, and loses a publisher's wordmark on
     the way. Matched on the URL because that is the only thing the two halves
     share, exactly as SiteTile already matches the mark. */
  const listed = getHubApps().find(
    (app) => app.web && sameUrl(app.web.url, site.url),
  );
  return {
    kind: "site",
    label: listed ? <AppName app={listed} short /> : site.title,
    name: site.title,
    desc: displayOrigin(site.url),
    site,
  };
}

/** The one place the two kinds of slot draw differently. */
function RefTile({
  resolved,
  size,
  className = "",
}: {
  resolved: Resolved;
  size: number;
  className?: string;
}): ReactNode {
  return resolved.kind === "app" ? (
    <AppTile app={resolved.app} size={size} className={className} />
  ) : (
    <SiteTile site={resolved.site} size={size} className={className} />
  );
}

/**
 * `refKey`'s inverse, for reading a drop payload back.
 *
 * The key rather than JSON: it is the identity the rest of the rail already
 * uses. A payload that will not parse is ignored rather than guessed at.
 */
function decodeRefKey(key: string): RailRef | null {
  const separator = key.indexOf(":");
  if (separator === -1) return null;
  const kind = key.slice(0, separator);
  const rest = key.slice(separator + 1);
  if (!rest) return null;
  if (kind === "app") return { kind: "app", slug: rest };
  if (kind === "site") return { kind: "site", id: rest };
  return null;
}

function RailShell({
  label,
  active,
  onClick,
  children,
  compact = false,
  className = "",
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  compact?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent) => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`focus-ring group flex flex-col items-center rounded-xl text-[11px] font-medium transition-colors ${
        compact ? "size-13 justify-center" : "w-20 gap-1.5 px-1 py-2.5"
      } ${
        active
          ? "bg-surface-raised text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      } ${className}`}
    >
      {children}
      {!compact && <span className="max-w-full truncate">{label}</span>}
    </button>
  );
}

export function IconRail(): ReactNode {
  const {
    libraryTab,
    setLibraryTab,
    mainView,
    setMainView,
    railCollapsed,
    openSettings,
    activeRef,
    openApp,
    isInstalled,
    activeSpaceId,
    openLinkInBrowser,
    pinnedSites,
    railEntries,
    groupRefs,
    ungroupRef,
    reorderRailRef,
    openShare,
    uninstallApp,
    unpinSite,
  } = useHub();

  // A system tab is "active" when its view/panel is showing.
  const tabActive = (id: LibraryTab): boolean =>
    id === "spaces"
      ? mainView === "profiles"
      : id === "apps"
        ? mainView === "store"
        : libraryTab === "downloads";
  /*
   * Whether an app is the thing on screen at all.
   *
   * `activeRef` remembers the last app opened and keeps remembering it while
   * Workspaces, Apps, Settings or the Timeline have the canvas — which is right
   * for going back, and wrong for the rail: it lit Browse and Workspaces at the
   * same time, so two buttons claimed to be where you are. An app tile is
   * current only when an app is what you are looking at.
   */
  const canvasIsApp = mainView === "app";
  // Clicking a tab sets both the panel (libraryTab) and the main view.
  const openTabView = (id: LibraryTab): void => {
    setLibraryTab(id);
    if (id === "apps") setMainView("store");
    else if (id === "spaces") setMainView("profiles");
    else setMainView("app");
  };
  // Expanded: soft glow on inactive tiles. Collapsed: no glow, and inactive
  // icons go grayscale (restoring on hover).
  const tileTone = (isActive: boolean): string =>
    isActive
      ? ""
      : railCollapsed
        ? "grayscale transition duration-200 group-hover:grayscale-0"
        : ICON_GLOW;
  /*
   * The pinned block: Workspaces, then Browse when it is pinned, then Apps.
   *
   * Built here rather than at module scope because two of the three now depend
   * on state — whether Browse is pinned at all, and whether this workspace
   * still has it connected. Disconnecting Browse takes the button with it,
   * which is the point: the button is a place to reach the app, not a
   * replacement for having it.
   *
   * `systemTabs` still carries the two that map onto a LibraryTab; Browse is
   * not one of those — it opens an app rather than a panel — so it is added
   * here with its own opener instead of being forced into that union.
   */
  const settingsState = useSettings();
  const browsePinned = settingsState.browseAsButton && isInstalled("browser");
  const pinned = [
    /* Workspaces is opt-in — see `workspacesInRail` in lib/settings-store. The
       list of workspaces is in the column beside this rail whether or not the
       button is here, so switching it off takes away a door, not the room. */
    ...(settingsState.workspacesInRail
      ? [
          {
            ...systemTabs[0]!,
            active: tabActive("spaces"),
            open: () => openTabView("spaces"),
          },
        ]
      : []),
    ...(browsePinned
      ? [
          {
            id: "browse",
            label: content.library.spaces.browse,
            icon: Globe,
            desc: content.library.spaces.browseDesc,
            active:
              canvasIsApp &&
              activeRef.kind === "app" &&
              activeRef.slug === "browser",
            open: () => openApp("browser"),
            /*
             * Flat, like the two either side of it.
             *
             * It carried the app tiles' drop-shadow for a while, on the grounds
             * that Browse is a real app rather than a shell surface. That reads
             * on a tile — a rounded square of artwork with a shadow under it —
             * and not on a stroke glyph, where the same filter follows every
             * line of the drawing and comes out as a smudge round the icon.
             * Workspaces and Apps sit either side wearing no shadow, so flat is
             * also the consistent answer.
             */
          },
        ]
      : []),
    {
      ...systemTabs[1]!,
      active: tabActive("apps"),
      open: () => openTabView("apps"),
    },
  ];

  const unread = getUnreadRefs();
  const [dragging, setDragging] = useState<RailRef | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  /* Which tile is offering to be removed, by ref key. One at a time: two open
     crosses in a column of icons is two things to dismiss. */
  const [removing, setRemoving] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);

  /*
   * Dismissed by the next press anywhere else.
   *
   * On the document rather than on a backdrop element, because a backdrop over
   * the whole app to catch one click would swallow the click that was going
   * somewhere. Capture phase, so the cross is gone before whatever was pressed
   * gets to act on it.
   */
  useEffect(() => {
    if (!removing) return;
    const dismiss = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-remove-badge]")) {
        return;
      }
      setRemoving(null);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [removing]);

  /**
   * Taking a tile off the rail.
   *
   * Removing is disconnecting, not hiding: an app goes out of this workspace
   * the same way the App Store's Disconnect takes it out, and a web listing is
   * connected by having its URL pinned, so unpinning is the same act for one of
   * those. Two shapes, one meaning — a rail that could hide a connected app
   * would be a second inventory of what this workspace has.
   */
  const removeRef = (ref: RailRef): void => {
    setRemoving(null);
    if (ref.kind === "app") uninstallApp(ref.slug as AppSlug, activeSpaceId);
    else unpinSite(ref.id);
  };

  /** Essential apps refuse to be uninstalled, so they are not offered it. */
  const essentialSlugs = new Set<string>(getEssentialAppSlugs());
  const removable = (ref: RailRef): boolean =>
    ref.kind !== "app" || !essentialSlugs.has(ref.slug);

  const resolve = (ref: RailRef): Resolved | null =>
    resolveRef(ref, pinnedSites);

  /**
   * Open a slot.
   *
   * An app takes over the canvas. A site is a tab, so it goes through the
   * browser's own open path — same native tab layer, history and substrate as
   * a URL typed into the address bar; the rail is a shortcut to that, not a
   * second kind of tab. The ref goes in as an argument rather than being set
   * afterwards because `openLinkInBrowser` ends by setting the active ref, so
   * a `setActiveRef(ref)` around the call is overwritten and the origin chip
   * never appears.
   */
  const openSlot = (ref: RailRef, resolved: Resolved): void => {
    if (resolved.kind === "app") {
      openApp(resolved.app.slug);
      return;
    }
    openLinkInBrowser(activeSpaceId, resolved.site.url, ref);
  };

  const entryUnread = (entry: RailEntry): boolean =>
    entry.type === "single"
      ? unread.has(refKey(entry.ref))
      : entry.members.some((member) => unread.has(refKey(member)));

  // True while dragging a slot that currently lives inside a folder — used to
  // reveal the "remove from folder" drop zone.
  const draggingFromGroup = railEntries.some(
    (entry) =>
      entry.type === "group" &&
      entry.members.some(
        (member) => dragging !== null && sameRef(member, dragging)
      )
  );

  const startDrag =
    (ref: RailRef) =>
    (event: React.DragEvent): void => {
      event.dataTransfer.setData(DRAG_MIME, refKey(ref));
      event.dataTransfer.effectAllowed = "move";
      setDragging(ref);
      setTip(null);
    };
  /** The slot being dragged, read back from the drop's own payload. */
  const droppedRef = (event: React.DragEvent): RailRef | null =>
    decodeRefKey(event.dataTransfer.getData(DRAG_MIME));
  const endDrag = (): void => {
    setDragging(null);
    setOverTarget(null);
  };
  const canDrop = (event: React.DragEvent): boolean =>
    event.dataTransfer.types.includes(DRAG_MIME);

  // Top third → drop before (reorder), bottom third → after, middle → group.
  const dropZone = (event: React.DragEvent): "before" | "mid" | "after" => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height * 0.32) return "before";
    if (y > rect.height * 0.68) return "after";
    return "mid";
  };

  const showTip = (
    event: React.MouseEvent,
    label: string,
    desc: string
  ): void => {
    if (dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
      label,
      desc,
    });
  };
  const hideTip = (): void => setTip(null);

  const openGroupSettings = (entry: RailEntry): void => {
    if (entry.type !== "group") return;
    setSettings({ id: entry.id, name: entry.name, color: entry.color });
    setTip(null);
  };
  const startRemovePress = (key: string) => (): void => {
    pressTimer.current = window.setTimeout(() => {
      setRemoving(key);
      hideTip();
    }, LONG_PRESS_MS);
  };
  const startPress = (entry: RailEntry) => (): void => {
    pressTimer.current = window.setTimeout(
      () => openGroupSettings(entry),
      LONG_PRESS_MS
    );
  };
  const cancelPress = (): void => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <nav
      aria-label="Hub navigation"
      className={`flex h-full flex-col items-center py-4 transition-[width] duration-200 ease-out ${
        railCollapsed ? "w-18" : "w-24"
      }`}
    >
      {/* Pinned tabs — Profiles / Apps / Downloads stay at the top. */}
      <div className="flex w-full shrink-0 flex-col items-center gap-1 px-2 py-1">
        {pinned.map((tab) => (
          <div
            key={tab.id}
            onMouseEnter={(event) => showTip(event, tab.label, tab.desc)}
            onMouseLeave={hideTip}
          >
            <RailShell
              label={tab.label}
              active={tab.active}
              compact={railCollapsed}
              onClick={tab.open}
            >
              {/* The icon keeps its size; the box around it takes the 36px an
                  app tile below occupies. Bare, a 24px glyph sat six pixels
                  inside the column of tiles under it, and the top of the rail
                  read as indented. Growing the glyph would have fixed the
                  alignment by making these icons louder than the artwork they
                  sit above, which is the wrong half to change. */}
              <span className="grid size-9 place-items-center">
                <tab.icon className="size-6" aria-hidden="true" />
              </span>
            </RailShell>
          </div>
        ))}
      </div>

      {railEntries.length > 0 && (
        <div className="bg-border my-2 h-px w-12 shrink-0" aria-hidden="true" />
      )}

      {/* Apps and pinned sites — scroll underneath the pinned tabs.

          `scrollbar-none` is alignment, not taste: an `overflow-y-auto` column
          reserves a gutter on its right, so its centred tiles sat 5px left of
          the pinned ones above, which have no gutter to make room for. A
          scrollbar in a 96px column of icons was not doing any work anyway. */}
      <div className="scrollbar-none flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1">
        {railEntries.map((entry) => {
          const showUnread = entryUnread(entry);
          if (entry.type === "single") {
            const ref = entry.ref;
            const resolved = resolve(ref);
            if (!resolved) return null;
            const isActive = canvasIsApp && sameRef(activeRef, ref);
            const prefix = `${refKey(ref)}:`;
            const zone = overTarget?.startsWith(prefix)
              ? overTarget.slice(prefix.length)
              : null;
            return (
              <div
                key={refKey(ref)}
                /* The handle the Guided Tour points at. A named attribute
                   rather than a selector the tour has to guess: this element
                   says what it is, and a refactor that moves it takes the name
                   with it instead of silently breaking a card. */
                data-tour={
                  ref.kind === "app"
                    ? `rail-${ref.slug}`
                    : `rail-site-${ref.id}`
                }
                className="relative"
                onMouseEnter={(event) =>
                  showTip(event, resolved.name, resolved.desc)
                }
                onMouseLeave={hideTip}
                /* Held down rather than right-clicked, because the rail is the
                   one part of this app a thumb reaches on a tablet. The context
                   menu does the same thing for a mouse. */
                onPointerDown={
                  removable(ref) ? startRemovePress(refKey(ref)) : undefined
                }
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onContextMenu={
                  removable(ref)
                    ? (event) => {
                        event.preventDefault();
                        setRemoving(refKey(ref));
                        hideTip();
                      }
                    : undefined
                }
              >
                {showUnread && (
                  <span
                    className="bg-foreground absolute top-1/2 left-0 z-10 h-3.5 w-1.5 -translate-y-1/2 rounded-r-full"
                    aria-hidden="true"
                  />
                )}
                {zone === "before" && (
                  <span
                    className="bg-accent absolute -top-0.5 left-1/2 z-10 h-0.5 w-12 -translate-x-1/2 rounded-full"
                    aria-hidden="true"
                  />
                )}
                <RailShell
                  label={resolved.label}
                  active={isActive}
                  compact={railCollapsed}
                  onClick={() => openSlot(ref, resolved)}
                  draggable
                  onDragStart={startDrag(ref)}
                  onDragEnd={endDrag}
                  onDragOver={(event) => {
                    if (
                      canDrop(event) &&
                      !(dragging && sameRef(dragging, ref))
                    ) {
                      event.preventDefault();
                      setOverTarget(`${prefix}${dropZone(event)}`);
                    }
                  }}
                  onDragLeave={() => setOverTarget(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = droppedRef(event);
                    if (dropped && !sameRef(dropped, ref)) {
                      const z = dropZone(event);
                      if (z === "before")
                        reorderRailRef(dropped, ref, "before");
                      else if (z === "after")
                        reorderRailRef(dropped, ref, "after");
                      else groupRefs(dropped, { kind: "ref", ref });
                    }
                    endDrag();
                  }}
                  className={zone === "mid" ? "ring-accent ring-2" : ""}
                >
                  <RefTile
                    resolved={resolved}
                    size={36}
                    className={tileTone(isActive)}
                  />
                </RailShell>
                {zone === "after" && (
                  <span
                    className="bg-accent absolute -bottom-0.5 left-1/2 z-10 h-0.5 w-12 -translate-x-1/2 rounded-full"
                    aria-hidden="true"
                  />
                )}
                {/* The cross, once the tile has been held. `data-remove-badge`
                    is how the document-level dismiss knows to leave this one
                    press alone — see the effect above. */}
                <AnimatePresence>
                  {removing === refKey(ref) && (
                    <motion.button
                      type="button"
                      data-remove-badge=""
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 520,
                        damping: 24,
                      }}
                      onClick={() => removeRef(ref)}
                      aria-label={`${content.appStore.railRemove} ${resolved.name}`}
                      className="focus-ring border-surface bg-negative absolute top-1 right-2 z-20 grid size-5 place-items-center rounded-full border-2 text-white shadow-lg"
                    >
                      <X
                        className="size-3"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          // group
          const isOver = overTarget === `group:${entry.id}`;
          const isExpanded = expandedGroup === entry.id;
          const tint = entry.color || undefined;
          return (
            <div
              key={entry.id}
              /* Preset folders keep the id the preset gave them, so a tour card
                 can point at "the folder your answer created" by name. */
              data-tour={`rail-group-${entry.id}`}
              className="relative"
              onContextMenu={(event) => {
                event.preventDefault();
                openGroupSettings(entry);
              }}
              onPointerDown={startPress(entry)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
            >
              {showUnread && (
                <span
                  className="bg-foreground absolute top-4 left-0 z-10 h-3.5 w-1.5 rounded-r-full"
                  aria-hidden="true"
                />
              )}
              {isExpanded ? (
                <div
                  className={`bg-surface flex flex-col items-center gap-1 rounded-2xl p-1.5 ${
                    railCollapsed ? "w-14" : "w-20"
                  }`}
                  onDragOver={(event) => {
                    if (canDrop(event)) {
                      event.preventDefault();
                      setOverTarget(`group:${entry.id}`);
                    }
                  }}
                  onDragLeave={() => setOverTarget(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = droppedRef(event);
                    if (dropped)
                      groupRefs(dropped, { kind: "group", id: entry.id });
                    endDrag();
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(null)}
                    aria-label={`Collapse ${entry.name}`}
                    className="focus-ring text-muted-foreground hover:text-foreground flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]"
                  >
                    <Folder
                      className="size-4"
                      style={tint ? { color: tint } : undefined}
                      aria-hidden="true"
                    />
                    {!railCollapsed && (
                      <span className="max-w-full truncate">{entry.name}</span>
                    )}
                  </button>
                  {entry.members.map((member) => {
                    const resolved = resolve(member);
                    if (!resolved) return null;
                    const isActive = canvasIsApp && sameRef(activeRef, member);
                    return (
                      <button
                        key={refKey(member)}
                        type="button"
                        draggable
                        onDragStart={startDrag(member)}
                        onDragEnd={endDrag}
                        onClick={() => openSlot(member, resolved)}
                        onMouseEnter={(event) =>
                          showTip(event, resolved.name, resolved.desc)
                        }
                        onMouseLeave={hideTip}
                        aria-label={resolved.name}
                        className={`focus-ring group flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
                          isActive
                            ? "bg-surface-raised text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                        }`}
                      >
                        <RefTile
                          resolved={resolved}
                          size={34}
                          className={tileTone(isActive)}
                        />
                        {!railCollapsed && (
                          <span className="max-w-full truncate">
                            {resolved.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {isOver && (
                    <span
                      className="bg-accent my-0.5 h-0.5 w-12 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ) : (
                <RailShell
                  label={entry.name}
                  active={
                    canvasIsApp &&
                    entry.members.some((member) => sameRef(activeRef, member))
                  }
                  compact={railCollapsed}
                  onClick={() => setExpandedGroup(entry.id)}
                  onDragOver={(event) => {
                    if (canDrop(event)) {
                      event.preventDefault();
                      setOverTarget(`group:${entry.id}`);
                    }
                  }}
                  onDragLeave={() => setOverTarget(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = droppedRef(event);
                    if (dropped)
                      groupRefs(dropped, { kind: "group", id: entry.id });
                    endDrag();
                  }}
                >
                  <span
                    className={`grid size-11 grid-cols-2 grid-rows-2 gap-0.5 rounded-[22%] p-1 ${
                      tint ? "" : "bg-surface"
                    } ${isOver ? "nexus-shake ring-accent ring-2" : ""}`}
                    style={tint ? { backgroundColor: tint } : undefined}
                  >
                    {entry.members.slice(0, 4).map((member) => {
                      const resolved = resolve(member);
                      return resolved ? (
                        <RefTile
                          key={refKey(member)}
                          resolved={resolved}
                          size={16}
                        />
                      ) : (
                        <span key={refKey(member)} />
                      );
                    })}
                  </span>
                </RailShell>
              )}
            </div>
          );
        })}

        {draggingFromGroup && (
          <div
            onDragOver={(event) => {
              if (canDrop(event)) {
                event.preventDefault();
                setOverTarget("ungroup");
              }
            }}
            onDragLeave={() => setOverTarget(null)}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = droppedRef(event);
              if (dropped) ungroupRef(dropped);
              endDrag();
            }}
            className={`mt-1 flex flex-col items-center gap-1 rounded-xl border border-dashed px-1 py-2.5 text-center text-[10px] leading-tight transition-colors ${
              railCollapsed ? "w-13" : "w-20"
            } ${
              overTarget === "ungroup"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground"
            }`}
            title={railCollapsed ? "Remove from folder" : undefined}
          >
            <FolderMinus className="size-5" aria-hidden="true" />
            {!railCollapsed && (
              <span className="max-w-full">Remove from folder</span>
            )}
          </div>
        )}
      </div>

      {/*
        The footer is a column: the version on its own line, the two buttons on
        the line under it, hard against the bottom of the rail.

        They used to share a row, and the row could not hold them — 96px of rail
        less px-2 leaves 80, two 28px buttons take 56, and "v0.2.1" needs about
        34 in the 24 that remain. It truncated to "v...", which is a version
        label that has stopped being one. A line of its own has the whole 80px.

        The buttons stay last because they are the things you press, and a
        control that moves depending on whether a label above it rendered is a
        control you have to look for.
      */}
      <div className="flex w-full shrink-0 flex-col items-center gap-1 pt-3">
        <div
          className={`flex w-full items-center ${
            railCollapsed
              ? "flex-col-reverse gap-1 px-2"
              : "justify-between gap-1 px-2"
          }`}
        >
          {/* Settings, not the panel toggle: closing the panel now lives beside
            the panel's own title, and the rail keeps the two things that are
            about the whole product rather than about one app. */}
          <button
            type="button"
            aria-label={content.settings.title}
            onClick={openSettings}
            aria-current={mainView === "settings" ? "true" : undefined}
            /* Open is the tint behind the gear, not a recoloured gear. Same rule
             as the settings categories: the accent marks where you are, and the
             glyph stays the colour every other icon in the rail footer is. */
            className={`focus-ring rounded-md p-1.5 transition-colors ${
              mainView === "settings"
                ? "bg-accent/15 text-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Cog className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Share Nexus"
            onClick={openShare}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-md p-1.5"
          >
            <Gift className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {tip && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="border-border dark:bg-surface pointer-events-none fixed z-70 max-w-52 -translate-y-1/2 rounded-xl border bg-white px-3 py-2 shadow-xl"
        >
          <p className="text-foreground text-xs font-semibold">{tip.label}</p>
          <p className="text-muted-foreground line-clamp-3 text-[11px] leading-snug text-balance">
            {tip.desc}
          </p>
        </div>
      )}

      {settings && (
        <GroupSettingsDialog
          key={settings.id}
          open
          onClose={() => setSettings(null)}
          groupId={settings.id}
          initialName={settings.name}
          initialColor={settings.color}
        />
      )}
    </nav>
  );
}
