"use client";

import { useHub } from "@/components/hub/hub-provider";
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Plus } from "lucide-react";
import type { ReactNode } from "react";

type Attestation = {
  id: string;
  type: string;
  counterparty: string;
  issuer: string;
  direction: "issued" | "received";
  createdAt: string;
};

// table: attestations — placeholder records issued to / received by the user.
const ATTESTATIONS: Attestation[] = [
  {
    id: "att-email",
    type: "Email ownership",
    counterparty: "you@nexus.id",
    issuer: "Nexus Certifier",
    direction: "received",
    createdAt: "2026-06-14T10:00:00.000Z",
  },
  {
    id: "att-kyc",
    type: "Identity verified (KYC)",
    counterparty: "you@nexus.id",
    issuer: "BSV Association",
    direction: "received",
    createdAt: "2026-05-30T10:00:00.000Z",
  },
  {
    id: "att-domain",
    type: "Domain control",
    counterparty: "fractional.farm",
    issuer: "You",
    direction: "issued",
    createdAt: "2026-06-02T10:00:00.000Z",
  },
  {
    id: "att-dev",
    type: "Developer identity",
    counterparty: "1Sat Labs",
    issuer: "You",
    direction: "issued",
    createdAt: "2026-04-21T10:00:00.000Z",
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AttestationsApp(): ReactNode {
  const { attestationFilter } = useHub();
  const items = ATTESTATIONS.filter(
    (item) => attestationFilter === "all" || item.direction === attestationFilter,
  );

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Attestations</h2>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            New attestation
          </button>
        </div>
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          Attestations are signed on-chain statements that vouch for an identity
          or a claim.
        </p>

        {items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
            No attestations in this view.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => {
              const issued = item.direction === "issued";
              return (
                <li key={item.id} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <BadgeCheck className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.type}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {issued ? "To" : "From"} {item.counterparty} ·{" "}
                        {item.issuer}
                      </p>
                    </div>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        issued
                          ? "bg-accent/15 text-accent"
                          : "bg-positive/15 text-positive"
                      }`}
                    >
                      {issued ? (
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDownLeft className="size-3" aria-hidden="true" />
                      )}
                      {issued ? "Issued" : "Received"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
