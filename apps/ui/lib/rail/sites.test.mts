import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addPinnedSite,
  parsePinnedSites,
  removePinnedSite,
  renamePinnedSite,
  type PinnedSite,
} from "./sites.ts";

const NOW = "2026-08-10T12:00:00.000Z";

function seed(): PinnedSite[] {
  return [
    {
      id: "s1",
      title: "Example",
      url: "https://example.com/",
      origin: "https://example.com",
      sortOrder: 0,
      createdAt: NOW,
    },
  ];
}

test("addPinnedSite normalizes the URL and derives the origin", () => {
  const result = addPinnedSite([], { url: "example.com/start", now: NOW, id: "s1" });
  assert.ok(result);
  assert.equal(result.site.url, "https://example.com/start");
  assert.equal(result.site.origin, "https://example.com");
  assert.equal(result.site.sortOrder, 0);
  assert.equal(result.site.createdAt, NOW);
});

test("addPinnedSite titles the site from its host when none is given", () => {
  const result = addPinnedSite([], { url: "https://www.example.com/", now: NOW, id: "s1" });
  assert.ok(result);
  assert.equal(result.site.title, "example.com");
});

test("addPinnedSite keeps a supplied title", () => {
  const result = addPinnedSite([], {
    url: "https://example.com/",
    title: "My Shop",
    now: NOW,
    id: "s1",
  });
  assert.ok(result);
  assert.equal(result.site.title, "My Shop");
});

test("addPinnedSite refuses a URL that may not be pinned", () => {
  assert.equal(addPinnedSite([], { url: "javascript:alert(1)", now: NOW, id: "s1" }), null);
  assert.equal(addPinnedSite([], { url: "http://example.com/", now: NOW, id: "s1" }), null);
  assert.equal(addPinnedSite([], { url: "no dots here", now: NOW, id: "s1" }), null);
});

test("addPinnedSite dedupes by url and returns the existing pin", () => {
  const sites = seed();
  const result = addPinnedSite(sites, { url: "https://example.com/", now: NOW, id: "s2" });
  assert.ok(result);
  assert.equal(result.sites.length, 1);
  assert.equal(result.site.id, "s1");
});

test("addPinnedSite puts a new site at the end of the order", () => {
  const result = addPinnedSite(seed(), { url: "https://other.com/", now: NOW, id: "s2" });
  assert.ok(result);
  assert.equal(result.site.sortOrder, 1);
  assert.equal(result.sites.length, 2);
});

test("removePinnedSite drops only the named site", () => {
  const sites = removePinnedSite(seed(), "s1");
  assert.deepEqual(sites, []);
  assert.equal(removePinnedSite(seed(), "nope").length, 1);
});

test("renamePinnedSite trims, and ignores an empty title", () => {
  assert.equal(renamePinnedSite(seed(), "s1", "  Shop  ")[0]?.title, "Shop");
  assert.equal(renamePinnedSite(seed(), "s1", "   ")[0]?.title, "Example");
});

