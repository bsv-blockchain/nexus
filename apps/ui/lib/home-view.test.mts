import { test } from "node:test";
import assert from "node:assert/strict";
import { homeView, homescreenFor } from "./home-view.ts";

test("homescreenFor sends an unanswered picker to Focus", () => {
  assert.equal(homescreenFor([]), "focus");
});

test("homescreenFor sends a solitary Thinker to Focus", () => {
  assert.equal(homescreenFor(["thinker"]), "focus");
});

test("homescreenFor sends everyone else to the Timeline", () => {
  assert.equal(homescreenFor(["maker"]), "timeline");
  assert.equal(homescreenFor(["developer"]), "timeline");
  assert.equal(homescreenFor(["gamer"]), "timeline");
  /* Thinker alongside anything is somebody with a reason to watch a feed. The
     order is the picker's build order, so both arrangements are reachable. */
  assert.equal(homescreenFor(["thinker", "maker"]), "timeline");
  assert.equal(homescreenFor(["maker", "thinker"]), "timeline");
});

test("homeView answers with the preference where there is a Timeline", () => {
  assert.equal(homeView("focus", true), "home");
  assert.equal(homeView("timeline", true), "timeline");
});

test("homeView falls to Focus where the Timeline is gone", () => {
  /* Promoted to an app and then disconnected: there is nothing to choose, so
     the preference cannot be honoured and must not strand Home on a view that
     is not there. */
  assert.equal(homeView("timeline", false), "home");
  assert.equal(homeView("focus", false), "home");
});
