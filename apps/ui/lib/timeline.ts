import type { EcosystemId } from "@/lib/data/types";
import { ecosystems } from "@/lib/data/ecosystems";
/* The people and posts tables directly, not the `@/lib/data` barrel: this
   module is imported by the store, which the barrel's chain reaches, and a
   module-level read through the barrel resolved to `undefined` at init. */
import { messagePeople } from "@/lib/data/messages";
import { timelinePosts } from "@/lib/data/timeline";
/**
 * Formatting the Timeline does and nothing else does.
 *
 * Sits beside {@link file://./messages.ts} for the same reason that one exists:
 * the fixtures in `lib/data` hold numbers, and turning a number into the string
 * a feed shows is a decision about this surface, not about the data.
 */

/**
 * Minutes, as a feed writes them.
 *
 * Ages are stored in minutes rather than as timestamps because a static export
 * has no "now" — a fixture dated last Tuesday is a week old by the time anybody
 * looks at the build, and a demo whose freshest post is eight days ago reads as
 * abandoned. Minutes-ago is always true.
 */
export function agoLabel(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

/**
 * Counts, as a feed writes them.
 *
 * One decimal below ten thousand and none above, which is the convention every
 * reader of a feed already knows: 1.2K, 18.4K, 412.
 */
export function countLabel(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10_000)
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (value < 1_000_000) return `${Math.round(value / 1000)}K`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Satoshis on a tip chip, short enough to sit inside one. */
export function satsLabel(sats: number): string {
  if (sats < 1000) return `${sats} sats`;
  return `${countLabel(sats)} sats`;
}

/**
 * The chain tip this build pretends to be sitting at.
 *
 * A constant rather than a lookup: nothing here talks to a node, and a height
 * derived from the wall clock would change between two renders in the same
 * paint — which is the impurity the lint rule exists to catch. Bump it when the
 * fixtures start to look stale.
 */
export const CHAIN_TIP = 963_190;

/** Roughly one block every ten minutes, which is the only rate worth assuming. */
const MINUTES_PER_BLOCK = 10;

/**
 * The block a post of this age would have landed in.
 *
 * Derived from `ago` rather than stored on the fixture so the two cannot
 * disagree: a post that says "6m" and cites a block from yesterday is worse
 * than no block at all.
 */
export function blockForAge(minutes: number): number {
  return CHAIN_TIP - Math.floor(minutes / MINUTES_PER_BLOCK);
}

/** Grouped, the way a block explorer writes them. */
export function blockLabel(height: number): string {
  return height.toLocaleString("en-US");
}

/** Where that block can be read in full. */
export function blockUrl(height: number): string {
  return `https://whatsonchain.com/block-height/${height}`;
}

/**
 * The ecosystems the Timeline offers as a filter, in the order they are shown.
 *
 * A fixed list rather than every entry in `ecosystems`: Nexus is the hub you are
 * signed into and HandCash has no posters here, so both would be rows that
 * either match everything or nothing. Counted off the posts so a row can say
 * how much is behind it before you spend a click finding out.
 */
export const TIMELINE_ECOSYSTEMS_ORDER = [
  "twetch",
  "treechat",
  "lamint",
  "commonsource",
  "mycelia",
] as const;

export interface TimelineEcosystem {
  id: EcosystemId;
  name: string;
  icon: string | null;
  iconPlate?: string | undefined;
  /** how many posts in the shared pool are authored from it */
  count: number;
}

/**
 * The rows, resolved and counted.
 *
 * Computed on first call and cached, rather than at module load: the tables
 * this reads are themselves modules, and evaluating at load put this on the
 * wrong side of an import cycle — the counts came out of an array that had not
 * been filled in yet. Once is still once.
 */
let rows: TimelineEcosystem[] | null = null;

export function timelineEcosystems(): TimelineEcosystem[] {
  if (rows) return rows;
  rows = TIMELINE_ECOSYSTEMS_ORDER.flatMap((id) => {
    const entry = ecosystems.find((item) => item.id === id);
    if (!entry) return [];
    const count = timelinePosts.filter(
      (post) =>
        messagePeople.find((person) => person.id === post.authorId)
          ?.ecosystem === id
    ).length;
    return [
      {
        id: entry.id,
        name: entry.name,
        icon: entry.icon,
        ...(entry.iconPlate ? { iconPlate: entry.iconPlate } : {}),
        count,
      },
    ];
  });
  return rows;
}
