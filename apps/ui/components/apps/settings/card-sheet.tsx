"use client";

/**
 * Connecting a bank card, from whichever screen you happen to be at.
 *
 * Three ways in, and the split is not arbitrary — it is the one every browser
 * and every wallet has landed on for the same reason. A card number is sixteen
 * digits somebody has to read off a physical object, and the screen you are
 * most likely to be reading it in front of is the one in your hand:
 *
 *   photograph it — the phone's camera reads the front, which is what iOS's
 *   own "Scan Card" does and the reason nobody types a card into a phone twice
 *
 *   type it on the phone — the fallback for a worn card or bad light
 *
 *   type it here — for somebody at a desk with no phone paired, because a flow
 *   whose only path runs through a second device is a flow that strands people
 *
 * The desktop leads with the handoff rather than the form: the same code the
 * pairing panel shows, for the same reason it shows one. A number typed into a
 * laptop in an open-plan office is a number somebody read over your shoulder,
 * and the phone is both more private and already holding the card.
 *
 * Nothing here is sent anywhere. The full number exists for exactly as long as
 * somebody is typing it and is never handed to the store — see lib/cards-store,
 * which only ever learns four digits and a network.
 */

import { QrBlock } from "@/components/hub/qr-block";
import { Dialog } from "@/components/hub/dialog";
import { addCard } from "@/lib/cards-store";
import { content, getLinkedDevices, type FundingCard } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useReducedMotion } from "@/lib/motion";
import { Camera, Keyboard, ScanLine } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

const copy = content.settings.payments;

/** How long the viewfinder pretends to be reading. */
const SCAN_MS = 1_900;

/**
 * What a camera would come back with.
 *
 * A different card from the seeded one, so scanning demonstrably adds rather
 * than appears to do nothing, and a Mastercard so the network badge is visibly
 * derived from the number rather than hard-coded.
 */
const SCANNED = {
  number: "5355 2211 9043 8817",
  expiry: "04/29",
  holder: "CRUMBS",
};

/**
 * The network, from the first digit.
 *
 * The actual rule issuers use, and short enough to be worth doing properly:
 * the leading digit is the major industry identifier, and 4/5/3 are the three
 * anybody in Europe is holding.
 */
function networkOf(number: string): FundingCard["network"] {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("4")) return "Visa";
  if (digits.startsWith("3")) return "American Express";
  return "Mastercard";
}

