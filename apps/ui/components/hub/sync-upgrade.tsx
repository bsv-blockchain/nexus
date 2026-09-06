"use client";

/**
 * Turning Nexus Sync on.
 *
 * Adapted from the reference upgrade sheet: your details and payment method on
 * the left, the plan and the confirmation on the right. A modal on a pointer, a
 * full-height scrolling sheet on a phone — the form is long enough that a
 * centred box on a small screen would be a scroller inside a scroller.
 *
 * Two departures from the reference, both because Nexus Sync is one person
 * syncing their own devices rather than a company buying seats: nothing is
 * priced per member, and there is no "contact sales" — there is nobody to
 * contact about $9.99.
 *
 * The part that is ours rather than adapted is paying from the wallet. It is
 * offered only when the workspace's wallet can actually cover the period being
 * bought, checked against the *recurring* price rather than the discounted
 * first charge: a wallet that covers an introductory month and then cannot pay
 * the next one has not really covered anything.
 */

import { usdForSatoshis, useUsdPerBsv } from "@/lib/exchange-rate";
import { useHub } from "@/components/hub/hub-provider";
import { useHostOverlay } from "@/lib/wallet-data";
import { content } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { activeWalletFor, isUnlocked } from "@/lib/wallets-store";
import { closeSync, useTimeline } from "@/lib/timeline-store";
import { CloudSync, CreditCard, Check, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.timeline.upgrade;

/**
 * The plan, in one place.
 *
 * `now` is what the first charge is after the introductory discount; `every` is
 * what it costs from then on. Keeping both explicit is what lets the sheet say
 * "$4.99 due now, then $9.99 monthly" without either number being derived from
 * a percentage at render and drifting from the badge beside it.
 */
const PLANS = {
  month: { list: 9.99, now: 4.99, every: 9.99, label: copy.perMonth },
  year: { list: 119.88, now: 99, every: 99, label: copy.perYear },
} as const;

/**
 * What paying from the wallet takes off, and why it is a different deal.
 *
 * Card is a subscription: a discounted first charge, then a recurring one.
 * Wallet buys the whole period outright and does not renew — so there is no
 * second charge to hold anybody to, and the 6.9% is what that certainty is
 * worth. It comes off the amount the card would have taken now, which is what
 * makes it read as a discount rather than as a different price list.
 */
const WALLET_DISCOUNT = 0.069;

type Period = keyof typeof PLANS;

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Mounted once, by the shell.
 *
 * It lived inside the Timeline, which was right while the Timeline's rail was
 * the only place the pitch appeared. Focus grew a card carrying the same
 * argument — see components/hub/nexus-sync-pitch, which exists because the two
 * columns share the words and not the shell around them — and its button did
 * nothing at all: `openSync` set a flag with nobody rendering the sheet.
 *
 * So it sits beside the other things the whole app can open. Anywhere that
 * offers Nexus Sync now opens the same sheet, and a third place offering it
 * gets that for free rather than discovering this the same way Focus did.
 */
export function SyncUpgrade(): ReactNode {
  const { syncOpen } = useTimeline();

  /* Take the native tab layer away: the Timeline can be open with Browse as
     the active app, and a browsed page paints above this document. Refcounted,
     and called before the early return because a hook cannot sit behind one. */
  useHostOverlay(syncOpen);

  return (
    <AnimatePresence>
      {syncOpen && <Sheet key="sync-upgrade" />}
    </AnimatePresence>
  );
}

function Sheet(): ReactNode {
  const isDesktop = useIsDesktop();
  const { activeSpaceId } = useHub();
  const [period, setPeriod] = useState<Period>("month");
  const [method, setMethod] = useState<"card" | "wallet">("card");
  const [agreed, setAgreed] = useState(false);
  const [company, setCompany] = useState(false);

  const plan = PLANS[period];
  /* Prepaying the period, less the bitcoin discount. */
  const walletTotal = plan.now * (1 - WALLET_DISCOUNT);
  const wallet = activeWalletFor(activeSpaceId);
  /* Priced at what bitcoin is worth now, not at a rate written into a fixture:
     this figure decides whether somebody can pay from their wallet. */
  const usdPerBsv = useUsdPerBsv();
  const balance = wallet
    ? usdForSatoshis(wallet.balanceSatoshis, usdPerBsv)
    : 0;
  /* `isUnlocked` only tracks wallets opened this session, so a wallet that was
     never sealed is not in it — the seal itself is `wallet.locked`. Reading the
     session list alone made every ordinary wallet look shut. */
  const locked = Boolean(wallet?.locked) && !isUnlocked(wallet!.id);
  /* Against the whole prepaid amount, because that is what leaves the wallet:
     this path buys the period outright rather than starting a subscription, so
     there is no later charge to also be good for. */
  const funded = Boolean(wallet) && !locked && balance >= walletTotal;
  const walletUsable = funded;

  /* A method that stops being payable when the period changes must not stay
     selected, or the button would be live over an unpayable choice. */
  const payMethod = method === "wallet" && !walletUsable ? "card" : method;

  const submit = (): void => {
    /* Only the card path has anything to agree to. Asking somebody to accept
       renewal terms for a purchase that does not renew would be a checkbox
       guarding nothing. */
    if (payMethod === "card" && !agreed) {
      toast.error(copy.needsConsent);
      return;
    }
    toast.success(copy.done);
    closeSync();
  };

  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeSync}
        className="fixed inset-0 z-75 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className={
          isDesktop
            ? `fixed top-1/2 left-1/2 max-h-[86vh] w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl ${frame}`
            : /* Full height and scrolling, not a short sheet: this form is
                 taller than a phone, and a sheet that cannot reach its own
                 button is a dead end. */
              `fixed inset-x-0 top-4 bottom-0 rounded-t-3xl ${frame}`
        }
      >
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={closeSync}
            aria-label={copy.close}
            className="focus-ring bg-surface-hover text-muted-foreground hover:text-foreground absolute top-4 right-4 z-10 rounded-full p-1.5"
          >
            <X className="size-4" aria-hidden="true" />
          </button>

          <div className="p-6 sm:p-8">
            <span className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-full">
              <CloudSync className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-2xl font-bold">{copy.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              {copy.blurb}
            </p>

            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <div>
                <Section title={copy.you}>
                  <Field label={copy.name} value="John Galt" />
                  {/*
                    Behind a switch, because most people buying this are not a
                    company and two blank optional fields ask everybody to
                    decide they do not apply. The ones who do need an invoice
                    know it before they open this.
                  */}
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={company}
                      onClick={() => setCompany(!company)}
                      className={`focus-ring mt-0.5 grid size-4 shrink-0 place-items-center rounded ring-1 transition-colors ${
                        company
                          ? "bg-accent text-accent-foreground ring-accent"
                          : "ring-border"
                      }`}
                    >
                      {company && <Check className="size-3" />}
                    </button>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {copy.asCompany}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {copy.asCompanyHint}
                      </span>
                    </span>
                  </label>
                  <AnimatePresence initial={false}>
                    {company && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <Field
                          label={copy.business}
                          placeholder={copy.businessPlaceholder}
                        />
                        <Field
                          label={copy.vat}
                          placeholder={copy.vatPlaceholder}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Section>

                <Section title={copy.payWith}>
                  <div
                    role="radiogroup"
                    aria-label={copy.payWith}
                    className="border-border divide-border/60 divide-y overflow-hidden rounded-xl border"
                  >
                    <MethodRow
                      icon={<CreditCard className="size-4" />}
                      label={copy.card}
                      selected={payMethod === "card"}
                      onSelect={() => setMethod("card")}
                    >
                      {payMethod === "card" && (
                        <div className="mt-3 space-y-2">
                          <Bare
                            label={copy.cardNumber}
                            placeholder="4242 4242 4242 4242"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Bare label={copy.cardExpiry} placeholder="04/29" />
                            <Bare label={copy.cardCvc} placeholder="123" />
                            <Bare
                              label={copy.cardPostcode}
                              placeholder="1011"
                            />
                          </div>
                        </div>
                      )}
                    </MethodRow>

                    <MethodRow
                      icon={<Wallet className="size-4" />}
                      label={copy.wallet}
                      selected={payMethod === "wallet"}
                      disabled={!walletUsable}
                      onSelect={() => setMethod("wallet")}
                      badge={walletUsable ? copy.walletOff : undefined}
                    >
                      {/*
                        Why it cannot be used, where the option is.
                        A greyed row with no reason beside it is the most
                        common way an interface refuses without explaining.
                      */}
                      <p className="text-muted-foreground mt-1 text-[11px] text-pretty">
                        {!wallet
                          ? copy.walletNone
                          : locked
                            ? copy.walletLocked.replace(
                                "{wallet}",
                                wallet.label
                              )
                            : !funded
                              ? copy.walletShort
                                  .replace("{wallet}", wallet.label)
                                  .replace(
                                    "{period}",
                                    period === "month"
                                      ? copy.periodMonth
                                      : copy.periodYear
                                  )
                              : `${copy.walletDesc.replace("{wallet}", wallet.label)} ${copy.walletAvailable.replace("{amount}", usd(balance))}`}
                      </p>
                    </MethodRow>
                  </div>
                </Section>
              </div>

              <div>
                <Section title={copy.billing} trailing="USD">
                  <div
                    role="radiogroup"
                    aria-label={copy.billing}
                    className="space-y-2"
                  >
                    <PlanRow
                      label={copy.monthly}
                      was={usd(PLANS.month.list)}
                      now={`${usd(PLANS.month.now)} ${copy.perMonth}`}
                      badge={copy.firstMonthOff}
                      selected={period === "month"}
                      onSelect={() => setPeriod("month")}
                    />
                    <PlanRow
                      label={copy.annually}
                      was={usd(PLANS.year.list)}
                      now={`${usd(PLANS.year.now)} ${copy.perYear}`}
                      badge={copy.bestValue}
                      accentBadge
                      note={copy.saves.replace(
                        "{amount}",
                        usd(PLANS.year.list - PLANS.year.now)
                      )}
                      selected={period === "year"}
                      onSelect={() => setPeriod("year")}
                    />
                  </div>
                </Section>

                <Section title={copy.confirm}>
                  <div className="border-border bg-surface-raised rounded-xl border p-4">
                    <p className="flex items-baseline gap-2">
                      <span className="text-muted-foreground text-sm line-through">
                        {usd(payMethod === "wallet" ? plan.now : plan.list)}
                      </span>
                      <span className="text-2xl font-bold">
                        {usd(payMethod === "wallet" ? walletTotal : plan.now)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {copy.dueNow}
                      </span>
                    </p>
                    {payMethod === "wallet" ? (
                      <>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {copy.walletPrepaid.replace(
                            "{span}",
                            period === "month" ? copy.spanMonth : copy.spanYear
                          )}
                        </p>
                        <p className="text-positive mt-0.5 text-xs font-medium">
                          {copy.walletSaves.replace(
                            "{amount}",
                            usd(plan.now - walletTotal)
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {copy.renews
                          .replace("{amount}", usd(plan.every))
                          .replace(
                            "{every}",
                            period === "month"
                              ? copy.everyMonth
                              : copy.everyYear
                          )}
                      </p>
                    )}

                    {payMethod === "card" && (
                      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={agreed}
                          onClick={() => setAgreed(!agreed)}
                          className={`focus-ring mt-0.5 grid size-4 shrink-0 place-items-center rounded ring-1 transition-colors ${
                            agreed
                              ? "bg-accent text-accent-foreground ring-accent"
                              : "ring-border"
                          }`}
                        >
                          {agreed && <Check className="size-3" />}
                        </button>
                        <span className="text-muted-foreground text-[11px] text-pretty">
                          {copy.autoRenew}{" "}
                          <span className="underline">({copy.terms})</span>
                        </span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={submit}
                      className="focus-ring bg-accent text-accent-foreground mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                    >
                      {copy.cta}
                    </button>
                  </div>
                </Section>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ---------------------------------------------------------------- parts --- */

function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        {/* The reference offers a currency picker. There is one currency here —
            the wallets are priced in it — and a dropdown with a single option
            is a control that teaches you it does nothing. */}
        {trailing && (
          <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-semibold">
            {trailing}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string;
  placeholder?: string;
}): ReactNode {
  return (
    <label className="mt-2 block first:mt-0">
      <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
        {label}
      </span>
      <input
        defaultValue={value}
        placeholder={placeholder}
        aria-label={label}
        className="border-border bg-surface-raised focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

/** A field inside a payment method, where the label is already implied. */
function Bare({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}): ReactNode {
  return (
    <input
      placeholder={placeholder}
      aria-label={label}
      className="border-border bg-surface focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none"
    />
  );
}

function MethodRow({
  icon,
  label,
  selected,
  disabled = false,
  onSelect,
  badge,
  children,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** the saving, where the method carries one */
  badge?: string | undefined;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className={disabled ? "opacity-60" : ""}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
        className="focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span
          aria-hidden="true"
          className={`grid size-4 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
            selected ? "bg-accent ring-accent" : "ring-border"
          }`}
        >
          {selected && <span className="size-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
        {badge && (
          <span className="bg-positive/15 text-positive shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
            {badge}
          </span>
        )}
      </button>
      {children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function PlanRow({
  label,
  was,
  now,
  badge,
  note,
  accentBadge = false,
  selected,
  onSelect,
}: {
  label: string;
  was: string;
  now: string;
  badge: string;
  note?: string;
  accentBadge?: boolean;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`focus-ring flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-accent bg-accent/5"
          : "border-border hover:bg-surface-hover"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
          selected ? "bg-accent ring-accent" : "ring-border"
        }`}
      >
        {selected && <span className="size-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground block text-sm">
          <span className="line-through">{was}</span>{" "}
          <span className="text-foreground font-medium">{now}</span>
        </span>
        {note && (
          <span className="text-muted-foreground block text-[11px]">
            {note}
          </span>
        )}
      </span>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          accentBadge
            ? "bg-accent/15 text-accent"
            : "bg-positive/15 text-positive"
        }`}
      >
        {badge}
      </span>
    </button>
  );
}
