"use client";

import { Favicon } from "@/components/hub/favicon";
import { useHub } from "@/components/hub/hub-provider";
import { content, type BrowserTab } from "@/lib/data";
import type { RecentSite } from "@/components/hub/hub-provider";
import { ArrowRight, Globe, Info, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Search / New Tab overlay from the design: type to filter open tabs and
 * jump to them, or press Enter to open the query as a new tab. ⌘T opens it,
 * Escape closes, arrow keys move the selection.
 */
export function CommandPalette(): ReactNode {
  const { commandPaletteOpen, setCommandPaletteOpen } = useHub();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;
  return <CommandPaletteContent onClose={() => setCommandPaletteOpen(false)} />;
}

type PaletteEntry =
  | { kind: "tab"; tab: BrowserTab }
  | { kind: "recent"; site: RecentSite }
  | { kind: "open"; query: string };

function CommandPaletteContent({
  onClose,
}: {
  onClose: () => void;
}): ReactNode {
  const {
    tabsBySpace,
    recentBySpace,
    activeSpaceId,
    spaces,
    openTab,
    createTab,
  } = useHub();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const copy = content.commandPalette;
  const spaceName =
    spaces.find((space) => space.id === activeSpaceId)?.name ?? "";

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.toLowerCase();
    const matches = (title: string, url: string): boolean =>
      title.toLowerCase().includes(needle) || url.toLowerCase().includes(needle);

    /*
     * This workspace only, and open tabs before pages that are merely
     * remembered.
     *
     * It used to search every space at once, which put Work's tabs in front of
     * somebody typing in Personal — the one thing separate workspaces are for.
     * Open tabs lead because switching to a tab you already have beats opening
     * a second copy of it.
     */
    const tabEntries: PaletteEntry[] = (tabsBySpace[activeSpaceId] ?? [])
      .filter((tab) => matches(tab.title, tab.url))
      .map((tab) => ({ kind: "tab", tab }));

    const openUrls = new Set(
      (tabsBySpace[activeSpaceId] ?? []).map((tab) => tab.url),
    );
    // A page that is already open is offered as the tab, never twice.
    const recentEntries: PaletteEntry[] = (recentBySpace[activeSpaceId] ?? [])
      .filter((site) => !openUrls.has(site.url) && matches(site.title, site.url))
      .map((site) => ({ kind: "recent", site }));

    const found = [...tabEntries, ...recentEntries];
    return query.trim().length > 0
      ? [...found, { kind: "open", query: query.trim() }]
      : found;
  }, [tabsBySpace, recentBySpace, activeSpaceId, query]);

  const selected = Math.min(selectedIndex, Math.max(0, entries.length - 1));

  const activate = (entry: PaletteEntry | undefined): void => {
    if (!entry) return;
    if (entry.kind === "tab") openTab(entry.tab.id);
    else if (entry.kind === "recent") createTab(entry.site.url);
    else createTab(entry.query);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={copy.placeholder}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-[0_12px_90px_-8px_rgba(0,0,0,0.85)] ring-1 ring-black/10 dark:bg-black dark:text-white dark:shadow-[0_12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Search
            className="size-5 shrink-0 opacity-50"
            aria-hidden="true"
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((index) =>
                  Math.min(index + 1, entries.length - 1),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                activate(entries[selected]);
              }
            }}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-50"
          />
          <Info className="size-4 shrink-0 opacity-40" aria-hidden="true" />
        </div>

        <div className="border-t border-black/10 p-2 dark:border-white/10">
          {entries.length === 0 && (
            <p className="px-3 py-4 text-sm opacity-50">{copy.noResults}</p>
          )}
          {entries.map((entry, index) => {
            const isSelected = index === selected;
            const rowClass = `focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
              isSelected
                ? "bg-accent text-accent-foreground"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`;
            const trailingClass = `flex shrink-0 items-center gap-1.5 text-xs ${
              isSelected ? "text-accent-foreground/90" : "opacity-50"
            }`;

            if (entry.kind === "open") {
              return (
                <button
                  key="open-query"
                  type="button"
                  onClick={() => activate(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={rowClass}
                >
                  <Globe className="size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.query}
                  </span>
                  <span className={trailingClass}>
                    {copy.openNewTab}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              );
            }

            if (entry.kind === "recent") {
              return (
                <button
                  key={`recent-${entry.site.url}`}
                  type="button"
                  onClick={() => activate(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={rowClass}
                >
                  <Favicon
                    url={entry.site.url}
                    letter={entry.site.favicon}
                    color={entry.site.faviconColor}
                    size={20}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.site.title}
                  </span>
                  {/* The workspace it belongs to, not a verb: these rows all do
                      the same thing, and the useful thing to say is whose page
                      this was. */}
                  <span className={trailingClass}>
                    {spaceName}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              );
            }

            return (
              <button
                key={entry.tab.id}
                type="button"
                onClick={() => activate(entry)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={rowClass}
              >
                <Favicon
                  url={entry.tab.url}
                  letter={entry.tab.favicon}
                  color={entry.tab.faviconColor}
                  size={20}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {entry.tab.title}
                </span>
                <span className={trailingClass}>
                  {copy.switchToTab}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
