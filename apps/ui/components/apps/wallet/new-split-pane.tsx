"use client";

/**
 * Raising a split, as a side pane.
 *
 * The same shape as a new payment link, for the same reason: the list stays
 * beside it, so what you are adding to is visible while you describe what you
 * are adding, and it commits on a button because half a split is not a split.
 *
 * The draft lives in the module rather than in the body component. `SidePane`
 * renders its footer as a SIBLING of its children, so the button and the fields
 * it commits cannot share React state — and a button that cannot see the form
 * is a control that lies about being available.
 *
 * @see components/apps/wallet/new-payment-link-pane.tsx — the pane this follows
 * @see lib/splits-store.ts — where a raised split goes
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { formatUnits } from "@/components/apps/wallet/token-mark";
import { content, getTokens, getWalletContacts } from "@/lib/data";
import { createSplit } from "@/lib/splits-store";
import { Check, Search, X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

const FORM_ID = "new-split";

type Mode = "even" | "custom";

interface Draft {
  description: string;
  tokenId: string;
  /** kept as typed, so a half-entered "0." is not rounded out from under them */
  amount: string;
  mode: Mode;
  people: string[];
  /** person id to the typed share, only in `custom` */
  shares: Record<string, string>;
  query: string;
}

const EMPTY_DRAFT: Draft = {
  description: "",
  tokenId: "",
  amount: "",
  mode: "even",
  people: [],
  shares: {},
  query: "",
};

let draft: Draft = EMPTY_DRAFT;
const listeners = new Set<() => void>();

