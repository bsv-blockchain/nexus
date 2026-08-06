# SPEC: wallet setup, backup, and a real Settings surface

Status: agreed 2026-08-06. Scope of one implementation pass; each workstream is
independently landable. Written against the six-reader mapping of nexus,
bsv-browser and bsv-desktop (facts cited by file:line were verified by hand).

## Why

The shells ship Browser and Wallet backed by a real wallet, but three things a
production wallet cannot lack are missing on every platform:

1. **Create-new wallet.** Restore-from-phrase is the only way in
   (`useWalletBridge.ts:165-170` says so explicitly). A user without an existing
   wallet cannot use the product.
2. **Backup.** No surface ever shows the recovery phrase again. A user who
   restores once and loses their paper is unrecoverable, and a created wallet
   (point 1) would be born unbacked.
3. **Settings.** The Settings app is a design-repo prototype: 17 controls, 4 of
   which work, none wallet-related. There is no network switch, no reveal, no
   sign-out on any platform.

The demo (web/Vercel) keeps the design repo's Settings untouched — the UX
designer's flow must not change. Everything here is live-mode only, gated the
same way `WALLET_SECTIONS` already gates wallet tabs.

## Reference decisions (from bsv-browser / bsv-desktop)

- **Acknowledgement, not quiz.** bsv-browser gates the generated phrase behind
  an explicit acknowledgement checkbox (`app/auth/mnemonic.tsx:419-441`) and has
  no verification quiz anywhere. We copy that: cheaper, and the quiz's security
  theatre is not worth onboarding friction. Copy/share actions also count as
  acknowledgement, as they do there.
- **Store the phrase before showing it.** bsv-browser's generate flow stores the
  mnemonic (biometric-gated) and builds the wallet BEFORE the reveal screen, so
  abandoning the flow mid-backup loses nothing (`mnemonic.tsx:59-88`). Same
  order here.
- **Logout deletes keys, never the ledger.** bsv-browser's `logout()` deletes
  snapshot+mnemonic+recoveredKey and leaves the SQLite DB and its registry
  behind (`WalletContext.tsx:1612-1628`), and its dialog copy says exactly that.
  Same semantics, same honesty in copy. We additionally fix its known gap: the
  desktop `deleteSnap` no-op against keychain snapshots (nexus
  `platform/index.mjs:78-84`) must also clear the secure-store snapshot.
- **Network switch is teardown + rebuild.** `switchNetwork(network)` exists on
  mobile (`WalletContext.tsx:1354`) and persists via `finalConfig`. Desktop gets
  the equivalent: persist `network` in key-value.json, rebuild from stored
  mnemonic against that chain. Chains offered in UI: `main`, `test` (teratest
  stays env/dev-only).
- **Desktop must warn when the OS cannot keep a secret.** Desktop
  `encryptionStatus()` exists and is consumed by nothing
  (`secureStore.mjs:126-130`, reader-flagged as an unmet requirement).
  `settings.get` carries it to the chrome.

## Protocol additions (packages/bridge)

`protocol.js` METHODS (constants, since these are first-class wallet surface):

| constant | wire name | semantics |
|---|---|---|
| `WALLET_CREATE` | `wallet.create` | generate 12 words, build, store; returns `{ ok, mnemonic }`. Refuses when a wallet exists. |
| `WALLET_BACKUP` | `wallet.backup` | return `{ mnemonic }` from secure storage (biometric-gated on mobile). Error when none stored. |
| `WALLET_LOGOUT` | `wallet.logout` | delete key material (mnemonic, recoveredKey, password, snapshot incl. keychain), tear down managers, publish `wallet.state`. Ledger DBs stay. Returns `{ ok }`. |
| `SETTINGS_GET` | `settings.get` | `{ network, networks: ['main','test'], messageBoxUrl, secure: { storedSecurely, method } }` — `method` one of `'keychain-biometric' | 'keychain' | 'none'`. |
| `SETTINGS_SET_NETWORK` | `settings.setNetwork` | `{ network }` → switch + rebuild. Returns `{ ok }`. Wallet must exist. |

`client.js`: `wallet.create/backup/logout` join the wallet namespace;
`settings.get/setNetwork` become a new `settings` namespace. **client.js is
injected source: no backticks, no `${}`** (documented trap). Timeouts: create
and setNetwork are slow (PBKDF2 + rebuild) — 120s like restore; backup 60s
(biometric prompt); settings.get default.

Capability: both shells append `'settings'`. The chrome's Wallet settings
category renders only when `resolveDataMode() === 'live' && can('settings')`.

## Mobile shell (apps/mobile)

In `useWalletBridge.ts` (same method-table pattern, same `ref.current` idiom):

