"use client";

/**
 * Swapping, both kinds.
 *
 * The first screen is the same either way — what you have, what you want, how
 * much — and what happens after it is decided by that choice rather than by
 * anything the person has to understand in advance. Two BSV assets settle here
 * and it is over in one press. Anything crossing a chain walks through the four
 * steps a real cross-chain swap actually has, because each of them is a thing
 * that can go wrong and only the person can prevent: the wrong destination, no
 * refund path, the wrong network, a deposit sent after the window closed.
 *
 * The provider side is mocked and advances when you act on it. What is not
 * mocked is the shape — the addresses, the window, the id you would quote at
 * support, the warning about sending on the wrong chain. Those are what the
 * screen is for.
 *
 * @see lib/swap.ts for the model and the routing rule
 */

import { formatUnits } from "@/components/apps/wallet/token-mark";
import { CoinMark, CoinPicker } from "@/components/apps/wallet/coin-picker";
import { Sheet } from "@/components/apps/messages/sheet";
import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { content } from "@/lib/data";
import { useMinute } from "@/lib/clock";
import {
  depositAddress,
  quote,
  routeFor,
  swapId,
  SWAP_WINDOW_MS,
  useSwapCoins,
  type SwapCoin,
} from "@/lib/swap";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The provider standing behind a cross-chain swap.
 *
 * Named on screen, every step. A swap that crosses a chain is a swap somebody
 * else is holding your money during, and a wallet that does not say whose hands
 * those are is a wallet taking credit for a custody it does not have.
 */
const PROVIDER = {
  name: "ChangeNOW",
  support: "https://changenow.io/support",
} as const;

/** Ordered, because the track draws them and the header counts them. */
const STEPS = [
  "Choose amount",
  "Review details",
  "Review & send",
  "Done",
] as const;

type Step = 0 | 1 | 2 | 3;

/* -------------------------------------------------------------------------- */

