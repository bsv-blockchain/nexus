import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
