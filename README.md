# Nexus

A BSV wallet and browser across iOS, Android, macOS, Windows, and Linux. It hosts arbitrary third-party sites with a wallet provider (`window.nexus`) injected into them at document-start, gated per origin.

## Architecture — Decision A′

See `docs/ARCHITECTURE.md` for the full rationale.

- **UI**: The existing Next.js + Tailwind 4 app, unchanged. One codebase, all platforms.
- **Desktop shell**: Electron. `WebContentsView` per tab, `preload` at document-start in an isolated world, `webRequest`, `setWindowOpenHandler`, `setPermissionRequestHandler`.
- **Mobile shell**: Expo / React Native. Chrome = one full-screen `react-native-webview`; tabs = additional `react-native-webview`s positioned by RN layout. Shared seams: `window.nexusHost` (`@nexus/bridge`) on the chrome, `window.nexus` (`@nexus/substrate`) on each page.

## Quickstart

### All platforms

```bash
npm install
npm run serve              # static server on port 8099
```

### Desktop (Electron)

```bash
npm run desktop            # in a separate terminal
```

### Mobile (iOS simulator)

```bash
npm run ios                # in a separate terminal
```

### Mobile (Android emulator)

```bash
npm run android            # in a separate terminal
```

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
