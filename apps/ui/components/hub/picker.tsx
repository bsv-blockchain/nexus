"use client";

/**
 * Choosing one value out of a list, without a native dropdown.
 *
 * A `<select>` is the one control in this build that is drawn by the
 * operating system rather than by us. It cannot carry an icon, it cannot be
 * searched, it renders as a grey system list on a dark theme, and on a phone
 * it becomes a wheel that looks like nothing else in the app. Every other
 * surface here is ours; a field that suddenly is not reads as a hole in the
 * product.
 *
 * So: a popover on a desktop, anchored under the field and matched to its
 * width, and the same bottom sheet every other interstitial uses on a phone.
 * Both draw the same rows, with the same marks beside them, and both search
 * once a list is long enough to be worth searching.
 *
 * The icon is a `ReactNode` rather than an icon name on purpose — callers
 * pass whatever already draws that thing elsewhere (`RepoMark` for a source,
 * `AppTile` for an app), so a source looks the same in this list as it does
 * in the store rather than being redrawn as an approximation of itself.
 */

import { Sheet } from "@/components/apps/messages/sheet";
import { PopoverMenu } from "@/components/hub/popover-menu";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface PickerOption {
  id: string;
  label: string;
  /** a second line, for what the label alone does not say */
  hint?: string;
  /** whatever already draws this thing elsewhere in the product */
  icon?: ReactNode;
  /** shown right-aligned: a count, a price, a status word */
  meta?: string;
}

/** Below this many options, a search box is furniture rather than help. */
const SEARCH_FROM = 8;

export function Picker({
  value,
  options,
  onPick,
  label,
  placeholder = "Choose…",
  className = "",
  searchable,
  searchPlaceholder = "Search",
}: {
  /** the chosen option's id, or null for none */
  value: string | null;
  options: PickerOption[];
  onPick: (id: string) => void;
  /** what this field is, for the sheet's heading and the listbox's name */
  label: string;
  placeholder?: string;
  className?: string;
  /** force the search box on or off; by default it appears once the list is long */
  searchable?: boolean;
  searchPlaceholder?: string;
}): ReactNode {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<
    { top: number; left: number; right: number; bottom: number } | undefined
  >(undefined);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.id === value) ?? null;
  const showSearch = searchable ?? options.length >= SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(needle) ||
          (option.hint ?? "").toLowerCase().includes(needle) ||
          (option.meta ?? "").toLowerCase().includes(needle),
      )
    : options;

  const close = (): void => {
    setOpen(false);
    setQuery("");
  };

  const choose = (id: string): void => {
    onPick(id);
    close();
    /* Back to the field that opened it. A picker that leaves focus on a
       surface it has just removed drops the caret at the top of the page,
       which is a long way back for somebody filling in a form by keyboard. */
    triggerRef.current?.focus();
  };

  const list = (
    <OptionList
      options={shown}
      value={value}
      onPick={choose}
      label={label}
      showSearch={showSearch}
      query={query}
      onQuery={setQuery}
      searchPlaceholder={searchPlaceholder}
      onClose={close}
    />
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          });
          setWidth(rect.width);
          setOpen(true);
        }}
        className={`border-border bg-surface focus-ring hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${className}`}
      >
        {selected?.icon && (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            {selected.icon}
          </span>
        )}
        <span className={`min-w-0 flex-1 ${selected ? "" : "text-muted-foreground"}`}>
          <span className="block truncate">{selected?.label ?? placeholder}</span>
        </span>
        {selected?.meta && (
          <span className="text-muted-foreground shrink-0 text-xs">{selected.meta}</span>
        )}
        <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      </button>

      {isDesktop ? (
        <PopoverMenu
          open={open}
          {...(anchor ? { anchor } : {})}
          {...(width ? { width } : {})}
          onClose={close}
          label={label}
          role="listbox"
          align="start"
          className="max-h-96 overflow-y-auto"
        >
          {list}
        </PopoverMenu>
      ) : (
        <Sheet open={open} onClose={close} label={label} full>
          <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-muted-foreground mb-2 px-1 text-xs font-semibold">{label}</p>
            {list}
          </div>
        </Sheet>
      )}
    </>
  );
}

/**
 * The rows themselves, drawn once for both surfaces.
 *
 * Arrow keys move a highlight and Enter takes it, so the search box does not
 * strand a keyboard user with a list they can see and cannot reach. The
 * highlight starts on whatever is already chosen, which is where somebody
 * reopening a field expects to be.
 */
function OptionList({
  options,
  value,
  onPick,
  label,
  showSearch,
  query,
  onQuery,
  searchPlaceholder,
  onClose,
}: {
  options: PickerOption[];
  value: string | null;
  onPick: (id: string) => void;
  label: string;
  showSearch: boolean;
  query: string;
  onQuery: (next: string) => void;
  searchPlaceholder: string;
  onClose: () => void;
}): ReactNode {
  /* Opens on whatever is already chosen, which is where somebody reopening a
     field expects to be, rather than at the top of a list they have to walk
     back down. */
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, options.findIndex((option) => option.id === value)),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* Clamped here rather than corrected in an effect: a filtered list can be
     shorter than wherever the highlight had got to, and the honest fix is
     that the highlight is derived from both rather than a second source of
     truth that has to be chased back into range. */
  const active = Math.min(highlight, Math.max(0, options.length - 1));

  /* Typing starts the highlight over. Keeping it where it was means Enter
     picks whatever happens to be in that position now, which is not the row
     the person was looking at when they started typing. */
  const changeQuery = (next: string): void => {
    setHighlight(0);
    onQuery(next);
  };

  const move = (delta: number): void => {
    if (options.length === 0) return;
    const next = (active + delta + options.length) % options.length;
    setHighlight(next);
    listRef.current?.querySelectorAll("[data-option]")[next]?.scrollIntoView({
      block: "nearest",
    });
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) onPick(option.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      {showSearch && (
        <div className="border-border bg-surface mb-1 flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
          <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${label}`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      )}
      <div ref={listRef}>
        {options.length === 0 && (
          <p className="text-muted-foreground px-2.5 py-3 text-sm">Nothing matches that.</p>
        )}
        {options.map((option, index) => {
          const chosen = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              data-option
              aria-selected={chosen}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => onPick(option.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                index === active ? "bg-surface-hover" : ""
              }`}
            >
              {option.icon && (
                <span className="flex shrink-0 items-center" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{option.label}</span>
                {option.hint && (
                  <span className="text-muted-foreground block truncate text-xs">
                    {option.hint}
                  </span>
                )}
              </span>
              {option.meta && (
                <span className="text-muted-foreground shrink-0 text-xs">{option.meta}</span>
              )}
              <Check
                className={`size-4 shrink-0 ${chosen ? "text-accent" : "opacity-0"}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
