"use client";

/**
 * Pay — one surface, six cells.
 *
 * A port of BSV Browser's /pay screen into Nexus's chrome. The behaviour is
 * deliberately unchanged, including the parts that look like restrictions:
 *
 *   · Direction is the primary axis, because it is the first thing a user knows
 *     about their own situation. Who the counterparty is comes second, and it is
 *     what determines the rail.
 *   · The user never picks a transport. `pay.classify` in the shell infers the
 *     rail from how the counterparty was identified.
 *   · Handle and address both need the network; nearby is the whole point of
 *     being offline, so it is the one rail that stays enabled underground.
 *   · The address rail's consequence line is never implicit — that rail cannot
 *     notify the payee, so a user who pastes an address has posted cash.
 *
 * What is different is only what had to be: the visual language is Nexus's, and
 * every wallet call goes through the host bridge rather than straight into a
 * React Native context.
 */

import { Sheet } from "@/components/apps/messages/sheet";
import {
  can,
  payHost,
  scanHost,
  shareHost,
  useAsync,
  useOnline,
  usePoll,
  type InboxRow,
  type RailId,
  type OfflineStatus,
  type OutboxEntry,
  type ProcessedTx,
} from "@/lib/pay-data";
import { SATS_PER_BSV } from "@/lib/wallet";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  QrCode,
  ScanLine,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";

export type Direction = "pay" | "get";
type Cell = "pay-nearby" | "pay-handle" | "pay-address" | "get-nearby" | "get-handle" | "get-address";

interface CellSpec {
  cell: Cell;
  title: string;
  subtitle: string;
  icon: typeof ScanLine;
}

/**
 * The grid, in BSV Browser's own words.
 *
 * These strings are its `pay_cell_*` values verbatim (context/i18n/translations.tsx).
 * They are not placeholders to improve on: "Someone remote" names the counterparty
 * rather than the transport, which is the whole point of a screen where the user
 * never picks a rail. An earlier draft here invented "A Nexus contact" and "Another
 * wallet", which named our product and our plumbing instead of their situation.
 */
const CELLS: Record<Direction, CellSpec[]> = {
  pay: [
    { cell: "pay-nearby", title: "Someone nearby", subtitle: "Scan their code", icon: ScanLine },
    { cell: "pay-handle", title: "Someone remote", subtitle: "Pick a handle — they need this app", icon: User },
    { cell: "pay-address", title: "To an address", subtitle: "Paste or scan an address", icon: Wallet },
  ],
  get: [
    { cell: "get-nearby", title: "Someone nearby", subtitle: "Show your payment code", icon: QrCode },
    { cell: "get-handle", title: "Someone remote", subtitle: "Share your handle", icon: User },
    { cell: "get-address", title: "To an address", subtitle: "Show an address", icon: Wallet },
  ],
};

const CELL_TITLES: Record<Cell, string> = {
  "pay-nearby": "Someone nearby",
  "pay-handle": "Someone remote",
  "pay-address": "To an address",
  "get-nearby": "Someone nearby",
  "get-handle": "Someone remote",
  "get-address": "To an address",
};

/**
 * The one line that must never be implicit — `pay_conseq_address`.
 *
 * Four words, and better than the paragraph that was here: it says the thing that
 * is actually different about this rail, which is that nobody gets told.
 */
const ADDRESS_CONSEQUENCE = "Sent — they are not notified.";

const HISTORY_POLL_MS = 5000;

function sats(n: number): string {
  return `${n.toLocaleString("en-US")} sats`;
}

// ── Small shared pieces ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="mb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Cta({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-opacity disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function Note({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-muted-foreground">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** A QR rendered as an inline SVG. No network, no image host. */
function Qr({ value, size = 220 }: { value: string; size?: number }): ReactNode {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(value, { type: "svg", margin: 1, width: size })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-3">
      {svg ? (
        // The encoder's own SVG; `value` never reaches the DOM as markup.
        <div className="[&>svg]:block" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div style={{ width: size, height: size }} className="animate-pulse rounded bg-neutral-200" />
      )}
    </div>
  );
}

function CopyChip({ text, label }: { text: string; label: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="focus-ring flex w-full flex-col gap-2 rounded-xl bg-surface p-3 text-center transition-colors hover:bg-surface-hover"
    >
      <span className="truncate font-mono text-xs text-muted-foreground">{text}</span>
      <span className="flex items-center justify-center gap-1.5 text-xs font-semibold">
        {copied ? (
          <>
            <Check className="size-3.5 text-positive" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden="true" />
            {label}
          </>
        )}
      </span>
    </button>
  );
}

