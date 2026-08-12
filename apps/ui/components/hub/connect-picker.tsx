"use client";

import { PopoverMenu } from "@/components/hub/popover-menu";
import { content } from "@/lib/data";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.profiles.picker;

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
  mark: ReactNode;
  /** shown greyed with a note rather than hidden, where it cannot be picked */
  disabled?: string;
}

/**
 * One thing connected, and the way to change which.
 *
 * A row of switches said a profile could hold several of these; it holds one.
 * The switches were also the wrong shape for the question — with five handles
 * and four wallets in play, "which one" is a choice from a list, not nine
 * independent yes-or-nos that happen to be mutually exclusive.
 *
 * Filtering is inline and the list before anybody types is the most recent
 * few, because the thing you just made is the thing you are most likely
 * reaching for and an alphabetical list buries it. Searching a list of four is
 * pointless; searching a list of forty is the only way through it, and the same
 * control has to work at both sizes without changing shape.
 */
export function ConnectPicker({
  label,
  connected,
  options,
  onPick,
  emptyLabel,
  onAdd,
  addLabel,
}: {
  /** what is being connected, for the popover's accessible name */
  label: string;
  /** the option currently connected, if any */
  connected: PickerOption | null;
  options: PickerOption[];
  onPick: (id: string) => void;
  /** the trigger's words when nothing is connected */
  emptyLabel: string;
  onAdd?: () => void;
  addLabel?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<
    { top: number; left: number; right: number; bottom: number } | undefined
  >(undefined);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  /* Before a query: the newest few. After one: everything that matches, because
     a filtered list that is also truncated hides the result somebody typed for. */
  const shown = q
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(q) ||
          (option.hint ?? "").toLowerCase().includes(q),
      )
    : options.slice(0, 5);

  const close = (): void => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          });
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        /* The border carries the hover, not the fill. A row that changes
           colour under the pointer competes with the connected thing it is
           showing; an edge that sharpens says the same and stays quiet. */
        className="focus-ring border-border bg-surface-raised hover:border-foreground/50 flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors"
      >
        {connected ? (
          <>
            {connected.mark}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {connected.label}
              </span>
              {connected.hint && (
                <span className="text-muted-foreground block truncate text-[10px]">
                  {connected.hint}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-[13px]">
            {emptyLabel}
          </span>
        )}
        <ChevronDown
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden="true"
        />
      </button>

      {/* Aligned to the trigger's leading edge rather than its trailing
          one: the menu is wider than the row it drops from, so an end-aligned
          menu hangs out to the left of the thing that opened it and reads as
          belonging to whatever is over there. */}
      <PopoverMenu
        open={open}
        {...(anchor ? { anchor } : {})}
        onClose={close}
        label={label}
        align="start"
        className="w-64"
      >
        <div className="border-border/60 mb-1 flex items-center gap-1.5 border-b px-1.5 pb-1.5">
          <Search
            className="text-muted-foreground size-3.5 shrink-0"
            aria-hidden="true"
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={label}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-0.5 text-xs outline-none"
          />
        </div>

        {!q && options.length > 5 && (
          <p className="text-muted-foreground px-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
            {copy.recent}
          </p>
        )}

        {shown.map((option) => {
          const current = option.id === connected?.id;
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={current}
              disabled={Boolean(option.disabled)}
              onClick={() => {
                onPick(option.id);
                close();
              }}
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left disabled:opacity-50"
            >
              {option.mark}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {option.label}
                </span>
                {(option.disabled ?? option.hint) && (
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {option.disabled ?? option.hint}
                  </span>
                )}
              </span>
              {current && (
                <Check
                  className="text-accent size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {shown.length === 0 && (
          <p className="text-muted-foreground px-2 py-2 text-[11px]">
            {copy.noMatch}
          </p>
        )}

        {onAdd && (
          <button
            type="button"
            onClick={() => {
              close();
              onAdd();
            }}
            className="focus-ring border-border/60 hover:bg-surface-hover mt-1 flex w-full items-center gap-2 rounded-md border-t px-2 py-1.5 text-left text-xs font-semibold"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            {addLabel}
          </button>
        )}
      </PopoverMenu>
    </>
  );
}
