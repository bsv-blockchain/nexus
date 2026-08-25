"use client";

/**
 * Choosing a coin out of twelve hundred.
 *
 * The list is far too long to be a list, so it is a search box with a shortlist
 * under it: Popular, which is the assets this wallet issues plus the majors the
 * provider flags, and then as much of the rest as fits before the count takes
 * over. Below that a line saying how many more there are — because a picker
 * that silently stops at forty rows is a picker that appears not to have
 * Litecoin in it.
 *
 * Every row states the network beside the ticker. On a list where `usdt` names
 * eleven different tokens, the chain is not a detail, it is which one.
 */

import { formatUnits } from "@/components/apps/wallet/token-mark";
import { loadSwapAssets } from "@/lib/swap-assets";
import type { SwapCoin } from "@/lib/swap";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** How many of the long tail to draw before deferring to search. */
const TAIL = 40;

/** The coin's own mark, or its first letter on a plate when it has none. */
export function CoinMark({
  coin,
  size = 28,
}: {
  coin: SwapCoin;
  size?: number;
}): ReactNode {
  if (!coin.icon) {
    return (
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          background: coin.color,
          fontSize: size * 0.45,
        }}
      >
        {coin.symbol[0]}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coin.icon}
        alt=""
        loading="lazy"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    </span>
  );
}

function matches(coin: SwapCoin, needle: string): boolean {
  if (!needle) return true;
  return (
    coin.symbol.toLowerCase().includes(needle) ||
    coin.name.toLowerCase().includes(needle) ||
    coin.networkLabel.toLowerCase().includes(needle)
  );
}

function Row({
  coin,
  active,
  onSelect,
}: {
  coin: SwapCoin;
  active: boolean;
  onSelect: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={`focus-ring flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active ? "bg-accent/15" : "hover:bg-surface-hover"
      }`}
    >
      <CoinMark coin={coin} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{coin.name}</span>
        {/* The ticker is already upper-case and the network name is a proper
            noun. Upper-casing the line turned "BNB Smart Chain" into shouting
            and "zkSync Era" into something that is not the product's name. */}
        <span className="text-muted-foreground block truncate text-[10px]">
          {coin.symbol} · {coin.networkLabel}
        </span>
      </span>
      {coin.units > 0 && (
        <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
          {formatUnits(coin.units, coin.decimals)}
        </span>
      )}
      {active && (
        <Check className="text-accent size-4 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

export function CoinPicker({
  coins,
  selected,
  onSelect,
  label,
}: {
  coins: SwapCoin[];
  selected: string;
  onSelect: (coinId: string) => void;
  label: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const current = coins.find((coin) => coin.id === selected) ?? coins[0];

  useEffect(() => {
    if (!open) return;
    /* Asked for here rather than on wallet open: this is the first moment the
       long list is needed, and until then it is a request nobody made. */
    loadSwapAssets();
    field.current?.focus();
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

  const { popular, rest, hidden } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = coins.filter((coin) => matches(coin, needle));
    const featured = found.filter((coin) => coin.featured);
    const tail = found.filter((coin) => !coin.featured);
    return {
      popular: featured,
      rest: tail.slice(0, TAIL),
      hidden: Math.max(0, tail.length - TAIL),
    };
  }, [coins, query]);

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
        <CoinMark coin={current} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{current.symbol}</span>
          {/* The balance when there is one, because that is what decides
              whether this is the right asset. Otherwise the name — under `BSV`
              the word "BSV" is not a second fact, and the name is. */}
          <span className="text-muted-foreground block truncate text-[11px]">
            {current.units > 0
              ? formatUnits(current.units, current.decimals)
              : current.name}
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
        <div
          className="border-border bg-surface-raised absolute top-full right-0 left-0 z-30 mt-1.5 rounded-xl border shadow-2xl"
          role="listbox"
          aria-label={label}
        >
          <div className="border-border flex items-center gap-2 border-b px-3 py-2">
            <Search
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
            <input
              ref={field}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assets"
              aria-label="Search assets"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {popular.length > 0 && (
              <>
                <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-[10px] font-bold tracking-wide uppercase">
                  Popular
                </p>
                {popular.map((coin) => (
                  <Row
                    key={coin.id}
                    coin={coin}
                    active={coin.id === selected}
                    onSelect={() => {
                      onSelect(coin.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </>
            )}

            {rest.length > 0 && (
              <>
                <p className="text-muted-foreground px-2.5 pt-2.5 pb-1 text-[10px] font-bold tracking-wide uppercase">
                  All assets
                </p>
                {rest.map((coin) => (
                  <Row
                    key={coin.id}
                    coin={coin}
                    active={coin.id === selected}
                    onSelect={() => {
                      onSelect(coin.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </>
            )}

            {popular.length === 0 && rest.length === 0 && (
              <p className="text-muted-foreground px-2.5 py-6 text-center text-xs">
                Nothing matches “{query.trim()}”.
              </p>
            )}

            {hidden > 0 && (
              <p className="text-muted-foreground px-2.5 py-2.5 text-center text-[11px]">
                Search to access {hidden.toLocaleString("en-US")} more assets.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
