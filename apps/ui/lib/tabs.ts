/**
 * Client-side helpers for creating browser tabs from user input.
 * Pure functions — no React, no storage.
 */
import { getMockPage, type BrowserTab } from "@/lib/data";

const FAVICON_COLORS = [
  "#4353ff",
  "#16a34a",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
  "#0ea5e9",
];

/**
 * Screens the browser serves itself, addressed like anywhere else.
 *
 * `nexus://extensions` rather than a flag on the tab, for the same reason
 * Chromium uses `chrome://`: a tab is a thing with an address, and a tab with
 * no address is a special case every part of the strip has to know about — the
 * title, the icon, reopening a closed one, the history stack. Give it a URL and
 * all of that keeps working with nothing added.
 */
export const INTERNAL_SCHEME = "nexus://";

export const INTERNAL_PAGES: Record<string, { title: string }> = {
  "nexus://extensions": { title: "Extensions" },
  "nexus://tumbleupon": { title: "TumbleUpon" },
};

/** The internal page this URL names, or null for an ordinary address. */
export function internalPage(url: string): { title: string } | null {
  return INTERNAL_PAGES[url.trim().toLowerCase()] ?? null;
}

/** "foo.com/bar" → "https://foo.com/bar"; free text → a search URL. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  /* Left exactly as typed: these are not hosts and must not be search terms
     either — `nexus://extensions` is an address that resolves inside. */
  if (trimmed.toLowerCase().startsWith(INTERNAL_SCHEME)) {
    return trimmed.toLowerCase();
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Looks like a host if it has a dot and no spaces.
  if (/^[^\s]+\.[^\s]{2,}$/.test(trimmed)) return `https://${trimmed}`;
  return `https://search.nexus.example/?q=${encodeURIComponent(trimmed)}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Stable color pick so the same site always gets the same favicon color. */
function colorFor(text: string): string {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const color = FAVICON_COLORS[Math.abs(hash) % FAVICON_COLORS.length];
  return color ?? FAVICON_COLORS[0]!;
}

/**
 * The letter-tile colour a site falls back to when it serves no favicon.
 *
 * Exported so a pinned site's rail tile and that site's tab agree: they are
 * the same site, and two colours for it would read as two different things.
 */
export function faviconColorFor(url: string): string {
  return colorFor(hostnameOf(url));
}

/**
 * Whether two URLs name the same page.
 *
 * The app has two canonicalisers and they disagree about a trailing slash:
 * `normalizeUrlInput` (pinned sites) returns `new URL(...).href`, so
 * `https://example.com/`, while `normalizeUrl` above returns what was typed, so
 * `https://example.com`. Comparing the raw strings meant typing a URL and then
 * tapping that same site on the rail opened a second tab for it.
 *
 * Nothing is re-STORED through this. Both spellings stay exactly as they are
 * written today — this only decides whether an existing tab can be reused.
 */
export function sameUrl(a: string, b: string): boolean {
  return canonicalUrl(a) === canonicalUrl(b);
}

function canonicalUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    // Not a URL either side of the comparison, so fall back to the text: the
    // one thing this must never do is throw on the way to opening a tab.
    return url.trim();
  }
}

/** Builds a full tab record for a URL, reusing mock-page titles when known. */
export function buildTab(
  input: string,
  spaceId: string,
  sortOrder: number,
): BrowserTab {
  const url = normalizeUrl(input);
  const mockPage = getMockPage(url);
  const host = hostnameOf(url);
  /* An internal page names itself. `hostnameOf` would call this one
     "extensions", which is the URL read as a domain rather than as a title. */
  const title = internalPage(url)?.title ?? mockPage?.heading ?? host;

  return {
    id: `tab-${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    title,
    url,
    // [...title][0], not title[0]: a title starting with an emoji indexes to a
    // lone surrogate, which renders as the replacement character.
    favicon: ([...title][0] ?? "•").toUpperCase(),
    // Through the exported helper, so "a pinned site's rail tile and its tab
    // are the same colour" is structural rather than two call sites happening
    // to agree.
    faviconColor: faviconColorFor(url),
    sortOrder,
    createdAt: new Date().toISOString(),
  };
}
