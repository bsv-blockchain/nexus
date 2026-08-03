# Nexus spike — task spec

Read `ARCHITECTURE.md` first. This file is the contract each task is built and
judged against. Every path is relative to the repo root (`/Users/personal/git/nexus`).

> **Superseded in one place.** This spec told builders that the injected provider and
> client are functions stringified with `Function.prototype.toString()`. That is wrong on
> Hermes and was corrected during the spike — the injected code is now a **string
> constant** in each package. See `SPIKE-RESULTS.md` → "The Hermes finding". The rest of
> the spec stands as written.

## Already built (do not modify)

- `packages/substrate/src/{protocol,provider,injected,host,index}.js`
- `packages/bridge/src/{protocol,client,injected,hostRouter,index}.js`

Public API, exactly as exported:

```js
// @nexus/substrate
const { buildSubstrateScript, createSubstrateHost, createProvider, CHANNEL, METHODS } = require('@nexus/substrate')
buildSubstrateScript({ walletEnabled, timeoutMs, version })   // -> string, ends with `true;`
createSubstrateHost({ handlers, send })                       // -> { handle(raw, ctx) }
//   handlers: { ping, getVersion, getPublicKey, createAction }, each (params, ctx) => any
//   send: (envelope, ctx) => void

// @nexus/bridge
const { buildChromeBridgeScript, createHostRouter, createHostClient, METHODS, EVENTS } = require('@nexus/bridge')
buildChromeBridgeScript({ shell, platform, timeoutMs })       // -> string, ends with `true;`
createHostRouter({ methods, send })                           // -> { handle(raw), emit(name, payload) }
```

`METHODS`: `host.info`, `tabs.create|destroy|navigate|setBounds|setActive|goBack|goForward|reload|stop|list`.
`EVENTS`: `tab.nav`, `tab.title`, `tab.loading`, `tab.message`, `tab.crash`.

Method params, as the client sends them:

| Method | params |
|---|---|
| `host.info` | `null` → return `{ shell, platform, version, tabCount }` |
| `tabs.create` | `{ url, options }` → return `{ id }` |
| `tabs.destroy` / `setActive` / `goBack` / `goForward` / `reload` / `stop` | `{ id }` |
| `tabs.navigate` | `{ id, url }` |
| `tabs.setBounds` | `{ id, rect: { x, y, width, height } }` — CSS px of the chrome document |
| `tabs.list` | `null` → return `[{ id, url, title, loading, canGoBack, canGoForward }]` |

Event payloads: `tab.nav` `{ id, url, canGoBack, canGoForward }`; `tab.title` `{ id, title }`;
`tab.loading` `{ id, loading, progress }`; `tab.message` `{ id, method, params, result }`;
`tab.crash` `{ id, reason }`.

## Conventions

- Chrome URL comes from `NEXUS_CHROME_URL`, default `http://localhost:8099`.
- Static server port **8099**. Real UI dev server port **3000**.
- No new npm dependencies beyond those named in each task.
- CommonJS in `packages/**`; ESM (`.mjs`) for Electron main; `.cjs` for Electron preloads; TSX for the Expo app.
- Never invent API surface. If something in this spec is impossible, say so in your
  final report instead of silently substituting an approach.

---

## T1 — `apps/harness/index.html`

Single self-contained HTML file (inline CSS + JS, no build, no deps) that drives
`window.nexusHost`. This is what proves the seam on both shells without touching
the real UI.

Requirements:

1. Layout mimicking the real chrome: 96px left icon rail (six items, inline SVG or
   text glyphs, 11px labels), a top bar with back / forward / reload buttons, a URL
   input, a "+" new-tab button, and a tab strip. Remaining space is
   `<div id="viewport">` — **this is the tab rect**.
2. A log pane (fixed height ~160px, monospace, newest last, auto-scrolled) that
   records every RPC call, result, and event with millisecond timings.
3. Startup: wait for `window.nexusHost` (listen for `nexushost:ready`, and also
   poll every 50ms up to 5s as a fallback), then `info()`, log the result, then
   create one tab at `https://example.com`.
4. `ResizeObserver` on `#viewport` **and** a `window` resize listener → call
   `tabs.setBounds(activeId, rect)` with `getBoundingClientRect()` values rounded
   to integers. Log every bounds push as `bounds id=… x,y w×h`.
5. URL input Enter → `tabs.navigate(activeId, url)`; prepend `https://` when the
   value has no scheme.
6. Tab strip: clicking a tab → `setActive` + `setBounds`; "+" → `tabs.create`;
   middle-click or an × on the tab → `tabs.destroy`. Support at least 4 tabs.
7. Subscribe to all five `EVENTS` and log them. `tab.nav` updates the URL input and
   the back/forward disabled states; `tab.title` updates the tab strip label.