/** Amount in satoshis. The wallet's unit — no conversion games on the way in. */
function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }): ReactNode {
  const n = Number(value);
  const bsv = Number.isFinite(n) && n > 0 ? n / SATS_PER_BSV : 0;
  return (
    <div>
      <FieldLabel>Amount</FieldLabel>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="0"
          aria-label="Amount in satoshis"
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">sats</span>
      </div>
      {bsv > 0 ? <p className="mt-1 text-[11px] text-muted-foreground">{bsv.toFixed(8)} BSV</p> : null}
    </div>
  );
}

// ── Offline notice ──────────────────────────────────────────────────────────

/**
 * Advisory, never load-bearing. A rejected 'sent' row gets its own unattributed
 * line: those carry no sender, because sender and receivedVia are only ever
 * recorded on the receiving side, and describing the user's own failed payment
 * as "someone handed you this" would report it as fraud against them.
 */
function OfflineNotice({ status, online, onSendNow }: { status: OfflineStatus; online: boolean; onSendNow: () => void }): ReactNode {
  const nothing =
    status.queued === 0 && status.rejected.length === 0 && status.sentRejected.length === 0 && online;
  if (nothing) return null;

  return (
    <div className="mb-4 space-y-2">
      {!online ? (
        <Note>You are offline. Nearby payments still work; the others need a connection.</Note>
      ) : null}
      {status.queued > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">
            {status.queued} payment{status.queued === 1 ? "" : "s"} waiting to be broadcast
            {status.stalled ? ` · stalled on ${status.stalled}` : ""}
          </span>
          <button type="button" onClick={onSendNow} className="focus-ring shrink-0 font-semibold text-accent">
            Send now
          </button>
        </div>
      ) : null}
      {status.rejected.length > 0 ? (
        <div className="rounded-xl border border-negative/40 bg-negative/10 px-3 py-2.5 text-xs text-negative">
          {status.rejected.length} payment{status.rejected.length === 1 ? "" : "s"} handed to you could not be
          accepted. Ask the sender to pay again.
        </div>
      ) : null}
      {status.sentRejected.length > 0 ? (
        <div className="rounded-xl border border-negative/40 bg-negative/10 px-3 py-2.5 text-xs text-negative">
          {status.sentRejected.length} of your own payment{status.sentRejected.length === 1 ? "" : "s"} was
          rejected when it reached the network.
        </div>
      ) : null}
    </div>
  );
}

// ── Address rail ────────────────────────────────────────────────────────────

/**
 * Get paid → a conventional wallet.
 *
 * Show the address and money appears: the sweep runs in the shell on its own
 * cycle, so this view registers the address and then stays out of the way. The
 * day stepper is a recovery affordance only — a previously-issued address whose
 * funds cannot be swept is lost money — which is why it sits behind a disclosure.
 */
