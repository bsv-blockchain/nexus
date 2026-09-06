"use client";

import { TokenMark } from "@/components/apps/wallet/token-mark";
import { useHub } from "@/components/hub/hub-provider";
import { activeWalletFor } from "@/lib/wallets-store";
import { ConnectPicker } from "@/components/hub/connect-picker";
import { content, getTokens } from "@/lib/data";
import { createPaymentLink } from "@/lib/payment-links-store";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

/** What the seeded links actually differ by: a named price, or the payer's call. */
const KINDS = ["fixed", "open"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Offered rather than typed.
 *
 * The seeded links run a day, a fortnight and a month, so those are the shapes
 * this is for. A date picker would invite precision the thing does not have —
 * and every one of these is a round number somebody would have reached for
 * anyway.
 */
const EXPIRY_DAYS = [1, 14, 30, 90] as const;

/** Ties the footer's button to the form it submits, across the pane's frame. */
const FORM_ID = "new-payment-link";

interface Draft {
  description: string;
  kind: Kind;
  /** kept as typed, so a half-entered "0." is not rounded out from under them */
  amount: string;
  tokenId: string;
  expiresInDays: number;
}

const EMPTY_DRAFT: Draft = {
  description: "",
  kind: "fixed",
  amount: "",
  tokenId: "",
  expiresInDays: 30,
};

/*
 * The draft lives in the module, not in the body component.
 *
 * SidePane renders its `footer` as a SIBLING of its children, so the Create
 * button and the fields it commits cannot share React state — and the button has
 * to know whether the form is complete or it is a control that lies about being
 * available. A store is the smallest thing both can read. Same two-exports shape
 * as AppOnboardingPane/Footer and LicencePane/Footer.
 */
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

/** Parsed amount, or NaN. */
function amountOf(current: Draft): number {
  return Number.parseFloat(current.amount);
}

/**
 * Whether this could be created.
 *
 * A fixed-price link with no price is the one state the form can reach that
 * would make a link nobody can pay.
 */
function isReady(current: Draft): boolean {
  const units = amountOf(current);
  return (
    current.description.trim().length > 0 &&
    current.tokenId.length > 0 &&
    (current.kind === "open" || (Number.isFinite(units) && units > 0))
  );
}

/**
 * New payment link, as a side pane.
 *
 * A side pane rather than the modal sheet the button used to promise, matching
 * conversation settings: the list stays beside it, so the thing you are adding
 * to is still visible while you describe what you are adding.
 *
 * Unlike that pane, this one commits on a button. Conversation settings edits
 * something that already exists, so applying each change as it is made is the
 * honest model; a link does not exist until every part of it has been decided,
 * and half a link is not a link.
 */
export function NewPaymentLinkPane({
  onCreated,
}: {
  onCreated: (linkId: string, description: string) => void;
}): ReactNode {
  /* Which wallet this lands in: the one the workspace is spending from, which
     is also the one whose list the new row has to appear in. */
  const { activeSpaceId } = useHub();
  const walletId = activeWalletFor(activeSpaceId)?.id ?? "";
  const copy = content.wallet.newLinkPane;
  const tokens = getTokens();
  const current = useDraft();

  /* Cleared on the way out rather than on the way in, so reopening after a
     mistaken close does not lose what was typed, but a fresh Create starts
     blank. */
  useEffect(() => () => setDraft(EMPTY_DRAFT), []);

  /* The first token is the default, and it has to be chosen once the list is
     known rather than in the initial draft, which cannot see lib/data. */
  useEffect(() => {
    if (!draft.tokenId && tokens[0]) setDraft({ tokenId: tokens[0].id });
  }, [tokens]);

  const token = tokens.find((entry) => entry.id === current.tokenId) ?? null;

  return (
    <form
      id={FORM_ID}
      /* The pane gives its children no padding — every pane sets its own, and
         this is the same p-4 the licence and settings panes use. */
      className="space-y-5 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isReady(draft)) return;
        const link = createPaymentLink(
          {
            description: draft.description.trim(),
            tokenId: draft.tokenId,
            ...(draft.kind === "fixed" ? { amountUnits: amountOf(draft) } : {}),
            expiresInDays: draft.expiresInDays,
          },
          walletId,
        );
        onCreated(link.id, link.description);
      }}
    >
      <Field label={copy.descriptionLabel} hint={copy.descriptionHint}>
        <input
          value={current.description}
          onChange={(event) => setDraft({ description: event.target.value })}
          placeholder={copy.descriptionPlaceholder}
          className="focus-ring bg-surface ring-border/60 w-full rounded-lg px-3 py-2 text-sm ring-1"
        />
      </Field>

      <Field
        label={copy.kindLabel}
        hint={current.kind === "fixed" ? copy.kindFixedHint : copy.kindOpenHint}
      >
        <div
          role="group"
          aria-label={copy.kindLabel}
          className="bg-surface ring-border/60 grid grid-cols-2 gap-0.5 rounded-lg p-0.5 ring-1"
        >
          {KINDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={current.kind === option}
              onClick={() => setDraft({ kind: option })}
              className={`focus-ring rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                current.kind === option
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "fixed" ? copy.kindFixed : copy.kindOpen}
            </button>
          ))}
        </div>
      </Field>

      {/* Only where there is an amount to name. A disabled field beside "Payer
          chooses" would be a box asking a question the answer has already
          settled. */}
      {current.kind === "fixed" && (
        <Field label={copy.amountLabel}>
          <input
            value={current.amount}
            onChange={(event) => setDraft({ amount: event.target.value })}
            inputMode="decimal"
            placeholder="0.00"
            className="focus-ring bg-surface ring-border/60 w-full rounded-lg px-3 py-2 text-sm tabular-nums ring-1"
          />
        </Field>
      )}

      {/*
        A picker rather than a row of chips.

        Chips fit four tokens and stop working at forty, and the list here is
        whatever the wallet holds. ConnectPicker is the control the profile
        connections already use for exactly this shape of question — one thing
        chosen from a list that might be long, with the filtering inline.
      */}
      <Field label={copy.assetLabel}>
        <ConnectPicker
          label={copy.assetLabel}
          emptyLabel={copy.assetEmpty}
          connected={
            token
              ? {
                  id: token.id,
                  label: token.symbol,
                  hint: token.name,
                  mark: <TokenMark token={token} size={16} />,
                }
              : null
          }
          options={tokens.map((entry) => ({
            id: entry.id,
            label: entry.symbol,
            hint: entry.name,
            mark: <TokenMark token={entry} size={16} />,
          }))}
          onPick={(id) => setDraft({ tokenId: id })}
        />
      </Field>

      <Field label={copy.expiryLabel}>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY_DAYS.map((days) => {
            const selected = days === current.expiresInDays;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={selected}
                onClick={() => setDraft({ expiresInDays: days })}
                className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors ${
                  selected
                    ? "bg-accent/20 ring-accent/40 text-foreground"
                    : "bg-surface ring-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {days} {copy.expiryDays}
              </button>
            );
          })}
        </div>
      </Field>

      <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
        {copy.noBackendNote}
      </p>
    </form>
  );
}

/**
 * The commit, pinned to the bottom of the pane with the form scrolling behind it.
 *
 * `form` rather than a click handler: the button is outside the element it
 * submits, which is the whole reason this is a separate export — and it keeps
 * Enter from inside a text field doing the same thing as the press.
 */
export function NewPaymentLinkFooter(): ReactNode {
  const copy = content.wallet.newLinkPane;
  const current = useDraft();
  return (
    <button
      type="submit"
      form={FORM_ID}
      disabled={!isReady(current)}
      className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
    >
      {copy.submit}
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
    <label className="block">
      <span className="text-muted-foreground block pb-1.5 text-[10px] font-semibold tracking-[1px] uppercase">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground mt-1.5 block text-[11px] leading-relaxed text-pretty">
          {hint}
        </span>
      )}
    </label>
  );
}
