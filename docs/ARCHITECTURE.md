# Nexus architecture — decision record

Status: **spike**. Decisions below are settled for the spike; the spike exists to
validate the two marked ⚠️.

## What Nexus is

A BSV wallet **and browser** across iOS, Android, macOS, Windows, Linux. It hosts
arbitrary third-party sites with a wallet provider (`window.nexus`) injected into
them at document-start, gated per origin. The UI is the existing Next.js app
(`vincemedia/bsvnexus`, ~32k lines of real UI excluding fixtures).

The browser requirement — **N positioned embedded webviews, each with our code
inside someone else's page** — is what drives every choice here.

## Decision: A′ — DOM UI everywhere, native shells per platform

| Layer | Choice |
|---|---|
| UI | The existing Next.js + Tailwind 4 app, unchanged. One codebase, all platforms. |
| Desktop shell | **Electron**. `WebContentsView` per tab, `preload` at document-start in an isolated world, `webRequest`, `setWindowOpenHandler`, `setPermissionRequestHandler`. Chromium in-process → macOS/Windows/Linux render identically. |
| Mobile shell | **Expo / React Native**. Chrome = one full-screen `react-native-webview` loading the same UI; tabs = additional `react-native-webview`s positioned by RN layout. |
| Shared seam | `window.nexusHost` — identical API on both shells (`@nexus/bridge`). UI code never learns which shell it is in. |
| Page-facing seam | `window.nexus` — the wallet provider injected into browsed pages (`@nexus/substrate`). |

### Why the mobile shell is RN and not Capacitor

Tab embedding is the whole product risk. `react-native-webview` has already been
shipped to both stores by this team (BSV Browser), including document-start
injection, nav interception, cookie policy, content-process recovery, snapshotting
and a warm-view pool. The Capacitor route would put that on
`@capgo/capacitor-inappbrowser`'s positioned-webview mode, whose document-start
timing and N-simultaneous-instance behaviour are unverified, and would discard a
working EAS → Transporter → Play pipeline.

Cost accepted: we hand-roll the chrome↔native bridge (`@nexus/bridge`) that
Capacitor would have given us, and pay one extra Hermes runtime in memory.

### Rejected

