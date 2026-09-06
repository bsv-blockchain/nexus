/**
 * Reading Store Admin's own numbers back — two different questions from the
 * same data. A Nexus team member wants the whole picture: what is Discover's
 * promo real estate doing in aggregate, and which slots are actually
 * contested. A sponsor wants one answer about one campaign: what did my
 * placement actually do. Both are built from the same `daily` buckets in
 * lib/admin-store.ts — nothing here is a second copy of the count, only a
 * different way of adding it up.
 */

import type { AdminPromoState, CampaignBase } from "./admin-store";

export interface DailyPoint {
  date: string;
  impressions: number;
  clicks: number;
}

export function allCampaigns(state: AdminPromoState): CampaignBase[] {
  return [...state.banners, ...state.collections];
}

export interface Totals {
  impressions: number;
  clicks: number;
  ctr: number;
  liveCount: number;
  sponsoredCount: number;
}

export function totals(campaigns: CampaignBase[]): Totals {
  const impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    liveCount: campaigns.filter((c) => c.enabled).length,
    sponsoredCount: campaigns.filter((c) => c.sponsored).length,
  };
}

/** The last `days` days, oldest first, zero-filled where nothing happened. */
export function dailySeries(campaigns: CampaignBase[], days = 14): DailyPoint[] {
  const points: DailyPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    let impressions = 0;
    let clicks = 0;
    for (const campaign of campaigns) {
      const day = campaign.daily[iso];
      if (day) {
        impressions += day.impressions;
        clicks += day.clicks;
      }
    }
    points.push({ date: iso, impressions, clicks });
  }
  return points;
}

/**
 * How full each slot is, 1..slotCount — banners and collections counted
 * separately, because they never compete with each other. Discover renders
 * them as two independent rows, each with its own `winningCampaigns` call
 * (see discover-banner-row.tsx / discover-collection-row.tsx), so a banner
 * and a collection both assigned to "slot 1" are not two campaigns fighting
 * for one position — they're two campaigns in two different rows that
 * happen to share a number. Merging them into one count would have called a
 * slot "contested" when nothing on it was actually competing.
 */
export function slotUtilization(
  banners: CampaignBase[],
  collections: CampaignBase[],
  slotCount: number,
): { slot: number; banners: number; collections: number }[] {
  return Array.from({ length: slotCount }, (_, i) => i + 1).map((slot) => ({
    slot,
    banners: banners.filter((c) => c.slot === slot && c.enabled).length,
    collections: collections.filter((c) => c.slot === slot && c.enabled).length,
  }));
}

export function ctrLabel(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}
