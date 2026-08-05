# Spec — the desktop wallet

Status: agreed, not implemented.
Goal: desktop stops being a browser shell and becomes the product — same wallet,
same payments, same transactions, on macOS, Windows and Linux.

## Why this is the next phase

Mobile has the wallet; desktop has none. That is the whole parity gap, and it is
one piece of work that lands on three of the five platforms at once. It is also
the thing that decides whether the "one chrome, two shells" architecture actually
holds: today the chrome runs on desktop, but only because it degrades to demo data.

## 0. The load-bearing discovery

`packages/wallet-storage` looked hard-wired to Expo. It is not. The entire
`expo-sqlite` surface it uses is **six methods**, counted across 1,519 lines:

| call | uses |
|---|---|
| `db.execAsync` | 21 |
| `db.getAllAsync` | 9 |
| `db.runAsync` | 7 |
| `db.getFirstAsync` | 4 |
| `db.withExclusiveTransactionAsync` | 1 |
| `db.closeAsync` | 1 |
| `SQLite.openDatabaseAsync` | 1 |

And **Electron 43 ships Node 24.18, whose built-in `node:sqlite` works** — probed,
not assumed: a `DatabaseSync` in the Electron main process created a table,
inserted and read back a row. So the desktop driver needs no native module, no
`better-sqlite3`, and no `@electron/rebuild` step that could break the four
native modules already linked on mobile.

That turns "days of work behind a storage abstraction" into a six-method seam.

## 1. The seam

`packages/wallet-storage/src/SqlDriver.ts`:

```ts
export interface SqlDriver {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>
  withExclusiveTransactionAsync(fn: (tx: SqlDriver) => Promise<void>): Promise<void>
  closeAsync(): Promise<void>
}
```

Two adapters:

- `drivers/expoDriver.ts` — wraps `expo-sqlite`. Must be a pass-through: the
  mobile app has a live wallet with real money in it, and any behaviour change
  here is a migration bug on a funded device.
- `drivers/nodeDriver.ts` — wraps `node:sqlite`'s `DatabaseSync`.

**`node:sqlite` is synchronous.** The adapter returns resolved promises. That is
correct rather than lazy — the calls genuinely are synchronous — but it means
`withExclusiveTransactionAsync` cannot rely on the driver serialising for it. Use
`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` explicitly, and hold a queue so two
overlapping transactions cannot interleave.

`StorageExpoSQLite` takes a driver instead of importing `expo-sqlite`. Keep the
class name for now: it is referenced across the wallet and renaming it is a
separate, noisier change. Add a note that the name is now wrong.

### Non-negotiable

The schema, the migrations and every SQL string stay **byte-identical**. A funded
mobile wallet must open its existing database with the new code and see the same
rows. Anything else is data loss.

## 2. What else is Expo-coupled

The wallet needs four more things a Node process cannot get from React Native:

| need | mobile | desktop |
|---|---|---|
| key storage | `expo-secure-store` (+ biometric) | Electron `safeStorage` (OS keychain), file-backed |
| key/value | `@react-native-async-storage/async-storage` | a JSON file under `app.getPath('userData')` |
| connectivity | `@react-native-community/netinfo` | `navigator.onLine` / Electron `net` |
| platform | `Platform.OS` | `process.platform` |

Each is small. Put them behind interfaces in the same style, in the same package
or in a new `packages/wallet-host`, and let both shells supply their own.

**`safeStorage` caveat:** on Linux it may fall back to plaintext when no keyring is
present. `safeStorage.isEncryptionAvailable()` must be checked, and a wallet must
refuse to store a mnemonic rather than write it in the clear. Say so in the UI.

## 3. Assembling the wallet without React

`apps/mobile/src/wallet/WalletContext.tsx` is 2,039 lines of React that builds the
manager stack: `WalletStorageManager` → `WalletSigner` → `Wallet` →
`WalletPermissionsManager`, plus `Monitor`, the sweeper and the offline queue.