test("parsePinnedSites keeps well-formed rows and drops the rest", () => {
  const raw = JSON.stringify([
    seed()[0],
    { id: "s2" },
    "nope",
    { id: "s3", title: "Bad", url: "javascript:alert(1)", origin: "x", sortOrder: 1, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.id, "s1");
});

test("parsePinnedSites re-derives origin rather than trusting the stored value", () => {
  const raw = JSON.stringify([{ ...seed()[0], origin: "https://attacker.example" }]);
  assert.equal(parsePinnedSites(raw)?.[0]?.origin, "https://example.com");
});

test("parsePinnedSites returns null on junk", () => {
  assert.equal(parsePinnedSites("{"), null);
  assert.equal(parsePinnedSites(JSON.stringify({})), null);
});

test("parsePinnedSites trims whitespace-only titles and falls back to hostname", () => {
  const raw = JSON.stringify([{ ...seed()[0], title: "   " }]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.[0]?.title, "example.com");
});

test("parsePinnedSites renumbers sortOrder to be contiguous, preventing collisions", () => {
  // Simulate stored data with a gap: sortOrders [0, 1, 3] because row 2 was unpinnable
  const raw = JSON.stringify([
    { id: "s1", title: "A", url: "https://a.com/", origin: "x", sortOrder: 0, createdAt: NOW },
    { id: "s2", title: "B", url: "https://b.com/", origin: "x", sortOrder: 1, createdAt: NOW },
    { id: "s3", title: "C", url: "https://c.com/", origin: "x", sortOrder: 3, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 3);
  assert.equal(parsed?.[0]?.sortOrder, 0);
  assert.equal(parsed?.[1]?.sortOrder, 1);
  assert.equal(parsed?.[2]?.sortOrder, 2);
  // Verify addPinnedSite does not collide
  const result = addPinnedSite(parsed || [], { url: "https://d.com/", now: NOW, id: "s4" });
  assert.ok(result);
  assert.equal(result.site.sortOrder, 3);
  assert.equal(result.sites.length, 4);
});

test("parsePinnedSites treats missing or invalid sortOrder as 0 and renumbers", () => {
  const raw = JSON.stringify([
    { id: "s1", title: "A", url: "https://a.com/", origin: "x", createdAt: NOW },
    { id: "s2", title: "B", url: "https://b.com/", origin: "x", sortOrder: NaN, createdAt: NOW },
    { id: "s3", title: "C", url: "https://c.com/", origin: "x", sortOrder: Infinity, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 3);
  assert.equal(parsed?.[0]?.sortOrder, 0);
  assert.equal(parsed?.[1]?.sortOrder, 1);
  assert.equal(parsed?.[2]?.sortOrder, 2);
});

test("parsePinnedSites canonicalizes stored URLs via new URL().href", () => {
  // Two URLs that are equivalent but differ in formatting
  const raw = JSON.stringify([
    { id: "s1", title: "Example", url: "https://example.com", origin: "x", sortOrder: 0, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  // new URL().href adds a trailing slash, so "https://example.com" becomes "https://example.com/"
  assert.equal(parsed?.[0]?.url, "https://example.com/");

  // Now add a URL that already has the trailing slash
  const result = addPinnedSite(parsed || [], { url: "https://example.com/", now: NOW, id: "s2" });
  assert.ok(result);
  // Both canonicalize to "https://example.com/", so it should be deduplicated
  assert.equal(result.site.id, "s1");
  assert.equal(result.sites.length, 1);
});

test("parsePinnedSites preserves a dotless intranet host like https://intranet/", () => {
  const raw = JSON.stringify([
    { id: "s1", title: "Intranet", url: "https://intranet/", origin: "x", sortOrder: 0, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.url, "https://intranet/");
  assert.equal(parsed?.[0]?.title, "Intranet");
});

test("parsePinnedSites preserves a loopback host like http://localhost:3000/", () => {
  const raw = JSON.stringify([
    { id: "s1", title: "Dev", url: "http://localhost:3000/", origin: "x", sortOrder: 0, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.url, "http://localhost:3000/");
});

test("parsePinnedSites dedupes rows by canonical URL, first occurrence wins", () => {
  const raw = JSON.stringify([
    { id: "s1", title: "First", url: "https://example.com", origin: "x", sortOrder: 0, createdAt: NOW },
    { id: "s2", title: "Second", url: "https://example.com/", origin: "x", sortOrder: 1, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.id, "s1");
  assert.equal(parsed?.[0]?.title, "First");
});

test("parsePinnedSites maintains contiguous sortOrder after dedup", () => {
  const raw = JSON.stringify([
    { id: "s1", title: "A", url: "https://a.com", origin: "x", sortOrder: 0, createdAt: NOW },
    { id: "s2", title: "B", url: "https://a.com/", origin: "x", sortOrder: 1, createdAt: NOW },
    { id: "s3", title: "C", url: "https://c.com", origin: "x", sortOrder: 2, createdAt: NOW },
  ]);
  const parsed = parsePinnedSites(raw);
  assert.equal(parsed?.length, 2);
  assert.equal(parsed?.[0]?.sortOrder, 0);
  assert.equal(parsed?.[1]?.sortOrder, 1);
});
