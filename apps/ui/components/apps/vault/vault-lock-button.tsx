"use client";

/**
 * When the vault shuts itself again.
 *
 * Built on the same pattern as
 * {@link file://../../hub/repositories-button.tsx}: a small control in a
 * contextual column's help bar that opens a popover on a pointer and a bottom
 * sheet on a phone, anchored to a rect captured at click rather than measured
 * in an effect.
 *
 * It is a setting rather than an action, which is why it lives down here beside
 * the guide button instead of on the door. The door asks one question — are you
 * getting in — and how long the answer lasts is not part of it.
 */

import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { setPolicy, useVault, type LockPolicy } from "@/lib/vault-store";
import { Check, ShieldCheck, Timer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.vault.lock;

/** Trigger position + viewport, captured at click. */
interface Anchor {
  left: number;
  top: number;
  vw: number;
  vh: number;
}

const POLICIES: LockPolicy[] = ["on-leave", "timed", "never"];

function label(policy: LockPolicy): string {
  return copy.policy[policy];
}

function describe(policy: LockPolicy): string {
  return policy === "on-leave"
    ? copy.policy["on-leaveDesc"]
    : policy === "timed"
      ? copy.policy.timedDesc
      : copy.policy.neverDesc;
}

function PolicySheet({
  anchor,
  onClose,
}: {
  anchor: Anchor | null;
  onClose: () => void;
}): ReactNode {
  const isDesktop = useIsDesktop();
  const { policy } = useVault();
  const { setMainView, setSettingsCategory } = useHub();

  const desktopPos =
    isDesktop && anchor
      ? {
          left: Math.max(12, Math.min(anchor.left, anchor.vw - 348)),
          bottom: anchor.vh - anchor.top + 8,
        }
      : null;

  const base =
    "z-70 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.cancel}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-65 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="dialog"
        aria-label={copy.policyTitle}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(desktopPos
          ? { style: { left: desktopPos.left, bottom: desktopPos.bottom } }
          : {})}
        className={
          isDesktop
            ? `fixed w-[300px] rounded-2xl ${base}`
            : `fixed inset-x-0 bottom-0 rounded-t-3xl ${base}`
        }
      >
        {!isDesktop && (
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
          </div>
        )}
        <h2 className="px-4 pt-4 pb-1 text-sm font-semibold">
          {copy.policyTitle}
        </h2>
        <div
          role="radiogroup"
          aria-label={copy.policyTitle}
          className="p-2 pt-1"
        >
          {POLICIES.map((entry) => (
            <button
              key={entry}
              type="button"
              role="radio"
              aria-checked={policy === entry}
              onClick={() => {
                setPolicy(entry);
                onClose();
              }}
              className="focus-ring hover:bg-surface-hover flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors ${
                  policy === entry
                    ? "bg-accent text-accent-foreground ring-accent"
                    : "ring-border bg-transparent"
                }`}
              >
                {policy === entry && <Check className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {label(entry)}
                </span>
                <span className="text-muted-foreground block text-[11px] text-pretty">
                  {describe(entry)}
                </span>
              </span>
            </button>
          ))}
        </div>
        {/* The other half of the same subject. This popover answers "when does
            it shut"; the section it links to answers "what opens it" — one
            question split across two surfaces, so each needs the other's
            address. */}
        <button
          type="button"
          onClick={() => {
            setSettingsCategory("security");
            setMainView("settings");
            onClose();
          }}
          className="focus-ring border-border hover:bg-surface-hover text-accent flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm font-semibold"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {content.security.title}
        </button>
      </motion.div>
    </>
  );
}

export function VaultLockButton(): ReactNode {
  const [open, setOpen] = useState(false);
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(open);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={copy.policyButton}
        title={copy.policyButton}
        aria-expanded={open}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({
            left: rect.left,
            top: rect.top,
            vw: window.innerWidth,
            vh: window.innerHeight,
          });
          setOpen(true);
        }}
        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-md p-1.5"
      >
        <Timer className="size-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && <PolicySheet anchor={anchor} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
