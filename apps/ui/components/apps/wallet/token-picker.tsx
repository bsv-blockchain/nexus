"use client";

import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { holdings } from "@/lib/wallet";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The asset you are sending, and a way to change it.
 *
 * Vela's shape: the current currency is stated, and picking another is a
 * deliberate second act. The row of chips it replaces put every holding on
 * screen at once, which reads as a set of options to weigh rather than one
 * answer already chosen — and scrolled sideways as soon as somebody held more
 * than four things.
 *
 * The balance is on the trigger because it is the number that decides whether
 * the asset is the right one. A picker showing only a symbol makes people open
 * it to remember what they have.
 */
export function TokenPicker({
  selected,
  onSelect,
  label,
}: {
  selected: string;
  onSelect: (tokenId: string) => void;
  label: string;
}): ReactNode {
  const rows = holdings();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const current = rows.find(({ token }) => token.id === selected) ?? rows[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!current) return null;

  return (
    <div ref={box} className="relative">
      <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="focus-ring border-border bg-surface hover:bg-surface-hover flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
      >
        <TokenMark token={current.token} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            {current.token.symbol}
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {formatUnits(current.units, current.token.decimals)}
          </span>
        </span>
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        /* Over the sheet rather than pushing it: opening a picker should not
           move the amount field somebody is about to type into. */
        <div
          role="listbox"
          aria-label={label}
          className="border-border bg-surface-raised absolute top-full right-0 left-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border p-1 shadow-2xl"
        >
          {rows.map(({ token, units }) => {
            const active = token.id === selected;
            return (
              <button
                key={token.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onSelect(token.id);
                  setOpen(false);
                }}
                className={`focus-ring flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-accent/15" : "hover:bg-surface-hover"
                }`}
              >
                <TokenMark token={token} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">
                    {token.symbol}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {formatUnits(units, token.decimals)}
                  </span>
                </span>
                {active && (
                  <Check
                    className="text-accent size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
