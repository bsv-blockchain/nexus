# Nexus spike — results

An unmeasured gate is **not** a pass. Fill each row with the actual observation, the
platform it was seen on, and the date. Delete nothing; if a gate fails, record the
failure and what it implies for the A′ decision.

| Gate | Criterion | Status | Evidence |
|---|---|---|---|
| G1 Rendering | Real bsvnexus UI usable in Electron renderer + iOS-sim chrome WebView | **PASS** desktop · iOS UNMEASURED | Electron renderer running `next dev`: full chrome renders — icon rail (Profiles/Apps/Messages/Wallet/Identity/Browse/Connections), side pane, address bar, content pane. `[HMR] connected`, no fatal console errors. Screenshot captured. iOS sim: not yet run. |
| G2 Desktop tabs | ≥3 tabs glued to measured rect; resize / maximise / restore within ±1px; instant active switch | **PASS** (macOS 2026-08-03) | 3 tabs; **47 bounds pushes, 0 with non-zero drift**, requested vs `view.getBounds()` identical through `setSize` ×3, `maximize`, `unmaximize` and every animated intermediate frame (1324×596 → 3724×1198 → 784×296). `setActive` 0–3ms, and switching away and back re-applied the stored rect. |
| G3 Mobile tabs | ≥2 tabs positioned in rect; rotation + keyboard show/hide keep alignment | UNMEASURED | Harness already pushes bounds on `orientationchange` and `visualViewport.resize` for this |
| G4 Document-start | `proof.html` reports `typeof window.nexus === 'object'` at first inline script | **PASS** macOS · rest UNMEASURED | macOS/Electron: `{"nexusType":"object","injectedAt":1785774918764,"firstScriptAt":1785774918765,"readyState":"loading"}` — provider existed **1ms before the page's first script**, document still parsing. iOS: — · Android: — · Windows: — · Linux: — |
| G5 RPC | `nexus.ping()` < 50ms; unknown method → `failure`; no cross-tab response leakage | **PASS** (macOS 2026-08-03) | Page→shell→page ping: **t1 2ms, t2 1ms, t3 0ms**. Unknown method refused: `EXPECTED FAILURE: nexusHost: unknown method tab.ping`. Isolation: each tab's pong carried its own distinct `at` (…8769 / …8772 / …8779) and each `tab.message` carried the matching id. Chrome RPC: `host.info` 3ms, `tabs.create` 2–3ms, `tabs.list` 0ms. |
| G6 Mobile perf | Mid-tier Android: chrome scroll + rail animation ≥ 50fps sustained | UNMEASURED | Needs a physical mid-tier device |
| G7 One UI codebase | Real UI needs no change beyond adding `window.nexusHost` call sites | **PASS** (desktop) | Integration is **one file, 137 diff lines** — `tools/ui-integration.patch` against `components/apps/browser-app.tsx` (113 lines). It adds `NativeSiteFrame` (a measured `<div>` that drives `tabs.create/setActive/setBounds/destroy`) and a `useHasShell()` effect, keeping the existing iframe path as the web fallback. Verified live: the real chrome measured its own pane and the native view landed at `req=401,9 1030×850 actual=401,9 1030×850 drift=0px`. `apps/ui/next.config.ts` has no `output: 'export'`, so **static export remains unconfirmed** — the dev-server path works; packaging needs that config plus `images.unoptimized`. |

## Decision rule

- G2, G4, G5 fail on desktop → the Electron half is wrong; nothing else matters.
- G1 or G6 fail on mid-tier Android → DOM chrome on mobile is not viable; the
  fallback is B (re-author the UI in RN primitives), and the ~32k-line rewrite cost
  becomes unavoidable rather than optional.
- G3 fails only under rotation / keyboard → fixable with bounds re-measure hooks, not
  an architecture failure.
- G7 fails → the "develop UX once" premise is broken; re-open the shell choice.

## How to reproduce the desktop run

```bash
npm install
npm run serve                                    # harness + proof page on :8099
cd apps/desktop && NEXUS_DEBUG=1 NEXUS_AUTOTEST=1 \
  NEXUS_CHROME_URL='http://localhost:8099/?autotest=1' \
  ../../node_modules/.bin/electron .             # gates G2, G4, G5

npm run ui:fetch && npm run ui:dev               # the real UI on :3000
git -C apps/ui apply ../../tools/ui-integration.patch   # or apply by hand; apps/ui is not tracked
cd apps/desktop && NEXUS_DEBUG=1 NEXUS_CHROME_URL='http://localhost:3000' \
  ../../node_modules/.bin/electron .             # gates G1, G7
```

`NEXUS_DEBUG=1` mirrors the harness log to stdout and prints `[bounds]` (requested vs
actual, with drift), `[proof]`, and `[ping]` lines. `NEXUS_SCREENSHOT=<path>` captures
the chrome. Run `electron` from `apps/desktop` — the repo root has no `main`.

## Notes

- **`capturePage()` cannot show a tab.** The native layer composites above the
  renderer, so a renderer screenshot shows the chrome with a hole where the tab is.
  Visual confirmation of a tab needs a window-level capture; the `[bounds]` drift
  lines are the stronger evidence anyway.
- **React StrictMode destroys the first tab.** In dev, effects double-invoke, so the
  first `tabs.create` is immediately disposed and the surviving tab is `t2`. That the
  orphan is cleaned up at all is the cleanup path working; production won't do this.
- **The demo already hit the wall this architecture removes.** `browser-app.tsx`
  carries the comment "hosts that refuse to be framed, where an iframe would leave the
  canvas blank" — X-Frame-Options / CSP `frame-ancestors`. A native webview is not
  subject to either, and unlike an iframe it can host document-start injection. The
  shell isn't only preserving the UI, it unblocks a dead end already in it.
- Still open: Android WebView injection timing, memory under N tabs, and chrome
  popovers occluded by the native tab layer.