- `wallet.create`: refuse if `walletBuilt` ("a wallet already exists on this
  device — sign out first"). `generateMnemonicWallet()` from
  `@nexus/wallet-core/src/utils/mnemonicWallet` → `buildWalletFromMnemonic(mnemonic)`
  (which stores the phrase via `setMnemonic`, `WalletContext.tsx:1257`) → verify
  `walletBuilt` (build swallows errors; state is the truth, same as restore) →
  `{ ok: true, mnemonic }`.
- `wallet.backup`: `getMnemonic()` (biometric prompt via LocalStorageProvider's
  `ensureAuth`) → null ⇒ throw "no recovery phrase is stored on this device" →
  `{ mnemonic }`.
- `wallet.logout`: call context `logout()` (`WalletContext.tsx:1628` — already
  deletes snap+mnemonic+recoveredKey, resets state, navigates chrome to '/').
  Await one tick, return `{ ok: true }`. The `wallet.state` push (App.tsx:133)
  fires from state change.
- `settings.get`: network from `selectedNetwork`; messageBoxUrl via the same
  source `pay.handle.messageBox` reads; `secure.method` =
  `'keychain-biometric'` when `LocalAuthentication` hardware+enrolled, else
  `'keychain'`; `storedSecurely: true` (expo-secure-store).
- `settings.setNetwork`: validate `'main'|'test'`, call `switchNetwork`,
  `{ ok: true }`.

`ChromeHost.tsx` capabilities: append `'settings'`.

## Desktop shell (apps/desktop)

`host.mjs`:

- `wallet.create`: same contract. `generateMnemonicWallet()` (import from
  wallet-core like buildWallet.ts does) → `restoreDesktopWallet(mnemonic, ...)`
  → `setMnemonic` only after build proves out (same order as restore) →
  `{ ok, mnemonic, storedSecurely }`.
- `wallet.backup`: `localStorage.getMnemonic()`; null ⇒ throw. No biometric on
  desktop (vault/TouchID is bsv-desktop's pattern; out of scope this pass).
- `wallet.logout`: `wallet = null`; delete mnemonic AND snapshot through
  secureStore (fix the deleteSnap keychain no-op while here); publish state.
- `settings.get`: network from the persisted choice (below); `secure` from
  `encryptionStatus()` → `storedSecurely: status === 'available'`-ish mapping,
  `method: 'keychain'` or `'none'`.
- `settings.setNetwork`: persist `'network'` in key-value.json; if a mnemonic is
  stored, tear down + `restoreDesktopWallet(phrase, { chain })`. `resume()` and
  `wallet.restore` read the persisted network instead of hardcoded `'main'`
  (`host.mjs:159,192` today; `wallet.info:81` stops lying by construction).
- Capabilities (`preload-chrome.cjs:22`): add `'settings'`, and `'tx'` if
  workstream D2 lands.

### D2 (landed): desktop `tx.*`

Port the six `tx.*` methods from `usePayBridge.ts:408-478` into a desktop
`payHost.mjs`: `tx.list`, `tx.abort`, `tx.refreshProof`, `tx.rawHex`,
`tx.exportCsv`, `tx.explorerUrl`. All are storage/services reads — no Monitor,
no outbox, no radios. Declare `'tx'`. The chrome's live `<Transactions/>`
pager then works on desktop.

### D3 (landed, `f577b9d`): desktop `pay.*`

This section said pay rails were "its own future spec". They were, and it was
short, because the logic is already platform-agnostic in
`packages/wallet-core/src/utils/pay/**` — the mobile hook is a wrapper, so the
desktop host is a second wrapper rather than a second implementation.

Seventeen methods: `classify`, `validateAddress`, `copyKeys`, the four
`address.*`, the nine `handle.*`, `proofNudge`, plus `offline.status` /
`offline.sendNow` from the Monitor work. `nearby.open` is NOT ported — it drives
two local radios Electron main has no path to.

The Monitor came first because the rails need it, and it is built by
`buildWallet.ts` but started by `host.mjs`, which stops it at sign out, network
switch and `before-quit`. That answers the original objection (a factory that
starts timers leaves the caller unable to stop them) rather than bypassing it.

No SSE on desktop: Electron 43 main is Node 24.18, where `EventSource` sits
behind `--experimental-eventsource`, and `ArcSSEClient` passes
react-native-sse-shaped options the WHATWG class would ignore — dropping
Last-Event-ID and the ARC key. Desktop polls instead. Adding SSE means a
dependency or an upstream change, not a flag.

Still absent on desktop: the background address sweeper. `pay.address.receive`
writes the watchlist, so a sweeper landing later is correct from day one, but
today an incoming address payment credits when the user presses "Check this
address now" rather than on arrival.

Consequence for the chrome, and the reason two defects existed: declaring `pay`
makes the payment grid render, and two of its six cells are hardware. Rails must
be gated on capability — `can('nearby')` for the nearby cells, `can('scan')` for
`ScanButton` — because `payHost()`/`scanHost()` throw rather than returning null,
so an ungated control's only outcome is a raw bridge error.

## Chrome (apps/ui)

1. `lib/wallet-data.ts`: extend the `NexusHost` structural type (wallet.create/
   backup/logout, settings) and `WalletInfo` gains `building?: boolean` (the
   shell already returns it, `useWalletBridge.ts:93`; the gate currently cannot
   tell "deriving keys" from "no wallet"). New helpers: `createWallet()`,
   `revealBackup()`, `logoutWallet()`, `readSettings()`, `setNetwork()` —
   same host()-getter idiom the file already uses.
2. `wallet-gate.tsx` becomes a three-state screen (still zero-prop,
   still `useHostOverlay`):
   - **choose**: "Create a new wallet" (primary) / "Restore from recovery
     phrase" (secondary). Shows `building` spinner state when info.building.
   - **create**: calls `createWallet()`; renders the 12 words in a numbered
     grid; copy button (counts as acknowledgement, like bsv-browser); explicit
     "I wrote these words down" checkbox; Continue disabled until acknowledged.
     Warning copy: anyone with the words has the money; Nexus cannot recover
     them.
   - **restore**: the existing textarea flow, unchanged.
3. Settings: **live builds get a Wallet category; demo keeps the designer's
   five untouched.**
   - `hub-provider.tsx`: `SettingsCategory` union gains `'wallet'`.
   - New file `components/apps/settings-wallet.tsx` (keeps the upstream-merged
     settings-app.tsx diff minimal): `WalletSettingsPanel` using the existing
     private Group/Row/Choice primitives (copy them or export them — prefer
     exporting Group/Row/Choice from settings-app.tsx, they are stable).
     Sections:
     - **Network**: Choice main/test → confirm dialog ("switches every screen
       to {net}; your funds live on mainnet") → `setNetwork` → success toast.
     - **Backup**: Row "Reveal recovery phrase" → warning screen → reveal
       (numbered grid + copy). On desktop with `secure.method === 'none'`,
       show the not-stored-securely warning from `settings.get`.
     - **Security**: read-only rows — where keys live (`keychain-biometric` →
       "Keys unlock with Face ID / Touch ID"), storage location copy.
     - **Sign out**: destructive Row → confirm dialog with bsv-browser's honest
       copy (deletes keys from this device, not transaction history; funds are
       safe only if the phrase is written down) → `logoutWallet()` → gate
       reappears via wallet.state.
   - `settings-app.tsx`: `SETTINGS_CATEGORIES` filtered exactly like
     `WALLET_SECTIONS` (wallet-app.tsx:68-72): demo → the design five; live →
     `[wallet, appearance, about]`. Panel switch gains the wallet branch.
     AboutPanel in live mode shows the HOST version (`window.nexusHost.info()`,
     the shell-version.tsx pattern) instead of the fixture release version.
   - `wallet-app.tsx`: hide Send/Receive/Exchange buttons in live mode when
     `!can('pay')` (desktop today), instead of opening fixture sheets.

## Out of scope, recorded

- **Desktop background address sweeper.** The only piece of the pay port
  deliberately left out: `wallet-core`'s sweeper is driven by mobile's
  WalletContext rather than by the Monitor, so wiring it is its own change.
  Until then an incoming address payment credits on a manual check.
- **Desktop biometrics.** Keys sit in the OS keychain via `safeStorage`, with no
  presence check in front of them. bsv-desktop's `electron/vault.ts` (AES-GCM
  under a scrypt-wrapped DEK) plus `electron/biometric.ts` (macOS
  `promptTouchID`) is the reference, and its own notes are honest that TouchID
  there proves presence rather than holding a Secure Enclave key.
- **Desktop SSE** — see D3. Needs a dependency or an upstream `ArcSSEClient`
  that accepts a WHATWG-shaped EventSource.
- Mobile's `TaskCheckForProofs`/`TaskUnFail` patches live inline in
  WalletContext and were not duplicated into desktop; extracting them into
  wallet-core beside `configureNewHeaderPolling` would serve both shells.
- Exchange has no live path on any platform — the fixture sheet is the only
  implementation, and it is demo-only now, so live builds simply lack the action.
- Passphrase (BIP-39 25th word), Shamir shares UI (wallet-core has
  `backupShares.ts`, zero callers), DB export/import, ARC override UI,
  trust-network UI, currency setting.
- The mobile-browser SettingsSheet (browser sheet fiction, demo-only).

## Verification gates

1. `apps/ui`: `npm run typecheck` + `npm run build` (shipping, DEMO=0) +
   `npm run build` demo (DEMO=1).
2. `npm run typecheck` (mobile tsconfig covers apps/mobile).
3. `node --experimental-transform-types --check` is not a thing; desktop:
   `npm run build --workspace @nexus/desktop` (esbuild) must succeed.
4. Desktop live: launch packaged-dir app with NEXUS_BOOT_LOG; screenshot; gate
   shows choose screen when no wallet; create → words → settings shows
   network/backup/signout; logout → gate returns.
5. Mobile: dev-client on simulator; same loop; biometric prompt appears for
   backup reveal (simulator Face ID match via notifyutil).
6. Demo regression: web preview still shows the designer's five categories and
   the demo wallet; `?data=demo` untouched.
