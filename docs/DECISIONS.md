# Nexus / Haven — product decisions

Decided 2026-08-03. These are settled unless explicitly revisited; they exist so nobody
re-opens them by accident, and so the reasoning survives the people who were in the room.

## 1. Identity

- **Bundle identifier: `org.bsvassociation.nexus`** — final, on both platforms. Creating the
  App Store Connect record freezes it, and that is accepted rather than waiting on the
  trademark answer.
- **URL scheme: `nexus://`** — third parties will hardcode this to invoke the wallet, so it
  is effectively permanent too. Additional schemes can be added later without dropping it.
- **Nexus is the working title; Haven is the intended brand**, pending trademark. Only the
  App Store display name and in-app branding follow the brand — none of the identifiers do.

## 2. Scope for v1

**Wallet (BSV only) and Browse.** Nothing else ships as functional.

The UI carries 16 app surfaces from the demo. The rest stay behind the demo-data flag
(`NEXT_PUBLIC_DEMO_DATA`) rather than shipping as convincing fakes — a wallet that shows
invented balances or a Messages app with no backend is worse than one that is visibly absent.
Notably out: Messages (11.9k lines, tiptap, no backend), Market, Mail, Vault, Vote,
Publisher, Signer, Attestations, Baskets, Learn.

## 3. Services and storage

- **Storage is LOCAL by default on mobile and desktop.** No remote storage service, no WAB.
  The wallet's source of truth is the on-device database.
- **ARC / chaintracks: `arcade-v2-*.bsvblockchain.tech` only.**
- **MessageBox: `gmb.bsvblockchain.tech`** (replacing `messagebox.babbage.systems`, and
  the never-adopted `message-box-us-1.bsvb.tech`). Not a source literal: it is
  `EXPO_PUBLIC_MESSAGEBOX_URL` / `NEXUS_MESSAGEBOX_URL` in the committed `/.env`, so
  changing it is a one-line diff rather than a hunt through `packages/` for whichever
  of three constants happened to be the one that was read. `npm run check` fails if
  the copies EAS and Expo need ever drift from it.
- Nothing points at `wab-us-1.bsvb.tech` or `store-us-1.bsvb.tech`.

Consequence worth stating: local-only storage means no cross-device recovery from the
backend. Recovery is the mnemonic and the database export, exactly as in BSV Browser.

## 4. Networks

**main, test and ttn**, with a selector, as BSV Browser has.

## 5. Native modules

Bring the complexity in: `react-native-engine-native` and `react-native-secp-native` (Rust
signing, measured 3.7× faster than the JS path) and `react-native-localpay-transport`
(BLE/AWDL offline payments). **Anything that cannot work in the desktop framework stays
mobile-only** rather than being watered down on both.

## 6. Dependency patches

**Carry BSV Browser's patches forward** — `@bsv/sdk@2.1.9` (124 KB) and
`@bsv/wallet-toolbox-mobile@2.4.3` (12 KB) via `patch-package`. They are low-level crypto
fixes. Extracting them into a proper library is the right eventual answer, but not now; the
cost is that every dependency bump is a merge against a patch file.

## 7. Code ownership

**`bsv-blockchain/nexus` owns the UI.** `vincemedia/bsvnexus` was the design source; it is no
longer the upstream. Design work contributes to this repository directly, so there is one
source of truth and no divergence to reconcile.

## 8. The Hermes `toString` question

BSV Browser is treated as **correct as shipped**. Where the same pattern misbehaves under
Nexus, that is a framework difference in this app and is fixed **here only** — no changes to
BSV Browser on Nexus's account.

(For the record: `packages/substrate/src/browser/injectedPolyfills.ts` builds its script via
`injectedPolyfills.toString()`, and `npm run check` fails on it. Converting it to a string
constant is a Nexus-side fix.)

## 9. Branching

`main` is the trunk. The `spike/a-prime-shells` branch was promoted and deleted — it stopped
being a spike some time ago. No other contributors yet, so no protection rules for now.
