"use client";

import { AppTile, SiteTile } from "@/components/hub/app-icon";
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
  getMailMessages,
  getUnreadCount,
  type HubApp,
} from "@/lib/data";
import { refKey, sameRef } from "@/lib/rail/layout";
import { displayOrigin } from "@/lib/rail/origin";
import type { PinnedSite } from "@/lib/rail/sites";
import {
  Folder,
  FolderMinus,
  Gift,
  Layers,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/**
 * A drag carries the dragged slot's `refKey`, under a MIME type of our own so
 * a file or a link dragged in from outside the rail cannot read as a slot.
 */
const DRAG_MIME = "application/x-nexus-rail-ref";
const LONG_PRESS_MS = 500;
/** Soft dark outer glow, a touch stronger at the bottom — inactive apps only. */
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
  | { kind: "app"; label: string; name: string; desc: string; app: HubApp }
  | {
      kind: "site";
      label: string;
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
          label: app.shortName,
          name: app.name,
          desc: app.description,
          app,
        }
      : null;
  }
  const site = sites.find((candidate) => candidate.id === ref.id);
  return site
    ? {
        kind: "site",
        label: site.title,
        name: site.title,
        desc: displayOrigin(site.url),
        site,
      }
    : null;
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
  label: string;
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
    activeSpaceId,
    openLinkInBrowser,
    pinnedSites,
    railEntries,
    groupRefs,
    ungroupRef,
    reorderRailRef,
    openShare,
  } = useHub();

  // A system tab is "active" when its view/panel is showing.
  const tabActive = (id: LibraryTab): boolean =>
    id === "spaces"
      ? mainView === "profiles"
      : id === "apps"
        ? mainView === "store"
        : libraryTab === "downloads";
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
  const unread = getUnreadRefs();
  const [dragging, setDragging] = useState<RailRef | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const pressTimer = useRef<number | null>(null);

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
        {systemTabs.map((tab) => (
          <div
            key={tab.id}
            onMouseEnter={(event) => showTip(event, tab.label, tab.desc)}
            onMouseLeave={hideTip}
          >
            <RailShell
              label={tab.label}
              active={tabActive(tab.id)}
              compact={railCollapsed}
              onClick={() => openTabView(tab.id)}
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

      {/* Apps and pinned sites — scroll underneath the pinned tabs. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1">
        {railEntries.map((entry) => {
          const showUnread = entryUnread(entry);
          if (entry.type === "single") {
            const ref = entry.ref;
            const resolved = resolve(ref);
            if (!resolved) return null;
            const isActive = sameRef(activeRef, ref);
            const prefix = `${refKey(ref)}:`;
            const zone = overTarget?.startsWith(prefix)
              ? overTarget.slice(prefix.length)
              : null;
            return (
              <div
                key={refKey(ref)}
                className="relative"
                onMouseEnter={(event) =>
                  showTip(event, resolved.name, resolved.desc)
                }
                onMouseLeave={hideTip}
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
                    const isActive = sameRef(activeRef, member);
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
                  active={entry.members.some((member) =>
                    sameRef(activeRef, member)
                  )}
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
            <Settings className="size-4" aria-hidden="true" />
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
