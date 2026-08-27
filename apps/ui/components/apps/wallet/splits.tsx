"use client";

/**
 * Splits — an amount divided across handles, with who has settled.
 *
 * Not the same as `/split` in a conversation, despite the name. That verb pays
 * an amount OUT, divided across recipients, and is done the moment it sends.
 * This is the opposite direction and it stays open: an amount somebody has
 * already covered, divided into what the others owe them back.
 *
 * One object, seen from two ends. A split you raised lists what everybody owes
 * YOU; a split somebody else raised lists what everybody owes THEM, and one of
 * those shares is yours to pay. Both are the same row — see `raisedBy` on
 * `SplitBill`, and lib/splits-store for where a raised one is kept.
 *
 * Three things here reach outside this file, and each is deliberate about where
 * the truth lives:
 *
 *   - Raising one opens a side pane, like a new payment link.
 *   - Paying a share opens the wallet's own send flow, carrying what it would
 *     settle. The share is marked when the money leaves, not when the sheet
 *     opens — see `settles` on `WalletIntent`.
 *   - A reminder opens the thread with the line written, rather than sending on
 *     somebody's behalf.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { useHub } from "@/components/hub/hub-provider";
import { Tooltip } from "@/components/hub/tooltip";
import {
  addChatThread,
  content,
  getChatThreadForPerson,
  getMessagePerson,
  getSplitBills,
  getToken,
  type SplitBill,
} from "@/lib/data";
import { firstName } from "@/lib/messages";
import {
  removeSplit,
  setShareStatus,
  statusOf,
  useRaisedSplits,
  useShareStatuses,
  type ShareStatus,
} from "@/lib/splits-store";
import { usd } from "@/lib/wallet";
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  Circle,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

function StatusIcon({ status }: { status: ShareStatus }): ReactNode {
  const copy = content.wallet.shareStatus;
  if (status === "paid") {
    return (
      <Tooltip label={copy.paid}>
        <span className="text-positive grid size-8 place-items-center">
          <Check className="size-4" aria-hidden="true" />
          <span className="sr-only">{copy.paid}</span>
        </span>
      </Tooltip>
    );
  }
  if (status === "failed") {
    return (
      <Tooltip label={copy.failed}>
        <span className="text-negative grid size-8 place-items-center">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">{copy.failed}</span>
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={copy.pending}>
      <span className="text-muted-foreground grid size-8 place-items-center">
        <Circle className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{copy.pending}</span>
      </span>
    </Tooltip>
  );
}

function Progress({ paid, total }: { paid: number; total: number }): ReactNode {
  const pct = total === 0 ? 0 : Math.round((paid / total) * 100);
  return (
    <div
      className="bg-muted h-1.5 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={paid}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={`h-full rounded-full transition-[width] ${
          paid === total ? "bg-positive" : "bg-accent"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * The current state of every share, overrides applied.
 *
 * A split carries the status it was seeded with; the store carries whatever has
 * happened since. Reading them together here rather than at each call site is
 * what keeps the list, the detail and the progress bar from disagreeing.
 */
function sharesWithStatus(
  bill: SplitBill
): { personId: string; units: number; status: ShareStatus }[] {
  return bill.shares.map((share) => ({
    ...share,
    status: statusOf(bill.id, share.personId, share.status),
  }));
}

/** Your own share, on a split somebody else raised. */
function yourStatus(bill: SplitBill): ShareStatus {
  return statusOf(bill.id, "you", bill.yourShareStatus ?? "pending");
}

/**
 * How far along a split is, counting every way it was divided.
 *
 * Your own share counts here even though it is rendered apart from the others:
 * "2 of 3 settled" on a bill split four ways is a number that does not describe
 * anything, and the one share missing from it would be the reader's own.
 */
function tally(bill: SplitBill): {
  paid: number;
  total: number;
  outstanding: number;
} {
  const shares = sharesWithStatus(bill);
  let paid = shares.filter((share) => share.status === "paid").length;
  let total = shares.length;
  let outstanding = shares
    .filter((share) => share.status !== "paid")
    .reduce((sum, share) => sum + share.units, 0);
  if (bill.raisedBy) {
    total += 1;
    if (yourStatus(bill) === "paid") paid += 1;
    else outstanding += bill.yourShareUnits ?? 0;
  }
  return { paid, total, outstanding };
}

/**
 * The conversation with somebody, started if there is none.
 *
 * Outside the component because it stamps an id from the clock, which a
 * component body may not read. Starting one rather than refusing follows the
 * profile card's message action — a split can name a wallet contact you have
 * never messaged, and that is exactly when a reminder is needed.
 */
