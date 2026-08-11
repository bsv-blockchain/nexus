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
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
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
  const origin = deriveOrigin(url);
  return origin ? `${origin}/favicon.ico` : null;
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