8. A **Proof** button that navigates the active tab to
   `http://localhost:8099/proof`.
9. A **Ping page** button calling `nexusHost.call('tab.ping', { id })` — expect a
   `failure` envelope for an unknown method, and log it as `EXPECTED FAILURE: …`.
   This proves unknown-method refusal is wired.
10. Visible state readout at the top right: shell, platform, active tab id, last
    rect, and tab count.

Style it to read as a plausible browser chrome (neutral dark palette, 8px radii) —
it is shown to stakeholders — but do not import fonts or any remote asset.

Acceptance: opening it in a plain browser (no shell) logs
`nexusHost unavailable — no shell` after the 5s fallback and does not throw.

---

## T2 — `tools/serve.mjs` + `tools/proof.html`

`tools/serve.mjs`: zero-dependency `node:http` static server.

- Port 8099, override with `PORT`.
- `/` and `/index.html` → `apps/harness/index.html`.
- `/proof` and `/proof.html` → `tools/proof.html`.
- Anything else under `apps/harness/` → serve from disk with a correct MIME type;
  otherwise 404 with a plain-text body.
- Headers: `Cache-Control: no-store`, `Access-Control-Allow-Origin: *`.
- Log `method path status ms` per request. On listen, print the LAN IP too
  (`os.networkInterfaces()`, first non-internal IPv4) because a physical phone
  cannot reach `localhost`.

`tools/proof.html`: the document-start evidence page. **Its very first element must
be an inline `<script>`** that captures, before anything else runs:

```js
window.__proof = {
  nexusType: typeof window.nexus,
  injectedAt: window.__nexusInjectedAt || null,
  firstScriptAt: Date.now(),
  readyState: document.readyState
}
```

Then the visible body must render:

- **PASS / FAIL** headline: PASS only when `__proof.nexusType === 'object'`.
- A table of the captured `__proof` values plus `navigator.userAgent`.
- Buttons: `nexus.ping()`, `nexus.getVersion()`, `nexus.getPublicKey()` — each
  showing the resolved value or the error text, and the round-trip in ms.
- A line stating whether the `nexus:ready` event fired before `DOMContentLoaded`.
- Big, legible type — this gets photographed on five platforms.

Guard every call so a missing `window.nexus` renders FAIL rather than throwing.

---

## T3 — `tools/fetch-ui.mjs`

Idempotent Node script (ESM, no deps) that prepares the real UI.

1. If `apps/ui` is absent, `git clone --depth 1 https://github.com/vincemedia/bsvnexus apps/ui`,
   then delete `apps/ui/.git` so the outer repo does not see a nested repo.
2. `npm install --prefix apps/ui` unless `apps/ui/node_modules` exists.
3. Static export: if no `apps/ui/next.config.*` sets `output: 'export'`, write
   `apps/ui/next.config.mjs` with `{ output: 'export', images: { unoptimized: true }, trailingSlash: true }`.
   If a config already exists, **do not overwrite it** — print the manual edit needed and continue.
4. Accept `--build`. With it, run `npm run build --prefix apps/ui` and report whether
   `apps/ui/out/index.html` exists.
5. Print next steps: `npm run ui:dev` (dev server on 3000) or point a shell at
   `apps/ui/out` via `NEXUS_CHROME_URL`.

Report failures honestly — a Next 16 App Router static export can fail on
dynamic APIs. If `--build` fails, print the tail of the error and exit non-zero.
Do not patch the demo's source to force a build.

---

## T4 — root config

Edit these; do not create anything else.

1. `package.json` — set `scripts` to exactly:

```json
{
  "serve": "node tools/serve.mjs",
  "desktop": "npm --workspace @nexus/desktop run dev",
  "mobile": "npm --workspace @nexus/mobile run start",
  "ios": "npm --workspace @nexus/mobile run ios",
  "android": "npm --workspace @nexus/mobile run android",
  "ui:fetch": "node tools/fetch-ui.mjs",
  "ui:build": "node tools/fetch-ui.mjs --build",
  "ui:dev": "npm run dev --prefix apps/ui",
  "typecheck": "tsc --noEmit -p apps/mobile"
}
```

2. `tsconfig.base.json` — replace the `paths` block with entries for
   `@nexus/substrate` → `./packages/substrate/src/index.js` and `@nexus/bridge` →
   `./packages/bridge/src/index.js`. Remove the stale `@nexus/ui` and `@nexus/tabs`
   entries (those packages do not exist in A′).
3. `.gitignore` — add `apps/ui/` and `apps/mobile/.expo/`.
4. `README.md` — create it: what Nexus is (2 sentences), the A′ decision in 3
   bullets with a pointer to `docs/ARCHITECTURE.md`, a quickstart
   (`npm install` → `npm run serve` → `npm run desktop`, and the mobile variant),
   and the gate table from the bottom of this file verbatim.

