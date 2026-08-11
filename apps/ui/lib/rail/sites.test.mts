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
