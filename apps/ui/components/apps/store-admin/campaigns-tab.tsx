"use client";

/**
 * A list of campaigns, for either row — one component rather than two,
 * because a banner and a collection differ in what their card draws and in
 * nothing else an admin does to them.
 *
 * The filter bar is the other half of collapsing the rows: a tool built so
 * an admin can keep adding campaigns needs a way to find one again. Status
 * and source are the two things somebody actually arrives knowing ("what is
 * live for HandCash", "what has expired"), and the search box covers the
 * third — a headline or an advertiser they half-remember.
 */

import { CampaignEditor } from "@/components/apps/store-admin/campaign-editor";
import { fieldClass, statusRank } from "@/components/apps/store-admin/blocks";
import {
  sourceFilterOptions,
  sourceOptions,
} from "@/components/apps/store-admin/pickers";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { Picker } from "@/components/hub/picker";
import {
  addCampaign,
  campaignStatus,
  type CampaignBase,
  type CampaignStatus,
  type PromoKind,
} from "@/lib/admin-store";
import { getDefaultRepositories } from "@/lib/data";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type StatusFilter = "all" | "live" | "scheduled" | "ended" | "off";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "scheduled", label: "Scheduled" },
  { id: "ended", label: "Ended" },
  { id: "off", label: "Off" },
];

function matchesStatus(status: CampaignStatus, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "live":
      return status.kind === "live" || status.kind === "sharing";
    case "scheduled":
      return status.kind === "scheduled";
    case "ended":
      return status.kind === "expired" || status.kind === "capped";
    case "off":
      return status.kind === "disabled" || status.kind === "losing";
  }
}

export function CampaignsTab({
  kind,
  campaigns,
  label,
}: {
  kind: PromoKind;
  campaigns: CampaignBase[];
  /** what the add button calls a new one: "New banner" / "New collection" */
  label: string;
}): ReactNode {
  const repos = getDefaultRepositories();
  const [newRepoId, setNewRepoId] = useState(() => repos[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = campaigns.filter((campaign) => {
    if (source !== "all" && campaign.repoId !== source) return false;
    if (!matchesStatus(campaignStatus(campaign, campaigns), status)) return false;
    if (!needle) return true;
    return (
      campaign.headline.toLowerCase().includes(needle) ||
      campaign.subhead.toLowerCase().includes(needle) ||
      campaign.advertiser.toLowerCase().includes(needle)
    );
  });

  /* Live first, so a growing list reads what's-showing-first rather than
     insertion order — see statusRank. The store's own array order is
     untouched; only this tab's rendering is reordered. */
  const ordered = [...visible].sort(
    (a, b) =>
      statusRank(campaignStatus(a, campaigns)) - statusRank(campaignStatus(b, campaigns)),
  );

  const onAdd = (): void => {
    const id = addCampaign(kind, newRepoId);
    setOpen(id);
    setCreated(id);
    /* A new campaign is off and unfiltered-for; landing on a filter that
       hides the thing you just made is the same "nothing happened" the
       scroll-into-view below exists to prevent. */
    setStatus("all");
    setSource("all");
    setQuery("");
    toast.success("Campaign created", {
      description: "Off until you switch it on.",
    });
  };

  return (
    <>
      <div className="border-border bg-surface-raised space-y-3 rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <Picker
              label="Source for the new campaign"
              value={newRepoId}
              options={sourceOptions(repos)}
              onPick={setNewRepoId}
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${PRIMARY_CTA}`}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headline or advertiser"
            className={`${fieldClass} w-auto min-w-48 flex-1`}
          />
          <div className="w-44">
            <Picker
              label="Filter by source"
              value={source}
              options={sourceFilterOptions(repos)}
              onPick={setSource}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatus(filter.id)}
                className={`focus-ring rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  status === filter.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:bg-surface-hover"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {campaigns.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No campaigns yet — add one above.
        </p>
      )}
      {campaigns.length > 0 && ordered.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing matches those filters. {campaigns.length} campaign
          {campaigns.length === 1 ? "" : "s"} in total.
        </p>
      )}

      {ordered.map((campaign) => (
        <CampaignEditor
          key={campaign.id}
          kind={kind}
          campaign={campaign}
          siblings={campaigns}
          open={open === campaign.id}
          onToggle={() => setOpen((current) => (current === campaign.id ? null : campaign.id))}
          autoFocus={created === campaign.id}
          onFocused={() => setCreated(null)}
        />
      ))}
    </>
  );
}
