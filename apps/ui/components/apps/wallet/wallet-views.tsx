"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  PriceChart,
  type ScrubPoint,
} from "@/components/apps/wallet/price-chart";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { Sheet } from "@/components/apps/messages/sheet";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getCurrentMessageUser,
  getEcosystem,
  getMessagePerson,
  getPaymentLinks,
  getToken,
  type MessagePerson,
  type PaymentLink,
  type WalletTransaction,
} from "@/lib/data";
import { formatFullDate, whoisFor } from "@/lib/messages";
import {
  change24hOf,
  changeTone,
  groupByDay,
  percent,
  txToken,
  txUnits,
  txUsd,
  usd,
} from "@/lib/wallet";
import { useHub } from "@/components/hub/hub-provider";
import { useHolding } from "@/lib/wallet-live";
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Search,
  Users,
} from "lucide-react";
import { useCreatedPaymentLinks } from "@/lib/payment-links-store";
import { toggleArchivedPaymentLink, useSettings } from "@/lib/settings-store";
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
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 rounded-md p-1.5"
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
 * Vela's gold verified pill: a valid handle certificate, plus at least one
 * other thing standing behind the key — a peer attestation, or an account the
 * person has proved is theirs.
 *
 * The social counts because it is the check most people can actually make: a
 * peer attestation means something to somebody who knows the peer, and an X
 * account they already follow means something to everybody else. The
 * certificate is still required, so a social alone never earns the pill.
 */
export function VerifiedHandle({
  person,
}: {
  person: MessagePerson;
}): ReactNode {
  const who = whoisFor(person);
  const attested = (person.socials ?? []).length;
  const verified =
    who.certificate === "valid" && (who.attestations > 0 || attested > 0);
  if (!verified) return null;
  return (
    <Tooltip label={content.wallet.verifiedHint} className="shrink-0">
      <span className="bg-warning/20 text-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
        <BadgeCheck className="size-3" aria-hidden="true" />
        {content.wallet.verified}
      </span>
    </Tooltip>
  );
}

/* ------------------------------------------------------------ token detail */

/**
 * One line of a token's provenance, opened in Browse where there is somewhere
 * to open.
 *
 * A button rather than an anchor: an `href` in this renderer navigates the
 * shell out of the app it is drawn in. Everything external in this client goes
 * through the active tab, which is what the address bar is for.
 */
