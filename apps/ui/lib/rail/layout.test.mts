import { test } from "node:test";
import assert from "node:assert/strict";
import {
  migrateRailLayout,
  reconcileRail,
  refKey,
  sameRef,
  type RailEntry,
} from "./layout.ts";

const app = (slug: string) => ({ kind: "app" as const, slug });
const site = (id: string) => ({ kind: "site" as const, id });
const single = (ref: { kind: "app"; slug: string } | { kind: "site"; id: string }) =>
  ({ type: "single" as const, ref });

test("refKey namespaces the two kinds so they cannot collide", () => {
  assert.equal(refKey(app("wallet")), "app:wallet");
  assert.equal(refKey(site("wallet")), "site:wallet");
  assert.notEqual(refKey(app("x")), refKey(site("x")));
});

test("sameRef compares kind and identity", () => {
  assert.equal(sameRef(app("wallet"), app("wallet")), true);
  assert.equal(sameRef(app("wallet"), site("wallet")), false);
  assert.equal(sameRef(site("a"), site("b")), false);
});

test("migrateRailLayout upgrades the old single-app shape", () => {
  const raw = JSON.stringify([{ type: "app", slug: "wallet" }]);
  assert.deepEqual(migrateRailLayout(raw), [single(app("wallet"))]);
});

test("migrateRailLayout upgrades the old group shape", () => {
  const raw = JSON.stringify([
    { type: "group", id: "g1", name: "Money", color: "#0f0", apps: ["wallet", "browser"] },
  ]);
  assert.deepEqual(migrateRailLayout(raw), [
    {
      type: "group",
      id: "g1",
      name: "Money",
      color: "#0f0",
      members: [app("wallet"), app("browser")],
    },
  ]);
});

test("migrateRailLayout passes the new shape through unchanged", () => {
  const layout: RailEntry[] = [single(site("s1")), single(app("browser"))];
  assert.deepEqual(migrateRailLayout(JSON.stringify(layout)), layout);
});

test("migrateRailLayout returns null on junk rather than throwing", () => {
  assert.equal(migrateRailLayout("{"), null);
  assert.equal(migrateRailLayout(JSON.stringify({ not: "an array" })), null);
});

test("migrateRailLayout drops entries it cannot understand", () => {
  const raw = JSON.stringify([{ type: "app", slug: "wallet" }, { type: "nonsense" }, 7]);
  assert.deepEqual(migrateRailLayout(raw), [single(app("wallet"))]);
});

test("reconcileRail drops refs that no longer exist", () => {
  const layout = [single(app("wallet")), single(site("gone"))];
  assert.deepEqual(reconcileRail(layout, [app("wallet")]), [single(app("wallet"))]);
});

test("reconcileRail appends refs the stored layout has never seen", () => {
  const layout = [single(app("wallet"))];
  assert.deepEqual(reconcileRail(layout, [app("wallet"), site("s1")]), [
    single(app("wallet")),
    single(site("s1")),
  ]);
});

test("reconcileRail de-duplicates a ref present twice", () => {
  const layout = [single(app("wallet")), single(app("wallet"))];
  assert.deepEqual(reconcileRail(layout, [app("wallet")]), [single(app("wallet"))]);
});

test("reconcileRail collapses a group down to one surviving member", () => {
  const layout: RailEntry[] = [
    { type: "group", id: "g1", name: "Money", members: [app("wallet"), site("gone")] },
  ];
  assert.deepEqual(reconcileRail(layout, [app("wallet")]), [single(app("wallet"))]);
});

test("reconcileRail drops a group whose members have all gone", () => {
  const layout: RailEntry[] = [
    { type: "group", id: "g1", name: "Money", members: [site("gone")] },
  ];
  assert.deepEqual(reconcileRail(layout, [app("wallet")]), [single(app("wallet"))]);
});

test("reconcileRail keeps a mixed group of an app and a site", () => {
  const layout: RailEntry[] = [
    { type: "group", id: "g1", name: "Money", members: [app("wallet"), site("s1")] },
  ];
  assert.deepEqual(reconcileRail(layout, [app("wallet"), site("s1")]), layout);
});
