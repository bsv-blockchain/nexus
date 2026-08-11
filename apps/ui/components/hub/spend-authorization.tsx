"use client";

/**
 * "This page wants to spend your money."
 *
 * The wallet is BLOCKED while this is on screen. A browsed page's `createAction`
 * does not return until the permissions manager is granted or denied, so every
 * path out of this component must answer — including unmount, where a dropped
 * request leaves the page frozen mid-payment until the bridge times out thirty
 * seconds later with an error the page cannot distinguish from a network fault.
 *
 * Requests under the auto-approve limit never reach here; the shell grants those
 * itself (see WalletContext's spendingAuthorizationCallback). What arrives is
 * either above the limit or inside the cooldown, which is to say: the cases where
 * a person is supposed to look.
 *
 * Deny is the default. Escape, the backdrop and unmount all deny rather than
 * leaving it open, because the failure mode of denying wrongly is a page that
 * says "payment cancelled" and the failure mode of the alternative is money
 * leaving a wallet because someone walked away from their phone.
 */

import { Sheet } from "@/components/apps/messages/sheet";
import { OriginLabel } from "@/components/hub/origin-label";
import { displayOrigin } from "@/lib/rail/origin";
import { SATS_PER_BSV, usd } from "@/lib/wallet";
import { useBsvRate } from "@/lib/wallet-live";
import { useHostOverlay } from "@/lib/wallet-data";
import { AlertTriangle, ArrowUpRight, Globe } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** The shell's SpendingRequest, minus what the chrome has no business seeing. */
export interface SpendRequest {
  requestID: string;
  originator: string;
  description?: string;
  authorizationAmount: number;
  renewal?: boolean;
  lineItems?: { description?: string; satoshis?: number }[];
}

interface PermissionHost {
  on?: (event: string, cb: (payload: unknown) => void) => () => void;
  permission?: {
    resolve: (
      requestID: string,
      approved: boolean,
      opts?: { amount?: number; ephemeral?: boolean },
    ) => Promise<unknown>;
    pending?: () => Promise<SpendRequest | null>;
  };
}

function host(): PermissionHost | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { nexusHost?: PermissionHost }).nexusHost ?? null;
}

function sats(n: number): string {
  return `${n.toLocaleString("en-US")} sats`;
}

/**
 * The originator, written the way the origin chip writes it — or null when the
 * shell did not name one.
 *
 * Same function, deliberately: a page cannot be one origin in the chip at the
 * top of the screen and another in the dialog that spends money. The scheme has
 * to go on first — the shell sends a bare host (`originatorForUrl` in the
 * substrate returns `new URL(url).host`) and `displayOrigin` needs something
 * `new URL` will parse, or it hands the string back untouched and the two
 * surfaces disagree about a leading `www.`.
 */
function originatorLabel(originator: string): string | null {
  if (!originator) return null;
  return displayOrigin(
    /^[a-z][a-z0-9+.-]*:\/\//i.test(originator)
      ? originator
      : `https://${originator}`,
  );
}

export function SpendAuthorization(): ReactNode {
  const [request, setRequest] = useState<SpendRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const rate = useBsvRate();

  // The live request, for the unmount path — which cannot read state.
  const live = useRef<SpendRequest | null>(null);
  live.current = request;

  const answer = useCallback((approved: boolean, amount?: number): void => {
    const current = live.current;
    if (!current) return;
    setBusy(true);
    const api = host()?.permission;
    // Clear locally FIRST. If the shell's reply never comes we must not be left
    // showing a sheet for a request nobody is waiting on any more, and the shell
    // is authoritative about the queue in either case.
    live.current = null;
    setRequest(null);
    void api
      ?.resolve(current.requestID, approved, approved && amount ? { amount } : {})
      .catch(() => {
        // Nothing useful to say: the page finds out from its own call either way.
      })
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    const h = host();
    if (!h?.on) return;
    const off = h.on("permission.request", (payload) => {
      const next = payload as SpendRequest | null;
      // Null means the queue drained — including because this request was
      // answered somewhere else — so it closes the sheet rather than being
      // ignored. Without that, answering from a second surface would leave a
      // sheet up for a request nobody is waiting on.
      if (!next || typeof next.requestID !== "string") {
        live.current = null;
        setRequest(null);
        return;
      }
      setRequest(next);
    });
    // A chrome reload while a request is queued would otherwise never see it —
    // the push already happened. Ask once at mount for whatever is outstanding.
    void h.permission?.pending?.().then((pending) => {
      if (pending && typeof pending.requestID === "string") setRequest(pending);
    }).catch(() => {});
    return off;
  }, []);

  // Deny anything still open when this unmounts. See the header: silence here is
  // a frozen page, and the wallet has no timeout of its own.
  useEffect(() => {
    return () => {
      const current = live.current;
      if (current) void host()?.permission?.resolve(current.requestID, false).catch(() => {});
    };
  }, []);

  // The tab layer paints above this document, so a sheet over a browsed page is
  // invisible until the shell takes that layer down. Refcounted by the hook, which
  // matters here: this can be up at the same time as another chrome overlay.
  useHostOverlay(request !== null);

  if (!request) return null;

  const origin = originatorLabel(request.originator);
  const amount = request.authorizationAmount;
  const bsv = amount / SATS_PER_BSV;
  const fiat = rate === null ? null : bsv * rate;
  const items = (request.lineItems ?? []).filter((item) => item && (item.description || item.satoshis));

  return (
    <Sheet open onClose={() => answer(false)} label="Approve this payment">
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="bg-warning/15 text-warning flex size-9 shrink-0 items-center justify-center rounded-full">
            <ArrowUpRight className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold">Approve this payment?</h2>
            {/* items-start and no `truncate`: the tail of a hostname is the
                registrable domain, and clipping it here is clipping the one fact
                this dialog exists to state. OriginLabel wraps instead, and is
                the same component the origin chip draws with. */}
            <p className="text-muted-foreground mt-0.5 flex items-start gap-1.5 text-xs">
              <Globe className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              {origin === null ? (
                <span className="font-mono">an unnamed site</span>
              ) : (
                <OriginLabel origin={origin} />
              )}
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 text-center">
          <p className="text-2xl font-bold tracking-tight">{sats(amount)}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {bsv.toFixed(8)} BSV{fiat === null ? "" : ` · ${usd(fiat)}`}
          </p>
        </div>

        {request.description ? (
          <div>
            <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
              What it is for
            </p>
            <p className="mt-1 text-sm text-pretty">{request.description}</p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="divide-border bg-surface divide-y overflow-hidden rounded-xl">
            {items.map((item, index) => (
              <li key={index} className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 truncate">{item.description ?? "Item"}</span>
                <span className="shrink-0 font-semibold">
                  {typeof item.satoshis === "number" ? sats(item.satoshis) : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Said plainly, because a renewal is the one that keeps spending after
            this sheet is gone. */}
        {request.renewal ? (
          <div className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs">
            <AlertTriangle className="text-warning mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              This renews a spending limit this site already had. Approving lets it keep
              spending up to this amount without asking again.
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            disabled={busy}
            className="focus-ring border-border rounded-xl border py-3 text-sm font-semibold disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => answer(true, amount)}
            disabled={busy}
            className="focus-ring bg-accent text-accent-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            Approve
          </button>
        </div>
        <p className="text-muted-foreground text-center text-[11px]">
          Approving authorises this one payment. Change the limit for silent payments in
          Settings → Wallet.
        </p>
      </div>
    </Sheet>
  );
}
