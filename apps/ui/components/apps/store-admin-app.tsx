"use client";

/**
 * Store Admin — Discover's promotional real estate, and what the catalogue
 * is allowed to show. Nexus staff only; see lib/developer-mode.tsx for how
 * it stays out of an ordinary install's rail, store and search entirely.
 *
 * Modelled on the App Store's own shell (a heading line, a tab row, a stack
 * of cards below it) rather than invented from nothing, and on the campaign
 * managers named in the brief — X, Meta, Google — for the shape all four
 * share: a list of placements, each with a status, a schedule, a share of
 * its slot, a cap and a sponsorship it either carries or does not. `Group`
 * and `Toggle` are the same components Settings itself is built from
 * (components/apps/settings/blocks), reused rather than redrawn — a switch
 * that looks different here than it does one app over is a switch that reads
 * as a different product.
 *
 * ## What this file is, and what it is not
 *
 * A shell: the tab row, the strip that says what needs attention, and
 * nothing else. Every tab is its own file under components/apps/store-admin,
 * the same split settings-app, the wallet and the roadmap already made once
 * they outgrew one screen.
 *
 * ## Eight tabs, and why each exists
 *
 * **Banners** and **Collections** are the two promotional rows this app
 * started as. **Surfaces** is the hero and the editorial rows — the most
 * valuable card in the store used to be the one thing here nobody could
 * change without a deploy. **Analytics** answers the two different questions
 * the same counted numbers support: what is the real estate doing and what
 * is still unsold, for a Nexus team member deciding what to sell next, and
 * what did one placement do, for the sponsor who bought it. **Catalogue** is
 * the half of the job that is not selling: featuring a listing, taking one
 * down, suspending a whole source. **Activity** is what changed and when,
 * and where the three sizes of undo live.
 */

import { AccessTab } from "@/components/apps/store-admin/access-tab";
import { ActivityTab } from "@/components/apps/store-admin/activity-tab";
import { AnalyticsTab } from "@/components/apps/store-admin/analytics-tab";
import { AttentionStrip } from "@/components/apps/store-admin/attention";
import { CampaignsTab } from "@/components/apps/store-admin/campaigns-tab";
import { CatalogueTab } from "@/components/apps/store-admin/catalogue-tab";
import { Guidelines } from "@/components/apps/store-admin/guidelines";
import { SurfacesTab } from "@/components/apps/store-admin/surfaces-tab";
import { Tab, TabRow } from "@/components/hub/tab-row";
import { useAdminPromoState } from "@/lib/admin-store";
import { useState, type ReactNode } from "react";

type AdminTab =
  | "banners"
  | "collections"
  | "surfaces"
  | "analytics"
  | "catalogue"
  | "access"
  | "activity"
  | "guidelines";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "banners", label: "Banners" },
  { id: "collections", label: "Collections" },
  { id: "surfaces", label: "Surfaces" },
  { id: "analytics", label: "Analytics" },
  { id: "catalogue", label: "Catalogue" },
  { id: "access", label: "Access" },
  { id: "activity", label: "Activity" },
  { id: "guidelines", label: "Guidelines" },
];

export function StoreAdminApp(): ReactNode {
  const [tab, setTab] = useState<AdminTab>("banners");
  const admin = useAdminPromoState();

  return (
    /*
     * The scroll container needs a height to scroll inside of.
     *
     * `flex-1` on its own did nothing here: the canvas hands an app a plain
     * block, so there was no flex line for it to take a share of, and a
     * scroll box whose height is its own content is a scroll box that never
     * scrolls. `h-full` inside a `flex h-full min-h-0` wrapper is what the
     * App Store already does one file over, and it is the pattern rather
     * than a fix invented here.
     */
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-200">
          <p className="text-muted-foreground text-sm">
            Manage Discover&rsquo;s promotional inventory: what is running, what
            is sponsored, who bought each placement, and what is still available
            to sell.
          </p>

          <AttentionStrip admin={admin} onOpenAnalytics={() => setTab("analytics")} />

          {/* Sticky, because this app is now eight tabs over a long page and a
              tab row that scrolls away leaves somebody at the bottom of
              Analytics with no way back except the way they came. The negative
              margins take it out to the container's own edges so the rows
              passing underneath are covered rather than showing at the sides. */}
          <div className="bg-background sticky top-0 z-20 -mx-6 mt-2 px-6 pt-1 sm:-mx-10 sm:px-10">
            <TabRow fade="from-background" gap="gap-6">
              {TABS.map((entry) => (
                <Tab
                  key={entry.id}
                  label={entry.label}
                  group="store-admin"
                  size="lg"
                  active={tab === entry.id}
                  onClick={() => setTab(entry.id)}
                />
              ))}
            </TabRow>
          </div>

          <div className="mt-6 space-y-4">
            {tab === "banners" && (
              <CampaignsTab kind="banners" campaigns={admin.banners} label="New banner" />
            )}
            {tab === "collections" && (
              <CampaignsTab
                kind="collections"
                campaigns={admin.collections}
                label="New collection"
              />
            )}
            {tab === "surfaces" && <SurfacesTab admin={admin} />}
            {tab === "analytics" && <AnalyticsTab admin={admin} />}
            {tab === "catalogue" && <CatalogueTab admin={admin} />}
            {tab === "access" && <AccessTab admin={admin} />}
            {tab === "activity" && <ActivityTab admin={admin} />}
            {tab === "guidelines" && <Guidelines />}
          </div>
        </div>
      </div>
    </div>
  );
}
