"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getMessagePerson,
  getSplitBills,
  getToken,
  type SplitBill,
} from "@/lib/data";
import { firstName } from "@/lib/messages";
import { usd } from "@/lib/wallet";
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  Circle,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

type ShareStatus = "paid" | "pending" | "failed";

function StatusIcon({ status }: { status: ShareStatus }): ReactNode {
  const copy = content.wallet.shareStatus;
  if (status === "paid") {
    return (
      <Check className="size-3.5 shrink-0 text-positive" aria-label={copy.paid} />
    );
  }
  if (status === "failed") {
    return <X className="size-3.5 shrink-0 text-negative" aria-label={copy.failed} />;
  }
  return (
    <Circle
      className="size-3.5 shrink-0 text-muted-foreground"
      aria-label={copy.pending}
    />
  );
}

/** Paid-count bar. A split's whole story is how much of it has come back. */
function Progress({ paid, total }: { paid: number; total: number }): ReactNode {
  const pct = total === 0 ? 0 : (paid / total) * 100;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span
        className={`block h-full rounded-full transition-all ${
          paid === total ? "bg-positive" : "bg-accent"
        }`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

/**
 * One split in full: who owes what, what has come back, and what you can do
 * about the rest. Shares fail independently, so a failed leg is shown as a leg
 * to retry rather than as a broken split.
 */
function Detail({
  bill,
  overrides,
  onBack,
  onMark,
  onRemind,
}: {
  bill: SplitBill;
  overrides: Record<string, ShareStatus>;
  onBack: () => void;
  onMark: (personId: string, status: ShareStatus) => void;
  onRemind: (personId: string) => void;
}): ReactNode {
  const copy = content.wallet.splits;
  const token = getToken(bill.tokenId);
  const shares = bill.shares.map((share) => ({
    ...share,
    status: overrides[share.personId] ?? (share.status as ShareStatus),
  }));
  const paid = shares.filter((s) => s.status === "paid").length;
  const outstanding = shares
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => sum + s.units, 0);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={content.wallet.back}
          className="focus-ring -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">
          {bill.description}
        </h2>
      </div>

      <section className="rounded-2xl bg-surface p-5">
        <p className="flex items-baseline gap-2 text-2xl font-bold tracking-tight">
          {token ? formatUnits(bill.totalUnits, token.decimals) : bill.totalUnits}
          {token && (
            <span className="inline-flex items-center gap-1 text-base">
              <TokenMark token={token} size={16} />
              {token.symbol}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {token ? usd(bill.totalUnits * token.usdPerUnit) : ""} ·{" "}
          {shares.length} {copy.ways}
        </p>

        <div className="mt-4">
          <Progress paid={paid} total={shares.length} />
          <p className="mt-2 text-xs font-medium">
            {paid === shares.length ? (
              <span className="text-positive">{copy.settled}</span>
            ) : (
              <>
                {token
                  ? `${formatUnits(outstanding, token.decimals)} ${token.symbol}`
                  : outstanding}{" "}
                <span className="font-normal text-muted-foreground">
                  {copy.stillOwed}
                </span>
              </>
            )}
          </p>
        </div>
      </section>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
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
                className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
              >
                <MemberAvatar person={person} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {person.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {token
                      ? `${formatUnits(share.units, token.decimals)} ${token.symbol}`
                      : share.units}
                  </span>
                </span>
              </ProfileHovercard>

              <span className="flex shrink-0 items-center gap-1">
                <StatusIcon status={share.status} />
                {share.status === "pending" && (
                  <Tooltip label={copy.remind}>
                    <button
                      type="button"
                      onClick={() => onRemind(share.personId)}
                      aria-label={`${copy.remind} — ${person.name}`}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    >
                      <BellRing className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {share.status === "failed" && (
                  <Tooltip label={copy.retry}>
                    <button
                      type="button"
                      onClick={() => onMark(share.personId, "pending")}
                      aria-label={`${copy.retry} — ${person.name}`}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {share.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => onMark(share.personId, "paid")}
                    className="focus-ring rounded-full bg-accent/10 px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent/20"
                  >
                    {copy.markPaid}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 px-1 text-xs text-pretty text-muted-foreground">
        {copy.independentNote}
      </p>
    </div>
  );
}

/**
 * Splits — an amount divided across handles, with who has settled.
 *
 * Named for what it is rather than "Bills": these come from `/split` in a
 * conversation, and calling them bills implies an invoice nobody sent.
 */
export function Splits(): ReactNode {
  const copy = content.wallet.splits;
  const [openId, setOpenId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, Record<string, ShareStatus>>
  >({});

  const bills = getSplitBills();
  const open = openId ? bills.find((bill) => bill.id === openId) : null;

  if (open) {
    return (
      <Detail
        bill={open}
        overrides={overrides[open.id] ?? {}}
        onBack={() => setOpenId(null)}
        onMark={(personId, status) => {
          setOverrides((current) => ({
            ...current,
            [open.id]: { ...(current[open.id] ?? {}), [personId]: status },
          }));
          const person = getMessagePerson(personId);
          if (status === "paid" && person) {
            toast.success(`${firstName(person.name)} ${copy.settledUp}`);
          }
        }}
        onRemind={(personId) => {
          const person = getMessagePerson(personId);
          if (person) toast.info(`${copy.reminded} ${firstName(person.name)}`);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-1 text-lg font-bold">{copy.title}</h2>
      <p className="mb-3 text-sm text-pretty text-muted-foreground">
        {copy.hint}
      </p>

      <ul className="space-y-3">
        {bills.map((bill) => {
          const token = getToken(bill.tokenId);
          const local = overrides[bill.id] ?? {};
          const shares = bill.shares.map(
            (share) => local[share.personId] ?? (share.status as ShareStatus),
          );
          const paid = shares.filter((s) => s === "paid").length;
          const settled = paid === shares.length;

          return (
            <li key={bill.id}>
              <button
                type="button"
                onClick={() => setOpenId(bill.id)}
                className="focus-ring w-full rounded-2xl bg-surface p-4 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {bill.description}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        settled ? "text-positive" : "text-muted-foreground"
                      }`}
                    >
                      {settled
                        ? copy.settled
                        : `${paid} ${copy.of} ${shares.length} ${copy.settledCount}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      {token && <TokenMark token={token} size={14} />}
                      {token
                        ? formatUnits(bill.totalUnits, token.decimals)
                        : bill.totalUnits}
                    </span>
                    <ChevronRight
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                </span>

                <span className="mt-3 block">
                  <Progress paid={paid} total={shares.length} />
                </span>

                {/* Facepile: who is in it, without opening it. */}
                <span className="mt-3 flex items-center gap-2">
                  <span className="flex -space-x-1.5">
                    {bill.shares.slice(0, 5).map((share) => {
                      const person = getMessagePerson(share.personId);
                      if (!person) return null;
                      return (
                        <MemberAvatar
                          key={share.personId}
                          person={person}
                          size={20}
                          className="ring-2 ring-surface"
                        />
                      );
                    })}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {bill.shares
                      .map((share) =>
                        firstName(getMessagePerson(share.personId)?.name ?? ""),
                      )
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
