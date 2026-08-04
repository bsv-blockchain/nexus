# Spec — native surfaces: scanner, local payments, share, tab focus

Status: agreed, not implemented.
Scope: four workstreams. Each is independently landable and independently testable.

## 0. The architectural decision that shapes all four

Nexus's chrome is a DOM document in a WebView. Three of the four things below
cannot live there:

- **Camera.** A QR scanner needs a camera feed. WKWebView can do `getUserMedia`,
  but the app already ships a working scanner in React Native and the browsed-tab
  layer paints above the chrome anyway, so a DOM scanner would be covered by any
  tab that happened to be open.
- **Local radios.** The nearby rail drives BLE/AWDL through
  `react-native-localpay-transport`. That is a native module; a document cannot
  reach it.
- **Share sheet.** `UIActivityViewController` is native by definition.

So these become **native surfaces the shell presents above the chrome**, opened by
a bridge call from the chrome and returning their result the same way. This is not
a compromise — it is the same split the tab layer already uses, and it lets us port
BSV Browser's real components rather than rewriting two thousand lines of flow
logic in the DOM and hoping it behaves the same.

The fourth (tab focus) is pure chrome and stays in the DOM.

### The presentation seam

One new shell-owned layer, `apps/mobile/src/native/NativeModalHost.tsx`, sitting at
a zIndex above `TabLayer`. It renders at most one native modal at a time, driven by
shell state, and every modal resolves a promise that the bridge method is awaiting.

```
chrome                      shell
──────                      ─────
nexusHost.scan.qr(opts) ──► scan.qr method
                            → NativeModalHost shows <QRScanner>
                            ← user scans / cancels
                        ◄── { text } | { cancelled: true }
```

While a native modal is up the shell **must** suppress the tab layer, exactly as
`chrome.setOverlay` does today — reuse that mechanism rather than adding a second
one, and drive it from shell state so the chrome cannot forget.

---

## 1. QR scanner — one component, five payload kinds

Port `bsv-browser/components/QRScanner.tsx` (316 lines) to
`apps/mobile/src/native/QRScanner.tsx`.

**It must stay one component.** BSV Browser deliberately has a single scanner that
every caller reuses; splitting it per payload type is how the five kinds drift apart.
The caller says what it will accept; the scanner reports what it saw.

Payload kinds, all of which must round-trip:

| kind | recogniser | already ported? |
|---|---|---|
| BSV address (bare or `bitcoin:`) | `isValidBsvAddress` / `normalizeAddressInput` | yes — `wallet-core/utils/pay/rails` |
| identity key (compressed pubkey) | `classifyScan` → `{kind:'handle'}` | yes |
| `peerpay:` URI | `validatePeerPayURI` | yes — `wallet-core/utils/parsePeerPayURI` |
| local-payment session / frame | `decodeSession` | yes — `wallet-core/utils/localpay/session` |
| Shamir backup slice | see `bsv-browser/utils/backupShares.ts` | yes — `wallet-core/utils/backupShares` |

`classifyScan` already covers the first four and is the single place a scanned
string becomes a rail. **Do not add a second classifier.** Extend `classifyScan`
only if a Shamir slice must be recognised by the same call; otherwise the scanner
takes an `accept` list and the caller disambiguates.

Requirements:

- `multiScan` mode must survive, and keep its retry-on-unrecognised behaviour: an
  unrecognised frame is not an error, it is a frame you have not seen yet. This is
  what makes animated multi-frame localpay codes work.
- Permission denial must offer `Linking.openSettings()`, as the source does.
- Strings: plain English constants, matching BSV Browser's copy. Nexus's shell has
  no i18n runtime and adding one for four labels is not worth it.
- New dependency: `expo-camera`. Requires a native rebuild.

Bridge surface:

```
nexusHost.scan.qr({ accept?: ScanKind[], hint?: string, multi?: boolean })
  → { text, target } | { cancelled: true }
```

`target` is `classifyScan`'s output when it recognised one, so a caller that wants
a rail does not have to re-parse.

Chrome callers to rewire: the address field in `pay-flow.tsx` (currently type-only)
and, in workstream 2, the nearby cells.

---

## 2. Local payments — the nearby rail

Port `bsv-browser/components/pay/NearbyFlow.tsx` (2179 lines) to
`apps/mobile/src/native/NearbyFlow.tsx`, presented by `NativeModalHost`.

The rail's logic — `wallet-core/utils/pay/rails/nearby`,
`utils/localpay/{build,codec,pending,session,verify}`, the transports, the offline
queue — **is already ported and already wired into `WalletContext`**. This
workstream is the UI and the transport driving, nothing else. Verify against
wallet-core before porting anything: several dependencies are already there.

Dependency tail that is NOT yet in `apps/mobile` (~1400 lines plus libraries):

