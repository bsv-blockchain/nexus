/**
 * Reading Store Admin's own numbers back — three different questions from
 * the same data. A Nexus team member wants the whole picture: what is
 * Discover's promo real estate doing, what has been sold, and what is still
 * going spare. A sponsor wants one answer about one campaign: what did my
 * placement actually do. Both are built from the same `daily` buckets in
 * lib/admin-store.ts — nothing here is a second copy of the count, only a
 * different way of adding it up.
 */

import {
  campaignWarnings,
  contendersForSlot,
  parseLocalDate,
  winningCampaigns,
  type AdminPromoState,
  type CampaignBase,
} from "./admin-store";
import { rateCard, SLOT_COUNT } from "./data/discover-promos";

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
  sponsoredCount: number;
}

export function totals(campaigns: { impressions: number; clicks: number; sponsored: boolean }[]): Totals {
  const impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    sponsoredCount: campaigns.filter((c) => c.sponsored).length,
  };
}

/**
 * The same totals plus `liveCount`, answered the only way it can be answered
 * honestly: by asking who actually wins a slot right now.
 *
 * Not a field on `totals` above, because a campaign whose flight has not
 * started, whose end date has passed, whose cap is spent, or which is losing
 * its slot to a higher-priority sibling is switched on and showing nothing.
 * Counting `enabled` was the one place this app contradicted its own
 * campaign badges. It needs the two lists apart, too — banners and
 * collections are independent rows, each running its own competition, so
 * flattening them first would have them fighting over slot numbers they do
 * not share.
 */
export function stateTotals(
  state: AdminPromoState,
  at?: number,
): Totals & { liveCount: number } {
  const now = at ?? Date.now();
  const campaigns = allCampaigns(state);
  const base = totals(campaigns);
  const live =
    winningCampaigns(state.banners, SLOT_COUNT, { now }).length +
    winningCampaigns(state.collections, SLOT_COUNT, { now }).length +
    (state.hero.enabled ? 1 : 0);
  return { ...base, liveCount: live };
}

/** The last `days` days, oldest first, zero-filled where nothing happened. */
export function dailySeries(campaigns: { daily: CampaignBase["daily"] }[], days = 14): DailyPoint[] {
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
 * them as two independent rows, each with its own `winningCampaigns` call,
 * so a banner and a collection both assigned to "slot 1" are not two
 * campaigns fighting for one position.
 *
 * `contested` is the number actually in the running after schedule and caps,
 * which is not the same as the number switched on: three campaigns pointed
 * at one slot with three different flight windows are a full quarter, not a
 * fight.
 */
export function slotUtilization(
  banners: CampaignBase[],
  collections: CampaignBase[],
  slotCount: number,
  now: number = Date.now(),
): { slot: number; banners: number; collections: number; bannerLive: boolean; collectionLive: boolean }[] {
  return Array.from({ length: slotCount }, (_, i) => i + 1).map((slot) => {
    const bannerContenders = contendersForSlot(banners, slot, now);
    const collectionContenders = contendersForSlot(collections, slot, now);
    return {
      slot,
      banners: bannerContenders.length,
      collections: collectionContenders.length,
      bannerLive: bannerContenders.length > 0,
      collectionLive: collectionContenders.length > 0,
    };
  });
}

export function ctrLabel(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

/* ---------------------------------------------------------------------- *
 * What has been sold, and what has not
 * ---------------------------------------------------------------------- */

/** Whether a campaign's flight overlaps the calendar month containing `now`. */
function runsInMonth(campaign: CampaignBase, now: number): boolean {
  const date = new Date(now);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  const start = campaign.startDate ? parseLocalDate(campaign.startDate) : monthStart;
  const end = campaign.endDate ? parseLocalDate(campaign.endDate) + 86_399_999 : monthEnd;
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  return start <= monthEnd && end >= monthStart;
}

export interface Booked {
  /** the sum of what is sold and running this month */
  monthly: number;
  /** sold placements running this month */
  count: number;
  /** sold but priced at nothing, which is money left on the table by accident */
  unpriced: number;
  /** what every empty slot would be worth at rate-card price */
  available: number;
  /** placements with nothing sold in them — house cards and the hero included */
  unsoldSlots: number;
}

/**
 * Booked revenue and unsold inventory, side by side.
 *
 * The two numbers a rate card exists to produce, and neither of them existed
 * while a price was a free-text label. Still a label rather than a
 * transaction — see lib/admin-store.ts — but a label that adds up is the
 * difference between a screen an admin reads and a screen an admin sells
 * from.
 */
export function booked(state: AdminPromoState, now: number = Date.now()): Booked {
  const campaigns = allCampaigns(state);
  const sold = campaigns.filter((c) => c.sponsored && runsInMonth(c, now));
  const heroSold = state.hero.sponsored && state.hero.enabled;
  const monthly =
    sold.reduce((sum, c) => sum + c.priceMonthly, 0) +
    (heroSold ? state.hero.priceMonthly : 0);
  const unpriced =
    sold.filter((c) => c.priceMonthly <= 0).length + (heroSold && state.hero.priceMonthly <= 0 ? 1 : 0);

  /*
   * Unsold, not empty. A slot running a house campaign is inventory somebody
   * could still buy — the house card is what fills a slot nobody has bought
   * yet, and counting it as taken would hide exactly the space this number
   * exists to find. The occupancy calendar draws the difference between
   * house and free; this line is about what is for sale.
   */
  const soldIn = (list: CampaignBase[], slot: number): boolean =>
    contendersForSlot(list, slot, now).some((c) => c.sponsored);
  let available = 0;
  let unsoldSlots = 0;
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    if (!soldIn(state.banners, slot)) {
      available += rateCard.banner.monthly;
      unsoldSlots += 1;
    }
    if (!soldIn(state.collections, slot)) {
      available += rateCard.collection.monthly;
      unsoldSlots += 1;
    }
  }
  if (!heroSold) {
    available += rateCard.hero.monthly;
    unsoldSlots += 1;
  }

  return { monthly, count: sold.length + (heroSold ? 1 : 0), unpriced, available, unsoldSlots };
}

export interface OccupancyDay {
  date: string;
  /** the campaign holding this slot that day, if any */
  headline: string | null;
  sponsored: boolean;
}

export interface OccupancyRow {
  slot: number;
  kind: "banner" | "collection";
  days: OccupancyDay[];
}

/**
 * Which slots are spoken for, day by day, for the next `days` days.
 *
 * The one view that answers "what can I sell, and from when" without an
 * admin opening every campaign and reading its dates. Schedule only —
 * deliberately not caps, which are about how fast a flight burns rather than
 * whether the slot is booked, and a calendar that greyed out a day because a
 * daily cap happened to be spent by teatime would be describing today's
 * traffic, not next month's availability.
 */
export function occupancy(
  state: AdminPromoState,
  days = 45,
  now: number = Date.now(),
): OccupancyRow[] {
  const rows: OccupancyRow[] = [];
  const lists: { kind: "banner" | "collection"; list: CampaignBase[] }[] = [
    { kind: "banner", list: state.banners },
    { kind: "collection", list: state.collections },
  ];
  for (const { kind, list } of lists) {
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const row: OccupancyDay[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const at = date.getTime();
        const holder = list
          .filter((c) => c.slot === slot && c.enabled)
          .filter((c) => {
            const start = c.startDate ? parseLocalDate(c.startDate) : -Infinity;
            const end = c.endDate ? parseLocalDate(c.endDate) + 86_399_999 : Infinity;
            return at >= start && at <= end;
          })
          .sort((a, b) => a.priority - b.priority)[0];
        row.push({
          date: date.toISOString().slice(0, 10),
          headline: holder?.headline ?? null,
          sponsored: holder?.sponsored ?? false,
        });
      }
      rows.push({ slot, kind, days: row });
    }
  }
  return rows;
}

