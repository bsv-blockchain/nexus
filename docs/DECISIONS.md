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

*Amended 2026-08-11.* That was the intent, not yet the fact: design work continued in
`vincemedia/bsvnexus` for five days after the fork, and 66 commits were merged back on
`feat/design-catchup`. See `docs/SPEC-design-catchup.md`. The rule stands going forward,
and the reconciliation cost of five days is the argument for it.

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

## 10. Apps, and what "Nexus distributes nothing" means

Decided 2026-08-11, replacing the reading recorded in `53e6e00`.

There **is** an Apps surface, and it is a store in every way a person would recognise:
search, sort, filter, listings grouped by whoever serves them. What Nexus does not do is
**operate a distribution channel or make claims about software it did not build**. Those
are different sentences, and only the second one is a principle.

Concretely:

- A **built-in app** is a screen compiled into this binary. Connecting one adds it to the
  active profile's rail. Nothing is downloaded, because it was already there.
- A **web app** is a listing with a `web` field — somebody else's website. Connecting one
  pins its URL to the rail as a `{ kind: "site" }` ref and records an origin-scoped grant
  against that profile's wallet. Disconnecting revokes both. This is the web3 convention
  (Coinbase's dapp connections, MetaMask's connected sites, CAIP-25 session scopes) and
  our own: BRC-100 for the interface, BRC-43 for what a grant covers, BRC-73 for grouping
  the approval.
- **Ratings, review counts, catalogue versions and freshness are demo-only.** They are
  derived from a hash of the slug and there is no registry behind them. Under
  `NEXT_PUBLIC_DEMO_DATA=0` they do not render, and the sort control drops Trending and
  Most popular while keeping Newest and Oldest — those are dates on rows the build ships
  with, which is a fact about the build rather than a claim about other people.

The rail's two kinds stay distinct in the type (`lib/rail/layout.ts`). That is what stops a
website reaching code that assumes a screen, and it is the line the permission model rests
on.

## 11. Getting a demo surface shipped

Seventeen of nineteen app surfaces are drawn against fixtures and reachable only under
`NEXT_PUBLIC_DEMO_DATA`. `docs/PROMOTING-DEMO-SURFACES.md` is the process that gets one
out: four stages (drawn → validated → built → shipped) and two exits — into the binary, or
onto the web as a site a user connects.

**Prefer the web.** It is the cheaper mistake, it ships on its own schedule, and it proves
the `window.nexus` seam by using it. Reach for the binary when the answer to "why can this
not be a website?" is a key, an offline requirement, or the OS.

## 12. Desktop auto-update

Decided 2026-08-12.

**One channel: the latest published release.** No beta ring, no staged rollout,
no per-user opt-in. Settings › About shows what the updater is doing and offers
the one decision that is the user's — when to restart into it.

- **Downloads happen without asking; installing does not.** Keeping people
  current is the point, so waiting for a click before fetching would leave the
  least attentive users the least protected. Restarting closes the app, which is
  never ours to do to somebody mid-payment.
- **A draft release ships nothing.** electron-updater reads the newest published
  release, so publishing the draft is the act that releases an update. See
  `docs/RELEASING.md`.
- **Windows signing lives inside electron-builder** (`build/win-sign.cjs`), not
  in a later workflow step, because signing after the hash is computed is how
  bsv-desktop broke updates for every Windows client twice.
- **Linux: AppImage only.** A .deb is the package manager's to replace, and the
  About panel says so rather than claiming to watch.

The Stable/Beta picker inherited from the design repository was removed rather
than disabled: it was a switch with nothing behind it. `settings/beta-dialog.tsx`
stays in the tree for when channels are real.