function setDraft(patch: Partial<Draft>): void {
  draft = { ...draft, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useDraft(): Draft {
  return useSyncExternalStore(
    subscribe,
    () => draft,
    () => EMPTY_DRAFT
  );
}

const totalOf = (current: Draft): number => Number.parseFloat(current.amount);

/**
 * What each person owes.
 *
 * Even mode divides and gives the remainder to the first share rather than
 * spreading a rounding error across all of them: the shares have to add up to
 * the total exactly, and one person paying a satoshi more is a truer answer
 * than four people each paying an amount that does not sum.
 */
export function sharesOf(
  current: Draft,
  decimals: number
): { personId: string; units: number }[] {
  const total = totalOf(current);
  if (!Number.isFinite(total) || total <= 0) return [];
  if (current.mode === "custom") {
    return current.people.map((personId) => ({
      personId,
      units: Number.parseFloat(current.shares[personId] ?? "") || 0,
    }));
  }
  const step = 10 ** decimals;
  const units = Math.floor((total / current.people.length) * step) / step;
  const spare =
    Math.round((total - units * current.people.length) * step) / step;
  return current.people.map((personId, index) => ({
    personId,
    units: index === 0 ? Math.round((units + spare) * step) / step : units,
  }));
}

function isReady(current: Draft, decimals: number): boolean {
  const total = totalOf(current);
  if (!current.description.trim() || !current.tokenId) return false;
  if (!Number.isFinite(total) || total <= 0) return false;
  if (current.people.length === 0) return false;
  const shares = sharesOf(current, decimals);
  if (shares.some((share) => share.units <= 0)) return false;
  /* Custom shares must not exceed the total. Under is allowed: somebody may be
     covering the rest themselves, which is a normal way to split a bill. */
  const sum = shares.reduce((acc, share) => acc + share.units, 0);
  return sum <= total + 10 ** -decimals;
}

export function NewSplitPane({
  onCreated,
}: {
  onCreated: (splitId: string, description: string) => void;
}): ReactNode {
  const copy = content.wallet.splits;
  const tokens = getTokens();
  const current = useDraft();
  const token = tokens.find((entry) => entry.id === current.tokenId) ?? null;
  const decimals = token?.decimals ?? 8;

  /* Cleared on the way out rather than on the way in, so reopening after a
     mistaken close keeps what was typed and a fresh raise starts blank. */
  useEffect(() => () => setDraft(EMPTY_DRAFT), []);

  useEffect(() => {
    if (!draft.tokenId && tokens[0]) setDraft({ tokenId: tokens[0].id });
  }, [tokens]);

  const needle = current.query.trim().toLowerCase();
  const contacts = getWalletContacts().filter(
    (person) =>
      !current.people.includes(person.id) &&
      (!needle ||
        person.name.toLowerCase().includes(needle) ||
        person.handle.toLowerCase().includes(needle))
  );

  const shares = sharesOf(current, decimals);
  const allocated = shares.reduce((sum, share) => sum + share.units, 0);
  const total = totalOf(current);
  const remainder = Number.isFinite(total) ? total - allocated : 0;

  return (
    <form
      id={FORM_ID}
      className="space-y-5 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isReady(draft, decimals)) return;
        const split = createSplit(
          {
            description: draft.description,
            tokenId: draft.tokenId,
            shares: sharesOf(draft, decimals),
          },
          new Date().toISOString()
        );
        onCreated(split.id, split.description);
      }}
    >
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {copy.newHint}
      </p>

      <Field label={copy.descriptionLabel}>
        <input
          value={current.description}
          onChange={(event) => setDraft({ description: event.target.value })}
          placeholder={copy.descriptionPlaceholder}
          className="focus-ring bg-surface ring-border/60 w-full rounded-lg px-3 py-2 text-sm ring-1"
        />
      </Field>

      <Field label={copy.amountLabel} hint={copy.amountHint}>
        <div className="flex gap-2">
          <input
            value={current.amount}
            onChange={(event) => setDraft({ amount: event.target.value })}
            inputMode="decimal"
            placeholder="0.00"
            className="focus-ring bg-surface ring-border/60 min-w-0 flex-1 rounded-lg px-3 py-2 text-sm tabular-nums ring-1"
          />
          <select
            value={current.tokenId}
            onChange={(event) => setDraft({ tokenId: event.target.value })}
            aria-label={content.wallet.asset}
            className="focus-ring bg-surface ring-border/60 rounded-lg px-2 py-2 text-sm font-semibold ring-1"
          >
            {tokens.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.symbol}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field label={copy.peopleLabel} hint={copy.peopleHint}>
        {current.people.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {current.people.map((personId) => {
              const person = getWalletContacts().find((p) => p.id === personId);
              if (!person) return null;
              const share = shares.find((s) => s.personId === personId);
              return (
                <li
                  key={personId}
                  className="bg-surface ring-border/60 flex items-center gap-2 rounded-lg px-2 py-1.5 ring-1"
                >
                  <MemberAvatar person={person} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {person.name}
                  </span>
                  {current.mode === "custom" ? (
                    <input
                      value={current.shares[personId] ?? ""}
                      onChange={(event) =>
                        setDraft({
                          shares: {
                            ...current.shares,
                            [personId]: event.target.value,
                          },
                        })
                      }
                      inputMode="decimal"
                      aria-label={`${person.name} — ${copy.yourShare}`}
                      className="focus-ring bg-surface-raised ring-border/60 w-24 rounded-md px-2 py-1 text-right text-xs tabular-nums ring-1"
                    />
                  ) : (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {share
                        ? `${formatUnits(share.units, decimals)}${token ? ` ${token.symbol}` : ""}`
                        : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        people: current.people.filter((id) => id !== personId),
                      })
                    }
                    aria-label={`Remove ${person.name}`}
                    className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="bg-surface ring-border/60 flex items-center gap-2 rounded-lg px-2.5 py-2 ring-1">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <input
            value={current.query}
            onChange={(event) => setDraft({ query: event.target.value })}
            placeholder={content.wallet.toPlaceholder}
            aria-label={copy.peopleLabel}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {contacts.length > 0 && (
          <ul className="ring-border/60 mt-1.5 max-h-44 overflow-y-auto rounded-lg ring-1">
            {contacts.slice(0, 8).map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      people: [...current.people, person.id],
                      query: "",
                    })
                  }
                  className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2 px-2.5 py-2 text-left"
                >
                  <MemberAvatar person={person} size={22} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {person.name}
                  </span>
                  <span className="text-muted-foreground truncate text-[11px]">
                    @{person.handle}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {current.people.length > 0 && (
        <Field label={copy.sharesLabel}>
          <div
            role="group"
            className="bg-surface ring-border/60 grid grid-cols-2 gap-0.5 rounded-lg p-0.5 ring-1"
          >
            {(["even", "custom"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={current.mode === option}
                onClick={() => setDraft({ mode: option })}
                className={`focus-ring rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  current.mode === option
                    ? "bg-accent/20 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "even" ? copy.evenly : copy.custom}
              </button>
            ))}
          </div>
          {current.mode === "custom" && token && (
            <p
              className={`mt-2 text-[11px] ${
                remainder < 0 ? "text-negative" : "text-muted-foreground"
              }`}
            >
              {remainder < 0
                ? copy.over
                : `${copy.remainder}: ${formatUnits(Math.max(0, remainder), decimals)} ${token.symbol}`}
            </p>
          )}
        </Field>
      )}
    </form>
  );
}

/**
 * The pane's own button, in the footer.
 *
 * Reads the same module draft the fields write to, which is the whole reason
 * that draft is not component state.
 */
export function NewSplitFooter(): ReactNode {
  const copy = content.wallet.splits;
  const current = useDraft();
  const token = getTokens().find((entry) => entry.id === current.tokenId);
  const ready = isReady(current, token?.decimals ?? 8);

  return (
    <button
      type="submit"
      form={FORM_ID}
      disabled={!ready}
      className="focus-ring bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40"
    >
      <Check className="size-4" aria-hidden="true" />
      {copy.raise}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <p className="text-[11px] font-semibold">{label}</p>
      {hint && (
        <p className="text-muted-foreground mt-0.5 mb-1.5 text-[11px] text-pretty">
          {hint}
        </p>
      )}
      <div className={hint ? "" : "mt-1.5"}>{children}</div>
    </div>
  );
}
