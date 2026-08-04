"use client";

/**
 * Transaction history.
 *
 * A port of BSV Browser's app/transactions.tsx. The behaviour that matters is the
 * status mapping and what each row lets you do about it:
 *
 *   · An offline-queue row OUTRANKS the raw transaction status. A held transaction
 *     sits at 'unproven' (green "Accepted", indistinguishable from a broadcast one)
 *     or, when the payer-side promotion failed, at 'nosend' (indistinguishable from
 *     a deliberate pending-signature noSend). Showing the raw status would tell the
 *     user their money has moved when it has not left the device.
 *   · Unsigned / nosend / nonfinal can be aborted; everything else unfinished can
 *     have its proof refreshed. They are mutually exclusive, so a row never offers
 *     both.
 */

import { useHub } from "@/components/hub/hub-provider";
import { shareHost, txHost, useAsync, type OfflineRow, type WalletActionRow } from "@/lib/pay-data";
import { Copy, Download, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const PAGE_SIZE = 30;

const ABORTABLE = new Set(["unsigned", "nosend", "nonfinal"]);

type Tone = "positive" | "warning" | "negative" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  positive: "bg-positive/15 text-positive",
  warning: "bg-warning/15 text-warning",
  negative: "bg-negative/15 text-negative",
  muted: "bg-surface-raised text-muted-foreground",
};

/** The queue row wins when there is one — see the file header. */
function statusOf(status: string, offline?: OfflineRow): { label: string; tone: Tone } {
  if (offline) {
    switch (offline.status) {
      case "queued":
        return { label: "Waiting to send", tone: "muted" };
      case "posting":
        return { label: "Sending", tone: "muted" };
      case "rejected":
        return { label: "Rejected", tone: "negative" };
    }
  }
  switch (status) {
    case "completed":
      return { label: "Confirmed", tone: "positive" };
    case "unproven":
      return { label: "Accepted", tone: "positive" };
    case "sending":
      return { label: "Broadcasting", tone: "positive" };
    case "nosend":
      return { label: "Not sent", tone: "warning" };
    case "unsigned":
      return { label: "Unsigned", tone: "warning" };
    case "nonfinal":
      return { label: "Not final", tone: "warning" };
    case "failed":
      return { label: "Failed", tone: "negative" };
    default:
      return { label: status, tone: "muted" };
  }
}

/**
 * The sign comes from the value, not from `isOutgoing`.
 *
 * `isOutgoing` means "this wallet created the transaction", which is a different
 * question from "did money leave": a payment swept in from an address is created
 * here and pays in. `satoshis` is already the signed net change to the wallet.
 */