function AddressReceive(): ReactNode {
  const [offset, setOffset] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [processed, setProcessed] = useState<ProcessedTx[]>([]);
  const [received, setReceived] = useState<{ amount: number; count: number } | null>(null);

  const state = useAsync(() => payHost().address.receive(offset), null as unknown as never, true, [offset]);
  const address = (state.data as { address?: string } | null)?.address ?? null;
  const maxDays = (state.data as { maxRecoveryDays?: number } | null)?.maxRecoveryDays ?? 30;
  const date = (state.data as { date?: string } | null)?.date ?? "";

  // Baseline, so a poll can tell an arrival from the history it loaded with.
  // Without it, opening on an address with past imports would celebrate them all
  // over again.
  const [, setBaseline] = useState<{ total: number; count: number } | null>(null);
  const tally = (rows: ProcessedTx[]) => ({
    total: rows.reduce((sum, tx) => sum + tx.satoshis, 0),
    count: rows.length,
  });

  useEffect(() => {
    const rows = (state.data as { processed?: ProcessedTx[] } | null)?.processed ?? [];
    setProcessed(rows);
    // A different address means a different history: re-baseline, or stepping to
    // a recovered day would read its existing imports as new arrivals.
    setBaseline(tally(rows));
  }, [state.data]);

  usePoll(
    async () => {
      if (!address) return;
      const rows = await payHost().address.history(address);
      setProcessed(rows);
      const now = tally(rows);
      setBaseline((before) => {
        // Compare on total AND count: two imports of equal size in one interval
        // move the count when the delta alone would look like one payment.
        if (before && (now.total > before.total || now.count > before.count)) {
          setReceived({
            amount: Math.max(0, now.total - before.total),
            count: Math.max(1, now.count - before.count),
          });
        }
        return now;
      });
    },
    HISTORY_POLL_MS,
    !!address,
  );

  const sweepNow = useCallback(async () => {
    if (!address) return;
    setSweeping(true);
    try {
      const { importedSatoshis } = await payHost().address.sweep(address, offset);
      const rows = await payHost().address.history(address);
      setProcessed(rows);
      setBaseline(tally(rows));
      // An arrival gets the full moment. Nothing found is not an event.
      if (importedSatoshis > 0) setReceived({ amount: importedSatoshis, count: 1 });
      else toast.info("No pending payments");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSweeping(false);
    }
  }, [address, offset]);

  const imported = processed.reduce((sum, tx) => sum + tx.satoshis, 0);

  if (state.loading && !address) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Generating address...</p>
    );
  }
  if (!address) {
    return <p className="py-10 text-center text-sm text-negative">{state.error ?? "Unable to generate address"}</p>;
  }

  return (
    <div className="space-y-4">
      <Qr value={address} />
      <CopyChip text={address} label="Copy" />
      <p className="text-center text-xs text-muted-foreground">
        Money sent here is added to your wallet automatically.
      </p>

      {processed.length > 0 ? (
        <div>
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Imported</span>
            <span className="font-bold text-positive">{sats(imported)}</span>
          </div>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl bg-surface">
            {processed.map((tx) => (
              <li key={tx.txid} className="flex items-center gap-2 px-3 py-2 text-xs">
                <Check className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
                <span className="font-semibold text-positive">+{sats(tx.satoshis)}</span>
                <span className="ml-auto truncate font-mono text-muted-foreground">
                  {tx.importedAt ? new Date(tx.importedAt).toLocaleTimeString() : tx.txid.slice(0, 12) + "…"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Recovery. Secondary by design: reaching an earlier day is the uncommon
          case of a payer who sat on an address. It must exist — unswept funds on
          an unreachable address are lost — but it is not a primary control. */}
      <button
        type="button"
        onClick={() => setShowRecovery((v) => !v)}
        className="focus-ring flex items-center gap-1 text-xs text-muted-foreground"
      >
        {showRecovery ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        Reach an earlier day
      </button>

      {showRecovery ? (
        <div className="space-y-2 rounded-xl bg-surface p-3">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={offset >= maxDays}
              onClick={() => setOffset((o) => Math.min(maxDays, o + 1))}
              aria-label="Previous day"
              className="focus-ring rounded-lg p-1.5 text-accent disabled:opacity-30"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-24 text-center font-mono text-xs">{date}</span>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              aria-label="Next day"
              className="focus-ring rounded-lg p-1.5 text-accent disabled:opacity-30"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void sweepNow()}
            disabled={sweeping}
            className="focus-ring w-full rounded-lg border border-border py-2 text-xs font-semibold text-accent disabled:opacity-50"
          >
            {sweeping ? "Sweeping…" : "Check this address now"}
          </button>
        </div>
      ) : null}

      {received ? (
        <div className="rounded-xl border border-positive/40 bg-positive/10 p-4 text-center">
          <p className="text-lg font-bold text-positive">+{sats(received.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {received.count} payment{received.count === 1 ? "" : "s"} received
          </p>
          <button
            type="button"
            onClick={() => setReceived(null)}
            className="focus-ring mt-3 text-xs font-semibold text-accent"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Pay → a conventional wallet. The consequence line is load-bearing here. */
function AddressSend(): ReactNode {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onAddress = useCallback(async (text: string) => {
    setAddress(text);
    if (!text) {
      setError(null);
      return;
    }
    // Validation lives in the shell — it needs the SDK's base58 check, and this
    // is the one field where a wrong answer burns money to an unspendable script.
    const { valid, normalized } = await payHost().validateAddress(text);
    if (valid && normalized !== text) setAddress(normalized);
    setError(valid ? null : "That is not a valid BSV address");
  }, []);

  const canSend = !!address && !!amount && !error && Number(amount) > 0 && !sending;

  const send = useCallback(async () => {
    setSending(true);
    try {
      await payHost().address.send(address, Math.round(Number(amount)));
      toast.success(`Paid ${sats(Math.round(Number(amount)))}`);
      setAddress("");
      setAmount("");
      setError(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [address, amount]);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Recipient address</FieldLabel>
        <div
          className={`focus-ring flex items-center gap-1 rounded-xl border bg-surface px-3 py-2.5 ${
            error ? "border-negative" : "border-border"
          }`}
        >
        <input
          value={address}
          onChange={(e) => void onAddress(e.target.value.trim())}
          placeholder="1…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Recipient BSV address"
          className="w-full bg-transparent font-mono text-sm outline-none"
        />
        <ScanButton accept={["address"]} hint="Point the camera at a BSV address QR code" onText={(t) => void onAddress(t)} />
        </div>
        {error ? <p className="mt-1 text-xs text-negative">{error}</p> : null}
      </div>

      <AmountField value={amount} onChange={setAmount} />

      {/* Never implicit. This rail cannot notify the payee. */}
      <Note>{ADDRESS_CONSEQUENCE}</Note>

      <Cta onClick={() => void send()} disabled={!canSend} busy={sending}>
        <ArrowUpRight className="size-4" aria-hidden="true" />
        Pay
      </Cta>
    </div>
  );
}

// ── Handle rail ─────────────────────────────────────────────────────────────

/** Share your handle. The link is the same `peerpay:` form the app already routes. */
function HandleReceive(): ReactNode {
  const identity = useAsync(() => payHost().handle.identity(), null as unknown as never);
  const [stuck, setStuck] = useState<InboxRow[]>([]);
  const [working, setWorking] = useState(false);

  const key = (identity.data as { identityKey?: string } | null)?.identityKey ?? null;
  const link = (identity.data as { link?: string } | null)?.link ?? null;

  // Credit whatever is in the box. Accepting was never a decision a user could
  // act on — the money is already theirs — so only failures reach the screen.
  const pump = useCallback(async (retry?: string[]) => {
    setWorking(true);
    try {
      const { accepted, stuck: left } = await payHost().handle.inbox(retry);
      if (accepted > 0) toast.success(`Received ${accepted} payment${accepted === 1 ? "" : "s"}`);
      setStuck(left);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }, []);

  useEffect(() => {
    if (key) void pump();
  }, [key, pump]);

  if (identity.loading && !key) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!key) return <p className="py-10 text-center text-sm text-negative">{identity.error ?? "No identity key"}</p>;

  return (
    <div className="space-y-4">
      {link ? <Qr value={link} /> : null}
      <CopyChip text={key} label="Copy" />
      {link ? (
        <button
          type="button"
          onClick={() =>
            void shareHost()
              .text(link, "My payment link")
              .catch(() =>
                // No native sheet on this shell. The link is the point, so it
                // still has to land somewhere the user can paste it from.
                navigator.clipboard.writeText(link).then(() => toast.success("Copied")),
              )
          }
          className="focus-ring w-full rounded-xl bg-surface p-3 text-xs font-semibold transition-colors hover:bg-surface-hover"
        >
          Share link
        </button>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        Payments sent to your handle are credited automatically.
      </p>

      <button
        type="button"
        onClick={() => void pump()}
        disabled={working}
        className="focus-ring w-full rounded-xl border border-border py-2 text-xs font-semibold text-accent disabled:opacity-50"
      >
        {working ? "Checking…" : "Check for payments"}
      </button>

      {stuck.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-negative">
            {stuck.length === 1 ? "Couldn\u2019t be added" : `${stuck.length} couldn\u2019t be added`}
          </p>
          {stuck.map((row) => (
            <div key={row.messageId} className="rounded-xl border border-negative/40 bg-negative/10 p-3 text-xs">
              <p className="font-semibold">{sats(row.amount)}</p>
              <p className="mt-0.5 text-muted-foreground">{row.error}</p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => void pump([row.messageId])}
                  className="focus-ring font-semibold text-accent"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Discarding acknowledges without crediting: the message leaves
                    // the box for good and the money can never be claimed. Never one
                    // tap away.
                    if (!window.confirm("Give up on this payment? The money cannot be recovered — the sender would have to pay again.")) return;
                    void payHost()
                      .handle.discard(row.messageId)
                      .then(() => pump());
                  }}
                  className="focus-ring font-semibold text-negative"
                >
                  Give up
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pay a handle. The outbox write happens before delivery is attempted, in the
 * shell — the token holds derivation data for an already-broadcast transaction,
 * so losing it between broadcast and delivery loses the money. A failed delivery
 * therefore leaves an `unsent` row, offered here for retry.
 */
function HandleSend(): ReactNode {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const outbox = useAsync(() => payHost().handle.outbox(), [] as OutboxEntry[]);

  const unsent = useMemo(() => outbox.data.filter((e) => e.status === "unsent"), [outbox.data]);
  const canSend = recipient.length > 0 && Number(amount) > 0 && !sending;

  const send = useCallback(async () => {
    setSending(true);
    try {
      await payHost().handle.send(recipient.trim(), Math.round(Number(amount)));
      toast.success(`Paid ${sats(Math.round(Number(amount)))}`);
      setAmount("");
      setRecipient("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
      outbox.reload();
    }
  }, [recipient, amount, outbox]);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Their handle</FieldLabel>
        <div className="focus-ring flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2.5">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          placeholder="02…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Recipient identity key"
          className="w-full bg-transparent font-mono text-sm outline-none"
        />
        <ScanButton
          accept={["handle"]}
          hint="Point the camera at their handle or payment link"
          onText={(t) => setRecipient(t.trim())}
        />
        </div>
      </div>

      <AmountField value={amount} onChange={setAmount} />

      <Cta onClick={() => void send()} disabled={!canSend} busy={sending}>
        <ArrowUpRight className="size-4" aria-hidden="true" />
        Pay
      </Cta>

      {unsent.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Not delivered yet</p>
          {unsent.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-surface p-3 text-xs">
              <p className="font-semibold">{sats(entry.token.amount)}</p>
              <p className="mt-0.5 truncate font-mono text-muted-foreground">{entry.recipient}</p>
              {entry.lastError ? <p className="mt-0.5 text-negative">{entry.lastError}</p> : null}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void payHost()
                      .handle.retry(entry.id)
                      .then(() => {
                        toast.success("Delivered");
                        outbox.reload();
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
                  }
                  className="focus-ring font-semibold text-accent"
                >
                  Retry delivery
                </button>
                <button
                  type="button"
                  onClick={() => void payHost().handle.dismiss(entry.id).then(() => outbox.reload())}
                  className="focus-ring font-semibold text-muted-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Nearby ──────────────────────────────────────────────────────────────────

/**
 * The nearby rail runs entirely in a native screen.
 *
 * It needs a camera and the device's own local radios, neither of which a
 * document in a WebView can reach, so this cell does not render the flow — it
 * asks the shell to present it and waits for what happened. The exchange itself,
 * including its own scanning, is BSV Browser's flow ported into
 * apps/mobile/src/native/NearbyFlow.tsx.
 */
function NearbyCell({ role, onDone }: { role: "payer" | "payee"; onDone: () => void }): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once per mount. The shell refuses a second native screen while one is up,
    // and React would otherwise re-present on every render.
    if (started.current) return;
    started.current = true;
    void payHost()
      .nearby.open(role)
      .then((result) => {
        if (result.outcome === "paid") toast.success(`Paid ${sats(result.satoshis ?? 0)}`);
        else if (result.outcome === "received") toast.success(`Received ${sats(result.satoshis ?? 0)}`);
        // Queued is not an arrival. The frame is safe and cannot be lost, but the
        // money is not spendable yet, so it gets the neutral note the native
        // screen already showed rather than a second, greener claim.
        else if (result.outcome === "queued") toast.info("Saved — it will be added to your wallet automatically.");
        onDone();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [role, onDone]);

  return (
    <div className="py-10 text-center">
      {error ? (
        <>
          <p className="text-sm font-semibold text-negative">{error}</p>
          <button type="button" onClick={onDone} className="focus-ring mt-3 text-xs font-semibold text-accent">
            Back
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Opening the camera…</p>
      )}
    </div>
  );
}

/**
 * Scan a code into a field.
 *
 * `accept` is what the caller can actually use; anything else the camera sees is
 * ignored and scanning continues, which is what lets an animated multi-frame code
 * be read without every intermediate frame counting as a failure.
 *
 * Renders nothing where the shell has no camera. scanHost() throws "this device
 * has no camera surface" rather than returning null, so an ungated button is a
 * button whose only outcome is an error — and the field beside it still accepts
 * a pasted address, which is the whole job on a desktop.
 */
function ScanButton({ accept, hint, onText }: { accept: RailId[]; hint: string; onText: (text: string) => void }): ReactNode {
  if (!can("scan")) return null;
  return (
    <button
      type="button"
      aria-label="Scan a QR code"
      onClick={() =>
        void scanHost()
          .qr({ accept, hint })
          .then((result) => {
            if ("cancelled" in result) return;
            onText(result.text);
          })
          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
      }
      className="focus-ring shrink-0 rounded-lg p-2 text-accent"
    >
      <ScanLine className="size-4" aria-hidden="true" />
    </button>
  );
}

// ── The sheet ───────────────────────────────────────────────────────────────

export function PaySheet({
  open,
  onClose,
  initialDirection = "pay",
}: {
  open: boolean;
  onClose: () => void;
  initialDirection?: Direction;
}): ReactNode {
  const online = useOnline();
  // Two local radios and a camera; Electron main has a path to neither, so the
  // shell says so in its capability list rather than the chrome guessing.
  const hasNearby = can("nearby");
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [cell, setCell] = useState<Cell | null>(null);

  const offline = useAsync(() => payHost().offline.status(), {
    queued: 0,
    rejected: [],
    sentRejected: [],
    queuedSent: [],
  } as OfflineStatus, open, [cell, online]);

  useEffect(() => {
    if (open) {
      setDirection(initialDirection);
      setCell(null);
    }
  }, [open, initialDirection]);

  // One deferred proof sweep per visit, gated in the shell. Best-effort: a failed
  // sweep leaves the background trigger as the backstop and never surfaces here.
  useEffect(() => {
    if (!open || !online) return;
    void payHost().proofNudge().catch(() => {});
  }, [open, online]);

  const body = (): ReactNode => {
    switch (cell) {
      case "pay-nearby":
        return <NearbyCell role="payer" onDone={() => setCell(null)} />;
      case "get-nearby":
        return <NearbyCell role="payee" onDone={() => setCell(null)} />;
      case "pay-handle":
        return <HandleSend />;
      case "get-handle":
        return <HandleReceive />;
      case "pay-address":
        return <AddressSend />;
      case "get-address":
        return <AddressReceive />;
      default:
        return (
          <>
            <OfflineNotice
              status={offline.data}
              online={online}
              onSendNow={() => void payHost().offline.sendNow().then(() => offline.reload())}
            />

            {/* Direction first: it is what the user already knows. */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
              {(["pay", "get"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  className={`focus-ring rounded-lg py-2 text-sm font-semibold transition-colors ${
                    direction === d ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {d === "pay" ? "Pay" : "Get paid"}
                </button>
              ))}
            </div>

            <ul className="space-y-2">
              {/*
               * Nearby is dropped entirely where the shell has no radios — it is not
               * a rail that degrades, it is one that does not exist. Electron
               * declares pay without nearby, and left in place the cell rendered
               * "unknown method pay.nearby.open" as its error text. Worse offline,
               * where the rule below disables the other two: nearby would have been
               * the only pressable cell and the only one that could not work.
               */}
              {CELLS[direction]
                .filter(({ cell }) => hasNearby || !cell.endsWith("nearby"))
                .map(({ cell: id, title, subtitle, icon: Icon }) => {
                // Handle needs a message-box round trip and address needs an
                // overlay lookup; neither works underground. Nearby is the whole
                // point of being offline.
                const disabled = !online && !id.endsWith("nearby");
                return (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setCell(id)}
                      className="focus-ring flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                        <Icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {disabled ? "Needs internet" : subtitle}
                        </span>
                      </span>
                      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
                })}
            </ul>
          </>
        );
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={cell ? CELL_TITLES[cell] : "Payments"}>
      <div className="p-4">
        {cell ? (
          <button
            type="button"
            onClick={() => setCell(null)}
            className="focus-ring mb-3 flex items-center gap-1 text-xs font-semibold text-accent"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Payments
          </button>
        ) : null}
        {body()}
      </div>
    </Sheet>
  );
}

/** Re-exported so the wallet screen can open the sheet straight into a direction. */
export const PAY_DIRECTIONS: Record<"send" | "receive", Direction> = { send: "pay", receive: "get" };

