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
import { Copy, Search } from "lucide-react";
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
  presetUnits,
  onClose,
  onSend,
}: {
  open: boolean;
  tokenId: string;
  presetPersonId?: string | null;
  /** opens on this amount, for a caller that already knows it — a split share */
  presetUnits?: number | null;
  onClose: () => void;
  onSend: (args: {
    token: Token;
    units: number;
    person: MessagePerson;
  }) => void;
}): ReactNode {
  const copy = content.wallet;
  const [asset, setAsset] = useState(tokenId);
  const [amount, setAmount] = useState(presetUnits ? String(presetUnits) : "");
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState<string | null>(
    presetPersonId ?? null
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
        handleOf(person).toLowerCase().includes(needle)
    )
    .slice(0, 6);
  /* Looked up across every contact rather than in `people`, which is the search
     results capped at six. A recipient the caller preset — a split's payee —
     need not be in that window, and finding nothing there rendered the search
     box while the send button was already enabled. */
  const chosen = personId
    ? getWalletContacts().find((p) => p.id === personId)
    : null;

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
          className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
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
            className="text-muted-foreground mb-1.5 block text-[11px] font-bold tracking-wide uppercase"
          >
            {copy.amount}
          </label>
          <div className="border-border flex items-center gap-2 rounded-xl border px-3">
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
          <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
            <span>
              {token && units > 0 ? usd(units * token.usdPerUnit) : usd(0)}
            </span>
            {holding && token && (
              <button
                type="button"
                onClick={() => setAmount(String(holding.units))}
                className="focus-ring hover:text-foreground rounded font-semibold"
              >
                {copy.max} {formatUnits(holding.units, token.decimals)}
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
            {copy.to}
          </p>
          {chosen ? (
            <div className="border-accent bg-accent/10 flex items-center gap-2.5 rounded-xl border p-3">
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
                  className="text-muted-foreground max-w-full truncate text-xs"
                />
              </span>
              <button
                type="button"
                onClick={() => setPersonId(null)}
                className="focus-ring text-muted-foreground hover:bg-surface-hover shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
              >
                {copy.change}
              </button>
            </div>
          ) : (
            <>
              <div className="border-border flex items-center gap-2 rounded-xl border px-3">
                <Search
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.toPlaceholder}
                  aria-label={copy.to}
                  className="placeholder:text-muted-foreground h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <ul className="mt-2 space-y-0.5">
                {people.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setPersonId(person.id)}
                      className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
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
                          className="text-muted-foreground max-w-full truncate text-[11px]"
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
            className="bg-surface grid size-40 grid-cols-11 gap-px rounded-xl p-2"
            role="img"
            aria-label={copy.qrLabel}
          >
            {Array.from({ length: 121 }, (_, i) => {
              const on =
                (i * 7 + (i % 11) * 3 + account.address.charCodeAt(i % 20)) %
                  3 <
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
          <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
            {copy.yourHandle}
          </p>
          <div className="border-border flex items-center gap-2 rounded-xl border px-3 py-2.5">
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
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded p-1"
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs text-pretty">
            {token?.base ? copy.receiveHintBsv : copy.receiveHintToken}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/** Every token, for the picker's "add an asset" affordance. */
export function allTokens(): Token[] {
  return getTokens();
}
