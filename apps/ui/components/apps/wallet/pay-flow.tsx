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
  type MessageBoxState,
  type PayIdentity,
  type RailId,
  type OfflineStatus,
  type OutboxEntry,
  type ProcessedTx,
} from "@/lib/pay-data";
import { SATS_PER_BSV, usd } from "@/lib/wallet";
import { useBsvRate } from "@/lib/wallet-live";
import {
  AlertCircle,
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
  Settings,
  User,
  Wallet,
  X,
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

const DIRECTION_TITLES: Record<Direction, string> = { pay: "Pay", get: "Get paid" };

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

/**
 * The handle rail's own surprise, and it had no line at all until now.
 *
 * Delivery is asynchronous: the money leaves this wallet immediately and sits in
 * their message box until their wallet next looks. A payer who reads "Pay" as
 * "hand over" needs to know the gap exists before the tap.
 */
const HANDLE_CONSEQUENCE = "Sent now, arrives when their wallet next checks.";

const HISTORY_POLL_MS = 5000;

/**
 * How often the handle inbox is re-read while its cell is open.
 *
 * MessageBox has no push channel, so "the payment appears on its own" means
 * polling — and this screen used to do it exactly once, on mount. Standing in
 * front of it while someone paid you showed nothing until you tapped a button.
 * Five seconds is the "it just appeared" threshold; `usePoll` stops it when the
 * document is hidden and skips a tick while one is still in flight.
 */
const INBOX_POLL_MS = 5000;

/** How long a tapped Give up stays armed before it disarms itself. */
const DISCARD_ARM_MS = 5000;

/** Identity search is a network call; this is how long typing has to pause first. */
const SEARCH_DEBOUNCE_MS = 350;

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

/**
 * The amount.
 *
 * Satoshis are what leaves the wallet and what `value` always holds — dollars are
 * a display concern that stops at this component's edge, so no caller ever holds
 * a fiat figure. The toggle appears only when there is a real exchange rate:
 * converting someone's "$50" through a stale constant sends the wrong amount of
 * money, which is worse than not offering the option. Same rule the balance
 * screens follow, applied where it can actually cost something.
 */
function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }): ReactNode {
  const usdPerBsv = useBsvRate();
  const [inUsd, setInUsd] = useState(false);
  // Dollars typed so far, kept apart from `value`: round-tripping satoshis back
  // through the rate would rewrite the digits under someone mid-keystroke.
  const [dollars, setDollars] = useState("");

  // A rate that disappears mid-entry (the shell lost it) must not strand the field
  // in a mode it can no longer convert.
  useEffect(() => {
    if (usdPerBsv === null) setInUsd(false);
  }, [usdPerBsv]);

  const satoshis = Number(value);
  const bsv = Number.isFinite(satoshis) && satoshis > 0 ? satoshis / SATS_PER_BSV : 0;

  const onDollars = (text: string): void => {
    if (text && !/^\d*\.?\d{0,2}$/.test(text)) return;
    setDollars(text);
    if (usdPerBsv === null) return;
    const amount = Number(text);
    onChange(text && Number.isFinite(amount) ? String(Math.round((amount / usdPerBsv) * SATS_PER_BSV)) : "");
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <FieldLabel>Amount</FieldLabel>
        {usdPerBsv !== null ? (
          <button
            type="button"
            onClick={() => {
              setInUsd((v) => !v);
              setDollars("");
              onChange("");
            }}
            className="focus-ring text-[11px] font-semibold text-accent"
          >
            {inUsd ? "Enter satoshis" : "Enter dollars"}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
        {inUsd ? <span className="shrink-0 text-lg font-semibold text-muted-foreground">$</span> : null}
        <input
          value={inUsd ? dollars : value}
          onChange={(e) =>
            inUsd ? onDollars(e.target.value) : onChange(e.target.value.replace(/[^0-9]/g, ""))
          }
          inputMode={inUsd ? "decimal" : "numeric"}
          placeholder={inUsd ? "0.00" : "0"}
          aria-label={inUsd ? "Amount in US dollars" : "Amount in satoshis"}
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{inUsd ? "USD" : "sats"}</span>
      </div>
      {/* The other unit, always — whichever way it was typed, the payer sees both
          before the tap. */}
      {satoshis > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {inUsd
            ? `${satoshis.toLocaleString("en-US")} sats · ${bsv.toFixed(8)} BSV`
            : `${bsv.toFixed(8)} BSV${usdPerBsv !== null ? ` · ${usd(bsv * usdPerBsv)}` : ""}`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The moment money arrives.
 *
 * Held until it is acknowledged, never a toast. A toast is the right weight for
 * "your settings were saved" and the wrong weight for "someone just paid you":
 * it can be missed entirely — phone face down, in a pocket, not being looked at
 * when it fires — and whether the money landed is the one thing a payee must
 * never be left unsure about. Requiring a tap means the event cannot be missed,
 * only dismissed.
 *
 * Presentational. By the time this mounts the payment is already credited, so
 * dismissing it cannot affect money.
 */
function ReceivedPanel({
  amount,
  count,
  onDone,
}: {
  amount: number;
  count: number;
  onDone: () => void;
}): ReactNode {
  return (
    <div role="status" className="rounded-xl border border-positive/40 bg-positive/10 p-4 text-center">
      <p className="text-lg font-bold text-positive">+{sats(amount)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {count} payment{count === 1 ? "" : "s"} received
      </p>
      <button type="button" onClick={onDone} className="focus-ring mt-3 text-xs font-semibold text-accent">
        Done
      </button>
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
        <ReceivedPanel amount={received.amount} count={received.count} onDone={() => setReceived(null)} />
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

// ── Recipient ───────────────────────────────────────────────────────────────

/**
 * Who you are paying, on the handle rail.
 *
 * A search box that resolves names, accepts a pasted identity key, opens the
 * scanner, and collapses to an identity card once a counterparty is chosen. The
 * field used to be a bare text input labelled "02…", which asked a payer to
 * recognise their friend by the first two characters of a public key and gave
 * them nothing to check against before parting with money.
 *
 * Identity is decoration and the rail never depends on it: a pasted key is
 * payable whether or not anything resolves, and every failure here is silent.
 */
function RecipientField({
  value,
  onChange,
}: {
  value: string;
  onChange: (identityKey: string) => void;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PayIdentity[]>([]);
  const [chosen, setChosen] = useState<PayIdentity | null>(null);
  const [searching, setSearching] = useState(false);

  // A key is a key, whatever it was typed into. 66 hex characters starting 02/03
  // is a compressed public key and nothing else, so it is taken as the recipient
  // directly rather than searched for as a name.
  const looksLikeKey = /^0[23][0-9a-fA-F]{64}$/.test(query.trim());

  useEffect(() => {
    const text = query.trim();
    if (looksLikeKey) {
      onChange(text);
      setResults([]);
      // Resolve for display only — who this is, if anyone knows. The payment does
      // not wait for it and does not care if it never answers.
      let cancelled = false;
      void payHost()
        .handle.resolve(text)
        .then(({ identity }) => {
          if (!cancelled && identity) setChosen(identity);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    onChange("");
    if (text.length < 2) {
      setResults([]);
      return;
    }
    // Debounced: a lookup per keystroke is a network call per keystroke.
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void payHost()
        .handle.search(text)
        .then(({ results: found }) => {
          if (cancelled) return;
          setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [query, looksLikeKey, onChange]);

  const clear = useCallback(() => {
    setChosen(null);
    setQuery("");
    setResults([]);
    onChange("");
  }, [onChange]);

  if (chosen && value) {
    return (
      <div>
        <FieldLabel>Paying</FieldLabel>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
          <IdentityAvatar identity={chosen} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {chosen.name?.trim() || "Unnamed"}
            </span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {chosen.abbreviatedKey || chosen.identityKey}
            </span>
          </span>
          <button
            type="button"
            onClick={clear}
            aria-label="Choose someone else"
            className="focus-ring shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <FieldLabel>Their handle</FieldLabel>
      <div className="focus-ring flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name, or paste their key"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Recipient name or identity key"
          className="w-full bg-transparent text-sm outline-none"
        />
        {searching ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        <ScanButton
          accept={["handle"]}
          hint="Point the camera at their handle or payment link"
          onText={(t) => setQuery(t.trim())}
        />
      </div>

      {/* A pasted key that nothing knows about is still payable — say so rather
          than leaving the payer wondering whether the field took it. */}
      {looksLikeKey && !chosen ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Key accepted. Nobody has published a name for it.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl bg-surface">
          {results.map((identity) => (
            <li key={identity.identityKey}>
              <button
                type="button"
                onClick={() => {
                  setChosen(identity);
                  onChange(identity.identityKey);
                }}
                className="focus-ring flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <IdentityAvatar identity={identity} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {identity.name?.trim() || "Unnamed"}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {identity.abbreviatedKey || identity.identityKey}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Their picture if they published one, their initial otherwise. */
function IdentityAvatar({ identity }: { identity: PayIdentity }): ReactNode {
  const url = identity.avatarURL?.trim();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent"
    >
      {(identity.name?.trim()?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

// ── MessageBox configuration ────────────────────────────────────────────────

/**
 * Which server the handle rail delivers through, and the only route to changing it.
 *
 * Both halves are load-bearing rather than decorative. The panel holds the reset
 * and the use-no-server escape hatches, so without an affordance that opens it a
 * user who saved a broken host has no way back — the auto-open below only fires
 * for the explicit no-server sentinel. And the host is worth naming because it
 * decides whether a handle payment can be delivered at all.
 */
function useMessageBox(): {
  state: MessageBoxState | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  saving: boolean;
  save: (url: string) => Promise<void>;
} {
  const box = useAsync(() => payHost().handle.messageBox(), null as MessageBoxState | null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const announced = useRef(false);

  // No server means the rail cannot deliver, which the user has to be told once
  // rather than discover from a failed payment. Once per mount: re-opening the
  // panel every reload would fight anyone who deliberately closed it.
  useEffect(() => {
    if (box.data?.disabled && !announced.current) {
      announced.current = true;
      setOpen(true);
    }
  }, [box.data?.disabled]);

  const save = useCallback(
    async (url: string) => {
      setSaving(true);
      try {
        await payHost().handle.setMessageBox(url);
        box.reload();
        setOpen(false);
        toast.success("Message box saved");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [box],
  );

  return { state: box.data, open, setOpen, saving, save };
}

function MessageBoxBar({
  state,
  open,
  onToggle,
}: {
  state: MessageBoxState;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label="Message box server"
      className={`focus-ring flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
        state.disabled ? "border-negative/40" : "border-border"
      }`}
    >
      {state.disabled ? (
        <AlertCircle className="size-3.5 shrink-0 text-negative" aria-hidden="true" />
      ) : (
        <Check className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
      )}
      <span className={`min-w-0 flex-1 truncate ${state.disabled ? "text-negative" : "text-muted-foreground"}`}>
        {state.disabled ? "No server — tap to configure" : state.url}
      </span>
      <Settings className={`size-4 shrink-0 ${open ? "text-accent" : "text-muted-foreground"}`} aria-hidden="true" />
    </button>
  );
}

function MessageBoxPanel({
  state,
  saving,
  onSave,
}: {
  state: MessageBoxState;
  saving: boolean;
  onSave: (url: string) => void;
}): ReactNode {
  // Seeded from the saved value, except for the sentinel: showing `noMessageBox`
  // in a URL field invites someone to edit it into a host that does not exist.
  const [input, setInput] = useState(state.disabled ? "" : state.url);
  const trimmed = input.trim();

  return (
    <div className="space-y-2 rounded-xl bg-surface p-3">
      <p className="text-xs font-semibold">Message box server</p>
      <p className="text-[11px] text-muted-foreground">
        Handle payments are delivered through this server. Both people need one to be reachable.
      </p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) onSave(trimmed);
        }}
        placeholder={state.defaultUrl}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="url"
        aria-label="Message box URL"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none"
      />
      <button
        type="button"
        onClick={() => onSave(trimmed)}
        disabled={saving || !trimmed}
        className="focus-ring w-full rounded-lg bg-accent py-2 text-xs font-bold text-accent-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <div className="flex gap-3">
        {!state.isDefault ? (
          <button
            type="button"
            onClick={() => onSave(state.defaultUrl)}
            disabled={saving}
            className="focus-ring text-xs font-semibold text-accent disabled:opacity-50"
          >
            Use the default
          </button>
        ) : null}
        {!state.disabled ? (
          <button
            type="button"
            onClick={() => onSave(state.noneValue)}
            disabled={saving}
            className="focus-ring ml-auto text-xs font-semibold text-muted-foreground disabled:opacity-50"
          >
            Use no server
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The bar, its panel, and the warning that the rail is off — as one block. */
function MessageBoxSection({ box }: { box: ReturnType<typeof useMessageBox> }): ReactNode {
  if (!box.state) return null;
  return (
    <div className="space-y-2">
      <MessageBoxBar state={box.state} open={box.open} onToggle={() => box.setOpen(!box.open)} />
      {box.open ? <MessageBoxPanel state={box.state} saving={box.saving} onSave={(u) => void box.save(u)} /> : null}
    </div>
  );
}

// ── Handle rail ─────────────────────────────────────────────────────────────

/** Share your handle. The link is the same `peerpay:` form the app already routes. */
function HandleReceive(): ReactNode {
  const identity = useAsync(() => payHost().handle.identity(), null as unknown as never);
  const box = useMessageBox();
  const [stuck, setStuck] = useState<InboxRow[]>([]);
  const [working, setWorking] = useState(false);
  const [received, setReceived] = useState<{ amount: number; count: number } | null>(null);
  // A read in flight, whether a poll tick or a tap. usePoll guards its own
  // re-entry but knows nothing about the button, and two concurrent reads of the
  // same box race to credit the same payment.
  const busy = useRef(false);

  const key = (identity.data as { identityKey?: string } | null)?.identityKey ?? null;
  const link = (identity.data as { link?: string } | null)?.link ?? null;

  /**
   * Credit whatever is in the box.
   *
   * Accepting was never a decision a user could act on — the money is already
   * theirs and refusing only leaves it in the box — so an arrival is reported,
   * not offered, and only the failures get a list.
   *
   * `silent` is for the poll: a tick that finds nothing must say nothing, and a
   * tick that fails must not raise an error toast every five seconds over a
   * flapping connection. What a tick may always do is report money arriving.
   */
  const pump = useCallback(async (retry?: string[], silent = false) => {
    if (busy.current) return;
    busy.current = true;
    if (!silent) setWorking(true);
    try {
      const { accepted, creditedSatoshis, stuck: left } = await payHost().handle.inbox(retry);
      if (accepted > 0) setReceived({ amount: creditedSatoshis ?? 0, count: accepted });
      setStuck(left);
    } catch (e: unknown) {
      if (!silent) toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }, []);

  // No server, no box to read. Reading anyway would raise an error toast on mount
  // and then once every five seconds after it.
  const canRead = !!key && box.state !== null && !box.state.disabled;

  useEffect(() => {
    if (canRead) void pump();
  }, [canRead, pump]);

  // The payment lands when the SENDER's wallet delivers it, which is not an event
  // this device can be told about — MessageBox has no push channel here. Standing
  // in front of this screen has to be enough.
  usePoll(async () => {
    await pump(undefined, true);
  }, INBOX_POLL_MS, canRead);

  if (identity.loading && !key) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!key) return <p className="py-10 text-center text-sm text-negative">{identity.error ?? "No identity key"}</p>;

  return (
    <div className="space-y-4">
      {received ? (
        <ReceivedPanel amount={received.amount} count={received.count} onDone={() => setReceived(null)} />
      ) : null}
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
      {/* Only true while there is a box to read. With no server the sentence
          would be a promise the rail cannot keep. */}
      <p className="text-center text-xs text-balance text-muted-foreground">
        {canRead
          ? "Payments sent to your handle are credited automatically while this is open."
          : "Choose a message box server below before sharing your handle."}
      </p>

      <MessageBoxSection box={box} />

      {/* The poll does this every few seconds; the button is for someone who does
          not want to wait out an interval, and for saying so out loud that
          checking is a thing that happens. */}
      <button
        type="button"
        onClick={() => void pump()}
        disabled={working || !canRead}
        className="focus-ring w-full rounded-xl border border-border py-2 text-xs font-semibold text-accent disabled:opacity-50"
      >
        {working ? "Checking…" : "Check now"}
      </button>

      {stuck.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-negative">
            {stuck.length === 1 ? "Couldn\u2019t be added" : `${stuck.length} couldn\u2019t be added`}
          </p>
          {stuck.map((row) => (
            <StuckRow key={row.messageId} row={row} onRetry={() => void pump([row.messageId])} onDiscarded={() => void pump()} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A payment the wallet could not credit, with its two ways out.
 *
 * Giving up ABANDONS money: the acknowledge removes the message from the box, so
 * this wallet can never credit it and the only recovery is asking the sender to
 * pay again. It is armed rather than confirmed — one tap to arm, a second to do
 * it, and it disarms itself after a few seconds — which is the same shape the
 * destructive controls in Settings use. `window.confirm` was doing the job, but
 * it is a browser chrome dialog in an app that is not presenting itself as a
 * browser page, and it blocks the poll behind it while it sits there.
 */
function StuckRow({
  row,
  onRetry,
  onDiscarded,
}: {
  row: InboxRow;
  onRetry: () => void;
  onDiscarded: () => void;
}): ReactNode {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISCARD_ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="rounded-xl border border-negative/40 bg-negative/10 p-3 text-xs">
      <p className="font-semibold">{sats(row.amount)}</p>
      <p className="mt-0.5 text-muted-foreground">{row.error}</p>
      {armed ? (
        <p className="mt-1 text-negative">
          The money cannot be recovered — the sender would have to pay again.
        </p>
      ) : null}
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onRetry} className="focus-ring font-semibold text-accent">
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            void payHost()
              .handle.discard(row.messageId)
              .then(onDiscarded)
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)));
          }}
          className="focus-ring font-semibold text-negative"
        >
          {armed ? "Tap again to give up" : "Give up"}
        </button>
      </div>
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
  const box = useMessageBox();

  const unsent = useMemo(() => outbox.data.filter((e) => e.status === "unsent"), [outbox.data]);
  const disabled = box.state?.disabled === true;
  const canSend = recipient.length > 0 && Number(amount) > 0 && !sending && !disabled;

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
      <RecipientField value={recipient} onChange={setRecipient} />

      <AmountField value={amount} onChange={setAmount} />

      {/*
       * The address rail's consequence line has always been here and this one was
       * missing, which had it backwards for the payer standing there: the address
       * rail's surprise is that nobody is told, and this rail's is that the money
       * leaves now and arrives whenever the other wallet next looks. Both are
       * things you want to know before the tap, not after.
       */}
      <Note>{HANDLE_CONSEQUENCE}</Note>

      <MessageBoxSection box={box} />

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
  // Not state. Whoever opened the sheet chose the direction, and there is no control
  // in here that can change it — see the heading below.
  const direction = initialDirection;
  const [cell, setCell] = useState<Cell | null>(null);

  const offline = useAsync(() => payHost().offline.status(), {
    queued: 0,
    rejected: [],
    sentRejected: [],
    queuedSent: [],
  } as OfflineStatus, open, [cell, online]);

  useEffect(() => {
    if (open) setCell(null);
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

            {/*
             * Direction is stated, not chosen. Nothing opens this sheet without
             * already having answered it — Send and Receive are the only two doors
             * in — so a segmented control here re-asked a question the user had just
             * answered, and offered them the chance to contradict themselves.
             */}
            <h3 className="mb-4 text-base font-bold">{DIRECTION_TITLES[direction]}</h3>

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
    <Sheet
      open={open}
      onClose={onClose}
      label={cell ? CELL_TITLES[cell] : DIRECTION_TITLES[direction]}
    >
      <div className="p-4">
        {cell ? (
          <button
            type="button"
            onClick={() => setCell(null)}
            className="focus-ring mb-3 flex items-center gap-1 text-xs font-semibold text-accent"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {DIRECTION_TITLES[direction]}
          </button>
        ) : null}
        {body()}
      </div>
    </Sheet>
  );
}

/** Re-exported so the wallet screen can open the sheet straight into a direction. */
export const PAY_DIRECTIONS: Record<"send" | "receive", Direction> = { send: "pay", receive: "get" };

