# Nexus

A BSV wallet and browser across iOS, Android, macOS, Windows, and Linux. It hosts arbitrary third-party sites with a wallet provider (`window.nexus`) injected into them at document-start, gated per origin.

A sixth target, **web**, is not a product: it is the demo build the design work runs on. See [Web — the preview target](#web--the-preview-target).

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
export ANDROID_HOME=$HOME/Library/Android/sdk
npm run android            # in a separate terminal
```

`ANDROID_HOME` is not optional and the failure does not say so usefully. Gradle
finds the SDK through `android/local.properties`, which `expo prebuild --clean`
deletes and `.gitignore` keeps out of the repo — so the first Android build after
any prebuild dies with *"SDK location not found"* several hundred lines into a log
that `npm` then truncates to a lifecycle-script error. Exporting the variable
avoids the file entirely.

### Web — the preview target

The sixth target, and the only one that is not a product. It runs the full demo:
every prototype app, every fixture, no wallet. It exists so design ideas can be
put in front of a customer or a partner the same afternoon, and it is never
shipped to a store.

Locally:

```bash
npm run web
```

To share a URL, deploy it to Vercel:

```bash
npm run web:deploy
```

That prints a preview URL you can send to anyone. It is `noindex`, and each run
gets its own URL, so two people can compare two ideas side by side. Publishing
to the project's own domain instead:

```bash
npm run web:deploy -- --prod
```

First time on a machine, you need the CLI and access to the team — the script
tells you if either is missing, and links `apps/ui` for you once you have both:

```bash
npm i -g vercel@latest && vercel login
```

`@latest` matters — `apps/ui` is on Next 16, and a CLI from before Next 15 shipped
misreads it. `npm run web:deploy` warns if yours is too old.

## Demo surfaces versus shipping surfaces

`apps/ui` is a fork of the design repository, where all fifteen apps are
prototypes drawn against ~9k lines of typed fixtures in `lib/data`. Two of them
are no longer prototypes: **Browser** drives real WebViews in the shell's native
tab layer, and **Wallet** spends real satoshis through `@nexus/wallet-core`.

One build-time flag decides which of the two worlds a build carries, and the
default is the strict one — forgetting a flag should cost a demo, not ship a fake
balance to the App Store.

| | apps shown | wallet | demo imagery | payload |
|---|---|---|---|---|
| shells (`npm run ui:bundle`) | Browser, Wallet | real, or an honest empty state | pruned | 4.6 MB |
| web (`npm run web`) | all fifteen | fixtures | included | 29.6 MB |

`apps/ui/lib/surfaces.ts` holds the list and the reasoning. The bar for adding a
slug to it is a service that answers.

To see the demo build exactly as the shells package it — useful when a bug only
shows up in the export, not in `next dev`:

```bash
npm run ui:build:demo && npm run serve
```

## Working on the shipping UX

The demo runs in any browser. **The shipping UX does not**, and the reason is not
a missing flag: `resolveDataMode()` goes live when `window.nexusHost.has('wallet')`,
which is a thing only a shell provides. In a plain browser there is no wallet to
ask, and `lib/wallet-data.ts` refuses to fall back to fixtures — so a live-mode
page in Chrome is an empty screen, correctly. Layout and copy can be worked on
there. A balance cannot.

Two terminals. The first serves the chrome with fixtures compiled out and the app
list narrowed to what you are working on; the second is Electron, pointed at it:

```bash
npm run dev:wallet
```

```bash
npm run dev:shell
```

You get hot reload and a real wallet at the same time — the shell holds
`@nexus/wallet-core`, so the balance, the ledger and Send/Receive over the address
and handle rails are all live. Only `nearby` (BLE/AWDL) is mobile-only.

### Focusing on one surface

`NEXT_PUBLIC_SURFACES` narrows a build to the apps you name:

```bash
NEXT_PUBLIC_DEMO_DATA=0 NEXT_PUBLIC_SURFACES=wallet,browser npm run ui:dev
```

**It can only narrow.** It is applied after the build's own set rather than in
place of it, so no value of it puts a demo surface into a live build — naming
`messages` in a live build removes nothing and adds nothing. `dev:wallet` is this
line with `wallet,browser` already in it.

Keep `browser` in the list unless you mean to test its absence: `BROWSER_REF` is
the fallback the rail returns to, and MainView routes connected sites through
`BrowserApp`.

### A wallet with nothing in it

A fresh shell has no keys and no coins, so the first run is an empty balance and
an empty ledger — which is the correct live state, not a bug. **Settings › Wallet**
is where you create or restore one and pick the network. Fund a testnet wallet
before working on Send.

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