function threadWith(personId: string): { id: string; created: boolean } {
  const existing = getChatThreadForPerson(personId);
  if (existing) return { id: existing.id, created: false };
  const id = `thread-${Date.now()}`;
  addChatThread({ id, personId, createdAt: new Date().toISOString() });
  return { id, created: true };
}

function Detail({
  bill,
  owned,
  onBack,
}: {
  bill: SplitBill;
  /** raised here rather than seeded, so it is yours to delete */
  owned: boolean;
  onBack: () => void;
}): ReactNode {
  const copy = content.wallet.splits;
  const hub = useHub();
  const token = getToken(bill.tokenId);
  const shares = sharesWithStatus(bill);
  const { paid, total, outstanding } = tally(bill);
  const owner = bill.raisedBy ? getMessagePerson(bill.raisedBy) : null;
  const mine = yourStatus(bill);

  /**
   * Opens the thread with the reminder already written.
   *
   * Not sent: chasing somebody for money is a thing a person says, not a thing
   * a wallet should say for them. The composer takes the seed and the send is
   * still theirs.
   */
  const remind = (personId: string, units: number): void => {
    const person = getMessagePerson(personId);
    if (!person) return;
    hub.openApp("messages");
    const thread = threadWith(personId);
    if (thread.created) hub.bumpConversations();
    hub.setMessageThread(thread.id);
    hub.seedComposer(
      `${firstName(person.name)}, ${copy.reminderDraft
        .replace("{what}", bill.description)
        .replace(
          "{amount}",
          token ? `${formatUnits(units, token.decimals)} ${token.symbol}` : ""
        )}`
    );
  };

  /** The wallet's own send flow, told what it would settle. */
  const payShare = (): void => {
    if (!bill.raisedBy) return;
    hub.setWalletIntent({
      kind: "send",
      tokenId: bill.tokenId,
      personId: bill.raisedBy,
      ...(bill.yourShareUnits ? { units: bill.yourShareUnits } : {}),
      settles: { splitId: bill.id, personId: "you" },
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={content.wallet.back}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1.5"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">
          {bill.description}
        </h2>
        {owned && (
          <Tooltip label={copy.remove}>
            <button
              type="button"
              onClick={() => {
                removeSplit(bill.id);
                toast.success(copy.removed, { description: bill.description });
                onBack();
              }}
              aria-label={copy.remove}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-negative rounded-md p-1.5"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      <section className="bg-surface rounded-2xl p-5">
        <p className="flex items-baseline gap-2 text-2xl font-bold tracking-tight">
          {token
            ? formatUnits(bill.totalUnits, token.decimals)
            : bill.totalUnits}
          {token && (
            <span className="inline-flex items-center gap-1 text-base">
              <TokenMark token={token} size={16} />
              {token.symbol}
            </span>
          )}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {token ? usd(bill.totalUnits * token.usdPerUnit) : ""} · {total}{" "}
          {copy.ways}
          {owner && (
            <>
              {" · "}
              {copy.raisedByLabel} {owner.name}
            </>
          )}
        </p>

        <div className="mt-4">
          <Progress paid={paid} total={total} />
          <p className="mt-2 text-xs font-medium">
            {paid === total ? (
              <span className="text-positive">{copy.settled}</span>
            ) : (
              <>
                {token
                  ? `${formatUnits(outstanding, token.decimals)} ${token.symbol}`
                  : outstanding}{" "}
                <span className="text-muted-foreground font-normal">
                  {/* "owed to you" is only true on one you raised. */}
                  {bill.raisedBy ? copy.stillOutstanding : copy.stillOwed}
                </span>
              </>
            )}
          </p>
        </div>
      </section>

      {/* Your own share, on one somebody else raised. Above the others because
          it is the only line on this screen you can act on. */}
      {bill.raisedBy && (
        <section className="bg-surface mt-4 flex items-center gap-3 rounded-2xl p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{copy.yourShare}</span>
            <span className="text-muted-foreground block text-xs tabular-nums">
              {token && bill.yourShareUnits
                ? `${formatUnits(bill.yourShareUnits, token.decimals)} ${token.symbol}`
                : ""}
            </span>
          </span>
          {mine === "paid" ? (
            <span className="text-positive flex items-center gap-1.5 text-xs font-bold">
              <Check className="size-4" aria-hidden="true" />
              {copy.yourSharePaid}
            </span>
          ) : (
            <button
              type="button"
              onClick={payShare}
              className="focus-ring bg-accent text-accent-foreground rounded-full px-3.5 py-2 text-xs font-bold"
            >
              {copy.payShare}
            </button>
          )}
        </section>
      )}

      <ul className="divide-border bg-surface mt-4 divide-y overflow-hidden rounded-2xl">
        {shares.map((share) => {
          const person = getMessagePerson(share.personId);
          if (!person) return null;
          return (
            <li
              key={share.personId}
              className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap"
            >
              <ProfileHovercard
                person={person}
                wrapperClassName="min-w-0 flex-1"
                className="focus-ring flex w-full min-w-0 items-center gap-2.5 rounded-lg text-left"
              >
                <MemberAvatar person={person} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {person.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {token
                      ? `${formatUnits(share.units, token.decimals)} ${token.symbol}`
                      : share.units}
                  </span>
                </span>
              </ProfileHovercard>

              <span className="flex shrink-0 items-center gap-1">
                <StatusIcon status={share.status} />
                {/* Chasing and marking are the creditor's, so they are absent
                    on a split somebody else raised — those shares are not
                    yours to settle or to chase. */}
                {!bill.raisedBy && share.status === "pending" && (
                  <Tooltip label={copy.remind}>
                    <button
                      type="button"
                      onClick={() => remind(share.personId, share.units)}
                      aria-label={`${copy.remind} — ${person.name}`}
                      className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground grid size-8 place-items-center rounded-lg"
                    >
                      <BellRing className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {!bill.raisedBy && share.status === "failed" && (
                  <Tooltip label={copy.retry}>
                    <button
                      type="button"
                      onClick={() =>
                        setShareStatus(bill.id, share.personId, "pending")
                      }
                      aria-label={`${copy.retry} — ${person.name}`}
                      className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground grid size-8 place-items-center rounded-lg"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {!bill.raisedBy && share.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() =>
                      setShareStatus(bill.id, share.personId, "paid")
                    }
                    className="focus-ring bg-accent/10 text-accent hover:bg-accent/20 rounded-full px-2.5 py-1.5 text-xs font-bold"
                  >
                    {copy.markPaid}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground mt-3 px-1 text-xs text-pretty">
        {copy.independentNote}
      </p>
    </div>
  );
}

/** One row in either list. */
function Row({
  bill,
  onOpen,
}: {
  bill: SplitBill;
  onOpen: () => void;
}): ReactNode {
  const copy = content.wallet.splits;
  const token = getToken(bill.tokenId);
  const { paid, total } = tally(bill);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring bg-surface hover:bg-surface-hover flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {bill.description}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
            {token
              ? `${formatUnits(bill.totalUnits, token.decimals)} ${token.symbol}`
              : bill.totalUnits}{" "}
            · {paid} {copy.of} {total} {copy.settledCount}
          </span>
          <span className="mt-2 block">
            <Progress paid={paid} total={total} />
          </span>
        </span>
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

export function Splits(): ReactNode {
  const copy = content.wallet.splits;
  const { openDetailPane } = useHub();
  const [openId, setOpenId] = useState<string | null>(null);
  /* Subscribed to, not merely read: `statusOf` and the raised list are plain
     reads, so without these nothing repaints when a share settles. */
  const raised = useRaisedSplits();
  useShareStatuses();

  const accountId = useWalletAccountId();
  const all = [...raised, ...getSplitBills(accountId)];
  const open = openId ? all.find((bill) => bill.id === openId) : null;

  if (open) {
    return (
      <Detail
        bill={open}
        owned={raised.some((bill) => bill.id === open.id)}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const owedToYou = all.filter((bill) => !bill.raisedBy);
  const youOwe = all.filter((bill) => bill.raisedBy);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-lg font-bold">{copy.title}</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {copy.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openDetailPane({ kind: "new-split", id: "" })}
          className="focus-ring bg-accent text-accent-foreground flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold"
        >
          <Plus className="size-4" aria-hidden="true" />
          {copy.newSplit}
        </button>
      </div>

      {all.length === 0 && (
        <div className="bg-surface rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold">{copy.empty}</p>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            {copy.emptyHint}
          </p>
        </div>
      )}

      {youOwe.length > 0 && (
        <>
          <h3 className="text-muted-foreground mt-4 mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
            {copy.youOwe}
          </h3>
          <ul className="space-y-3">
            {youOwe.map((bill) => (
              <Row
                key={bill.id}
                bill={bill}
                onOpen={() => setOpenId(bill.id)}
              />
            ))}
          </ul>
        </>
      )}

      {owedToYou.length > 0 && (
        <>
          <h3 className="text-muted-foreground mt-4 mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
            {copy.owedToYou}
          </h3>
          <ul className="space-y-3">
            {owedToYou.map((bill) => (
              <Row
                key={bill.id}
                bill={bill}
                onOpen={() => setOpenId(bill.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
