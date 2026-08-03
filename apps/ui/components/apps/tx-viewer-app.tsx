"use client";

import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getChainTransactions,
  type ChainTransaction,
  type TxIO,
} from "@/lib/data";
import { ExternalLink, Layers3 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

function truncateTxid(txid: string): string {
  return `${txid.slice(0, 10)}…${txid.slice(-8)}`;
}

function formatSats(satoshis: number): string {
  return `${satoshis.toLocaleString("en-US")} sats`;
}

function IOList({ title, entries }: { title: string; entries: TxIO[] }): ReactNode {
  return (
    <div>
      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      <ul className="mt-1.5 space-y-1.5">
        {entries.map((entry, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs">{entry.address}</p>
              <p className="text-[11px] text-muted-foreground">
                {entry.scriptType}
              </p>
            </div>
            <p className="shrink-0 text-xs font-semibold">
              {formatSats(entry.satoshis)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TransactionDetail({ tx }: { tx: ChainTransaction }): ReactNode {
  const copy = content.txViewer;

  return (
    <div className="rounded-2xl bg-surface p-5">
      <h3 className="text-sm font-semibold">{copy.detailTitle}</h3>
      <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
        {tx.txid}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] text-muted-foreground">Block</dt>
          <dd className="font-medium">
            {tx.blockHeight?.toLocaleString("en-US") ?? copy.unconfirmed}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Confirmations</dt>
          <dd className="font-medium">
            {tx.confirmations.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Size</dt>
          <dd className="font-medium">
            {tx.sizeBytes.toLocaleString("en-US")} B
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Fee</dt>
          <dd className="font-medium">{formatSats(tx.feeSatoshis)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <IOList title={copy.inputs} entries={tx.inputs} />
        <IOList title={copy.outputs} entries={tx.outputs} />
      </div>

      <div className="mt-5">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Layers3 className="size-3.5" aria-hidden="true" />
          {copy.overlaysTitle}
        </h4>
        <ul className="mt-1.5 space-y-2">
          {tx.overlays.map((overlay) => (
            <li
              key={overlay.id}
              className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{overlay.network}</p>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
                  {overlay.topic}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {overlay.summary}
              </p>
              <p className="mt-1.5 truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
                {overlay.dataPreview}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function matchesTx(
  tx: ChainTransaction,
  query: string,
  kind: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields: Record<string, string> = {
    block: String(tx.blockHeight ?? ""),
    tx: tx.txid,
    address: [...tx.inputs, ...tx.outputs].map((io) => io.address).join(" "),
    tag: tx.overlays.map((o) => `${o.topic} ${o.network}`).join(" "),
  };
  const haystack =
    kind === "all" ? Object.values(fields).join(" ") : (fields[kind] ?? "");
  return haystack.toLowerCase().includes(q);
}

export function TxViewerApp(): ReactNode {
  const { exploreQuery, exploreKind } = useHub();
  const transactions = getChainTransactions();
  const copy = content.txViewer;

  const filtered = useMemo(
    () => transactions.filter((tx) => matchesTx(tx, exploreQuery, exploreKind)),
    [transactions, exploreQuery, exploreKind],
  );

  const [selectedId, setSelectedId] = useState("");
  const selected =
    filtered.find((tx) => tx.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{copy.listTitle}</h2>
          <a
            href="https://whatsonchain.com/stats"
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-surface-hover"
          >
            WhatsOnChain stats
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {filtered.map((tx) => (
            <button
              key={tx.id}
              type="button"
              role="tab"
              aria-selected={tx.id === selected?.id}
              onClick={() => setSelectedId(tx.id)}
              className={`focus-ring rounded-full px-3 py-1.5 font-mono text-xs transition-colors ${
                tx.id === selected?.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {truncateTxid(tx.txid)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {selected ? (
            <TransactionDetail tx={selected} />
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
              No transactions match your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