function Fact({
  label,
  url,
}: {
  label: string;
  url: string | undefined;
}): ReactNode {
  const { navigateActiveTab } = useHub();
  if (!url) return <>{label}</>;
  return (
    <button
      type="button"
      onClick={() => navigateActiveTab(url)}
      className="focus-ring hover:text-accent inline-flex items-center gap-1 rounded font-medium underline decoration-dotted underline-offset-2 transition-colors"
    >
      {label}
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </button>
  );
}

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
  /* The day the chart is being scrubbed over, or null. Held here rather than in
     the chart because the figure it changes is above it. */
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  if (loading && !holding) {
    return (
      <Page title={copy.loading} onBack={onBack}>
        {null}
      </Page>
    );
  }
  if (!holding) {
    return (
      <Page title={copy.notFound} onBack={onBack}>
        {null}
      </Page>
    );
  }
  const token = holding.token;
  const own = transactions.filter((tx) => (tx.tokenId ?? "bsv") === tokenId);

  return (
    <Page title={token.name} onBack={onBack}>
      <section className="bg-surface rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2 text-2xl font-bold tracking-tight">
              {formatUnits(holding.units, token.decimals)}
              <span className="inline-flex items-center gap-1 text-base">
                <TokenMark token={token} size={16} />
                {token.symbol}
              </span>
            </p>
            {/*
              One figure, which the chart below can take over.

              Scrubbing a day writes its value here rather than into a tooltip
              of its own: this line already answers "what is it worth", and a
              second answer floating over the chart would be two.
            */}
            <p className="text-muted-foreground mt-1 text-sm">
              {scrub ? (
                <>
                  {usd(scrub.usd)}{" "}
                  <span className="font-semibold">{scrub.date}</span>
                </>
              ) : (
                <>
                  {usd(holding.usd)}{" "}
                  {/* A 24h move is a fixture property. Nothing on a live device knows
                      what this asset did yesterday, and "+0.0%" would answer as if it did. */}
                  {showTrend && (
                    <span
                      className={`font-semibold ${changeTone(change24hOf(token))}`}
                    >
                      {percent(change24hOf(token))}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/*
          A row of its own, edge to edge.

          Beside the balance it was a 96px thumbnail of a month of trading —
          legible as a direction and nothing more. This is the one screen about
          one asset, so the chart gets the width the screen has.
        */}
        {showTrend && (
          <div className="mt-4">
            <PriceChart holding={holding} onScrub={setScrub} />
          </div>
        )}

        {token.blurb && (
          <p className="text-muted-foreground mt-4 text-sm text-pretty">
            {token.blurb}
          </p>
        )}

        <dl className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          {token.protocol && (
            <div>
              <dt className="text-muted-foreground text-xs">{copy.protocol}</dt>
              <dd className="mt-0.5 font-medium">
                <Fact label={token.protocol} url={token.protocolUrl} />
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground text-xs">{copy.issuer}</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
              {token.ecosystem ? (
                <>
                  <TokenMark token={token} size={14} />
                  {getEcosystem(token.ecosystem)?.name}
                </>
              ) : (
                <Fact
                  label={token.issuer ?? copy.independent}
                  url={token.issuerUrl}
                />
              )}
            </dd>
          </div>
          {token.peg && (
            <div className="col-span-2">
              <dt className="text-muted-foreground text-xs">{copy.peg}</dt>
              <dd className="mt-0.5 font-medium">{token.peg.note}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSend(tokenId)}
            className="focus-ring bg-accent text-accent-foreground flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
            {copy.send}
          </button>
          <button
            type="button"
            onClick={() => onReceive(tokenId)}
            className="focus-ring border-border hover:bg-surface-hover flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold"
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
      (txToken(tx)?.symbol ?? "").toLowerCase().includes(needle)
  );
  const groups = groupByDay(matching);

  return (
    <>
      <div className="bg-surface mb-3 flex items-center gap-2 rounded-xl px-3">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchActivity}
          aria-label={copy.searchActivity}
          className="placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {groups.length === 0 ? (
        <p className="bg-surface text-muted-foreground rounded-2xl px-4 py-10 text-center text-sm">
          {empty}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-5">
            <h3 className="text-muted-foreground mb-1.5 px-1 text-[11px] font-bold tracking-wide uppercase">
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
      <p className="bg-surface text-muted-foreground mt-2 rounded-2xl px-4 py-10 text-center text-sm">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-border bg-surface divide-y overflow-hidden rounded-2xl">
      {transactions.map((tx) => {
        const incoming = tx.direction === "incoming";
        const token = txToken(tx);
        return (
          <li key={tx.id}>
            <button
              type="button"
              onClick={() => onOpen(tx.id)}
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
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
                <span className="text-muted-foreground block truncate text-xs">
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
                <span className="text-muted-foreground block text-xs">
                  {tx.status === "pending" ? (
                    <span className="text-warning font-medium">
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
                  : "border-muted-foreground text-muted-foreground border border-dashed"
              }`}
            >
              {step.done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <Clock className="size-3" />
              )}
            </span>
            {index < steps.length - 1 && (
              <span className="bg-border mt-1 w-px flex-1" />
            )}
          </span>
          <span className="min-w-0 flex-1 pb-1">
            <span className="block text-sm font-medium">{step.label}</span>
            {step.note && (
              <span className="text-muted-foreground block text-xs text-pretty">
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
      <section className="bg-surface rounded-2xl p-5">
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
        <p className="text-muted-foreground mt-1 text-sm">{usd(txUsd(tx))}</p>

        <Timeline tx={tx} />

        <dl className="border-border mt-5 space-y-2.5 border-t pt-4 text-sm">
          {tx.memo && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground shrink-0 text-xs">
                {copy.memo}
              </dt>
              <dd className="min-w-0 text-right">{tx.memo}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground shrink-0 text-xs">
              {copy.networkFee}
            </dt>
            <dd>{tx.feeSatoshis.toLocaleString("en-US")} sats</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{copy.txid}</dt>
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
                className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded p-1"
              >
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onExplore(tx.txid)}
          className="focus-ring border-border hover:bg-surface-hover mt-5 flex w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold"
        >
          {copy.viewOnChain}
          <ExternalLink className="size-4" aria-hidden="true" />
        </button>
      </section>
    </Page>
  );
}

/* --------------------------------------------------------- payment links */

const LINK_TABS = ["active", "archived"] as const;
type LinkTab = (typeof LINK_TABS)[number];

export function PaymentLinks({
  onCreate,
}: {
  onCreate: () => void;
}): ReactNode {
  const copy = content.wallet;
  /* Made-this-session first, then the seeded ones. Concatenated here rather
     than inside the accessor, so lib/data stays only what was written into it —
     see lib/payment-links-store. */
  const all = [...useCreatedPaymentLinks(), ...getPaymentLinks()];
  const settings = useSettings();
  const [tab, setTab] = useState<LinkTab>("active");
  const [preview, setPreview] = useState<PaymentLink | null>(null);
  const isArchived = (id: string): boolean =>
    settings.archivedPaymentLinks.includes(id);
  const links = all.filter((link) =>
    tab === "archived" ? isArchived(link.id) : !isArchived(link.id)
  );

  return (
    <Page
      title={copy.links}
      action={
        <button
          type="button"
          onClick={onCreate}
          className="focus-ring bg-accent text-accent-foreground shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
        >
          {copy.newLink}
        </button>
      }
    >
      <p className="text-muted-foreground mb-3 text-sm text-pretty">
        {copy.linksHint}
      </p>

      {/* Counts in the label, as the collectibles tabs do: the point of an
          archive is that you stop looking at it, so the only thing worth saying
          about it from here is how much is in there. */}
      <div
        role="tablist"
        aria-label={copy.links}
        className="border-border mb-4 flex gap-1 border-b"
      >
        {LINK_TABS.map((option) => {
          const count = all.filter((link) =>
            option === "archived" ? isArchived(link.id) : !isArchived(link.id)
          ).length;
          const selected = option === tab;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(option)}
              className={`focus-ring -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-foreground text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent font-medium"
              }`}
            >
              {copy.linkTabs[option]}
              <span className="text-muted-foreground text-xs tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {links.length === 0 && tab === "archived" && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {copy.noArchivedLinks}
        </p>
      )}

      <ul className="space-y-3">
        {links.map((link) => {
          const token = getToken(link.tokenId);
          const collected = link.payments.reduce((sum, p) => sum + p.units, 0);
          return (
            <li key={link.id} className="bg-surface rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {link.description}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 font-mono text-xs">
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

              <div className="border-border mt-3 flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground text-xs">
                  {link.amountUnits !== undefined && token
                    ? `${formatUnits(link.amountUnits, token.decimals)} ${token.symbol} ${copy.perPayer}`
                    : copy.payerChooses}
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {token && <TokenMark token={token} size={14} />}
                  {token ? formatUnits(collected, token.decimals) : collected}
                  <span className="text-muted-foreground text-xs font-normal">
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
                          className="text-positive size-3 shrink-0"
                          aria-hidden="true"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Half, a quarter, a quarter — `flex-[2]` against two `flex-1`.
                  Copying is what somebody came here to do, so it keeps the fill
                  and twice the room; previewing and archiving are each a
                  once-per-link act. */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      `https://nexus.pay/${link.code}`
                    );
                    toast.success(copy.linkCopied);
                  }}
                  className="focus-ring bg-accent text-accent-foreground flex flex-2 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  {copy.copyLink}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(link)}
                  className="focus-ring border-border hover:bg-surface-hover flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold"
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  {copy.previewLink}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const archived = isArchived(link.id);
                    toggleArchivedPaymentLink(link.id);
                    toast.success(
                      archived ? copy.linkRestored : copy.linkArchived,
                      {
                        description: link.description,
                        action: {
                          label: content.hub.undo,
                          onClick: () => toggleArchivedPaymentLink(link.id),
                        },
                      }
                    );
                  }}
                  className="focus-ring border-border hover:bg-surface-hover flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold"
                >
                  {isArchived(link.id) ? (
                    <ArchiveRestore className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Archive className="size-3.5" aria-hidden="true" />
                  )}
                  {isArchived(link.id) ? copy.restoreLink : copy.archiveLink}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <LinkPreview link={preview} onClose={() => setPreview(null)} />
    </Page>
  );
}

/**
 * The payer's side of a link, as its owner cannot otherwise see it.
 *
 * Every value is the link's own — description, amount, asset, the date it stops
 * accepting. Nothing is added: no payer count, no "3 people are viewing this",
 * none of the things a hosted page would know and this one cannot.
 *
 * The Pay button is present and disabled, because it is the thing the payer's
 * screen is mostly made of and a preview that left it out would be a preview of
 * something else. Disabled rather than absent, and the note underneath says why.
 */
function LinkPreview({
  link,
  onClose,
}: {
  link: PaymentLink | null;
  onClose: () => void;
}): ReactNode {
  const copy = content.wallet;
  const token = link ? getToken(link.tokenId) : undefined;
  /* The link's creator is whoever holds this wallet — links are made here and
     nowhere else, so there is no other candidate and none to invent. */
  const creator = getCurrentMessageUser();
  return (
    <Sheet open={Boolean(link)} onClose={onClose} label={copy.previewTitle}>
      {link && (
        <div className="space-y-4 p-4">
          <p className="text-muted-foreground text-center font-mono text-xs">
            nexus.pay/{link.code}
          </p>
          <div className="bg-surface rounded-2xl p-5 text-center">
            {/* Who is asking, above what they are asking for.
                A payer's first question is not the amount — it is whether this
                link belongs to the person they think it does, and the qualified
                handle is the part that answers it. Vela's rule, and the reason
                links are addressed to handles rather than addresses. */}
            <div className="flex flex-col items-center gap-1.5">
              <MemberAvatar person={creator} size={44} />
              <Handle
                person={creator}
                size={11}
                className="text-muted-foreground max-w-full truncate text-xs"
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-pretty">
              {link.description}
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
              {token && <TokenMark token={token} size={20} />}
              {link.amountUnits !== undefined && token
                ? `${formatUnits(link.amountUnits, token.decimals)} ${token.symbol}`
                : copy.payerChooses}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {copy.previewAccepting} {formatFullDate(link.expiresAt)}
            </p>
            <button
              type="button"
              disabled
              className="bg-accent text-accent-foreground mt-4 w-full rounded-full px-3 py-2 text-sm font-semibold opacity-40"
            >
              {copy.previewPay}
            </button>
          </div>
          <p className="text-muted-foreground text-center text-[11px] leading-relaxed text-pretty">
            {copy.previewNote}
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** Small header used by the group-ish sections. */
export function SectionIcon({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="bg-accent/15 text-accent flex size-8 items-center justify-center rounded-full">
      {children ?? <Users className="size-4" />}
    </span>
  );
}
