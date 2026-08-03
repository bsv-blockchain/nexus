"use client";

import { useHub } from "@/components/hub/hub-provider";
import { content, getProposals, type Proposal } from "@/lib/data";
import { PlusCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ProposalCard({ proposal }: { proposal: Proposal }): ReactNode {
  const copy = content.vote;
  const total = proposal.votesFor + proposal.votesAgainst;
  const forPct = total === 0 ? 0 : Math.round((proposal.votesFor / total) * 100);
  const open = proposal.status === "open";

  return (
    <article className="rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-balance">
          {proposal.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            open
              ? "bg-positive/15 text-positive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {open ? copy.openBadge : copy.closedBadge}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{proposal.summary}</p>

      <div
        className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${forPct}% ${copy.voteFor}`}
      >
        <div className="h-full bg-positive" style={{ width: `${forPct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {copy.voteFor} {proposal.votesFor.toLocaleString("en-US")} ·{" "}
          {copy.voteAgainst} {proposal.votesAgainst.toLocaleString("en-US")}
        </span>
        <span>
          {copy.closesLabel} {formatDate(proposal.closesAt)}
        </span>
      </div>

      {open && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-full bg-positive/15 px-3 py-1.5 text-xs font-semibold text-positive hover:bg-positive/25"
          >
            <ThumbsUp className="size-3.5" aria-hidden="true" />
            {copy.voteFor}
          </button>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-full bg-negative/15 px-3 py-1.5 text-xs font-semibold text-negative hover:bg-negative/25"
          >
            <ThumbsDown className="size-3.5" aria-hidden="true" />
            {copy.voteAgainst}
          </button>
        </div>
      )}
    </article>
  );
}

function Column({
  heading,
  proposals,
}: {
  heading: string;
  proposals: Proposal[];
}): ReactNode {
  return (
    <section>
      <h3 className="mb-3 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </h3>
      {proposals.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {content.vote.emptyColumn}
        </p>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </section>
  );
}

export function VoteApp(): ReactNode {
  const { voteStatus } = useHub();
  const proposals = getProposals();
  const copy = content.vote;
  const open = proposals.filter((p) => p.status === "open");
  const closed = proposals.filter((p) => p.status !== "open");

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <PlusCircle className="size-4" aria-hidden="true" />
            {copy.submit}
          </button>
        </div>

        {voteStatus === "all" ? (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Column heading={copy.openColumn} proposals={open} />
            <Column heading={copy.closedColumn} proposals={closed} />
          </div>
        ) : (
          <div className="mx-auto mt-6 max-w-2xl">
            <Column
              heading={
                voteStatus === "open" ? copy.openColumn : copy.closedColumn
              }
              proposals={voteStatus === "open" ? open : closed}
            />
          </div>
        )}
      </div>
    </div>
  );
}