/** `2/4 Review details` over a bar, which is where you are and how far. */
function Track({ step }: { step: Step }): ReactNode {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
        <span className="text-foreground tabular-nums">
          {step + 1}/{STEPS.length}
        </span>{" "}
        {STEPS[step]}
      </p>
      <div className="bg-surface flex h-1 gap-1 overflow-hidden rounded-full">
        {STEPS.map((name, index) => (
          <span
            key={name}
            className={`h-full flex-1 rounded-full transition-colors ${
              index <= step ? "bg-accent" : "bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A labelled amount with its mark — the You send / You get pair.
 *
 * `units` of null is not zero. A pair the fixtures cannot price has no figure
 * to show yet, and printing `0 ETH` under "You get" says you get nothing, which
 * is the worst available reading of an unknown.
 */
function Leg({
  label,
  coin,
  units,
}: {
  label: string;
  coin: SwapCoin;
  units: number | null;
}): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <CoinMark coin={coin} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-bold">
          {units === null
            ? coin.symbol
            : `${formatUnits(units, coin.decimals)} ${coin.symbol}`}
        </p>
      </div>
      {units === null && (
        <p className="text-muted-foreground shrink-0 text-[11px]">
          Quoted at deposit
        </p>
      )}
    </div>
  );
}

/** A value you will need again later, with the button that gets it for you. */
function CopyRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactNode {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-xl border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          {label}
        </p>
        <p className={`truncate text-xs ${mono ? "font-mono" : "font-bold"}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
        }}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded-lg p-1.5"
      >
        {copied ? (
          <Check className="text-positive size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** A thing worth knowing before you commit, in the tone of a note not an alarm. */
function Note({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-[11px] leading-relaxed">
      <span className="mt-px shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

function backLink(label: string, onClick: () => void): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-xs font-bold"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Step 1, and the whole of the in-wallet route.
 *
 * The rate line only appears when there is a real rate to state. A cross-chain
 * pair gets "quoted at deposit" instead, which is what actually happens — a
 * number invented here would be a number the provider then disagrees with.
 */
function Choose({
  coins,
  fromId,
  toId,
  amount,
  onFrom,
  onTo,
  onAmount,
}: {
  coins: SwapCoin[];
  fromId: string;
  toId: string;
  amount: string;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  onAmount: (value: string) => void;
}): ReactNode {
  const copy = content.wallet;
  const from = coins.find((coin) => coin.id === fromId);
  const to = coins.find((coin) => coin.id === toId);
  const units = Number(amount);
  const priced = from && to ? quote(from, to, units) : null;

  return (
    <div className="space-y-4">
      <CoinPicker
        coins={coins}
        selected={fromId}
        onSelect={onFrom}
        label={copy.from}
      />
      <div className="border-border flex items-center gap-2 rounded-xl border px-3">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) =>
            onAmount(event.target.value.replace(/[^\d.]/g, ""))
          }
          placeholder="0"
          aria-label={copy.amount}
          className="h-12 min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
        />
        {from && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
            <CoinMark coin={from} size={16} />
            {from.symbol}
          </span>
        )}
      </div>
      {from && from.units > 0 && (
        <button
          type="button"
          onClick={() => onAmount(String(from.units))}
          className="focus-ring text-muted-foreground hover:text-foreground -mt-2 block rounded-lg text-[11px]"
        >
          Balance {formatUnits(from.units, from.decimals)} {from.symbol} — use
          all
        </button>
      )}

      <div className="flex justify-center">
        <span
          className="bg-surface text-muted-foreground flex size-8 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ArrowDown className="size-4" />
        </span>
      </div>

      <CoinPicker
        coins={coins}
        selected={toId}
        onSelect={onTo}
        label={copy.to}
      />
      <div className="bg-surface rounded-xl p-3">
        {priced && to ? (
          <p className="flex items-baseline gap-2 text-lg font-bold">
            {formatUnits(priced.units, to.decimals)}
            {to && (
              <span className="inline-flex items-center gap-1 text-sm">
                <CoinMark coin={to} size={14} />
                {to.symbol}
              </span>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {PROVIDER.name} quotes this pair when your deposit lands. What you
            see before then is an estimate.
          </p>
        )}
      </div>

      {from && to && (
        <dl className="border-border space-y-1.5 border-t pt-3 text-xs">
          {priced && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.rate}</dt>
              <dd>
                1 {from.symbol} = {formatUnits(priced.rate, to.decimals)}{" "}
                {to.symbol}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{copy.networkFee}</dt>
            <dd>{routeFor(from, to) === "wallet" ? "1 sat" : "Included"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Settled by</dt>
            <dd className="flex items-center gap-1">
              {routeFor(from, to) === "wallet" ? (
                <>
                  <Check className="text-positive size-3" aria-hidden="true" />
                  This wallet, {copy.noSpread.toLowerCase()}
                </>
              ) : (
                PROVIDER.name
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * Step 2 — where it lands, and where it comes back to if it does not.
 *
 * The refund address is the field people skip, so it is a field rather than a
 * disclosure, and the reason it matters is written next to it. A cross-chain
 * swap that fails with no refund address is money in a queue nobody can move.
 */
function Details({
  from,
  to,
  units,
  destination,
  refund,
  onDestination,
  onRefund,
  onBack,
}: {
  from: SwapCoin;
  to: SwapCoin;
  units: number;
  destination: string;
  refund: string;
  onDestination: (value: string) => void;
  onRefund: (value: string) => void;
  onBack: () => void;
}): ReactNode {
  const priced = quote(from, to, units);
  return (
    <div className="space-y-4">
      {backLink("Change amount", onBack)}

      <div className="border-border space-y-3 rounded-xl border p-3">
        <Leg label="You send" coin={from} units={units} />
        <div className="border-border border-t" />
        <Leg label="You get" coin={to} units={priced?.units ?? null} />
      </div>

      <label className="block space-y-1.5">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          {to.symbol} destination · {to.networkLabel}
        </span>
        <input
          type="text"
          value={destination}
          onChange={(event) => onDestination(event.target.value)}
          placeholder={`Your ${to.symbol} address`}
          spellCheck={false}
          className="focus-ring border-border bg-surface w-full rounded-xl border px-3 py-2.5 font-mono text-xs outline-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          Refund address · {from.networkLabel}
        </span>
        <input
          type="text"
          value={refund}
          onChange={(event) => onRefund(event.target.value)}
          placeholder={`Where ${from.symbol} comes back to`}
          spellCheck={false}
          className="focus-ring border-border bg-surface w-full rounded-xl border px-3 py-2.5 font-mono text-xs outline-none"
        />
      </label>

      <div className="border-border space-y-2 border-t pt-3">
        <Note icon={<ShieldCheck className="size-3.5" />}>
          Send only {from.symbol}, on the {from.networkLabel} network. Another
          coin, or the right coin on the wrong chain, cannot be recovered.
        </Note>
        <Note icon={<CircleAlert className="size-3.5" />}>
          If the swap fails, {from.symbol} goes back to the refund address. Leave
          it empty and there is nowhere to send it.
        </Note>
        <Note icon={<ExternalLink className="size-3.5" />}>
          Swapped by {PROVIDER.name}. Rates, limits and custody during the swap
          are theirs.
        </Note>
      </div>
    </div>
  );
}

/**
 * Step 3 — the order exists, the money has not moved.
 *
 * Everything here is a thing the person needs while they are away from the
 * screen: the id support will ask for, how long they have, and the one button
 * that actually sends. The countdown is minute-resolution because the window is
 * a day — a second hand on a 24-hour clock is decoration that repaints.
 */
function Review({
  from,
  to,
  units,
  destination,
  id,
  createdAt,
  onSend,
  onBack,
}: {
  from: SwapCoin;
  to: SwapCoin;
  units: number;
  destination: string;
  id: string;
  createdAt: number;
  onSend: () => void;
  onBack: () => void;
}): ReactNode {
  const now = useMinute();
  const priced = quote(from, to, units);
  const left = createdAt + SWAP_WINDOW_MS - (now || createdAt);
  const hours = Math.max(0, Math.floor(left / 3_600_000));
  const minutes = Math.max(0, Math.floor((left % 3_600_000) / 60_000));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-surface text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold">
          <span
            className="bg-accent size-1.5 animate-pulse rounded-full"
            aria-hidden="true"
          />
          Waiting for your {from.symbol}
        </span>
        <button
          type="button"
          onClick={() => toast.success("Status is current.")}
          className="focus-ring text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-bold"
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />
          Refresh status
        </button>
      </div>

      <div className="border-border space-y-3 rounded-xl border p-3">
        <Leg label="You send" coin={from} units={units} />
        <div className="border-border border-t" />
        <Leg label="You get" coin={to} units={priced?.units ?? null} />
      </div>

      <CopyRow label="Swap ID" value={id} mono={false} />
      <CopyRow
        label={`Destination · ${to.networkLabel}`}
        value={destination || depositAddress(to, id)}
      />

      <p className="text-muted-foreground text-[11px]">
        This quote holds for{" "}
        <span className="text-foreground font-bold tabular-nums">
          {hours}h {minutes}m
        </span>
        . After that {PROVIDER.name} requotes at whatever the market is then.
      </p>

      <div className="border-border space-y-2 border-t pt-3">
        <Note icon={<CircleAlert className="size-3.5" />}>
          Send on the {from.networkLabel} network only. A deposit on another
          network reaches an address nobody holds the key to.
        </Note>
        <Note icon={<ExternalLink className="size-3.5" />}>
          Something wrong?{" "}
          <a
            href={PROVIDER.support}
            target="_blank"
            rel="noreferrer"
            className="text-accent font-bold underline underline-offset-2"
          >
            {PROVIDER.name} support
          </a>{" "}
          — quote the Swap ID.
        </Note>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onSend}
          className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
        >
          Review {from.symbol} payment
        </button>
        <button
          type="button"
          onClick={onBack}
          className="focus-ring text-muted-foreground hover:text-foreground w-full rounded-full px-4 py-2 text-xs font-bold"
        >
          Change amount or destination
        </button>
      </div>
    </div>
  );
}

/** Step 4 — sent, and what happens without you. */
function Done({
  from,
  to,
  units,
  id,
  onClose,
}: {
  from: SwapCoin;
  to: SwapCoin;
  units: number;
  id: string;
  onClose: () => void;
}): ReactNode {
  const priced = quote(from, to, units);
  return (
    <div className="space-y-4 text-center">
      <span
        className="bg-positive/15 text-positive mx-auto grid size-12 place-items-center rounded-full"
        aria-hidden="true"
      >
        <Check className="size-6" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-bold">
          {formatUnits(units, from.decimals)} {from.symbol} sent
        </h3>
        <p className="text-muted-foreground text-xs">
          {PROVIDER.name} releases{" "}
          {priced
            ? `${formatUnits(priced.units, to.decimals)} ${to.symbol}`
            : `your ${to.symbol}`}{" "}
          to your {to.networkLabel} address once the deposit confirms. Usually
          minutes.
        </p>
      </div>
      <CopyRow label="Swap ID" value={id} mono={false} />
      <button
        type="button"
        onClick={onClose}
        className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Exchange: one entry, two routes.
 *
 * `onExchange` fires only on the in-wallet route, because that is the one that
 * is over when you press the button. The provider route ends on its own fourth
 * step, where the money is out and the coin has not arrived yet — a toast
 * saying "Exchanged" over that would be a lie about who has what.
 */
export function SwapSheet({
  open,
  onClose,
  onExchange,
}: {
  open: boolean;
  onClose: () => void;
  onExchange: (args: {
    from: SwapCoin;
    to: SwapCoin;
    fromUnits: number;
    toUnits: number;
  }) => void;
}): ReactNode {
  const copy = content.wallet;
  const coins = useSwapCoins(useWalletAccountId());
  const [fromId, setFromId] = useState("bsv");
  const [toId, setToId] = useState("eursv");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [destination, setDestination] = useState("");
  const [refund, setRefund] = useState("");
  const [createdAt, setCreatedAt] = useState(0);

  /*
   * Back to the top each time it opens.
   *
   * Reopening onto step 3 of a swap somebody walked away from is the sheet
   * insisting on a decision they already declined. Adjusted during render off a
   * remembered prop rather than in an effect: an effect would paint the stale
   * step first and then correct it, which is the flash of somebody else's swap.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setStep(0);
      setDestination("");
      setRefund("");
      setAmount("");
    }
  }

  const from = coins.find((coin) => coin.id === fromId);
  const to = coins.find((coin) => coin.id === toId);
  const units = Number(amount);
  const route = from && to ? routeFor(from, to) : "wallet";
  const id = from && to ? swapId(from, to, amount) : "";

  /*
   * You cannot spend what you do not hold — on the route this wallet settles.
   *
   * The provider route is not checked, and deliberately: the deposit is sent by
   * hand from wherever the coin actually lives, which for `ETH → BSV` is not
   * this wallet at all. Blocking that on a BSV balance would refuse the swap
   * somebody opened the screen to make.
   */
  const fundable = from && (route === "provider" || units <= from.units);
  const canAdvance =
    Boolean(from && to) &&
    fromId !== toId &&
    Number.isFinite(units) &&
    units > 0 &&
    Boolean(fundable);

  function advance(): void {
    if (!from || !to) return;
    if (route === "wallet") {
      const priced = quote(from, to, units);
      onExchange({
        from,
        to,
        fromUnits: units,
        toUnits: priced?.units ?? 0,
      });
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      /* Stamped once, when the order is created — the window is the provider's
         and it starts when they quote, not when the screen repaints. */
      setCreatedAt(Date.now());
      setStep(2);
    }
  }

  const footer =
    step === 0 || step === 1 ? (
      <button
        type="button"
        disabled={!canAdvance || (step === 1 && !destination.trim())}
        onClick={advance}
        className="focus-ring bg-accent text-accent-foreground w-full rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {route === "wallet"
          ? copy.confirmExchange
          : step === 0
            ? "Continue"
            : "Create swap"}
      </button>
    ) : undefined;

  return (
    <Sheet open={open} onClose={onClose} label={copy.exchange} footer={footer}>
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{copy.exchange}</h2>

        {/* Only the provider route has steps. Showing a 1-of-4 track over a
            swap that finishes on this screen would promise three screens that
            never come. */}
        {route === "provider" && <Track step={step} />}

        {step === 0 && (
          <Choose
            coins={coins}
            fromId={fromId}
            toId={toId}
            amount={amount}
            onFrom={setFromId}
            onTo={setToId}
            onAmount={setAmount}
          />
        )}

        {step === 1 && from && to && (
          <Details
            from={from}
            to={to}
            units={units}
            destination={destination}
            refund={refund}
            onDestination={setDestination}
            onRefund={setRefund}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && from && to && (
          <Review
            from={from}
            to={to}
            units={units}
            destination={destination}
            id={id}
            createdAt={createdAt}
            onSend={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && from && to && (
          <Done
            from={from}
            to={to}
            units={units}
            id={id}
            onClose={onClose}
          />
        )}
      </div>
    </Sheet>
  );
}