| Option | Why not |
|---|---|
| **Tauri 2** | Multiwebview is behind the `unstable` flag with open positioning/resize/Linux bugs (tauri#10420, #10131, #13071, #11170). No multiwebview at all on mobile. `window.__TAURI__` into arbitrary origins unsupported (tauri#5088). Linux = WebKitGTK. |
| **Wails v3** | No multiple webviews in a window (wails#1163, #1997, #4952). Runtime injection works only for URLs you control; remote-origin IPC disabled by design. Still alpha. Go backend buys nothing against a TypeScript wallet stack. |
| **RN-everywhere (react-native-web)** | Would require re-authoring ~32k lines of DOM UI in RN primitives. No RN equivalent for `@property` colour interpolation (14 animated tokens), tiptap/ProseMirror (Messages), CSS 3D collectible cards, or 257 uses of grid/sticky/group-hover/peer/`:has()`. |
| **react-native-macos + react-native-windows** | No Linux target. RN-macOS also trails (0.81.7 vs RN 0.83.6). |
| **`@capacitor-community/electron`** | Unmaintained. Its replacement `@capawesome/capacitor-electron` is weeks old. Desktop uses plain Electron instead — no Capacitor bridge in the picture. |

General pattern: Tauri, Wails and friends host **your** app in a webview. Nexus
must host **other people's** sites with our code inside them. Only Electron
(desktop) and native webview libraries (mobile) treat that as a first-class case.

## The two seams

### `window.nexusHost` — chrome ↔ shell (`@nexus/bridge`)

Promise RPC + event subscription over one channel (`nexus.host.v1`).

- The client is a **string constant**, `CREATE_HOST_CLIENT_SOURCE`, and that string is
  the single source of truth. It is injected verbatim on mobile; the Electron chrome
  preload evaluates the same constant once to get a live factory. **Never stringify a
  function to inject it** — Hermes discards function source and hands the page a
  `[bytecode]` stub (measured: 660 chars of garbage vs 3540 of real source). `npm run
  check` enforces this, along with "no backticks or `${` inside the source strings".
- `createHostRouter()` runs shell-side and dispatches to that shell's `TabHost`.
- `tabs.setBounds` carries the px rect **and** normalized fractions of the document
  viewport, plus viewport size, zoom and dpr. Desktop uses px (CSS px and DIP coincide
  at zoom 1); mobile uses the fractions, which stay correct under page zoom and
  WebKit shrink-to-fit. Measured on iOS: viewport = screen = 402×874, `zoom=1`, so the
  fractions resolve back to the same numbers — but the protocol no longer *assumes* it.

### `window.nexus` — browsed page ↔ shell (`@nexus/substrate`)

- `createProvider()` follows the same string-constant contract as the bridge client
  (`CREATE_PROVIDER_SOURCE`): injected verbatim via
  `injectedJavaScriptBeforeContentLoaded` on mobile, evaluated once by the Electron tab
  preload and published with `contextBridge`.
- `createSubstrateHost()` treats every message as untrusted third-party input:
  unknown methods refused, handler throws become `failure` envelopes.
- Injection timing per platform:

| Platform | Mechanism | Guarantee |
|---|---|---|
| Electron (all desktop) | tab `preload` + `contextBridge` | Real isolated world, before page scripts by construction |
| iOS / macOS WKWebView | `WKUserScript` at document-start | Reliable |
| Android WebView | `onPageStarted` + `evaluateJavascript` | **Racy — no true document-start hook exists in any stack.** Same compromise BSV Browser already ships. |

## How the chrome reaches the device

The shell loads the chrome from a URL. Three deliveries, in increasing order of what
production needs:

| Delivery | Used by | Trade-off |
|---|---|---|
| Local harness / `next dev` | development | Fast loop; requires the dev machine |
| **Hosted (`bsvnexus.vercel.app`)** | **v0.0.1, on-device technical tests** | Testable build today, but needs network, and the deployed UI has no `window.nexusHost`, so the browse pane falls back to its iframe instead of native tabs |
| Bundled static export | production | Offline, no third-party dependency, and the only way the native tab layer works on device — because we control the build and can apply the `nexusHost` integration |

v0.0.1 ships hosted deliberately. Bundling was attempted and blocked: `tools/fetch-ui.mjs`
refuses to patch the demo's `next.config.ts` (it is not our repository), so there is no
`out/` to embed. Embedding one also means resolving Next's absolute `/_next/...` asset
paths under `file://`, or shipping a small local HTTP server inside the app. Both are
known, tractable, and neither belongs on the critical path to a first device build.

Consequence to keep in view: **until the chrome is bundled and patched, the native tab
layer is unreachable on device.** Everything proving it works — G2, G3, G4, G5 — was
measured against the harness and the Electron shell, not against the hosted demo.

## Mobile rules earned on device

- **Never absolutely position a natively-backed view directly.** Wrap it in a plain
  `View` that owns the rect and let the native component fill it with `flex: 1`. An
  absolutely-positioned `WebView` under the New Architecture reported the *correct*
  frame from `onLayout` while painting hundreds of dp away. Corollary: `onLayout`
  agreeing with what you asked for is not evidence the view is where you think.
- **The chrome owns its safe-area insets, not the shell.** The shell renders it edge to
  edge; the chrome pads with `env(safe-area-inset-*)` and sets `viewport-fit=cover`
  (required for WKWebView to report non-zero insets). Desktop reports 0 on all four, so
  it is one rule everywhere rather than a mobile branch.

## Known limitations, accepted

- **Native tab layers sit above the chrome.** On both shells the tab webview is a
  native layer over the DOM. Chrome popovers/menus that need to overlay page
  content must either live outside the tab rect, or shrink/hide the tab view, or
  move to a separate transparent window. Every Electron-based browser deals with
  this.
- **Spike preloads run with `sandbox: false`** so they can `require` workspace
  packages, with `contextIsolation: true` retained. Production must bundle the
  preloads (esbuild) and restore `sandbox: true`.
- Local payments (BLE/AWDL/Nearby) stay mobile-only; desktop v1 ships default-browser
  + deep links, biometric/OS unlock, and camera QR only.
- One wallet per device. No cross-device key sync in v1.

## Layout

```
apps/
  ui/         the Next.js chrome — fetched, not vendored (tools/fetch-ui.mjs)
  harness/    static page that drives window.nexusHost; proves the seam without touching the UI
  mobile/     Expo shell
  desktop/    Electron shell
packages/
  substrate/  window.nexus provider + host router      (shell-agnostic, CJS)
  bridge/     window.nexusHost client + host router     (shell-agnostic, CJS)
tools/        static server, document-start proof page, UI fetcher
```

Both shared packages are CommonJS on purpose: Metro, Electron ESM `import`, and
Electron `.cjs` preloads all consume them without a build step.

## Open questions the spike must answer ⚠️

1. Does the real 32k-line UI run acceptably in a mobile WebView on a mid-tier
   Android — the DOM chrome is the whole product surface there.
2. Do N positioned `react-native-webview` tabs stay glued to a rect measured in
   the chrome document, across rotation and keyboard show/hide.

See `SPIKE-PLAN.md` for gates.
