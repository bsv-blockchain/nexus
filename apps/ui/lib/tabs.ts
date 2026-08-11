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

/** "foo.com/bar" → "https://foo.com/bar"; free text → a search URL. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
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

/** Builds a full tab record for a URL, reusing mock-page titles when known. */
export function buildTab(
  input: string,
  spaceId: string,
  sortOrder: number,
): BrowserTab {
  const url = normalizeUrl(input);
  const mockPage = getMockPage(url);
  const host = hostnameOf(url);
  const title = mockPage?.heading ?? host;

  return {
    id: `tab-${Math.random().toString(36).slice(2, 10)}`,
    spaceId,
    title,
    url,
    favicon: (title[0] ?? "•").toUpperCase(),
    faviconColor: colorFor(host),
    sortOrder,
    createdAt: new Date().toISOString(),
  };
}
