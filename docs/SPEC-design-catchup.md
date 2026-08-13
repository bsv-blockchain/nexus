# Design catch-up — vincemedia/bsvnexus → bsv-blockchain/nexus

Status: **shipped**, merged to `main` 2026-08-12 as `4cf1635`. Kept because the
reasoning outlived the branch — §1 is why the Apps surface looks the way it does,
and §2 why a profile owns a wallet.

## Why this exists

`docs/DECISIONS.md` §7 says the design repository is no longer upstream and that design work
lands here directly. That is the intent, not yet the fact: the designer kept working in
`vincemedia/bsvnexus` after we forked, and this document is how the two get back to one
source of truth.

**Divergence point: `91b7524`** — "Sealed documents, saved lines, and a place for settings",
2026-08-05 22:54 CEST. That is the last commit the two trees share. Since then:

| | commits | source files | net lines |
|---|---|---|---|
| upstream (`vincemedia/bsvnexus`) | 66 | 121 | +16,404 / −1,278 |
| here (`apps/ui` only) | ~40 | 52 paths | wallet went live, store was deleted |

Upstream is at `127cb6c` (2026-08-10 10:00 CEST). Reference clone:
`/Users/personal/git/_ref/bsvnexus-upstream`. Live build: <https://www.nexus.free/>.

## What is being taken, and what is not

**Taken:** design and UX — layout, interaction, motion, copy, information architecture,
and the fixture data those screens are drawn against.

**Not taken:** anything about how this repository is built or shipped. Upstream is a
single Next.js app; we are a monorepo whose `apps/ui` is one workspace of five, bundled
into an Electron shell and an Expo shell. Upstream has no `@nexus/wallet-core`, no
`packages/substrate`, no patches, no EAS pipeline. None of that changes here.

**Preserved without exception:**

- every live wallet path — `lib/wallet-live.ts`, `lib/wallet-data.ts`, `lib/pay-data.ts`,
  `components/apps/wallet/pay-flow.tsx`, `components/apps/wallet/transactions.tsx`,
  `components/apps/settings-wallet.tsx`, `components/hub/spend-authorization.tsx`,
  `components/hub/wallet-gate.tsx`
- BRC-157 backup and recovery, and the entropy/backup-share modules behind it
- `lib/data-mode.ts` and `lib/surfaces.ts` — the demo/live switch, and the rule that a
  shipped binary cannot talk itself back into fixtures
- `lib/rail/*` — the pure, tested rail model (`RailRef`, `RailEntry`, `PinnedSite`,
  origin normalisation) and its four Node test files
- `components/hub/origin-chip.tsx`, `origin-label.tsx` — the anti-spoofing host renderer

## The four decisions this spec turns on

### 1. Apps is a store again, on our types

Upstream rebuilt the Apps surface between `db3522c` and `5f52674`: you *connect* an app
rather than install it, sources are grouped by whoever serves them, each section collapses,
and a filter bar sits above the lot. That surface returns as the real product surface,
with upstream's language.

What does **not** return is upstream's underlying model. Ours stays:

```ts
type RailRef = { kind: "app"; slug: string }   // a screen compiled into this binary
             | { kind: "site"; id: string }     // an external web app the user connected
```

The distinction is load-bearing — it is what stops a website reaching code that assumes a
screen — and it happens to be the same line the rest of web3 draws.

**"Connected apps" is not our coinage.** It is the settled term for the list of origins a
wallet has granted access to, and every major wallet ships the same three affordances:
a list, a per-row disconnect, and a disconnect-all.

| Wallet | Term | Shape |
|---|---|---|
| Coinbase Wallet | Dapp Connections | list, per-row disconnect, "Disconnect All" |
| MetaMask | Connected sites | per-site permissions, revoke **per account**, revoke all |
| Phantom | Connected apps | list per account |
| WalletConnect v2 / CAIP-25 | session scopes | namespaces negotiated at connect time |

MetaMask's per-account revoke is the one worth copying, because it is exactly what
upstream's profile column already says in words: *"Permissions are scoped to this
profile's wallet."* Same idea, arrived at independently.

On our own side of the fence the standard already exists: BRC-100 is the wallet-to-app
interface, BRC-43 defines the security levels and counterparty rules that decide what a
grant covers, and BRC-73 is *Group Permissions for App Access* — grouped approval, which
is what a connect sheet is. `@bsv/wallet-toolbox`'s `WalletPermissionsManager` is the
reference implementation, and `components/hub/spend-authorization.tsx` is already talking
to it.

So the merged model is:

- **A source** is who serves an app, not a distribution channel we operate. For a
  built-in app that is Nexus itself; for a web app it is its origin.
- **Connecting a built-in app** adds it to the active profile's rail. Nothing is
  downloaded, because it was already in the binary.
- **Connecting a web app** pins its URL to the rail *and* records an origin-scoped grant
  against the active profile's wallet. Disconnecting revokes both.
- **Ratings, review counts, version chips and "updated N days ago" are demo-only.**
  They are fixture properties with no service behind them; under `NEXT_PUBLIC_DEMO_DATA=0`
  they do not render. This is the one place upstream's design is trimmed rather than
  ported, and it is trimmed for the same reason `lib/surfaces.ts` exists.