---

## T5 — `apps/desktop` (Electron)

Files: `package.json`, `src/main.mjs`, `src/tabManager.mjs`, `src/preload-chrome.cjs`,
`src/preload-tab.cjs`.

`package.json`: name `@nexus/desktop`, `"type": "module"`, `"main": "src/main.mjs"`,
script `dev: "electron ."`, devDependency `electron: "^43.2.0"`, dependencies
`@nexus/bridge: "*"` and `@nexus/substrate: "*"`.

`src/main.mjs`:

- One `BrowserWindow` 1440×900, `webPreferences: { preload: <abs path>/preload-chrome.cjs, contextIsolation: true, sandbox: false, nodeIntegration: false }`.
- `loadURL(process.env.NEXUS_CHROME_URL ?? 'http://localhost:8099')`.
- Build a `createHostRouter({ methods, send })` where `send` is
  `win.webContents.send('nexus:host:in', envelope)`, and `ipcMain.on('nexus:host:out', (_e, msg) => router.handle(msg))`.
- `methods` delegates to the tab manager; `host.info` returns
  `{ shell: 'electron', platform: process.platform, version: app.getVersion(), tabCount }`.
- Quit on `window-all-closed` except darwin.

`src/tabManager.mjs`: `createTabManager({ win, emit })` → `{ create, destroy, navigate, setBounds, setActive, goBack, goForward, reload, stop, list, count }`.

- One `WebContentsView` per tab (`electron.WebContentsView`), added via
  `win.contentView.addChildView(view)`, with `webPreferences: { preload: <abs>/preload-tab.cjs, contextIsolation: true, sandbox: false, nodeIntegration: false }`.
- `setBounds` rounds to integers and applies immediately. Non-active tabs get
  `setVisible(false)`; `setActive` shows one and hides the rest, and re-applies the
  last known rect.
- Wire `webContents` events → `emit`: `did-navigate` and `did-navigate-in-page` →
  `tab.nav` (include `canGoBack`/`canGoForward`); `page-title-updated` → `tab.title`;
  `did-start-loading` / `did-stop-loading` → `tab.loading`; `render-process-gone` →
  `tab.crash`.
- `setWindowOpenHandler` → deny, and instead `create` a new tab at that URL and emit
  its `tab.nav`.
- Substrate traffic: `ipcMain.on('nexus:tab:out', ...)` handled by a
  `createSubstrateHost` whose `send` targets that tab's `webContents`
  (`nexus:tab:in`). Handlers for the spike: `ping` → `{ pong: true, at: Date.now() }`,
  `getVersion` → the app version, `getPublicKey` → a fixed 33-byte hex string with an
  obvious `spike-` marker, `createAction` → throw `'not implemented in spike'`.
  Every handled call also emits `tab.message` to the chrome so the harness log shows it.
- Keep a `Map` of id → `{ view, rect, url, title, loading }`. Ids are `t1`, `t2`, …

`src/preload-chrome.cjs`: `require('@nexus/bridge').createHostClient({ channel: CHANNEL, shell: 'electron', platform: process.platform, post: msg => ipcRenderer.send('nexus:host:out', msg) })`,
forward `ipcRenderer.on('nexus:host:in', …)` into `client.__deliver`, then
`contextBridge.exposeInMainWorld('nexusHost', client)` and dispatch a
`nexushost:ready` event on the page once exposed (use `webFrame.executeJavaScript`
or a `DOMContentLoaded`-safe dispatch — the harness also polls, so this is belt and braces).

`src/preload-tab.cjs`: `require('@nexus/substrate').createProvider({ channel: CHANNEL, post: msg => ipcRenderer.send('nexus:tab:out', msg), … })`,
forward `nexus:tab:in` → `provider.__deliver`, `contextBridge.exposeInMainWorld('nexus', provider)`,
and set `window.__nexusInjectedAt` in the page world so `tools/proof.html` can read it
(`webFrame.executeJavaScript('window.__nexusInjectedAt = Date.now()')`).

Note in a comment at the top of each preload: `sandbox: false` is a spike
concession so preloads can `require` workspace packages; production bundles them
and restores `sandbox: true`.

---

## T6 — `apps/mobile` (Expo)

Files: `package.json`, `app.json`, `index.js`, `App.tsx`, `babel.config.js`,
`metro.config.js`, `tsconfig.json`, `src/config.ts`, `src/useTabHost.ts`,
`src/ChromeHost.tsx`, `src/TabLayer.tsx`.

