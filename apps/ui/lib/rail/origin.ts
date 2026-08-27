/**
 * URL handling for pinned sites.
 *
 * Dependency-free on purpose: Node's built-in test runner strips types but does
 * not resolve the `@/` alias, so anything unit-tested here imports nothing.
 *
 * Every function returns null rather than throwing. These run against user
 * input and against persisted rows written by older builds, and a throw in
 * either path takes out the rail.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The scheme + host + port of a URL, or null if it will not parse. */
export function deriveOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * What the user typed, turned into a URL — or null if it is not one.
 *
 * "example.com" is a site; "no dots here" is a search query someone pasted into
 * the wrong box, and pinning it would create a dead rail icon.
 */
export function normalizeUrlInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate: string;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    // Already has a scheme with ://
    candidate = trimmed;
  } else {
    // No scheme with ://, so validate the bare authority before prefixing https://
    // to prevent laundering of javascript:, mailto:, data:, etc. into valid URLs.
    const authorityParts = trimmed.split("/");
    const authority = authorityParts[0];
    if (!authority) return null;

    // Reject userinfo (the @ would make the parser treat this as authentication)
    if (authority.includes("@")) return null;

    // Reject bare IPv6 addresses (they need an explicit scheme to parse correctly).
    // This is an accepted limitation: http://[::1]:3000 still works, bare [::1]:3000 does not.
    if (authority.startsWith("[")) return null;

    // Validate that any port is numeric (after the last :)
    if (authority.includes(":")) {
      const parts = authority.split(":");
      const port = parts[parts.length - 1];
      if (!port || !/^\d+$/.test(port)) return null;
    }

    candidate = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  const bare = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!bare.includes(".") && !LOCAL_HOSTS.has(parsed.hostname)) return null;
  return parsed.href;
}

/**
 * Whether a URL may be pinned.
 *
 * Allowlist, not denylist: https everywhere, http only on the loopback hosts a
 * developer needs. javascript:, data:, file: and about: are named in the tests
 * so a future edit that widens this has to delete an assertion to do it.
 */
export function isPinnableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol === "http:") return LOCAL_HOSTS.has(parsed.hostname);
  return false;
}

/**
 * The site's own favicon.
 *
 * Deliberately NOT a favicon service. Routing these through a third party hands
 * them the hostname of every site the user has pinned, on every render, from a
 * wallet browser. BSV Browser derives the same URL in BookmarkList.tsx.
 */
export function faviconUrlFor(url: string): string | null {
  return faviconCandidates(url)[0] ?? null;
}

/**
 * The marks a site might be serving, biggest first.
 *
 * `/favicon.ico` is 16 or 32 pixels and looks it on a 52px tile, but almost
 * every site that has anything better publishes it at one of these well-known
 * paths — the conventions browsers and phones already probe for. Tried in
 * order and each failure moves to the next, which is what `Favicon` does with
 * this list; the last entry is the one that has always worked.
 *
 * Guessed rather than read. Reading the page's own `<link rel="icon">` means
 * reaching into a document on somebody else's origin, which this side of the
 * app cannot do and should not be able to.
 */
export function faviconCandidates(url: string): string[] {
  const origin = deriveOrigin(url);
  if (!origin || origin === "null") return [];
  return [
    `${origin}/apple-touch-icon.png`,
    `${origin}/apple-touch-icon-precomposed.png`,
    `${origin}/icon.png`,
    `${origin}/favicon.ico`,
  ];
}

/**
 * A page title, cut down to something that fits under a rail tile.
 *
 * Page titles are written for a browser tab and a search result, so they carry
 * the site's name AND the page's AND a tagline, separated by whichever dash the
 * author reached for. The first segment is the name in nearly every case; the
 * host is the fallback, because "example.com" is at least true.
 */
export function shortNameFor(title: string, url: string): string {
  const first = (title ?? "")
    .split(/\s[|\u2013\u2014\u00b7\u2022-]\s/)[0]
    ?.trim();
  const name = first && first.length > 1 ? first : displayOrigin(url);
  /* Long enough for "Open Protocol Labs", short enough that the rail's own
     ellipsis is rare rather than usual. */
  return name.length > 22 ? `${name.slice(0, 21).trimEnd()}\u2026` : name;
}

/**
 * The origin as a person reads it — this is the string in the chip, and the
 * string the spend-authorization dialog must agree with.
 */
export function displayOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  return parsed.host.replace(/^www\./, "");
}