function sats(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toLocaleString("en-US")}`;
}

export function Transactions(): ReactNode {
  /*
   * Explorer links go through the hub's own createTab, not straight to
   * host.tabs.create. The chrome's browser pane is what gives a tab its rect —
   * a tab created behind the wallet screen has no bounds and paints nowhere, so
   * calling the shell directly opens an invisible tab and looks like a dead
   * button. createTab also switches the canvas to the browser, which is what the
   * source app did by popping back to its Browser screen.
   */
  const { createTab } = useHub();
  const [rows, setRows] = useState<WalletActionRow[]>([]);
  const [offline, setOffline] = useState<Record<string, OfflineRow>>({});
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const offsetRef = useRef(0);

  const first = useAsync(() => txHost().list({ offset: 0, limit: PAGE_SIZE }), null as unknown as never);

  useEffect(() => {
    const page = first.data as { actions?: WalletActionRow[]; totalActions?: number; offline?: Record<string, OfflineRow> } | null;
    if (!page?.actions) return;
    setRows(page.actions);
    setTotal(page.totalActions ?? 0);
    setOffline(page.offline ?? {});
    offsetRef.current = page.actions.length;
  }, [first.data]);

  const loadMore = useCallback(async () => {
    if (loadingMore || offsetRef.current >= total) return;
    setLoadingMore(true);
    try {
      const page = await txHost().list({ offset: offsetRef.current, limit: PAGE_SIZE });
      setRows((prev) => [...prev, ...page.actions]);
      setTotal(page.totalActions);
      offsetRef.current += page.actions.length;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, total]);

  const act = useCallback(
    async (key: string, run: () => Promise<void>) => {
      setBusy(key);
      try {
        await run();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const { count, csv, filename } = await txHost().exportCsv();
      if (count === 0) {
        toast.info("No transactions to export");
        return;
      }
      try {
        const { shared } = await shareHost().file(filename, csv, "text/csv");
        // Backing out of the sheet is a decision, not a failure — the user
        // changed their mind and there is nothing left to tell them.
        if (shared) toast.success(`${count} transactions exported as ${filename}`);
      } catch {
        // Only a shell with a native share sheet answers share.file; on the rest
        // the call comes back as an unknown method. The clipboard is the one sink
        // every shell has, so the export still lands somewhere instead of failing
        // on a surface the user cannot do anything about.
        await navigator.clipboard.writeText(csv);
        toast.success(`${count} transactions copied as ${filename}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }, []);

  if (first.loading && rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (first.error && rows.length === 0) {
    return <p className="py-10 text-center text-sm text-negative">{first.error}</p>;
  }
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Transactions</h2>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting}
          className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent disabled:opacity-50"
        >
          {exporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
          Export
        </button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {rows.map((row, index) => {
          const queued = row.txid ? offline[row.txid] : undefined;
          const status = statusOf(row.status, queued);
          const canAbort = ABORTABLE.has(row.status) && !!row.reference;
          const canRefresh = !canAbort && row.status !== "completed" && !!row.txid;

          return (
            <li key={`${row.txid || index}-${index}`} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.description || "Transaction"}</p>
                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[status.tone]}`}>
                  {status.label}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <p className={`text-sm font-bold ${row.satoshis < 0 ? "" : "text-positive"}`}>
                  {sats(row.satoshis)}
                </p>
                <div className="mt-1 flex justify-end gap-0.5">
                  {canAbort ? (
                    <button
                      type="button"
                      aria-label="Abort transaction"
                      disabled={busy === row.reference}
                      onClick={() =>
                        void act(row.reference!, async () => {
                          await txHost().abort(row.reference!);
                          toast.success("Aborted");
                          first.reload();
                        })
                      }
                      className="focus-ring rounded p-1 text-negative disabled:opacity-40"
                    >
                      <XCircle className="size-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <>
                      {canRefresh ? (
                        <button
                          type="button"
                          aria-label="Refresh proof"
                          disabled={busy === row.txid}
                          onClick={() =>
                            void act(row.txid, async () => {
                              await txHost().refreshProof(row.txid);
                              toast.success("Proof refreshed");
                              first.reload();
                            })
                          }
                          className="focus-ring rounded p-1 text-muted-foreground disabled:opacity-40"
                        >
                          <RefreshCw className={`size-4 ${busy === row.txid ? "animate-spin" : ""}`} aria-hidden="true" />
                        </button>
                      ) : null}
                      {row.txid ? (
                        <button
                          type="button"
                          aria-label="Open in explorer"
                          onClick={() =>
                            void txHost()
                              .explorerUrl(row.txid)
                              .then(({ url }) => createTab(url))
                          }
                          className="focus-ring rounded p-1 text-muted-foreground"
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Copy raw transaction"
                        disabled={!row.txid || busy === `copy-${row.txid}`}
                        onClick={() =>
                          void act(`copy-${row.txid}`, async () => {
                            const { hex } = await txHost().rawHex(row.txid);
                            await navigator.clipboard.writeText(hex);
                            toast.success("Raw transaction copied");
                          })
                        }
                        className="focus-ring rounded p-1 text-muted-foreground disabled:opacity-30"
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {offsetRef.current < total ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="focus-ring mt-3 w-full rounded-xl border border-border py-2 text-xs font-semibold text-accent disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : `Load more (${total - offsetRef.current} left)`}
        </button>
      ) : null}
    </div>
  );
}
