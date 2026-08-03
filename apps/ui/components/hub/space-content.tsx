"use client";

import { DataIcon } from "@/components/hub/app-icon";
import { Favicon } from "@/components/hub/favicon";
import { HoverMarquee } from "@/components/hub/hover-marquee";
import { useHub } from "@/components/hub/hub-provider";
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
  } = useHub();
  const items = spaceItemsBySpace[spaceId] ?? [];
  const topLevel = items.filter((item) => !item.parentId);
  const childrenOf = (id: string): SpaceItem[] =>
    items
      .filter((item) => item.parentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const tabs = tabsBySpace[spaceId] ?? [];

  return (
    <div className="flex flex-col gap-0.5">
      {topLevel.map((item) => {
        if (item.kind === "folder") {
          const expanded = expandedFolders.includes(item.id);
          const children = childrenOf(item.id);
          return (
            <div key={item.id}>
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
              </button>
              {expanded &&
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
        return (
          <button
            key={item.id}
            type="button"
            className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-surface-hover"
          >
            <DataIcon
              name={item.icon}
              className="size-4 shrink-0"
              style={{ color: item.iconColor }}
            />
            <HoverMarquee text={item.title} className="min-w-0 flex-1 text-left" />
          </button>
        );
      })}

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

      {tabs.map((tab) => {
        const active = activeApp === "browser" && activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-nexus-tab", tab.id);
              event.dataTransfer.effectAllowed = "copy";
              setTabDragging(true);
            }}
            onDragEnd={() => setTabDragging(false)}
            className={`group relative flex items-center rounded-lg ${
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
        );
      })}
    </div>
  );
}
