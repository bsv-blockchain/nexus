"use client";

import { AppMenu } from "@/components/hub/app-menu";
import { getSignEnvelopes, type SignEnvelope } from "@/lib/data";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  MoreVertical,
  Plus,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const statusStyles: Record<
  SignEnvelope["status"],
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-positive/15 text-positive",
  },
  awaiting: {
    label: "Awaiting signature",
    className: "bg-warning/15 text-warning",
  },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  declined: { label: "Declined", className: "bg-negative/15 text-negative" },
};

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Rebranded replica of the Teranode Sign envelopes screen (content pane). */
export function SignerApp(): ReactNode {
  const envelopes = getSignEnvelopes();
  const [query, setQuery] = useState("");
  const filtered = envelopes.filter((env) =>
    env.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Sign</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="font-medium text-foreground">Envelopes</span>
        </nav>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#9dddf0] text-xs font-bold text-[#08343f]">
            JI
          </span>
          <AppMenu slug="signer" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Envelopes</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A list of all envelopes
            </p>
          </div>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Envelope
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search (Envelope title, Tag name)"
              aria-label="Search envelopes"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Filters
            <Filter className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Search by tags:</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <Info className="size-3 text-accent" aria-hidden="true" />
            No tags applied
          </span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-raised">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Envelope</th>
                <th className="px-4 py-3 font-semibold">Date Created</th>
                <th className="px-4 py-3 font-semibold">Action Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Tags</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((env) => {
                const created = formatDate(env.createdAt);
                const status = statusStyles[env.status];
                return (
                  <tr
                    key={env.id}
                    className="border-b border-border last:border-0 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3 font-medium">{env.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{created.date}</div>
                      <div>{created.time}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {env.actionDate ? formatDate(env.actionDate).date : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{env.tag}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label="Row actions"
                        className="focus-ring rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <MoreVertical className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Rows per page: 10</span>
          <div className="flex items-center gap-3">
            <span>
              1–{filtered.length} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled
                className="rounded p-1 disabled:opacity-30"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled
                className="rounded p-1 disabled:opacity-30"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