/* ---------------------------------------------------------------------- *
 * What needs somebody's attention
 * ---------------------------------------------------------------------- */

/** How close an end date has to be before it is worth mentioning. */
const ENDING_SOON_DAYS = 7;

/**
 * The three states that quietly cost money if nobody notices: a campaign
 * with something wrong with it, a flight about to end, and a slot standing
 * empty. Derived from campaigns that already exist, so the result is empty
 * exactly when there is nothing to do — this is not a queue of invented
 * submissions, of which this build has none.
 */
export function attentionNotes(state: AdminPromoState, at?: number): string[] {
  const now = at ?? Date.now();
  const horizon = now + ENDING_SOON_DAYS * 24 * 60 * 60 * 1000;
  const campaigns = allCampaigns(state);

  const flagged = campaigns.filter((c) => campaignWarnings(c).length > 0).length;
  const ending = campaigns.filter((c) => {
    if (!c.enabled || !c.endDate) return false;
    const end = parseLocalDate(c.endDate);
    return Number.isFinite(end) && end >= now && end <= horizon;
  }).length;
  const { unsoldSlots } = booked(state, now);

  const notes: string[] = [];
  if (flagged > 0) notes.push(`${flagged} campaign${flagged === 1 ? "" : "s"} with a warning`);
  if (ending > 0) notes.push(`${ending} ending within ${ENDING_SOON_DAYS} days`);
  if (unsoldSlots > 0) {
    notes.push(`${unsoldSlots} placement${unsoldSlots === 1 ? "" : "s"} unsold`);
  }
  return notes;
}

/* ---------------------------------------------------------------------- *
 * Reporting
 * ---------------------------------------------------------------------- */

/**
 * The shape a report needs, which is less than a campaign has.
 *
 * The hero is a placement that is sold, counted and reported on like any
 * other, but it is not a campaign — it has no slot to win and no siblings to
 * lose to. Rather than inventing those fields so it can pass for one, the
 * two rankings and the sponsor report ask for this instead, and a campaign
 * satisfies it by simply having more.
 */
export interface Reportable {
  id: string;
  /** which source it promotes; empty for the hero, which is Nexus's own surface */
  repoId: string;
  headline: string;
  sponsored: boolean;
  advertiser: string;
  priceMonthly: number;
  impressions: number;
  clicks: number;
  daily: CampaignBase["daily"];
  startDate: string;
  endDate: string;
}

/** Every surface that can be reported on, campaigns and the hero alike. */
export function reportables(state: AdminPromoState): Reportable[] {
  const hero: Reportable = {
    id: "hero",
    repoId: "",
    headline: state.hero.title || "Discover hero",
    sponsored: state.hero.sponsored,
    advertiser: state.hero.advertiser,
    priceMonthly: state.hero.priceMonthly,
    impressions: state.hero.impressions,
    clicks: state.hero.clicks,
    daily: state.hero.daily,
    startDate: "",
    endDate: "",
  };
  return [hero, ...allCampaigns(state)];
}

/* ---------------------------------------------------------------------- *
 * Handing the numbers over
 * ---------------------------------------------------------------------- */

/** A sponsor's own history, as a spreadsheet rather than a sentence. */
export function seriesCsv(headline: string, points: DailyPoint[]): string {
  const escape = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const rows = [
    ["campaign", "date", "impressions", "clicks", "ctr"].join(","),
    ...points.map((point) =>
      [
        escape(headline),
        point.date,
        String(point.impressions),
        String(point.clicks),
        point.impressions > 0 ? (point.clicks / point.impressions).toFixed(4) : "0.0000",
      ].join(","),
    ),
  ];
  return rows.join("\n");
}
