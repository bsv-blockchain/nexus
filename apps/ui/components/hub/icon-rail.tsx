"use client";

import { AppTile } from "@/components/hub/app-icon";
import { GroupSettingsDialog } from "@/components/hub/group-settings-dialog";
import {
  useHub,
  type AppSlug,
  type LibraryTab,
  type RailEntry,
} from "@/components/hub/hub-provider";
import {
  getChatThreads,
  getHubApp,
  getMailMessages,
  getUnreadCount,
} from "@/lib/data";
import {
  Folder,
  FolderMinus,
  Gift,
  Layers,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

const DRAG_MIME = "application/x-nexus-app";
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
    label: "Profiles",
    icon: Layers,
    desc: "Switch between your profiles. Each keeps its own browser tabs, balances and identities.",
  },
  {
    id: "apps",
    label: "Apps",
    icon: LayoutGrid,
    desc: "Browse, install and manage the apps in your Nexus.",
  },
];

type Tip = { top: number; left: number; label: string; desc: string };
type GroupSettings = { id: string; name: string; color?: string | undefined };

/** Apps with fresh activity — surfaced as a dot on the left of the rail. */
function getUnreadApps(): Set<AppSlug> {
  const unread = new Set<AppSlug>();
  if (getChatThreads().some((thread) => getUnreadCount(thread.id) > 0))
    unread.add("messages");
  if (getMailMessages().some((mail) => !mail.read)) unread.add("mail");
  return unread;
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
    toggleRail,
    activeApp,
    openApp,
    railEntries,
    groupApps,
    ungroupApp,
    reorderRailApp,
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
  const unread = getUnreadApps();
  const [dragging, setDragging] = useState<AppSlug | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const pressTimer = useRef<number | null>(null);

  const entryUnread = (entry: RailEntry): boolean =>
    entry.type === "app"
      ? unread.has(entry.slug)
      : entry.apps.some((slug) => unread.has(slug));

  // True while dragging an app that currently lives inside a folder — used to
  // reveal the "remove from folder" drop zone.
  const draggingFromGroup =
    dragging !== null &&
    railEntries.some(
      (entry) => entry.type === "group" && entry.apps.includes(dragging),
    );

  const startDrag = (slug: AppSlug) => (event: React.DragEvent): void => {
    event.dataTransfer.setData(DRAG_MIME, slug);
    event.dataTransfer.effectAllowed = "move";
    setDragging(slug);
    setTip(null);
  };
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
    desc: string,
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
      LONG_PRESS_MS,
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
              <tab.icon className="size-6" aria-hidden="true" />
            </RailShell>
          </div>
        ))}
      </div>

      {railEntries.length > 0 && (
        <div className="my-2 h-px w-12 shrink-0 bg-border" aria-hidden="true" />
      )}

      {/* Installed apps — scroll underneath the pinned tabs. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1">
        {railEntries.map((entry) => {
            const showUnread = entryUnread(entry);
            if (entry.type === "app") {
              const app = getHubApp(entry.slug);
              if (!app) return null;
              const prefix = `app:${entry.slug}:`;
              const zone = overTarget?.startsWith(prefix)
                ? overTarget.slice(prefix.length)
                : null;
              return (
                <div
                  key={entry.slug}
                  className="relative"
                  onMouseEnter={(event) =>
                    showTip(event, app.name, app.description)
                  }
                  onMouseLeave={hideTip}
                >
                  {showUnread && (
                    <span
                      className="absolute top-1/2 left-0 z-10 h-3.5 w-1.5 -translate-y-1/2 rounded-r-full bg-foreground"
                      aria-hidden="true"
                    />
                  )}
                  {zone === "before" && (
                    <span
                      className="absolute -top-0.5 left-1/2 z-10 h-0.5 w-12 -translate-x-1/2 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                  <RailShell
                    label={app.shortName}
                    active={activeApp === entry.slug}
                    compact={railCollapsed}
                    onClick={() => openApp(entry.slug)}
                    draggable
                    onDragStart={startDrag(entry.slug)}
                    onDragEnd={endDrag}
                    onDragOver={(event) => {
                      if (canDrop(event) && dragging !== entry.slug) {
                        event.preventDefault();
                        setOverTarget(`${prefix}${dropZone(event)}`);
                      }
                    }}
                    onDragLeave={() => setOverTarget(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      const slug = event.dataTransfer.getData(
                        DRAG_MIME,
                      ) as AppSlug;
                      if (slug && slug !== entry.slug) {
                        const z = dropZone(event);
                        if (z === "before")
                          reorderRailApp(slug, entry.slug, "before");
                        else if (z === "after")
                          reorderRailApp(slug, entry.slug, "after");
                        else groupApps(slug, { kind: "app", slug: entry.slug });
                      }
                      endDrag();
                    }}
                    className={zone === "mid" ? "ring-2 ring-accent" : ""}
                  >
                    <AppTile
                      app={app}
                      size={36}
                      className={tileTone(activeApp === entry.slug)}
                    />
                  </RailShell>
                  {zone === "after" && (
                    <span
                      className="absolute -bottom-0.5 left-1/2 z-10 h-0.5 w-12 -translate-x-1/2 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            }

            // group
            const isOver = overTarget === `group:${entry.id}`;
            const isExpanded = expandedGroup === entry.id;
            const groupApp = (slug: AppSlug) => getHubApp(slug);
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
                    className="absolute top-4 left-0 z-10 h-3.5 w-1.5 rounded-r-full bg-foreground"
                    aria-hidden="true"
                  />
                )}
                {isExpanded ? (
                  <div
                    className={`flex flex-col items-center gap-1 rounded-2xl bg-surface p-1.5 ${
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
                      const slug = event.dataTransfer.getData(
                        DRAG_MIME,
                      ) as AppSlug;
                      if (slug) groupApps(slug, { kind: "group", id: entry.id });
                      endDrag();
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(null)}
                      aria-label={`Collapse ${entry.name}`}
                      className="focus-ring flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Folder
                        className="size-4"
                        style={tint ? { color: tint } : undefined}
                        aria-hidden="true"
                      />
                      {!railCollapsed && (
                        <span className="max-w-full truncate">
                          {entry.name}
                        </span>
                      )}
                    </button>
                    {entry.apps.map((slug) => {
                      const app = groupApp(slug);
                      if (!app) return null;
                      return (
                        <button
                          key={slug}
                          type="button"
                          draggable
                          onDragStart={startDrag(slug)}
                          onDragEnd={endDrag}
                          onClick={() => openApp(slug)}
                          onMouseEnter={(event) =>
                            showTip(event, app.name, app.description)
                          }
                          onMouseLeave={hideTip}
                          aria-label={app.name}
                          className={`focus-ring group flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
                            activeApp === slug
                              ? "bg-surface-raised text-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                          }`}
                        >
                          <AppTile
                            app={app}
                            size={34}
                            className={tileTone(activeApp === slug)}
                          />
                          {!railCollapsed && (
                            <span className="max-w-full truncate">
                              {app.shortName}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {isOver && (
                      <span
                        className="my-0.5 h-0.5 w-12 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                ) : (
                  <RailShell
                    label={entry.name}
                    active={entry.apps.includes(activeApp as AppSlug)}
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
                      const slug = event.dataTransfer.getData(
                        DRAG_MIME,
                      ) as AppSlug;
                      if (slug) groupApps(slug, { kind: "group", id: entry.id });
                      endDrag();
                    }}
                  >
                    <span
                      className={`grid size-11 grid-cols-2 grid-rows-2 gap-0.5 rounded-[22%] p-1 ${
                        tint ? "" : "bg-surface"
                      } ${isOver ? "nexus-shake ring-2 ring-accent" : ""}`}
                      style={tint ? { backgroundColor: tint } : undefined}
                    >
                      {entry.apps.slice(0, 4).map((slug) => {
                        const app = groupApp(slug);
                        return app ? (
                          <AppTile key={slug} app={app} size={16} />
                        ) : (
                          <span key={slug} />
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
                const slug = event.dataTransfer.getData(DRAG_MIME) as AppSlug;
                if (slug) ungroupApp(slug);
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

      <div
        className={`flex w-full shrink-0 items-center pt-3 ${
          railCollapsed
            ? "flex-col-reverse gap-1 px-2"
            : "justify-between px-4"
        }`}
      >
        <button
          type="button"
          aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleRail}
          className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {railCollapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Share Nexus"
          onClick={openShare}
          className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Gift className="size-4" aria-hidden="true" />
        </button>
      </div>

      {tip && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-70 max-w-52 -translate-y-1/2 rounded-xl border border-border bg-white px-3 py-2 shadow-xl dark:bg-surface"
        >
          <p className="text-xs font-semibold text-foreground">{tip.label}</p>
          <p className="line-clamp-3 text-[11px] leading-snug text-balance text-muted-foreground">
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
