"use client";

import { DataIcon } from "@/components/hub/app-icon";
import { Favicon } from "@/components/hub/favicon";
import { HoverMarquee } from "@/components/hub/hover-marquee";
import { useHub } from "@/components/hub/hub-provider";
import {
  DropLine,
  SPACE_ITEM_MIME,
  SPACE_TAB_MIME,
  useSpaceDrag,
} from "@/components/hub/space-drag";
import { content, type SpaceItem } from "@/lib/data";
import { ArrowDown, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";

/** A folder child — an internal page or an external link. */
function ChildRow({
  item,
  managerSpaceId,
}: {
  item: SpaceItem;
  managerSpaceId?: string | undefined;
}): ReactNode {
  const {
    activePage,
    openPage,
    openTab,
    createTab,
    tabsBySpace,
    openLinkInBrowser,
    setActiveSpaceId,
    setMainView,
  } = useHub();

  if (item.kind === "page" && item.pageId) {
    const active = activePage === item.pageId;
    const pageId = item.pageId;
    return (
      <button
        type="button"
        onClick={() => {
          if (managerSpaceId) {
            setActiveSpaceId(managerSpaceId);
            openPage(pageId);
            setMainView("app");
          } else {
            openPage(pageId);
          }
        }}
        aria-current={active ? "page" : undefined}
        className={`focus-ring flex w-full items-center gap-2.5 rounded-lg py-2 pr-2.5 pl-9 text-left text-sm ${
          active
            ? "bg-surface-raised font-medium shadow-sm"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <span
          className="size-4 shrink-0 rounded"
          style={{ backgroundColor: item.iconColor }}
          aria-hidden="true"
        />
        <HoverMarquee text={item.title} className="min-w-0 flex-1 text-left" />
      </button>
    );
  }

  // link child
  const openLink = (): void => {
    const url = item.url ?? "";
    if (managerSpaceId) {
      openLinkInBrowser(managerSpaceId, url);
      return;
    }
    const existing = Object.values(tabsBySpace)
      .flat()
      .find((tab) => tab.url === url);
    if (existing) openTab(existing.id);
    else createTab(url);
  };
  return (
    <button
      type="button"
      onClick={openLink}
      className="focus-ring flex w-full items-center gap-2.5 rounded-lg py-2 pr-2.5 pl-9 text-left text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground"
    >
      <Favicon
        url={item.url ?? ""}
        letter={item.title[0] ?? "•"}
        color={item.iconColor}
        size={16}
      />
      <span className="truncate">{item.title}</span>
    </button>
  );
}

/** Space folders (expandable), live folders, and the open tabs list. */
export function SpaceContent({
  spaceId,
  managerSpaceId,
}: {
  spaceId: string;
  managerSpaceId?: string | undefined;
}): ReactNode {
  const {
    activeTabId,
    activeApp,
    openTab,
    closeTab,
    clearTabs,
    tabsBySpace,
    spaceItemsBySpace,
    expandedFolders,
    toggleFolder,
    setTabDragging,
    setActiveSpaceId,
    setMainView,
    moveItemToSpace,
    moveTabToSpace,
  } = useHub();
  const { drag, setDrag, over, setOver } = useSpaceDrag();
  const items = spaceItemsBySpace[spaceId] ?? [];
  const topLevel = items.filter((item) => !item.parentId);
  const childrenOf = (id: string): SpaceItem[] =>
    items
      .filter((item) => item.parentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const tabs = tabsBySpace[spaceId] ?? [];

  /*
   * Drag between columns.
   *
   * The whole column is the drop surface and the line is drawn between rows,
   * because "before this one" and "onto this one" are different intentions
   * that a highlight on a row cannot tell apart. The index is worked out from
   * which half of a row the pointer is in, so the answer changes as you cross
   * the middle rather than when you leave the row.
   */
  const dropping = drag !== null && drag.fromSpaceId !== spaceId;
  const slotFrom = (event: React.DragEvent, index: number): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? index : index + 1;
  };
  const overIndex = over?.spaceId === spaceId ? over.index : null;
  /* One `over` index for a column that holds two lists. Tabs are numbered past
     the bookmarks rather than in a second piece of state, so "where would this
     land" stays a single answer. */
  const TAB_SLOT = 1000;
  const overTabIndex =
    overIndex !== null && overIndex >= TAB_SLOT ? overIndex - TAB_SLOT : null;
  const tabRowDrag = (index: number) => ({
    onDragOver: (event: React.DragEvent): void => {
      if (!dropping) return;
      event.preventDefault();
      setOver({ spaceId, index: TAB_SLOT + slotFrom(event, index) });
    },
    onDrop: (event: React.DragEvent): void => {
      if (!dropping) return;
      event.preventDefault();
      commit(TAB_SLOT + slotFrom(event, index));
    },
  });
  const commit = (index: number): void => {
    if (!drag) return;
    /* A tab dropped among the bookmarks is still a tab, and a bookmark dropped
       among the tabs is still a bookmark — the slot decides the position, the
       thing being dragged decides which list. */
    const inTabs = index >= 1000;
    const at = inTabs ? index - 1000 : index;
    if (drag.kind === "item") {
      moveItemToSpace(drag.id, drag.fromSpaceId, spaceId, at);
    } else {
      moveTabToSpace(drag.id, drag.fromSpaceId, spaceId, at);
    }
    setDrag(null);
    setOver(null);
  };
  const rowDrag = (index: number) => ({
    onDragOver: (event: React.DragEvent): void => {
      if (!dropping) return;
      event.preventDefault();
      setOver({ spaceId, index: slotFrom(event, index) });
    },
    onDrop: (event: React.DragEvent): void => {
      if (!dropping) return;
      event.preventDefault();
      commit(slotFrom(event, index));
    },
  });

  return (
    <div
      className="flex min-h-full flex-col gap-0.5"
      /* The column itself accepts a drop, landing at the end. Only the rows
         were targets before, so the empty space below a short list — which is
         most of a column — silently refused everything. */
      onDragOver={(event) => {
        if (!dropping) return;
        event.preventDefault();
        if (overIndex === null) setOver({ spaceId, index: topLevel.length });
      }}
      onDrop={(event) => {
        if (!dropping) return;
        event.preventDefault();
        commit(overIndex ?? topLevel.length);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        if (over?.spaceId === spaceId) setOver(null);
      }}
    >
      {topLevel.map((item, index) => {
        if (item.kind === "folder") {
          const expanded = expandedFolders.includes(item.id);
          const children = childrenOf(item.id);
          const carrying = drag?.kind === "item" && drag.id === item.id;
          return (
            <div key={item.id} {...rowDrag(index)}>
              <DropLine active={overIndex === index} />
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(SPACE_ITEM_MIME, item.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDrag({
                    kind: "item",
                    id: item.id,
                    fromSpaceId: spaceId,
                    childCount: children.length,
                  });
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
                className={carrying ? "opacity-50" : ""}
              >
              <button
                type="button"
                onClick={() => toggleFolder(item.id)}
                aria-expanded={expanded}
                className="focus-ring flex w-full items-center gap-1.5 rounded-lg px-1.5 py-2 text-left text-sm font-medium hover:bg-surface-hover"
              >
                <ChevronRight
                  className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                  aria-hidden="true"
                />
                <DataIcon
                  name={item.icon}
                  className="size-4 shrink-0"
                  style={{ color: item.iconColor }}
                />
                <HoverMarquee text={item.title} className="min-w-0 flex-1 text-left" />
                {/* What is coming with it, once the rows are hidden. */}
                {carrying && children.length > 0 && (
                  <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {children.length}
                  </span>
                )}
              </button>
              </div>
              {/* Shut while it is being carried: a folder that stays open is
                  eleven rows following the cursor. */}
              {expanded &&
                !carrying &&
                children.map((child) => (
                  <ChildRow
                    key={child.id}
                    item={child}
                    managerSpaceId={managerSpaceId}
                  />
                ))}
            </div>
          );
        }
        const carrying = drag?.kind === "item" && drag.id === item.id;
        return (
          <div key={item.id} {...rowDrag(index)}>
            <DropLine active={overIndex === index} />
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(SPACE_ITEM_MIME, item.id);
                event.dataTransfer.effectAllowed = "move";
                setDrag({
                  kind: "item",
                  id: item.id,
                  fromSpaceId: spaceId,
                  childCount: 0,
                });
              }}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-surface-hover ${
                carrying ? "opacity-50" : ""
              }`}
            >
              <DataIcon
                name={item.icon}
                className="size-4 shrink-0"
                style={{ color: item.iconColor }}
              />
              <HoverMarquee text={item.title} className="min-w-0 flex-1 text-left" />
            </button>
          </div>
        );
      })}

      {/* The slot past the last bookmark, so a drop below them all lands
          there rather than nowhere. */}
      <div
        className="min-h-2"
        onDragOver={(event) => {
          if (!dropping) return;
          event.preventDefault();
          setOver({ spaceId, index: topLevel.length });
        }}
        onDrop={(event) => {
          if (!dropping) return;
          event.preventDefault();
          commit(topLevel.length);
        }}
      >
        <DropLine active={overIndex === topLevel.length} />
      </div>

      <div className="my-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => clearTabs(spaceId)}
          disabled={tabs.length === 0}
          className="focus-ring flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground disabled:opacity-40"
        >
          <ArrowDown className="size-3" aria-hidden="true" />
          {content.library.spaces.clear}
        </button>
      </div>

      {tabs.map((tab, tabIndex) => {
        const active = activeApp === "browser" && activeTabId === tab.id;
        const carrying = drag?.kind === "tab" && drag.id === tab.id;
        return (
          <div key={tab.id} {...tabRowDrag(tabIndex)}>
          <DropLine active={overTabIndex === tabIndex} />
          <div
            draggable
            onDragStart={(event) => {
              /* Two payloads, because this drag has two meanings: onto the
                 favourites bar it is a bookmark, onto another column it is the
                 tab itself moving house. */
              event.dataTransfer.setData("application/x-nexus-tab", tab.id);
              event.dataTransfer.setData(SPACE_TAB_MIME, tab.id);
              event.dataTransfer.effectAllowed = "copyMove";
              setTabDragging(true);
              setDrag({
                kind: "tab",
                id: tab.id,
                fromSpaceId: spaceId,
                childCount: 0,
              });
            }}
            onDragEnd={() => {
              setTabDragging(false);
              setDrag(null);
              setOver(null);
            }}
            className={`group relative flex items-center rounded-lg ${
              carrying ? "opacity-50" : ""
            } ${
              active
                ? "bg-surface-raised font-medium shadow-sm"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (managerSpaceId) {
                  setActiveSpaceId(managerSpaceId);
                  openTab(tab.id);
                  setMainView("app");
                } else {
                  openTab(tab.id);
                }
              }}
              aria-current={active ? "page" : undefined}
              className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm"
            >
              <Favicon
                url={tab.url}
                letter={tab.favicon}
                color={tab.faviconColor}
                size={16}
              />
              <HoverMarquee text={tab.title} className="min-w-0 flex-1 pr-5 text-left" />
            </button>
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
              aria-label={`Close ${tab.title}`}
              className="focus-ring absolute right-1.5 rounded p-1 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-hover hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          </div>
        );
      })}

      {/* Below the last tab. */}
      <div
        className="min-h-3"
        onDragOver={(event) => {
          if (!dropping) return;
          event.preventDefault();
          setOver({ spaceId, index: TAB_SLOT + tabs.length });
        }}
        onDrop={(event) => {
          if (!dropping) return;
          event.preventDefault();
          commit(TAB_SLOT + tabs.length);
        }}
      >
        <DropLine active={overIndex === TAB_SLOT + tabs.length} />
      </div>
    </div>
  );
}