- `components/localpay/PresenceRow.tsx` (186)
- `components/pay/{PaymentQrDisplay,ReceivedOverlay}.tsx` (282)
- `components/ui/{PressableScale,Celebration}.tsx` (192)
- `components/wallet/{AmountInput,AmountDisplay}.tsx` (262)
- `hooks/{useHaptics,useConfirmationSound}.ts` (148)
- `context/theme/{tokens,motion}.ts` (218) — port the token values, drop the
  ThemeContext plumbing; the shell has one theme.
- libraries: `react-native-reanimated`, `react-native-qrcode-svg`,
  `@expo/vector-icons`, `expo-haptics`. Audio for the confirmation sound may be
  stubbed if `expo-audio` proves costly — say so rather than silently dropping it.

Bridge surface:

```
nexusHost.pay.nearby.open({ role: 'payer' | 'payee' })
  → { outcome: 'paid' | 'received' | 'cancelled', satoshis?: number }
```

Behaviour that must not be lost, because each of these is load-bearing:

- The payee's code is shown; the payer scans it. Direction is not negotiable
  mid-flow.
- Radio first, QR as fallback. `local_pay_radio_fallback` exists because the
  wireless link can be unavailable and the payment must still complete.
- A frame too large for QR says so (`local_pay_too_large`) rather than showing a
  code that cannot be decoded.
- A received payment that cannot be internalised immediately is **queued**, not
  lost (`local_pay_queued`), and the offline queue already handles it.
- `FrameVerifyError` is a refusal, not a crash: a bad frame is someone handing you
  a forged payment.

Copy: use BSV Browser's strings verbatim (`context/i18n/translations.tsx`, the
`local_pay_*` keys).

---

## 3. Share sheet

Add `expo-sharing`, and restore the behaviour the CSV export lost.

- `tx.exportCsv` currently returns the CSV text and the chrome copies it to the
  clipboard. Replace with a shell-side share: write to cache, `shareAsync`, clean
  up — exactly `bsv-browser/utils/exportTransactions.ts`'s tail, which was
  deliberately split out and is waiting to be reattached.
- Also wire share for the things the pay screens offer: the receive address, the
  `peerpay:` link, and a transaction id. BSV Browser has `pay_share_link`.

Bridge surface:

```
nexusHost.share.text({ text, title? })       → { shared: boolean }
nexusHost.share.file({ filename, contents, mimeType }) → { shared: boolean }
```

Keep `buildTransactionsCsv` pure and in wallet-core. Only the delivery moves.

---

## 4. Tab switching and focus

Two distinct defects, both in `apps/ui/components/hub/`.

**4a. The switcher's tap target is thirds.** `TabSwitcher`'s drag surface treats a
tap in the left third as "previous", the right third as "next", and only the middle
third selects. A visible, half-off-screen card therefore cannot be tapped to select
— observed on device. Make a tap on a card select that card. Keep the drag-to-scrub
gesture; it is good. The thirds heuristic can stay as a fallback for taps that miss
every card.

**4b. A tab opened from outside the browser does not get focus.** `createTab` was
calling `setActiveTabId` from inside a `setTabsBySpace` updater — updaters must be
pure and may run twice, so the activation could be dropped. That specific bug is
fixed (commit `9c5c33d`) but **the fix is unverified**: the on-device retest tapped
a button that did not fire, so nothing was proven. Re-test explicitly:

1. Wallet → Activity → a transaction's explorer button.
2. The chrome must switch to the browser AND show WhatsOnChain, not the previously
   active tab.

Also check `openTab`, `openLinkInBrowser` and the address-sheet path for the same
nested-updater shape — `openLinkInBrowser` has it at `hub-provider.tsx:989`.

**4c. While auditing, confirm** that `NativeSiteFrame`'s per-URL `key` does not
strand shell tabs: it destroys on unmount, but tabs created by any other path (the
old `openInTab` helper, now removed) had no owner and no rect. Nothing should call
`host.tabs.create` except `NativeSiteFrame`.

---

## 5. Copy — drop "Nexus" from the pay language

`pay-flow.tsx` invented its own labels. Replace with BSV Browser's, verbatim:

| cell | title | subtitle (pay) | subtitle (get) |
|---|---|---|---|
| nearby | Someone nearby | Scan their code | Show your payment code |
| handle | Someone remote | Pick a handle — they need this app | Share your handle |
| address | To an address | Paste or scan an address | Show an address |

Consequence lines (`pay_conseq_*`): "Settles in seconds." / "Lands when their
wallet next checks." / "Sent — they are not notified."

The address consequence currently in `pay-flow.tsx` is a longer invention. BSV
Browser's is four words and better. Use it.

---

## Definition of done

- `npm run check` shows no NEW failures (`injectedPolyfills` is a known pre-existing one).
- Typecheck clean: `apps/mobile` and `apps/ui`.
- One native rebuild, with `expo-camera`, `expo-sharing`, `react-native-reanimated`,
  `react-native-qrcode-svg`, `@expo/vector-icons`, `expo-haptics` linked.
- On-device: scan an address into the pay field; open the nearby cell and reach the
  code-display step; export CSV through the OS share sheet; open a transaction's
  explorer link and land on the right tab.
- Anything that cannot be finished is reported as unfinished, with the reason.
