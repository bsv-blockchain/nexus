"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { Spark } from "@/components/apps/wallet/portfolio";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getEcosystem,
  getMessagePerson,
  getPaymentLinks,
  getToken,
  type MessagePerson,
  type WalletTransaction,
} from "@/lib/data";
import { whoisFor } from "@/lib/messages";
import {
  changeTone,
  groupByDay,
  percent,
  txToken,
  txUnits,
  txUsd,
  usd,
} from "@/lib/wallet";
import { useHolding } from "@/lib/wallet-live";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

function Page({
  title,
  onBack,
  children,
  action,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={content.wallet.back}
            className="focus-ring -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Vela's gold verified pill, sourced from BRC-169 rather than a social login:
 * a valid handle certificate plus at least one peer attestation. The tooltip
 * says what it actually proves.
 */
export function VerifiedHandle({
  person,
}: {
  person: MessagePerson;
}): ReactNode {
  const who = whoisFor(person);
  const verified = who.certificate === "valid" && who.attestations > 0;
  if (!verified) return null;
  return (
    <Tooltip label={content.wallet.verifiedHint} className="shrink-0">
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">
        <BadgeCheck className="size-3" aria-hidden="true" />
        {content.wallet.verified}
      </span>
    </Tooltip>
  );
}

/* ------------------------------------------------------------ token detail */

export function TokenDetail({
  tokenId,
  transactions,
  onBack,
  onSend,
  onReceive,
  onOpenTx,
}: {
  tokenId: string;
  transactions: WalletTransaction[];
  onBack: () => void;
  onSend: (tokenId: string) => void;
  onReceive: (tokenId: string) => void;
  onOpenTx: (id: string) => void;
}): ReactNode {
  const copy = content.wallet;
  // The holding comes from the portfolio, not from the fixtures: this screen used to
  // print the demo's 34.2180455 BSV at the demo's $72.50 to a live wallet, above an
  // activity list that was correctly empty.
  const { holding, loading, showTrend } = useHolding(tokenId);
  if (loading && !holding) {
    return <Page title={copy.loading} onBack={onBack}>{null}</Page>;
  }
  if (!holding) {
    return <Page title={copy.notFound} onBack={onBack}>{null}</Page>;
  }
  const token = holding.token;
  const own = transactions.filter(
    (tx) => (tx.tokenId ?? "bsv") === tokenId,
  );

  return (
    <Page title={token.name} onBack={onBack}>
      <section className="rounded-2xl bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2 text-2xl font-bold tracking-tight">
              {formatUnits(holding.units, token.decimals)}
              <span className="inline-flex items-center gap-1 text-base">
                <TokenMark token={token} size={16} />
                {token.symbol}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {usd(holding.usd)}{" "}
              {/* A 24h move is a fixture property. Nothing on a live device knows
                  what this asset did yesterday, and "+0.0%" would answer as if it did. */}
              {showTrend && (
                <span className={`font-semibold ${changeTone(token.change24h)}`}>
                  {percent(token.change24h)}
                </span>
              )}
            </p>
          </div>
          {showTrend && <Spark holding={holding} width={96} height={34} />}
        </div>

        {token.blurb && (
          <p className="mt-4 text-sm text-pretty text-muted-foreground">
            {token.blurb}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          {token.protocol && (
            <div>
              <dt className="text-xs text-muted-foreground">{copy.protocol}</dt>
              <dd className="mt-0.5 font-medium">{token.protocol}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{copy.issuer}</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
              {token.ecosystem ? (
                <>
                  <TokenMark token={token} size={14} />
                  {getEcosystem(token.ecosystem)?.name}
                </>
              ) : (
                copy.independent
              )}
            </dd>
          </div>
          {token.peg && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{copy.peg}</dt>
              <dd className="mt-0.5 font-medium">{token.peg.note}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSend(tokenId)}
            className="focus-ring flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
            {copy.send}
          </button>
          <button
            type="button"
            onClick={() => onReceive(tokenId)}
            className="focus-ring flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
          >
            <ArrowDownLeft className="size-4" aria-hidden="true" />
            {copy.receive}
          </button>
        </div>
      </section>

      <h3 className="mt-6 px-1 text-sm font-semibold">
        {copy.activityIn} {token.symbol}
      </h3>
      <ActivityList
        transactions={own}
        onOpen={onOpenTx}
        empty={copy.noTokenActivity}
      />
    </Page>
  );
}

/* ---------------------------------------------------------------- activity */

/**
 * Transactions under day headings, with an optional search box. Grouping by day
 * is what makes a list of payments legible — an undifferentiated column of rows
 * tells you nothing about when anything happened.
 */
export function Activity({
  transactions,
  onOpen,
  empty,
}: {
  transactions: WalletTransaction[];
  onOpen: (id: string) => void;
  empty: string;
}): ReactNode {
  const copy = content.wallet;
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matching = transactions.filter(
    (tx) =>
      !needle ||
      tx.counterparty.toLowerCase().includes(needle) ||
      tx.memo.toLowerCase().includes(needle) ||
      (txToken(tx)?.symbol ?? "").toLowerCase().includes(needle),
  );
  const groups = groupByDay(matching);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3">
        <Search
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchActivity}
          aria-label={copy.searchActivity}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {groups.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-5">
            <h3 className="mb-1.5 px-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h3>
            <ActivityList
              transactions={group.items}
              onOpen={onOpen}
              empty={empty}
            />
          </section>
        ))
      )}
    </>
  );
}

export function ActivityList({
  transactions,
  onOpen,
  empty,
}: {
  transactions: WalletTransaction[];
  onOpen: (id: string) => void;
  empty: string;
}): ReactNode {
  if (transactions.length === 0) {
    return (
      <p className="mt-2 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
      {transactions.map((tx) => {
        const incoming = tx.direction === "incoming";
        const token = txToken(tx);
        return (
          <li key={tx.id}>
            <button
              type="button"
              onClick={() => onOpen(tx.id)}
              className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  incoming
                    ? "bg-positive/15 text-positive"
                    : "bg-negative/15 text-negative"
                }`}
                aria-hidden="true"
              >
                {incoming ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {tx.counterparty}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {tx.memo || content.wallet.noMemo}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                    incoming ? "text-positive" : ""
                  }`}
                >
                  {incoming ? "+" : "−"}
                  {token
                    ? formatUnits(txUnits(tx), token.decimals)
                    : txUnits(tx)}
                  {token && <TokenMark token={token} size={13} />}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tx.status === "pending" ? (
                    <span className="font-medium text-warning">
                      {content.wallet.pendingBadge}
                    </span>
                  ) : (
                    usd(txUsd(tx))
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Submitted → delivered → confirmed, ported from Vela's transfer timeline. */
function Timeline({ tx }: { tx: WalletTransaction }): ReactNode {
  const copy = content.wallet.timeline;
  const steps = [
    { label: copy.submitted, done: true },
    { label: copy.delivered, done: true },
    {
      label: copy.confirmed,
      done: tx.status === "confirmed",
      note: tx.status === "confirmed" ? undefined : copy.unbroadcast,
    },
  ];
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((step, index) => (
        <li key={step.label} className="flex gap-3">
          <span className="flex flex-col items-center" aria-hidden="true">
            <span
              className={`flex size-5 items-center justify-center rounded-full ${
                step.done
                  ? "bg-positive text-background"
                  : "border border-dashed border-muted-foreground text-muted-foreground"
              }`}
            >
              {step.done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <Clock className="size-3" />
              )}
            </span>
            {index < steps.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-border" />
            )}
          </span>
          <span className="min-w-0 flex-1 pb-1">
            <span className="block text-sm font-medium">{step.label}</span>
            {step.note && (
              <span className="block text-xs text-pretty text-muted-foreground">
                {step.note}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ActivityDetail({
  tx,
  onBack,
  onExplore,
}: {
  tx: WalletTransaction;
  onBack: () => void;
  onExplore: (txid: string) => void;
}): ReactNode {
  const copy = content.wallet;
  const token = txToken(tx);
  const incoming = tx.direction === "incoming";

  return (
    <Page title={tx.counterparty} onBack={onBack}>
      <section className="rounded-2xl bg-surface p-5">
        <p className="flex items-baseline gap-2 text-2xl font-bold tracking-tight">
          {incoming ? "+" : "−"}
          {token ? formatUnits(txUnits(tx), token.decimals) : txUnits(tx)}
          {token && (
            <span className="inline-flex items-center gap-1 text-base">
              <TokenMark token={token} size={16} />
              {token.symbol}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{usd(txUsd(tx))}</p>

        <Timeline tx={tx} />

        <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
          {tx.memo && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-xs text-muted-foreground">
                {copy.memo}
              </dt>
              <dd className="min-w-0 text-right">{tx.memo}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground">
              {copy.networkFee}
            </dt>
            <dd>{tx.feeSatoshis.toLocaleString("en-US")} sats</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{copy.txid}</dt>
            <dd className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px]">
                {tx.txid}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(tx.txid);
                  toast.success(copy.copied);
                }}
                aria-label={copy.copyTxid}
                className="focus-ring shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onExplore(tx.txid)}
          className="focus-ring mt-5 flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
        >
          {copy.viewOnChain}
          <ExternalLink className="size-4" aria-hidden="true" />
        </button>
      </section>
    </Page>
  );
}

/* --------------------------------------------------------- payment links */

export function PaymentLinks({ onCreate }: { onCreate: () => void }): ReactNode {
  const copy = content.wallet;
  const links = getPaymentLinks();

  return (
    <Page
      title={copy.links}
      action={
        <button
          type="button"
          onClick={onCreate}
          className="focus-ring shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {copy.newLink}
        </button>
      }
    >
      <p className="mb-3 text-sm text-pretty text-muted-foreground">
        {copy.linksHint}
      </p>
      <ul className="space-y-3">
        {links.map((link) => {
          const token = getToken(link.tokenId);
          const collected = link.payments.reduce((sum, p) => sum + p.units, 0);
          return (
            <li key={link.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {link.description}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <Link2 className="size-3" aria-hidden="true" />
                    nexus.pay/{link.code}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    link.status === "open"
                      ? "bg-positive/15 text-positive"
                      : "bg-surface-raised text-muted-foreground"
                  }`}
                >
                  {copy.linkStatus[link.status]}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {link.amountUnits !== undefined && token
                    ? `${formatUnits(link.amountUnits, token.decimals)} ${token.symbol} ${copy.perPayer}`
                    : copy.payerChooses}
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {token && <TokenMark token={token} size={14} />}
                  {token ? formatUnits(collected, token.decimals) : collected}
                  <span className="text-xs font-normal text-muted-foreground">
                    {copy.collected}
                  </span>
                </span>
              </div>

              {link.payments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {link.payments.map((payment) => {
                    const person = getMessagePerson(payment.personId);
                    if (!person) return null;
                    return (
                      <li
                        key={payment.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <MemberAvatar person={person} size={16} />
                        <span className="min-w-0 flex-1 truncate">
                          {person.name}
                        </span>
                        <Check
                          className="size-3 shrink-0 text-positive"
                          aria-hidden="true"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `https://nexus.pay/${link.code}`,
                  );
                  toast.success(copy.linkCopied);
                }}
                className="focus-ring mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-hover"
              >
                <Copy className="size-3.5" aria-hidden="true" />
                {copy.copyLink}
              </button>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

/** Small header used by the group-ish sections. */
export function SectionIcon({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent">
      {children ?? <Users className="size-4" />}
    </span>
  );
}
