"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { Sheet } from "@/components/apps/messages/sheet";
import { TokenPicker } from "@/components/apps/wallet/token-picker";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { VerifiedHandle } from "@/components/apps/wallet/wallet-views";
import {
  content,
  getCurrentMessageUser,
  getToken,
  getTokens,
  getWalletAccount,
  getWalletContacts,
  type MessagePerson,
  type Token,
} from "@/lib/data";
import { handleOf } from "@/lib/messages";
import { holdingOf, usd } from "@/lib/wallet";
import { ArrowDown, Check, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/** Token picker row list, shared by send and exchange. */
/**
 * Send: pick an asset, an amount, and a recipient.
 *
 * Recipients are handles, following Vela — you send to a person, and the
 * verified pill is what says you are paying the right one. Typing a raw handle
 * is equally valid, which is what makes cross-ecosystem payment work.
 */
export function SendSheet({
  open,
  tokenId,
  presetPersonId,
  onClose,
  onSend,
}: {
  open: boolean;
  tokenId: string;
  presetPersonId?: string | null;
  onClose: () => void;
  onSend: (args: { token: Token; units: number; person: MessagePerson }) => void;
}): ReactNode {
  const copy = content.wallet;
  const [asset, setAsset] = useState(tokenId);
  const [amount, setAmount] = useState("");
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState<string | null>(
    presetPersonId ?? null,
  );

  const token = getToken(asset);
  const holding = holdingOf(asset);
  const units = Number(amount);
  const valid =
    token &&
    Number.isFinite(units) &&
    units > 0 &&
    holding &&
    units <= holding.units &&
    personId;

  const needle = query.trim().toLowerCase();
  const people = getWalletContacts()
    .filter(
      (person) =>
        !needle ||
        person.name.toLowerCase().includes(needle) ||
        handleOf(person).toLowerCase().includes(needle),
    )
    .slice(0, 6);
  const chosen = personId ? people.find((p) => p.id === personId) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={copy.send}
      footer={
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            const person = getWalletContacts().find((p) => p.id === personId);
            if (token && person) onSend({ token, units, person });
          }}
          className="focus-ring w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {copy.reviewSend}
        </button>
      }
    >
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{copy.send}</h2>

        <TokenPicker selected={asset} onSelect={setAsset} label={copy.asset} />

        <div>
          <label
            htmlFor="send-amount"
            className="mb-1.5 block text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
          >
            {copy.amount}
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border px-3">
            <input
              id="send-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="0"
              className="h-12 min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
            />
            {token && (
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
                <TokenMark token={token} size={16} />
                {token.symbol}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {token && units > 0 ? usd(units * token.usdPerUnit) : usd(0)}
            </span>
            {holding && token && (
              <button
                type="button"
                onClick={() => setAmount(String(holding.units))}
                className="focus-ring rounded font-semibold hover:text-foreground"
              >
                {copy.max} {formatUnits(holding.units, token.decimals)}
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {copy.to}
          </p>
          {chosen ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-accent bg-accent/10 p-3">
              <MemberAvatar person={chosen} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {chosen.name}
                  </span>
                  <VerifiedHandle person={chosen} />
                </span>
                <Handle
                  person={chosen}
                  size={11}
                  className="max-w-full truncate text-xs text-muted-foreground"
                />
              </span>
              <button
                type="button"
                onClick={() => setPersonId(null)}
                className="focus-ring shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-surface-hover"
              >
                {copy.change}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border px-3">
                <Search
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.toPlaceholder}
                  aria-label={copy.to}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <ul className="mt-2 space-y-0.5">
                {people.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setPersonId(person.id)}
                      className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover"
                    >
                      <MemberAvatar person={person} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {person.name}
                          </span>
                          <VerifiedHandle person={person} />
                        </span>
                        <Handle
                          person={person}
                          size={10}
                          className="max-w-full truncate text-[11px] text-muted-foreground"
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Receive: an address and a shareable link, per asset. */
export function ReceiveSheet({
  open,
  tokenId,
  onClose,
}: {
  open: boolean;
  tokenId: string;
  onClose: () => void;
}): ReactNode {
  const copy = content.wallet;
  const [asset, setAsset] = useState(tokenId);
  const token = getToken(asset);
  const account = getWalletAccount();
  // Read from the signed-in identity rather than repeating the literal, so the
  // handle shown here cannot drift from the one used in Messages.
  const myHandle = handleOf(getCurrentMessageUser());

  return (
    <Sheet open={open} onClose={onClose} label={copy.receive}>
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{copy.receive}</h2>
        <TokenPicker selected={asset} onSelect={setAsset} label={copy.asset} />

        {/* Stand-in for a QR: a deterministic block grid, not a real code. */}
        <div className="flex justify-center py-2">
          <div
            className="grid size-40 grid-cols-11 gap-px rounded-xl bg-surface p-2"
            role="img"
            aria-label={copy.qrLabel}
          >
            {Array.from({ length: 121 }, (_, i) => {
              const on =
                (i * 7 + (i % 11) * 3 + account.address.charCodeAt(i % 20)) % 3 <
                1;
              return (
                <span
                  key={i}
                  className={on ? "bg-foreground" : "bg-transparent"}
                />
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {copy.yourHandle}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">
              {myHandle}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(myHandle);
                toast.success(copy.copied);
              }}
              aria-label={copy.copyHandle}
              className="focus-ring shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-pretty text-muted-foreground">
            {token?.base ? copy.receiveHintBsv : copy.receiveHintToken}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/** Exchange: swap between held assets with an explicit fee breakdown. */
export function ExchangeSheet({
  open,
  onClose,
  onExchange,
}: {
  open: boolean;
  onClose: () => void;
  onExchange: (args: {
    from: Token;
    to: Token;
    fromUnits: number;
    toUnits: number;
  }) => void;
}): ReactNode {
  const copy = content.wallet;
  const [fromId, setFromId] = useState("bsv");
  const [toId, setToId] = useState("eursv");
  const [amount, setAmount] = useState("");

  const from = getToken(fromId);
  const to = getToken(toId);
  const holding = holdingOf(fromId);
  const fromUnits = Number(amount);
  // Mid-market: value in, value out, minus a flat sub-cent network fee.
  const rate = from && to ? from.usdPerUnit / to.usdPerUnit : 0;
  const toUnits = Number.isFinite(fromUnits) ? fromUnits * rate : 0;
  const valid =
    from &&
    to &&
    from.id !== to.id &&
    fromUnits > 0 &&
    holding &&
    fromUnits <= holding.units;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={copy.exchange}
      footer={
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (from && to) onExchange({ from, to, fromUnits, toUnits });
          }}
          className="focus-ring w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {copy.confirmExchange}
        </button>
      }
    >
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{copy.exchange}</h2>

        <TokenPicker selected={fromId} onSelect={setFromId} label={copy.from} />
        <div>
          <div className="flex items-center gap-2 rounded-xl border border-border px-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="0"
              aria-label={copy.amount}
              className="h-12 min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
            />
            {from && (
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
                <TokenMark token={from} size={16} />
                {from.symbol}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <span
            className="flex size-8 items-center justify-center rounded-full bg-surface text-muted-foreground"
            aria-hidden="true"
          >
            <ArrowDown className="size-4" />
          </span>
        </div>

        <TokenPicker selected={toId} onSelect={setToId} label={copy.to} />
        <div className="rounded-xl bg-surface p-3">
          <p className="flex items-baseline gap-2 text-lg font-bold">
            {to ? formatUnits(toUnits, to.decimals) : "0"}
            {to && (
              <span className="inline-flex items-center gap-1 text-sm">
                <TokenMark token={to} size={14} />
                {to.symbol}
              </span>
            )}
          </p>
        </div>

        {from && to && (
          <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.rate}</dt>
              <dd>
                1 {from.symbol} = {formatUnits(rate, to.decimals)} {to.symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.networkFee}</dt>
              <dd>1 sat</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.midMarket}</dt>
              <dd className="flex items-center gap-1">
                <Check className="size-3 text-positive" aria-hidden="true" />
                {copy.noSpread}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </Sheet>
  );
}

/** Every token, for the picker's "add an asset" affordance. */
export function allTokens(): Token[] {
  return getTokens();
}
