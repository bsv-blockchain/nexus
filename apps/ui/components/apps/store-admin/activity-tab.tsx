"use client";

/**
 * What changed, and when.
 *
 * A tool where one switch can cost a sponsor a placement should be able to
 * answer "when did this stop running" without anybody reconstructing it from
 * memory. Every edit, creation, removal, takedown and surface change writes
 * a line here; counting does not, or a busy Discover would push the real
 * changes off the end within an hour.
 *
 * There is no "who" column, and inventing one would be worse than leaving it
 * out: this build has no staff accounts, so every entry was made by whoever
 * is sitting at this install. A deployment with real identities is where
 * that column belongs, and it can be added without touching the shape of an
 * entry.
 */

import { AdminGroup, ArmedButton } from "@/components/apps/store-admin/blocks";
import { clearLog, resetAdminState, type AdminPromoState, type AuditEntry } from "@/lib/admin-store";
import { clearReaderViews } from "@/lib/promo-frequency";
import { sinceLabel } from "@/lib/update-data";
import type { ReactNode } from "react";
import { toast } from "sonner";

const AREA_LABEL: Record<AuditEntry["area"], string> = {
  campaign: "Campaign",
  surface: "Surface",
  catalogue: "Catalogue",
  store: "Store",
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function ActivityTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const byDay = new Map<string, AuditEntry[]>();
  for (const entry of admin.log) {
    const day = entry.at.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(entry);
    else byDay.set(day, [entry]);
  }

  return (
    <>
      <AdminGroup
        id="activity"
        title="Recent changes"
        hint="Newest first. Rapid edits to one field collapse into a single line, so typing a headline is one entry rather than forty."
      >
        {admin.log.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">
            Nothing recorded yet — this fills in the moment anything on the
            other tabs changes.
          </p>
        )}
        {[...byDay.entries()].map(([day, entries]) => (
          <div key={day}>
            <p className="text-muted-foreground bg-surface px-3 py-1.5 text-[11px] font-semibold">
              {dayLabel(day)}
            </p>
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3">
                <span className="bg-muted text-muted-foreground mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                  {AREA_LABEL[entry.area]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    <span className="font-medium">{entry.action}</span>
                    {entry.subject ? ` · ${entry.subject}` : ""}
                  </span>
                  {entry.detail && (
                    <span className="text-muted-foreground block text-xs text-pretty">
                      {entry.detail}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  {sinceLabel(entry.at) ?? "just now"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </AdminGroup>

      <AdminGroup
        id="maintenance"
        title="Starting over"
        hint="Three different scales of undo, for the three different messes a fixture editor can get into."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-muted-foreground min-w-0 flex-1 text-xs text-pretty">
            <span className="text-foreground block text-sm font-medium">Clear this log</span>
            Leaves every campaign and every count exactly as it is.
          </p>
          <ArmedButton
            label="Clear log"
            armedLabel="Confirm clear"
            onConfirm={() => {
              clearLog();
              toast.success("Activity log cleared");
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-muted-foreground min-w-0 flex-1 text-xs text-pretty">
            <span className="text-foreground block text-sm font-medium">
              Forget what this reader has seen
            </span>
            Resets today&rsquo;s per-reader view counts, so a frequency-capped
            campaign shows again on this device. The placement&rsquo;s own
            totals are untouched.
          </p>
          <ArmedButton
            label="Forget views"
            armedLabel="Confirm forget"
            onConfirm={() => {
              clearReaderViews();
              toast.success("Reader view counts cleared", {
                description: "Frequency caps start again for this device today.",
              });
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-muted-foreground min-w-0 flex-1 text-xs text-pretty">
            <span className="text-negative block text-sm font-medium">Reset everything</span>
            Back to the seeded campaigns, with every count, takedown, surface
            edit and log entry dropped. There is no undo for this one.
          </p>
          <ArmedButton
            label="Reset"
            armedLabel="Confirm reset"
            onConfirm={() => {
              resetAdminState();
              toast.success("Store Admin reset", {
                description: "Back to the seeded campaigns.",
              });
            }}
          />
        </div>
      </AdminGroup>
    </>
  );
}
