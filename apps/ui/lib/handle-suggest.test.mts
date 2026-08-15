import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHandle, suggestHandle } from "./handle-suggest.ts";

test("suggestHandle returns an adjective-animal pair with no number", () => {
  const handle = suggestHandle([], 0);
  assert.match(handle, /^[a-z]+$/);
  assert.equal(checkHandle(handle, []), "ok");
});

test("suggestHandle is deterministic for a given pick", () => {
  assert.equal(suggestHandle([], 0.25), suggestHandle([], 0.25));
});

test("suggestHandle walks on rather than repeating a taken name", () => {
  const first = suggestHandle([], 0);
  const second = suggestHandle([first], 0);
  assert.notEqual(second, first);
  assert.equal(checkHandle(second, [first]), "ok");
});

test("suggestHandle numbers only once every plain pair is gone", () => {
  /* Every pair taken, so the only way through is a suffix — and it starts at
     two, because the first of something is not numbered. */
  const all: string[] = [];
  for (let i = 0; i < 200; i += 1) {
    const next = suggestHandle(all, 0);
    all.push(next);
  }
  const plain = all.filter((handle) => /^[a-z]+$/.test(handle));
  const numbered = all.filter((handle) => /\d+$/.test(handle));
  assert.equal(new Set(all).size, all.length, "every suggestion is distinct");
  assert.ok(numbered.length > 0, "falls back to numbers once pairs run out");
  assert.ok(
    numbered.every((handle) => !handle.endsWith("1")),
    "never suffixes with 1"
  );
  assert.ok(plain.length > numbered.length, "prefers the unnumbered pairs");
});

test("checkHandle names why it said no", () => {
  assert.equal(checkHandle("", []), "empty");
  assert.equal(checkHandle("ab", []), "malformed", "too short");
  assert.equal(checkHandle("Has Spaces", []), "malformed");
  assert.equal(checkHandle("with-dash", []), "malformed");
  assert.equal(checkHandle("cozycritter", ["cozycritter"]), "taken");
  assert.equal(checkHandle("CozyCritter", ["cozycritter"]), "taken", "case");
  assert.equal(checkHandle("freename", ["cozycritter"]), "ok");
});
