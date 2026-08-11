/**
 * The user's pinned sites.
 *
 * BSV Browser's BookmarkStore is the same model — { title, url, added }, deduped
 * by url — with an id and a sort order added because the rail is ordered and
 * renameable. Nothing about the underlying idea differs; Nexus wraps it in
 * different chrome.
 *
 * Pure: `now` and `id` are arguments, never read from the environment, so the
 * tests are deterministic and the React layer owns the clock.
 */
import { deriveOrigin, isPinnableUrl, normalizeUrlInput } from "./origin.ts";

export interface PinnedSite {
  id: string;
  title: string;
  url: string;
  /** derived from url; re-derived on read, never trusted from storage */
  origin: string;
  sortOrder: number;
  createdAt: string;
}

function hostTitle(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Add a site, or focus the one already there.
 *
 * Returns null when the input is not a pinnable URL. Returns the existing row
 * when the URL is already pinned — the caller reveals it rather than creating a
 * duplicate, which is what BookmarkStore.addBookmark does.
 */
export function addPinnedSite(
  sites: PinnedSite[],
  input: { url: string; title?: string; now: string; id: string },
): { sites: PinnedSite[]; site: PinnedSite } | null {
  const url = normalizeUrlInput(input.url);
  if (!url || !isPinnableUrl(url)) return null;
  const origin = deriveOrigin(url);
  if (!origin) return null;

  const existing = sites.find((site) => site.url === url);
  if (existing) return { sites, site: existing };

  const site: PinnedSite = {
    id: input.id,
    title: input.title?.trim() || hostTitle(url),
    url,
    origin,
    sortOrder: sites.length,
    createdAt: input.now,
  };
  return { sites: [...sites, site], site };
}

export function removePinnedSite(sites: PinnedSite[], id: string): PinnedSite[] {
  return sites
    .filter((site) => site.id !== id)
    .map((site, index) => ({ ...site, sortOrder: index }));
}

/** An empty title is a slip, not an instruction — keep the old one. */
export function renamePinnedSite(
  sites: PinnedSite[],
  id: string,
  title: string,
): PinnedSite[] {
  const trimmed = title.trim();
  if (!trimmed) return sites;
  return sites.map((site) => (site.id === id ? { ...site, title: trimmed } : site));
}

function parseSite(value: unknown): PinnedSite | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;

  // Canonicalize the stored URL without rejecting dotless intranet hosts.
  // Use new URL(...).href, not normalizeUrlInput, since the latter filters
  // typed input (no dots without localhost). This is already stored, and may
  // be a legitimate dotless host like https://intranet/
  //
  // A URL that will not parse, or lacks a scheme entirely (e.g. "example.com/")
  // is dropped rather than repaired. This module owns its storage format
  // exclusively — every row is written by addPinnedSite in canonical absolute
  // form. An unparseable value is tampering or corruption. Repairing it by
  // prefixing a scheme would let userinfo-bearing values like mailto:test@evil.com
  // through the net that normalizeUrlInput exists to catch on the typed path.
  let url: string;
  try {
    url = new URL(typeof record.url === "string" ? record.url : "").href;
  } catch {
    return null;
  }
  if (!isPinnableUrl(url)) return null;
  const origin = deriveOrigin(url);
  if (!origin) return null;

  // Trim title and fall back to hostname if empty
  const trimmedTitle = typeof record.title === "string" ? record.title.trim() : "";

  // Validate sortOrder is a safe finite number
  const sortOrder = typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
    ? Math.floor(record.sortOrder)
    : 0;

  return {
    id: record.id,
    title: trimmedTitle || hostTitle(url),
    url,
    origin,
    sortOrder,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
  };
}

/**
 * Read the persisted list.
 *
 * `origin` is re-derived from `url` rather than read back, so a tampered or
 * stale storage entry cannot make the chip claim one site while the tab loads
 * another. Renumber sortOrder to be contiguous so later calls to addPinnedSite
 * do not collide with existing rows. Dedupe by canonical URL so two rows
 * canonicalising to the same string collapse to one (first occurrence wins).
 */
export function parsePinnedSites(raw: string): PinnedSite[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map(parseSite)
    .filter((site): site is PinnedSite => site !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .reduce((acc, site) => {
      // Dedupe by canonical URL, first occurrence wins
      if (!acc.some((s) => s.url === site.url)) {
        acc.push(site);
      }
      return acc;
    }, [] as PinnedSite[])
    .map((site, index) => ({ ...site, sortOrder: index }));
}
