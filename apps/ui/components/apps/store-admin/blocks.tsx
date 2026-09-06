"use client";

/**
 * The pieces every Store Admin tab is built from.
 *
 * Lifted out of store-admin-app.tsx once the app grew past one screen, for
 * the same reason components/apps/settings/blocks.tsx exists: a tab that
 * carries its own copy of a status badge is a tab whose badge will
 * eventually disagree with the one next to it.
 */

import { Group } from "@/components/apps/settings/blocks";
import type { CampaignStatus } from "@/lib/admin-store";
import { Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * A settings-shaped card that is honest about not being a settings section.
 *
 * Every group here passes an explicit `id`, which is what keeps two
 * campaigns for the same source from rendering the same DOM anchor twice and
 * keeps this app out of the settings search index it was never part of.
 */
export function AdminGroup({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Group id={`admin-${id}`} title={title} {...(hint ? { hint } : {})}>
      {children}
    </Group>
  );
}

/** A compact label-over-control field, for the things Toggle doesn't cover. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-semibold">
        {label}
      </span>
      {children}
      {hint && <span className="text-muted-foreground mt-1 block text-[11px]">{hint}</span>}
    </label>
  );
}

export const fieldClass =
  "border-border bg-surface focus-ring w-full rounded-lg border px-3 py-2 text-sm";

export function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * A total, as money. Not `priceLabel`: that one says "Unpriced" for zero,
 * which is the right thing for a rate a nobody has set and the wrong thing
 * for a month in which nothing was booked.
 */
export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/** A single number with a word over it — the shape every summary row here uses. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactNode {
  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Status
 * ---------------------------------------------------------------------- */

const CAP_LABEL: Record<"total" | "daily" | "frequency", string> = {
  total: "Total cap reached",
  daily: "Daily cap reached",
  frequency: "Frequency cap reached",
};

export function statusPresentation(status: CampaignStatus): {
  label: string;
  className: string;
} {
  switch (status.kind) {
    case "live":
      return { label: "Live", className: "bg-positive/15 text-positive" };
    case "sharing":
      return {
        label: `Sharing · ${Math.round(status.share * 100)}%`,
        className: "bg-positive/15 text-positive",
      };
    case "losing":
      return { label: `Losing to ${status.to}`, className: "bg-warning/15 text-warning" };
    case "scheduled":
      return {
        label: `Starts ${formatDate(status.startsAt)}`,
        className: "bg-warning/15 text-warning",
      };
    case "capped":
      return { label: CAP_LABEL[status.reason], className: "bg-warning/15 text-warning" };
    case "expired":
      return {
        label: `Ended ${formatDate(status.endedAt)}`,
        className: "bg-muted text-muted-foreground",
      };
    case "disabled":
      return { label: "Disabled", className: "bg-muted text-muted-foreground" };
  }
}

/**
 * Live first, then everything else in the order an admin would want to act
 * on it — a campaign losing its slot is worth a look sooner than one that is
 * merely scheduled, and a spent cap sooner than a flight that ended on
 * purpose. Ties keep the list's existing order (`Array.prototype.sort` is
 * stable), so two disabled campaigns don't shuffle every render.
 */
export function statusRank(status: CampaignStatus): number {
  switch (status.kind) {
    case "live":
      return 0;
    case "sharing":
      return 1;
    case "losing":
      return 2;
    case "capped":
      return 3;
    case "scheduled":
      return 4;
    case "disabled":
      return 5;
    case "expired":
      return 6;
  }
}

export function StatusBadge({ status }: { status: CampaignStatus }): ReactNode {
  const { label, className } = statusPresentation(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------- *
 * Destructive controls
 * ---------------------------------------------------------------------- */

/** How long a "Remove" stays armed before it quietly stands down on its own. */
const REMOVE_ARM_MS = 5000;

/**
 * Arm, then confirm — the same shape the destructive controls in the wallet's
 * own inbox use (see StuckRow in components/apps/wallet/pay-flow.tsx), for the
 * same reason: a `window.confirm` is a browser-chrome dialog in an app that
 * does not present itself as a browser page, and it blocks everything behind
 * it while it sits there.
 *
 * Arming is not the whole safety net any more — what it guards is now
 * undoable from the toast it raises. Both, rather than either: arming stops
 * the misclick, and undo answers the deliberate press that turned out to be
 * wrong.
 */
export function ArmedButton({
  label,
  armedLabel,
  onConfirm,
  icon,
}: {
  label: string;
  armedLabel: string;
  onConfirm: () => void;
  icon?: ReactNode;
}): ReactNode {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), REMOVE_ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={`focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        armed
          ? "border-negative bg-negative/15 text-negative"
          : "border-border hover:bg-surface-hover text-muted-foreground"
      }`}
    >
      {icon}
      {armed ? armedLabel : label}
    </button>
  );
}

export function RemoveButton({ onRemove }: { onRemove: () => void }): ReactNode {
  return (
    <ArmedButton
      label="Remove"
      armedLabel="Confirm remove"
      onConfirm={onRemove}
      icon={<Trash2 className="size-3" aria-hidden="true" />}
    />
  );
}

/** Soft warnings, held right where the admin is already looking — see campaignWarnings. */
export function WarningsList({ warnings }: { warnings: string[] }): ReactNode {
  return (
    <div className="bg-warning/10 space-y-1 p-3">
      {warnings.map((warning) => (
        <p key={warning} className="text-warning text-xs font-medium text-pretty">
          {warning}
        </p>
      ))}
    </div>
  );
}