`docs/DECISIONS.md` gains an amendment recording that "Nexus distributes nothing" now
means "Nexus operates no distribution channel and makes no claims about what it did not
build" rather than "there is no Apps surface".

### 2. Profiles own a handle, a wallet and a connection list

Upstream's Aug 8 batch (`fef88e3` … `c721222`) turned a profile from a browsing context
into an identity context. Ported in full:

- the Profiles canvas: one column per profile, `Connections` / `Browsing` tabs, a stats
  header (`2 profiles · 2/5 handles · 4 wallets`), a guide panel, the `+` column
- `profiles-sidebar.tsx`, `profile-connections.tsx`, `connect-picker.tsx`
- drag bookmarks, folders and tabs between profiles (`space-drag.tsx`,
  `moveItemToSpace`, `moveTabToSpace`)
- per-profile theme, falling back to the system rather than to the last profile's
- the icon and the name as separate controls; a new profile opens collapsed

**Demo-scoped, deliberately.** `docs/DECISIONS.md` §3 says one wallet per device and no
key sync in v1, and that is not being revisited here. In demo mode the handle and wallet
pickers run on `lib/wallets-store.ts` and `lib/data/handles.ts` fixtures. In live mode the
wallet picker shows the one real wallet and offers no second; the handle picker is absent
until a handle service exists.

### 3. New surfaces land demo-gated, with a route out

Roadmap app + phase switcher, handle marketplace + share sheet, Downloads and Licence
panes, and the sixteen app onboarding guides all land behind `DEMO_SURFACES`, joining the
thirteen prototype apps already there.

That is now a holding pattern with an exit, not a graveyard. See
`docs/PROMOTING-DEMO-SURFACES.md` for the process that moves one of these from fixture to
shipped, and the two ways out: into the binary, or onto the web as something a user
connects.

### 4. Settings ports in full

`settings-app.tsx` grows 651 → 1129 lines and gains `lib/settings-store.ts` plus six
panels (permissions, autofill, shortcuts, per-sender tolls, beta dialog, blocks), a global
site-settings pane, and a rewritten mobile settings screen.

Our `components/apps/settings-wallet.tsx` — keys, network selector, BRC-157 backup — is
grafted in as a section alongside them and remains the source of truth for anything that
touches a key. It is the one settings section that is live rather than demo, and it stays
that way.

## Work inventory

Derived by three-way comparison of `91b7524` against both heads. Full lists in
`docs/PLAN-design-catchup.md`.

| Class | Count | Treatment |
|---|---|---|
| Wholesale | 37 | our copy is byte-identical to the divergence point; take upstream's |
| New | 46 | upstream added it; copy in |
| Restore | 7 | we deleted it, upstream evolved it; bring back adapted to `RailRef` |
| Merge | 19 | both sides edited; hand-merge, ours wins on anything live |
| Assets | 20 | 16 onboarding PNGs, 2 icons, metasearch still, brc-feedback doc |

The nineteen merges, in descending order of care needed:

`hub-provider.tsx` · `content.ts` · `hub-apps.ts` · `settings-app.tsx` ·
`mobile-browser.tsx` · `icon-rail.tsx` · `types.ts` · `wallet-app.tsx` ·
`main-view.tsx` · `browser-app.tsx` · `index.ts` · `spaces-panel.tsx` ·
`wallet-views.tsx` · `app-icon.tsx` · `hub-shell.tsx` · `publisher-app.tsx` ·
`releases.ts` · `config.ts` · `command-effects.ts`

## Naming reconciliation

The two trees renamed the same things differently. Ours wins where a live path reads it;
upstream's wins where it is only ever shown to a person.

| Upstream | Here | Resolution |
|---|---|---|
| `MainViewKind = "store"` | `"sites"` | `"store"` — the canvas is the Apps surface again |
| `RailEntry.type = "app"` | `"single"` | ours; an entry holds a ref, and a ref is not always an app |
| `entry.apps: AppSlug[]` | `entry.members: RailRef[]` | ours |
| `installedApps: AppSlug[]` | `builtinApps` + `pinnedSites` | merged: per-profile `connectedApps` over `RailRef` |
| `installApp` / `uninstallApp` | `pinSite` / `unpinSite` | `connect(ref)` / `disconnect(ref)` |
| "Pay & Receive" | — | "Payments" — upstream renamed it "Pay & Get paid"; ours is shorter |
| "badges" | — | "identifiers" (upstream) |
| "Canary" | — | "Dragon" (upstream) |

## Acceptance

- `npx tsc --noEmit` clean in `apps/ui`
- `npm run lint` clean
- `node --test` green for `lib/rail/*.test.mts` and `packages/wallet-core/test/*`
- `NEXT_PUBLIC_DEMO_DATA=0 npm run build` produces a build in which no fixture balance,
  rating, version chip or invented listing can be reached
- the Electron and Expo shells still load the bundled chrome and drive a native tab
- Send, Receive and the spend-authorization sheet still work against a live wallet