The desktop main process has no React. Do **not** port the component. Extract the
build sequence — the part that is just "make these objects in this order" — into a
plain async factory both shells can call, and leave the React state, the permission
queues and the UI callbacks in the mobile component.

This is the riskiest part of the phase. The mobile wallet works and holds real
funds; the extraction must not change what it builds or the order it builds it in.
Prefer a factory the component then *uses* over a rewrite of the component.

## 4. The bridge

Desktop grows the methods it currently refuses. The chrome needs no change — it
already codes against `nexusHost.wallet.*`, `pay.*` and `tx.*`, and already asks
`nexusHost.has(...)` before showing a surface.

As each lands, add its name to the Electron preload's `capabilities`. That list is
the honest statement of what desktop can do, and it is what stops the chrome
rendering a surface that would error.

Order: `wallet` first (info/accounts/transactions/restore), then `tx`, then `pay`'s
address rail. `scan` and `nearby` stay off — no camera path, no local radios.

## 5. Definition of done

- `npm run check` shows no NEW failures; both typechecks clean.
- A test that opens a database with the **node** driver, runs the migrations, writes
  and reads back — proving the seam without a device.
- The mobile app still builds and its existing wallet still opens. This is the one
  that matters: a regression here is somebody's money.
- Desktop: launch, restore a wallet, see a real balance and a real transaction list.
- The Electron `capabilities` list grows to match what actually works, and nothing
  more.

## 6. Explicitly out of scope

- `scan` and `nearby` on desktop. No camera surface, no BLE/AWDL.
- Biometric unlock on desktop. `safeStorage` is the keychain; Touch ID gating is a
  later refinement.
- Windows/Linux runtime verification. Neither machine exists here; those artifacts
  remain built-not-run until someone has the hardware.

## The "signed builds hang" incident — corrected diagnosis

A Developer ID-signed local build appeared to never start its renderer: window
created, router answering, `loadFile` called, then nothing — no `did-finish-load`,
no `did-fail-load`, no `preload-error`. An eliminations table was built (hardened
runtime, entitlements, library validation, preload, sandbox, asar integrity, the
chrome export — all ruled out; unsigned same-commit builds worked) and the wrong
conclusion was drawn: "unnotarized Developer ID builds do not launch."

The real cause, found once screen recording was granted and the dialog became
visible: **a macOS Keychain prompt**. `resume()` opens with `safeStorage`, which is
synchronous keychain access on the main thread. The "Nexus Safe Storage" keychain
item had been created by a differently-signed build, so macOS parked the call behind
a modal *"Nexus wants to use your confidential information"* password prompt — in
front of a white window that could not paint, because the thread that would paint it
was the one waiting. Unsigned builds "worked" because they could not match the item's
ACL the same way and fell through to the restore gate instead.

Why every row of the eliminations table still hung: `resume()` ran unconditionally at
router-ready in all of them. The one framing mistake was testing headless —
`screencapture` was failing with "could not create image from display" (no screen
recording permission), so a modal dialog was indistinguishable from a hang.

Consequences, all applied:

- `resume()` now fires on `did-finish-load`, so the chrome paints before any
  keychain access and a prompt appears over a real UI.
- Local signed builds are fine after one "Always Allow" — the Developer ID signature
  is stable across rebuilds. Ad-hoc/unsigned rebuilds churn signatures and re-prompt,
  which is the worse local experience.
- Notarization is still required for DISTRIBUTION (Gatekeeper blocks downloaded
  unnotarized apps on other machines) — it was just never the cause of this.

## Debugging a packaged app

A packaged `.app` does not give main's stdout to the terminal the way `electron .`
does, which is why the failure above produced no output at all. Two env vars exist for
this and are inert unless set:

- `NEXUS_BOOT_LOG=<path>` — appends startup milestones and load events to a file.
- `NEXUS_EVAL=<path.js>` — evaluates a script in the chrome after load and logs the
  result, so a bridge method can be exercised without a human clicking.
