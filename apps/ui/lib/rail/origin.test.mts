import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveOrigin,
  displayOrigin,
  faviconUrlFor,
  isPinnableUrl,
  normalizeUrlInput,
} from "./origin.ts";

test("deriveOrigin strips path, query and hash", () => {
  assert.equal(
    deriveOrigin("https://shop.example.com/a/b?q=1#top"),
    "https://shop.example.com",
  );
  assert.equal(deriveOrigin("https://example.com:8443/x"), "https://example.com:8443");
});

test("deriveOrigin returns null rather than throwing on junk", () => {
  assert.equal(deriveOrigin("not a url"), null);
  assert.equal(deriveOrigin(""), null);
});

test("normalizeUrlInput adds https when a scheme is missing", () => {
  assert.equal(normalizeUrlInput("example.com"), "https://example.com/");
  assert.equal(normalizeUrlInput("  example.com/path  "), "https://example.com/path");
  assert.equal(normalizeUrlInput("https://example.com/path"), "https://example.com/path");
});

test("normalizeUrlInput normalizes bare host:port with https", () => {
  assert.equal(normalizeUrlInput("localhost:3000"), "https://localhost:3000/");
  assert.equal(normalizeUrlInput("127.0.0.1:8080"), "https://127.0.0.1:8080/");
});

test("normalizeUrlInput rejects input that is not a host", () => {
  assert.equal(normalizeUrlInput(""), null);
  assert.equal(normalizeUrlInput("   "), null);
  assert.equal(normalizeUrlInput("no dots here"), null);
});

test("normalizeUrlInput rejects userinfo and script-bearing schemes", () => {
  // Prevent laundering of javascript:, mailto:, sip:, etc. into valid URLs by prefixing https://
  assert.equal(normalizeUrlInput("mailto:test@example.com"), null);
  assert.equal(normalizeUrlInput("javascript:alert(1)@evil.com"), null);
  assert.equal(normalizeUrlInput("sip:alice@example.com"), null);
});

test("isPinnableUrl accepts https, and http only for localhost", () => {
  assert.equal(isPinnableUrl("https://example.com/"), true);
  assert.equal(isPinnableUrl("http://localhost:3000/"), true);
  assert.equal(isPinnableUrl("http://127.0.0.1:3000/"), true);
  assert.equal(isPinnableUrl("http://example.com/"), false);
});

test("isPinnableUrl rejects the script-bearing schemes explicitly", () => {
  assert.equal(isPinnableUrl("javascript:alert(1)"), false);
  assert.equal(isPinnableUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isPinnableUrl("file:///etc/passwd"), false);
  assert.equal(isPinnableUrl("about:blank"), false);
});

test("faviconUrlFor points at the site's own origin, never a third party", () => {
  assert.equal(
    faviconUrlFor("https://example.com/deep/page"),
    "https://example.com/favicon.ico",
  );
  assert.equal(faviconUrlFor("garbage"), null);
});

test("faviconUrlFor returns null for opaque origins", () => {
  assert.equal(faviconUrlFor("javascript:alert(1)"), null);
  assert.equal(faviconUrlFor("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(faviconUrlFor("about:blank"), null);
});

test("displayOrigin drops the scheme and a leading www", () => {
  assert.equal(displayOrigin("https://www.example.com/x"), "example.com");
  assert.equal(displayOrigin("https://shop.example.com/x"), "shop.example.com");
  assert.equal(displayOrigin("http://localhost:3000/"), "localhost:3000");
  assert.equal(displayOrigin("garbage"), "garbage");
});