Pin these versions exactly (known-good together, matching the team's shipped app):

```
expo ^55.0.0, react 19.2.0, react-dom 19.2.0, react-native 0.83.6,
react-native-webview 13.16.0, react-native-safe-area-context ~5.6.0,
expo-status-bar ~55.0.6, expo-constants ~55.0.16
devDeps: @babel/core ^7.25.2, typescript ~5.9.2, @types/react ~19.2.10
dependencies: "@nexus/bridge": "*", "@nexus/substrate": "*"
```

`package.json` scripts: `start: "expo start --dev-client"`, `ios: "expo start --ios"`,
`android: "expo start --android"`. Name `@nexus/mobile`, `"main": "index.js"`.

`app.json`: name/slug `nexus`, `scheme: "nexus"`, `newArchEnabled: true`,
iOS `bundleIdentifier` and Android `package` `org.bsvblockchain.nexus`, and
`ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking: true` (the chrome is
served over plain HTTP from a dev machine).

`metro.config.js`: `getDefaultConfig(__dirname)`, then add the monorepo root to
`config.watchFolders` and both `<root>/node_modules` and `<app>/node_modules` to
`config.resolver.nodeModulesPaths`. Comment why: workspace packages live outside the
app directory.

`src/config.ts`: export `CHROME_URL` — read from `expo-constants`
`expoConfig.extra?.chromeUrl` if present, else `http://localhost:8099`, with a
comment that a physical device needs the LAN IP printed by `npm run serve`.

`src/useTabHost.ts`: owns tab state and returns
`{ tabs, activeId, methods, registerRef, onTabMessage, handlers }` where `methods`
is the object handed to `createHostRouter`. Tab state per id:
`{ id, url, rect, title, loading, canGoBack, canGoForward, visible }`. `setBounds`
stores the rect in state; `create` allocates `t1`, `t2`, …; `setActive` flips
`visible`. Imperative commands (`goBack`, `reload`, …) go through refs registered by
`TabLayer`.

`App.tsx`: full-screen `View`. Renders `ChromeHost` at `zIndex: 0` (absolute fill)
and `TabLayer` at `zIndex: 1`. Wires one `createHostRouter` (send → chrome ref
`injectJavaScript('window.__nexusHostDeliver(' + JSON.stringify(envelope) + ')')`)
and one `createSubstrateHost` per the same handler set as T5 (send → that tab's ref
`injectJavaScript('window.__nexusDeliver(…)')`). `host.info` returns
`{ shell: 'expo', platform: Platform.OS, version, tabCount }`.

`ChromeHost.tsx`: `WebView` with `source={{ uri: CHROME_URL }}`,
`injectedJavaScriptBeforeContentLoaded={buildChromeBridgeScript({ shell: 'expo', platform: Platform.OS })}`,
`onMessage` → `router.handle(event.nativeEvent.data)`, `originWhitelist={['*']}`,
`javaScriptEnabled`, `domStorageEnabled`, `setBuiltInZoomControls={false}`,
`overScrollMode="never"`, `style={{ flex: 1, backgroundColor: 'transparent' }}`.
Forward a ref up so `App` can `injectJavaScript`.

`TabLayer.tsx`: for each tab render an absolutely-positioned `WebView` at
`{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }` with
`opacity: visible ? 1 : 0` and `pointerEvents: visible ? 'auto' : 'none'`
(keep hidden tabs mounted — that is the warm-pool behaviour we already know works),
`injectedJavaScriptBeforeContentLoaded={buildSubstrateScript()}`,
`onMessage` → `substrateHost.handle(data, { tabId })`,
`onNavigationStateChange` → emit `tab.nav`, `onLoadStart`/`onLoadEnd` → `tab.loading`,
`onContentProcessDidTerminate` / `onRenderProcessGone` → `tab.crash`.
Register each `WebView` ref with `useTabHost`.

Do **not** add expo-router, reanimated, gesture-handler, or nativewind. The mobile
app is a shell; the UI is DOM.

---

## Gates — what the spike must show

| Gate | Criterion |
|---|---|
| G1 Rendering | The real bsvnexus UI loads and is usable in the Electron renderer **and** in the iOS-sim chrome WebView. Rail, theme morph and motion visible. |
| G2 Desktop tabs | ≥3 tabs each glued to the measured rect; resize / maximise / restore keeps alignment within ±1px; switching active tab is instant. |
| G3 Mobile tabs | ≥2 tabs positioned in the rect; rotation and keyboard show/hide keep alignment. |
| G4 Document-start | `tools/proof.html` reports `typeof window.nexus === 'object'` at its first inline script. Record per platform: iOS, Android, macOS, Windows, Linux. |
| G5 RPC | `nexus.ping()` round-trips < 50ms; unknown method returns a `failure` envelope; a response for tab A never lands in tab B. |
| G6 Mobile perf | On a mid-tier Android, chrome scroll and rail animation hold ≥ 50fps sustained. |
| G7 One UI codebase | The real UI needs no change beyond adding `window.nexusHost` call sites. |

Record results in `docs/SPIKE-RESULTS.md` as they are measured. An unmeasured gate
is **not** a pass.
