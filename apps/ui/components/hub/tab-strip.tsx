"use client";

/**
 * The open tabs, drawn across the top of the page.
 *
 * The other half of the `tabLayout` setting: when it reads "horizontal" the
 * library column stops drawing its tab list (see SpaceContent) and this strip
 * becomes the only one. Never both — a tab in two lists is two things to close
 * as far as anyone clicking is concerned, and only one of them is under the
 * pointer.
 *
 * It lives in the CONTENT column rather than beside the address bar, because
 * the address bar belongs to the library column here and a tab strip beside it
 * would be describing a page that is drawn somewhere else entirely. Above the
 * viewport, the strip and the page it labels are the same column.
 */

import { AddressBar } from "@/components/hub/browser-nav";
import { Favicon } from "@/components/hub/favicon";
import { internalPage } from "@/lib/tabs";
import { HoverMarquee } from "@/components/hub/hover-marquee";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { ArrowLeft, ArrowRight, Plus, Puzzle, RotateCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function TabStrip(): ReactNode {
  const {
    activeSpaceId,
    tabsBySpace,
    activeTabId,
    activeApp,
    openTab,
    closeTab,
    reorderTab,
    setCommandPaletteOpen,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useHub();

  /*
   * Which gap the drop indicator is sitting in, as an index into the list with
   * the dragged tab taken out.
   *
   * Held here rather than in the shared space-drag context because that one is
   * about moving tabs BETWEEN columns, and carries a source space with it. This
   * drag never leaves the strip: the only question is which side of a
   * neighbour the tab lands on.
   */
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const tabs = tabsBySpace[activeSpaceId] ?? [];
  const copy = content.library.spaces;

  return (
    <div className="flex shrink-0 flex-col">
      <div
        /* No bottom padding and no rule beneath: the tabs are meant to meet the
         bar below, so anything between them — a margin or a hairline — reads as
         the strip being separate from the thing it is attached to. */
        className="flex shrink-0 items-center gap-1 px-2 pt-1.5"
        /* A tab list, and announced as one: without this the strip reads to a
         screen reader as a row of unrelated buttons that happen to be next to
         each other. */
        role="tablist"
        aria-label={copy.tabs}
      >
        {/* Scrolls rather than shrinking past legibility: twenty tabs squeezed
          into a strip is twenty things nobody can read. */}
        <div
          className="flex min-w-0 flex-1 items-center overflow-x-auto"
          onDragOver={(event) => {
            // Without this the row is not a drop target at all and the browser
            // shows the "no entry" cursor over every gap in it.
            if (dragging) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!dragging || dropAt === null) return;
            event.preventDefault();
            reorderTab(activeSpaceId, dragging, dropAt);
            setDragging(null);
            setDropAt(null);
          }}
        >
          {tabs.map((tab, index) => {
            const active = activeApp === "browser" && activeTabId === tab.id;
            const carrying = dragging === tab.id;
            /* The slot this tab occupies once the dragged one is lifted out.
             Everything to the right of the gap shifts down by one, which is
             what makes "drop after the last tab" reachable at all. */
            const draggedIndex = tabs.findIndex(
              (candidate) => candidate.id === dragging
            );
            const slot =
              draggedIndex !== -1 && draggedIndex < index ? index - 1 : index;
            return (
              <div
                key={tab.id}
                className="flex shrink-0 items-center"
                onDragOver={(event) => {
                  if (!dragging || carrying) return;
                  event.preventDefault();
                  // Which half of the tab the pointer is in decides which side of
                  // it the drop lands on — "before this one" and "after this one"
                  // are different intentions a whole-row highlight cannot tell
                  // apart.
                  const rect = event.currentTarget.getBoundingClientRect();
                  const after = event.clientX - rect.left > rect.width / 2;
                  setDropAt(after ? slot + 1 : slot);
                }}
              >
                <DropMark
                  active={dragging !== null && !carrying && dropAt === slot}
                />
                <div
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    // Firefox refuses to start a drag with an empty payload.
                    event.dataTransfer.setData("text/plain", tab.id);
                    setDragging(tab.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropAt(null);
                  }}
                  /* Top corners round IN, bottom corners flare OUT — the manila
                   folder shape. The flares are drawn by `tab-flare` (globals.css)
                   rather than by a border radius, because a radius can only cut a
                   corner away and this has to ADD one: the fill continues past
                   the tab and curves down into the bar below. */
                  className={`group relative flex min-w-0 shrink-0 items-center rounded-t-lg ${
                    carrying ? "opacity-50" : ""
                  } ${
                    active
                      ? "bg-surface-raised tab-flare font-medium"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => openTab(tab.id)}
                    className="focus-ring flex w-40 min-w-0 items-center gap-2 rounded-t-lg py-1.5 pr-7 pl-2.5 text-left text-sm"
                  >
                    {/* A page the browser serves itself has no origin to
                        fetch an icon from, and its first letter is not a mark.
                        Chromium draws a puzzle piece here; so do we. */}
                    {internalPage(tab.url) ? (
                      <Puzzle
                        className="text-accent size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Favicon
                        url={tab.url}
                        letter={tab.favicon}
                        color={tab.faviconColor}
                      />
                    )}
                    <HoverMarquee text={tab.title} className="min-w-0 flex-1" />
                  </button>
                  {/* On hover and on focus, not always: a close button on every tab
                  at rest turns a row of pages into a row of X's. Kept in the
                  DOM either way so it can be tabbed to. */}
                  <button
                    type="button"
                    onClick={() => closeTab(tab.id)}
                    aria-label={`${copy.close} ${tab.title}`}
                    className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground absolute right-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* The gap past the last tab, so a tab can be dropped at the end. */}
          <DropMark active={dragging !== null && dropAt === tabs.length - 1} />

          {/* Beside the last tab rather than pinned to the far edge: it belongs to
            the row of tabs it extends, and a + parked against the window edge
            reads as a control for the window. */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label={copy.newTab}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground ml-1 flex size-7 shrink-0 items-center justify-center rounded-lg"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        The page's own controls, on the surface the active tab is made of.

        Sharing that colour is what makes the tab read as attached to this bar
        rather than floating above it — the flared corners either side of the
        active tab curve down into this exact fill. Moving back/forward/reload
        and the address bar here is what empties them out of the library column;
        see BrowserNav and SpacesPanel, which stand down when this exists.
      */}
      <div className="bg-surface-raised flex shrink-0 items-center gap-1 px-2 py-1.5">
        <div className="text-muted-foreground flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Go back"
            className="focus-ring hover:bg-surface-hover hover:text-foreground rounded-md p-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={!canGoForward}
            aria-label="Go forward"
            className="focus-ring hover:bg-surface-hover hover:text-foreground rounded-md p-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Reload"
            className="focus-ring hover:bg-surface-hover hover:text-foreground rounded-md p-1.5"
          >
            <RotateCw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <AddressBar />
      </div>
    </div>
  );

  /**
   * Where the dragged tab would land.
   *
   * Always in the layout, transparent until it is the live gap, so the row does
   * not jump sideways by the indicator's width the moment a drag crosses it.
   */
  function DropMark({ active }: { active: boolean }): ReactNode {
    return (
      <span
        aria-hidden="true"
        className={`mx-0.5 h-6 w-0.5 shrink-0 rounded-full transition-colors ${
          active ? "bg-accent" : "bg-transparent"
        }`}
      />
    );
  }
}
