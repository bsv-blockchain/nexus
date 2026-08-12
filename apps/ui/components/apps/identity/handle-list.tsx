"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useHub } from "@/components/hub/hub-provider";
import {
  checkHandle,
  content,
  getMessagePerson,
  handleListings,
  HANDLE_CHANGE_USD,
  MAX_HANDLES,
} from "@/lib/data";
import {
  activeHandleFor,
  addHandle,
  listHandle,
  releaseHandleFrom,
  useSettings,
} from "@/lib/settings-store";
import { Check, Loader2, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.identity.handles;

const money = (usd: number): string =>
  `$${usd.toLocaleString("en-GB", { minimumFractionDigits: usd % 1 ? 2 : 0 })}`;

/**
 * The handles you hold, and which one this profile wears.
 *
 * A list rather than a single field. Somebody with a work handle and a personal
 * one is not indecisive; they are two audiences, and the profile is already the
 * thing that separates them — so the active handle belongs to the profile
 * rather than to the account.
 */
export function HandleList(): ReactNode {
  const settings = useSettings();
  const { activeSpaceId, spaces } = useHub();
  const [selling, setSelling] = useState<string | null>(null);
  const [price, setPrice] = useState("218");

  const active = activeHandleFor(activeSpaceId);
  const space = spaces.find((entry) => entry.id === activeSpaceId);

  return (
    <ul className="divide-border/60 divide-y">
      {settings.handles.map((handle) => {
        const isActive = handle === active;
        const listed = settings.listedForSale[handle];
        /* Which other profiles are wearing it, so giving one up says what it
           would take with it. */
        const alsoOn = spaces
          .filter(
            (entry) =>
              entry.id !== activeSpaceId &&
              activeHandleFor(entry.id) === handle,
          )
          .map((entry) => entry.name);

        return (
          <li key={handle} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl text-base font-bold ${
                  isActive
                    ? "bg-accent/15 text-foreground"
                    : "bg-surface text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                @
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  @{handle}
                </span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {isActive
                    ? `${copy.active} · ${space?.name ?? ""}`
                    : alsoOn.length > 0
                      ? alsoOn.join(", ")
                      : listed !== undefined
                        ? `${copy.listedFor} ${money(listed)}`
                        : copy.onNexus}
                </span>
              </span>

              {isActive ? (
                <Check
                  className="text-accent size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    addHandle(handle, activeSpaceId);
                    toast.success(`@${handle}`, {
                      description: `${copy.active} · ${space?.name ?? ""}`,
                    });
                  }}
                  className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                >
                  {copy.useHere}
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  listed !== undefined
                    ? (listHandle(handle, null),
                      toast.success(`@${handle} ${copy.unlisted}`))
                    : setSelling(selling === handle ? null : handle)
                }
                aria-label={listed !== undefined ? copy.unlist : copy.sell}
                title={listed !== undefined ? copy.unlist : copy.sell}
                className={`focus-ring shrink-0 rounded-md p-1.5 ${
                  listed !== undefined
                    ? "text-accent hover:bg-surface-hover"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Tag className="size-3.5" aria-hidden="true" />
              </button>

              {/* Never on the last one: a key with no name is reachable by
                  nobody, and this is the control that would do it. */}
              {settings.handles.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    releaseHandleFrom(handle, Date.now());
                    toast.success(`@${handle}`, { description: copy.claimed });
                  }}
                  aria-label={`${copy.giveUp}: @${handle}`}
                  title={copy.giveUp}
                  className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-negative shrink-0 rounded-md p-1.5"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {selling === handle && (
              <div className="border-border bg-surface mt-2.5 rounded-lg border p-2.5">
                <p className="text-[11px] font-semibold">{copy.sellTitle}</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
                  {copy.sellHint}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="focus-within:ring-accent border-border bg-surface-raised flex items-baseline rounded-lg border px-2.5 py-1 focus-within:ring-2">
                    <span className="text-muted-foreground text-xs">$</span>
                    <input
                      value={price}
                      onChange={(event) =>
                        setPrice(event.target.value.replace(/[^\d]/g, ""))
                      }
                      inputMode="numeric"
                      aria-label={copy.sellTitle}
                      className="field-sizing-content min-w-[4ch] bg-transparent text-xs font-semibold tabular-nums outline-none"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const value = Number(price);
                      if (!value) return;
                      listHandle(handle, value);
                      setSelling(null);
                      toast.success(`@${handle} ${copy.listDone}`, {
                        description: money(value),
                      });
                    }}
                    className="focus-ring bg-accent text-accent-foreground rounded-full px-3 py-1 text-[11px] font-bold hover:opacity-90"
                  >
                    {copy.sell}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelling(null)}
                    aria-label={copy.cancel}
                    className="focus-ring text-muted-foreground hover:text-foreground rounded-md p-1"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}

      {settings.handles.length >= MAX_HANDLES && (
        <li className="text-muted-foreground px-4 py-3 text-[11px] text-pretty">
          {copy.full}
        </li>
      )}
    </ul>
  );
}

/**
 * Names other people are selling.
 *
 * The counterpart to the cap: five each means the good ones move by sale rather
 * than by whoever registered first keeping them forever. The seller is shown
 * because buying a name is buying it from somebody, and knowing who is part of
 * deciding whether the price is real.
 */
export function HandleMarket(): ReactNode {
  const settings = useSettings();
  const { activeSpaceId, setWalletIntent, openApp } = useHub();
  const [busy, setBusy] = useState<string | null>(null);

  const listings = handleListings.filter(
    (listing) => !settings.handles.includes(listing.handle),
  );
  if (listings.length === 0) return null;
  const full = settings.handles.length >= MAX_HANDLES;

  return (
    <ul className="divide-border/60 divide-y">
      {listings.map((listing) => {
        const seller = getMessagePerson(listing.sellerId);
        return (
          <li key={listing.handle} className="flex items-center gap-3 px-4 py-3">
            {seller && <MemberAvatar person={seller} size={32} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                @{listing.handle}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {copy.forSaleBy.replace("{seller}", seller?.name ?? "somebody")}
              </span>
            </span>
            <button
              type="button"
              disabled={full || busy === listing.handle}
              onClick={() => {
                setBusy(listing.handle);
                window.setTimeout(() => {
                  addHandle(listing.handle, activeSpaceId);
                  setBusy(null);
                  /* Bought from a person, so it settles in the wallet like any
                     other payment to one. */
                  setWalletIntent({ kind: "send" });
                  toast.success(`@${listing.handle}`, {
                    description: copy.bought,
                    action: {
                      label: content.wallet.openMessages.replace(
                        "Messages",
                        "Wallet",
                      ),
                      onClick: () => openApp("wallet"),
                    },
                  });
                }, 1200);
              }}
              className="focus-ring bg-accent text-accent-foreground flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy === listing.handle && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              )}
              {copy.buyFor.replace("{price}", money(listing.priceUsd))}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Claiming a name nobody holds, at the flat price. */
export function ClaimHandle(): ReactNode {
  const settings = useSettings();
  const { activeSpaceId, setWalletIntent } = useHub();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const active = activeHandleFor(activeSpaceId);
  const check = checkHandle(draft, active, settings.handles);
  const full = settings.handles.length >= MAX_HANDLES;

  const message =
    check.state === "empty"
      ? null
      : check.state === "current" || check.state === "owned"
        ? copy.checkOwned
        : check.state === "invalid"
          ? copy.checkInvalid
          : check.state === "short"
            ? copy.checkShort
            : check.state === "for-sale"
              ? copy.forSaleBy.replace(
                  "{seller}",
                  getMessagePerson(check.listing.sellerId)?.name ?? "somebody",
                )
              : check.state === "taken"
                ? copy.checkTaken
                : copy.checkAvailable;

  const claim = (): void => {
    if (check.state !== "available" || full) return;
    setBusy(true);
    window.setTimeout(() => {
      addHandle(draft, activeSpaceId);
      setBusy(false);
      setDraft("");
      setWalletIntent({ kind: "send" });
      toast.success(`@${draft.toLowerCase()}`, { description: copy.claimed });
    }, 1200);
  };

  return (
    <div className="p-4">
      {/*
        One row, because it is one act. The button sat under the field on its
        own line, which reads as a second decision after typing a name — and
        made the price, the only surprising thing here, the furthest thing from
        the thing being priced. The field grows, the button does not.
      */}
      <div className="focus-within:ring-accent border-border bg-surface flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 focus-within:ring-2">
        <span className="text-muted-foreground text-sm">@</span>
        <input
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") claim();
          }}
          disabled={full}
          placeholder={copy.placeholder}
          aria-label={copy.addTitle}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        {check.state === "available" && (
          <Check
            className="text-positive size-4 shrink-0"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          onClick={claim}
          disabled={check.state !== "available" || busy || full}
          className="focus-ring bg-accent text-accent-foreground flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          {copy.claimFor.replace("{price}", `$${HANDLE_CHANGE_USD.toFixed(2)}`)}
        </button>
      </div>
      {message && (
        <p
          className={`mt-1.5 text-[11px] ${
            check.state === "available"
              ? "text-positive"
              : check.state === "for-sale"
                ? "text-warning"
                : check.state === "current" || check.state === "owned"
                  ? "text-muted-foreground"
                  : "text-negative"
          }`}
        >
          {message}
          {check.state === "for-sale" &&
            ` · ${money(check.listing.priceUsd)}`}
        </p>
      )}
    </div>
  );
}
