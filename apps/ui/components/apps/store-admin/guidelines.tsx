"use client";

/**
 * The rules the rest of this app is built to keep — disclosure, what a slot
 * costs, and the two surfaces that stay out of the rate card regardless of
 * demand.
 */

import { AdminGroup } from "@/components/apps/store-admin/blocks";
import { priceLabel, rateCard } from "@/lib/data/discover-promos";
import type { ReactNode } from "react";

export function Guidelines(): ReactNode {
  return (
    <>
      <AdminGroup
        id="disclosure"
        title="Disclosure"
        hint="Every sponsored placement says so, in the same place a reader is already looking."
      >
        <p className="p-3 text-sm text-pretty">
          Marking a placement &ldquo;Sponsored&rdquo; adds the badge Discover
          already renders on it, with the advertiser&rsquo;s name alongside it
          when one is set, on the hero and the banners alike. Nothing sold
          through this tool is disguised as editorial. If a placement cannot
          carry that badge honestly, it should not be sold.
        </p>
      </AdminGroup>
      <AdminGroup
        id="rate-card"
        title="Rate card"
        hint="The reference price per placement type. Quote from this rather than inventing a number per campaign; Analytics adds these up into what is booked and what is still free."
      >
        {Object.entries(rateCard).map(([type, entry]) => (
          <div key={type} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{entry.label}</p>
              <p className="text-muted-foreground text-xs text-pretty">
                {entry.description}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">{priceLabel(entry.monthly)}</p>
          </div>
        ))}
      </AdminGroup>
      <AdminGroup
        id="never-sold"
        title="What never gets sold"
        hint="Two surfaces stay out regardless of demand."
      >
        <div className="space-y-2 p-3 text-sm">
          <p>
            <strong>Updates</strong> is a plain record of what changed
            recently, not a browse surface. A sponsored slot there reads as
            the plumbing being for sale.
          </p>
          <p>
            <strong>Essential Nexus Extensions</strong> is infrastructure the
            browser ships with, not merchandising. Same reasoning, and the
            same reason an essential listing cannot be hidden or featured from
            the Catalogue tab.
          </p>
        </div>
      </AdminGroup>
      <AdminGroup
        id="money"
        title="What this tool does not do"
        hint="Worth stating plainly, since every number above is shaped like one that would."
      >
        <p className="p-3 text-sm text-pretty">
          No money moves. &ldquo;Sponsored&rdquo;, an advertiser&rsquo;s name
          and a price are labels an admin sets, and booked revenue is those
          labels added up. There is no invoice behind any of it. Impressions
          and clicks are the exception: those are counted for real, once per
          card a reader actually sees and once per press of its button.
        </p>
      </AdminGroup>
    </>
  );
}
