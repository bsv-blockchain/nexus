"use client";

/**
 * Finding a setting without knowing where it lives.
 *
 * Eleven categories and about forty-five sections, and the way somebody finds
 * one today is by opening categories until the right words appear. That works
 * if you already know which category a thing is in, which is exactly what a
 * person hunting for a setting does not know — "auto-swap" is in Payments,
 * "who can reach you" is in Privacy, and nothing about either name says so.
 *
 * The field in the column is a button rather than an input. Typing into a
 * sidebar that then filters the list beneath it is the pattern this replaces:
 * it hides the categories you are not searching for, so a near-miss leaves you
 * looking at an empty column with no way back to browsing. The bar over the
 * page keeps the column intact behind it.
 *
 * @see lib/settings-index.ts for what it searches
 */

import { SETTINGS_CATEGORIES } from "@/components/apps/settings-app";
import { useHub, type SettingsCategory } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import {
  searchSettings,
  sectionSlug,
  type SettingsSection,
} from "@/lib/settings-index";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useHostOverlay } from "@/lib/wallet-data";
import { ChevronRight, Search } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Result =
  | { kind: "category"; id: SettingsCategory; label: string; hint: string }
  | { kind: "section"; section: SettingsSection };

/**
 * Take somebody to a section, and make it obvious which one.
 *
 * Two steps in one frame is not enough: the category has to render before its
 * headings exist to scroll to, so the scroll waits for the next frame. The
 * flash afterwards is what answers "which of these did I ask for" on a page of
 * six near-identical cards.
 */
function goTo(section: SettingsSection): void {
  requestAnimationFrame(() => {
    const target = document.getElementById(sectionSlug(section.title));
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    target.classList.add("settings-found");
    window.setTimeout(() => target.classList.remove("settings-found"), 1600);
  });
}

function ResultRow({
  result,
  active,
  onPick,
}: {
  result: Result;
  active: boolean;
  onPick: () => void;
}): ReactNode {
  const label =
    result.kind === "category" ? result.label : result.section.title;
  const where =
    result.kind === "category"
      ? result.hint
      : (SETTINGS_CATEGORIES.find((c) => c.id === result.section.category)
          ?.label ?? "");

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(event) => {
        /* Mousedown, not click: the field's blur would otherwise close the bar
           before the click landed on anything. */
        event.preventDefault();
        onPick();
      }}
      className={`focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
        active ? "bg-accent/15" : "hover:bg-surface-hover"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
          {result.kind === "category" ? where : `in ${where}`}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}

function SearchBar({
  onClose,
  onNavigate,
  categories,
}: {
  onClose: () => void;
  onNavigate?: (category: SettingsCategory) => void;
  categories: typeof SETTINGS_CATEGORIES;
}): ReactNode {
  const copy = content.settings.payments;
  const { setSettingsCategory } = useHub();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const isDesktop = useIsDesktop();
  const field = useRef<HTMLInputElement | null>(null);

  /* The browsed page is a native view above this document in both shells, so
     without this the bar opens behind whatever site is loaded. */
  useHostOverlay(true);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const results = useMemo<Result[]>(() => {
    const { categories: found, sections } = searchSettings(
      query,
      [...categories],
      isDesktop,
    );
    /* Categories first: a query that names one almost always means "take me
       there", and its sections are then one screen away anyway. */
    return [
      ...found.map(
        (entry): Result => ({
          kind: "category",
          id: entry.id,
          label: entry.label,
          hint: entry.hint,
        }),
      ),
      ...sections.map((section): Result => ({ kind: "section", section })),
    ];
  }, [query, categories, isDesktop]);

  const clamped = Math.min(index, Math.max(0, results.length - 1));

  /*
   * Two ways to arrive, because there are two settings screens.
   *
   * The desktop page reads the category from hub state and swaps its panel.
   * The phone sheet keeps a category of its own and pushes a screen, since a
   * drill-down has a back button and hub state has no notion of depth. Both
   * are told, so a result works the same either way and neither screen needs a
   * search of its own.
   */
  function pick(result: Result | undefined): void {
    if (!result) return;
    const category =
      result.kind === "category" ? result.id : result.section.category;
    setSettingsCategory(category);
    onNavigate?.(category);
    if (result.kind === "section") goTo(result.section);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="border-border bg-surface-raised w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-border flex items-center gap-2.5 border-b px-4 py-3">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <input
            ref={field}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter") pick(results[clamped]);
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              }
            }}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.search}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div role="listbox" aria-label={copy.search} className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-xs">
              {copy.searchEmpty}
            </p>
          ) : (
            results.map((result, position) => (
              <ResultRow
                key={
                  result.kind === "category"
                    ? `c:${result.id}`
                    : `s:${result.section.category}:${result.section.title}`
                }
                result={result}
                active={position === clamped}
                onPick={() => pick(result)}
              />
            ))
          )}
        </div>

        <p className="border-border text-muted-foreground border-t px-4 py-2 text-[11px]">
          {copy.searchHint}
        </p>
      </div>
    </div>
  );
}

/**
 * The field at the top of the Settings column, and the bar it opens.
 *
 * ⌘F while Settings is open, which is what the shortcuts table already calls
 * "Search this app" — so this is the binding keeping its own promise rather
 * than a new one to learn. ⌘K is the command palette's and ⌘T opens a tab;
 * both are questions about somewhere else.
 *
 * Bound only while this is mounted, which is only while Settings is open, so
 * ⌘F goes on meaning find-in-page everywhere else.
 */
export function SettingsSearch({
  onNavigate,
  categories = SETTINGS_CATEGORIES,
  className,
}: {
  /** the phone sheet's way of pushing its own screen; see `pick` */
  onNavigate?: (category: SettingsCategory) => void;
  /** narrowed on a phone, which drops Shortcuts */
  categories?: typeof SETTINGS_CATEGORIES;
  className?: string;
} = {}): ReactNode {
  const [open, setOpen] = useState(false);
  const copy = content.settings.payments;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "focus-ring border-border bg-surface hover:bg-surface-hover text-muted-foreground mb-1.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left"
        }
      >
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs">{copy.search}</span>
        {/* Only where there is a keyboard to press it on. A phone showing a
            chord badge is advertising a shortcut it cannot accept. */}
        <kbd className="bg-muted hidden shrink-0 rounded px-1 py-0.5 font-mono text-[10px] md:block">
          ⌘F
        </kbd>
      </button>
      {open && (
        <SearchBar
          onClose={() => setOpen(false)}
          {...(onNavigate ? { onNavigate } : {})}
          categories={categories}
        />
      )}
    </>
  );
}
