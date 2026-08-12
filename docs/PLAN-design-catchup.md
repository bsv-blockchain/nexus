# Design catch-up — implementation plan

Companion to `docs/SPEC-design-catchup.md`. Branch `feat/design-catchup`.

Reference trees, produced by `git worktree` off `/Users/personal/git/_ref/bsvnexus-upstream`:

- `up-base` — `91b7524`, the divergence point
- `up-head` — `127cb6c`, upstream today

Rule for every phase: **`npx tsc --noEmit` clean before moving on.** The merge is done in
dependency order so that never means stubbing.

## Phase 1 — data and stores

Nothing renders yet; everything later depends on these.

New: `lib/phase.ts` · `lib/settings-store.ts` · `lib/wallets-store.ts` ·
`lib/repositories-store.ts` · `lib/collapsed-repos.ts` · `lib/store-visits.ts` ·
`lib/roadmap-effects.ts` · `lib/brand.ts` · `lib/scroll-direction.ts` ·
`lib/use-is-desktop.ts`

New data: `lib/data/categories.ts` · `handles.ts` · `languages.ts` · `licence.ts` ·
`onboarding.ts` · `roadmap.ts` · `search-engines.ts` · `shortcuts.ts`

Restore: `lib/data/repositories.ts` · `lib/data/collections.ts`

Wholesale: `lib/commands.ts` · `lib/data/downloads.ts` · `identity.ts` · `messages.ts` ·
`spaces.ts` · `wallet.ts`

Merge: `lib/data/types.ts` · `content.ts` · `hub-apps.ts` · `index.ts` · `releases.ts` ·
`lib/config.ts` · `lib/command-effects.ts`

`hub-apps.ts` is the sharp one. Ours dropped `publisher`, `category`, `createdAt` and
`AppCategory` when the store went; the store needs them back, and they carry a
`demoOnly` marker so `lib/surfaces.ts` can strip the unverifiable ones from a live build.

Assets: `public/onboarding/*.png` (16) · `public/icons/roadmap.svg` ·
`open-protocol-labs.svg` · `public/search/metasearch.png` · `docs/brc-feedback.md`

## Phase 2 — chrome and QoL

Small, self-contained, no model changes.

New: `qr-block.tsx` · `share-backdrop.tsx` · `step-mark.tsx` · `dot-matrix.tsx` ·
`dev-badge.tsx` · `app-help-bar.tsx` · `app-menu.tsx` · `split-picker.tsx` ·
`inspector.tsx` · `downloads-pane.tsx` · `licence-pane.tsx` · `settings-panes.tsx` ·
`phase-switcher.tsx`

Wholesale: `app/globals.css` · `theme-picker.tsx` · `theme-provider.tsx` ·
`popover-menu.tsx` · `detail-pane.tsx` · `share-modal.tsx` · `release-notes.tsx` ·
`browser-nav.tsx` · `browser-settings-menu.tsx` · `space-content.tsx` ·
`space-icon.tsx` · `space-menu.tsx` · `app-context-sidebar.tsx` ·
all eleven `components/apps/messages/*` files · `connect-app.tsx` · `mail-app.tsx` ·
`market-app.tsx` · `messages-app.tsx` · `signer-app.tsx`

Merge: `app-icon.tsx` (ours added `SiteTile`) · `hub-shell.tsx` · `publisher-app.tsx` ·
`browser-app.tsx`

## Phase 3 — hub provider

The hinge. Everything after this reads the shape decided here.

- `MainViewKind`: `"app" | "store" | "profiles" | "settings"` — `"sites"` folds back into
  `"store"`, which is now the Apps surface
- per-profile connections: `connectedFor(spaceId): RailRef[]`, `connect(ref, spaceId?)`,
  `disconnect(ref, spaceId?)`, over upstream's `Record<spaceId, …>` storage with its
  flat-array migration kept
- keep ours: `pinnedSites`, `pinSite`, `unpinSite`, `renameSite`, `activeRef`,
  `setActiveRef`, the `RailEntry`/`RailRef` re-exports, `writeAppToUrl`'s no-op guard
- take upstream's: `VIEW_PARAM` / `SPLIT_PARAM` deep links, `splitApp`, `moveItemToSpace`,
  `moveTabToSpace`, roadmap filter state, the widened `detailPane` union, the widened
  `IdentitySection` and `SettingsSection`
- keep ours: the `"wallet"` settings section, and `openLinkInBrowser`'s `ref` argument

Then `icon-rail.tsx` and `main-view.tsx` follow it, and `mobile-browser.tsx` after those.

## Phase 4 — Settings

`settings-app.tsx` merge + six new panels (`permissions-panel` · `autofill-panel` ·
`shortcuts-panel` · `per-sender-tolls` · `beta-dialog` · `blocks`) + `site-settings-pane`
+ `mobile-settings`. Our `settings-wallet.tsx` section is re-attached and unchanged.

## Phase 5 — Identity

`identity-app.tsx` wholesale, plus `identity/handle-list.tsx` · `handles-panel.tsx` ·
`share-sheet.tsx`. The wallet-keys block at the foot of Identifiers reads
`lib/wallets-store.ts` in demo mode and the live wallet's own identity key otherwise.

## Phase 6 — Wallet

`wallet-switcher.tsx` and `token-picker.tsx` in; `wallet-flows.tsx` wholesale;
`wallet-app.tsx` and `wallet-views.tsx` merged.

Every live path survives verbatim: `useActivity`, `useHolding`, `payAvailable`,
`hidePayActions`, `liveActivity`, the `PaySheet`, `Transactions`, and the
`LIVE_SECTIONS` narrowing of `WALLET_SECTIONS`. The switcher renders one wallet and no
picker when `resolveDataMode() === "live"`.

## Phase 7 — Profiles

`profiles-sidebar.tsx` · `profile-connections.tsx` · `connect-picker.tsx` ·
`space-drag.tsx`; `profiles-manager.tsx` and `spaces-panel.tsx` merged.

## Phase 8 — Apps surface

`app-store.tsx` · `repo-section.tsx` · `store-filter.tsx` · `app-collections.tsx` ·
`app-detail-panel.tsx` · `app-permission-sheet.tsx` · `repositories-button.tsx` ·
`app-onboarding.tsx` · `web-app.tsx`, all restored against `RailRef`.

Connecting a built-in app adds it to the profile's rail. Connecting a web app pins the URL
*and* records an origin grant. Ratings, versions and freshness render only under
`DEMO_SURFACES`.

## Phase 9 — Roadmap

`roadmap-app.tsx` · `roadmap/*` (5) · `messages/roadmap-card.tsx`, demo-gated.

## Phase 10 — verification and docs

`tsc` · `lint` · `node --test` · a `NEXT_PUBLIC_DEMO_DATA=0` build audited for reachable
fixtures · both shells loading the bundled chrome · a live Send/Receive pass.

`docs/DECISIONS.md` gains the Apps amendment; `README.md` and `docs/ARCHITECTURE.md` are
checked for statements the merge made false.