/** Groups of four as you type, because that is how the digits are embossed. */
function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function CardSheet({ onClose }: { onClose: () => void }): ReactNode {
  const isDesktop = useIsDesktop();
  /*
   * The desktop has no camera worth pointing at a card, so it starts at the
   * handoff. A phone starts at the choice between its two ways in — showing it
   * a code to scan with itself is the same nonsense the pairing panel already
   * refuses to draw.
   */
  const [step, setStep] = useState<"choose" | "scanning" | "form">("choose");
  const [scanned, setScanned] = useState(false);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const still = useReducedMotion();

  useEffect(() => {
    if (step !== "scanning") return;
    const timer = window.setTimeout(() => {
      setNumber(SCANNED.number);
      setExpiry(SCANNED.expiry);
      setHolder(SCANNED.holder);
      setScanned(true);
      setStep("form");
    }, SCAN_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  const digits = number.replace(/\D/g, "");
  const valid = digits.length >= 12 && expiry.length >= 4;

  function connect(): void {
    if (!valid) {
      toast.error(copy.cardSheetInvalid);
      return;
    }
    /* The one place a full number exists, and it stops here. What crosses into
       the store is four digits, a network and where it was entered. */
    const here = getLinkedDevices().find((device) => device.current);
    addCard({
      id: `card-${digits.slice(-4)}-${digits.length}`,
      network: networkOf(digits),
      last4: digits.slice(-4),
      expiry,
      holder: holder.trim().toUpperCase() || SCANNED.holder,
      /* Empty means "this device". On a phone that is a linked device with a
         name; at a desk it is the machine you are sitting at, which the device
         list does not carry a row for. */
      capturedOn: isDesktop ? "" : (here?.id ?? ""),
      addedDaysAgo: 0,
    });
    toast.success(copy.cardConnected);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} label={copy.cardSheetTitle}>
      {/* Scrolls rather than overflowing. The handoff view is the tallest thing
          in Settings — a code, three steps and an alternative — and a short
          window would otherwise cut the alternative off entirely. */}
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <h2 className="pr-8 text-base font-bold">{copy.cardSheetTitle}</h2>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          {copy.cardSheetLead}
        </p>

        {step === "choose" && (
          <div className="mt-5">
            {isDesktop ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  {/* The mark in the middle, as the pairing code has it: a
                      bare code is a code for anything, and this one is asking
                      somebody to point a specific app at it. */}
                  <div className="nexus-flip-in">
                    <QrBlock value="nexus-card" label={copy.cardSheetPhone}>
                      <span className="grid size-11 place-items-center rounded-xl bg-white ring-4 ring-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/icons/Nexus-logo-solid-BG2.png"
                          alt=""
                          aria-hidden="true"
                          className="size-9 rounded-lg object-contain"
                        />
                      </span>
                    </QrBlock>
                  </div>
                  <p className="text-muted-foreground max-w-xs text-center text-xs text-pretty">
                    {copy.cardSheetPhoneHint}
                  </p>
                </div>
                <ol className="mx-auto mt-4 w-full max-w-xs space-y-2">
                  {copy.cardSheetSteps.map((line, index) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span
                        className="bg-accent text-accent-foreground mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm text-pretty">{line}</span>
                    </li>
                  ))}
                </ol>
                {/* The rule under "or" runs the full width so the two paths
                    read as alternatives rather than as a heading and a
                    footnote. */}
                <div className="my-4 flex items-center gap-3">
                  <span className="bg-border h-px flex-1" aria-hidden="true" />
                  <span className="text-muted-foreground text-[11px] uppercase">
                    {copy.cardSheetOr}
                  </span>
                  <span className="bg-border h-px flex-1" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="focus-ring border-border hover:bg-surface-hover flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                >
                  <Keyboard
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">
                    {copy.cardSheetTypeHere}
                  </span>
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Choice
                  icon={<Camera className="size-4" aria-hidden="true" />}
                  label={copy.cardSheetScan}
                  hint={copy.cardSheetScanHint}
                  onClick={() => setStep("scanning")}
                />
                <Choice
                  icon={<Keyboard className="size-4" aria-hidden="true" />}
                  label={copy.cardSheetType}
                  onClick={() => setStep("form")}
                />
              </div>
            )}
          </div>
        )}

        {step === "scanning" && (
          <div className="mt-5">
            {/* 1.586:1 — the ID-1 ratio every bank card on earth is cut to, so
                the frame is the shape of the object being held up to it. */}
            <div className="bg-muted relative aspect-[1.586] w-full overflow-hidden rounded-xl">
              <span
                className="border-accent absolute inset-4 rounded-lg border-2 border-dashed"
                aria-hidden="true"
              />
              {!still && (
                <motion.span
                  className="bg-accent absolute inset-x-4 h-0.5"
                  aria-hidden="true"
                  initial={{ top: "12%" }}
                  animate={{ top: "88%" }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                  }}
                />
              )}
              <ScanLine
                className="text-muted-foreground absolute inset-0 m-auto size-8"
                aria-hidden="true"
              />
            </div>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              {copy.cardSheetScanning}
            </p>
          </div>
        )}

        {step === "form" && (
          <div className="mt-5 space-y-3">
            {scanned && (
              <p className="text-accent text-xs font-medium text-pretty">
                {copy.cardSheetScanned}
              </p>
            )}
            <Field
              label={copy.cardSheetNumber}
              value={number}
              onChange={(next) => setNumber(groupDigits(next))}
              placeholder="4242 4242 4242 4242"
              mode="numeric"
              autoFocus
            />
            <div className="flex gap-3">
              <Field
                label={copy.cardSheetExpiry}
                value={expiry}
                onChange={setExpiry}
                placeholder="09/28"
                mode="numeric"
              />
              <Field
                label={copy.cardSheetCvc}
                value={cvc}
                onChange={(next) => setCvc(next.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                mode="numeric"
              />
            </div>
            <Field
              label={copy.cardSheetHolder}
              value={holder}
              onChange={setHolder}
              placeholder="CRUMBS"
            />
            <p className="text-muted-foreground text-[11px] text-pretty">
              {copy.cardSheetNote}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="focus-ring border-border hover:bg-surface-hover rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {copy.cardSheetBack}
              </button>
              <button
                type="button"
                onClick={connect}
                disabled={!valid}
                className="focus-ring bg-accent text-accent-foreground flex-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                {copy.cardSheetSubmit}
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** One of the phone's two ways in. */
function Choice({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring border-border hover:bg-surface-hover flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left"
    >
      <span
        className="bg-accent/12 text-accent mt-px grid size-8 shrink-0 place-items-center rounded-lg"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/** A labelled input, in the one shape this sheet needs four of. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  mode,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** `numeric` so a phone offers the keypad rather than the alphabet */
  mode?: "numeric";
  autoFocus?: boolean;
}): ReactNode {
  return (
    <label className="block min-w-0 flex-1">
      <span className="text-muted-foreground block text-[11px] font-medium">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={mode}
        autoComplete="off"
        autoFocus={autoFocus}
        className="focus-ring border-border bg-background mt-1 w-full rounded-lg border px-2.5 py-2 text-sm tabular-nums"
      />
    </label>
  );
}
