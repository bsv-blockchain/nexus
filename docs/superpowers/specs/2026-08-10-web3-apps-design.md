# SPEC: Web3 Apps — the rail becomes bookmarks, not a store

Status: agreed 2026-08-10, not implemented. Scope of one implementation pass.
Supersedes the app-store surface in `apps/ui/components/hub/app-store.tsx`.

## Why

The Apps section is an App Store rendered around a feature toggle, and both
halves of that are a problem.

`HubAppSlug` (`apps/ui/lib/data/types.ts:12`) is a closed union of fifteen React
surfaces compiled into the binary. "Install" writes a slug to `localStorage` and
draws an icon on the sidebar rail. Nothing is fetched, nothing is stored, no URL
field exists anywhere in the type. The word is decoration.

Around that toggle sits a full distribution surface: Install / Remove buttons,
Installed and Available sections, verified-publisher checkmarks, a "Third-party
developers" filter, an in-app-purchases block with subscription tiers, install
counts, star ratings, reviews, a user-addable repository list
(`repositories-button.tsx`), and copy that reads "You can remove this app any
time from the App Store" (`content.ts:1165`) — Apple's trademark, naming Nexus's
own store.

In a shipping build (`NEXT_PUBLIC_DEMO_DATA=0`) the catalog narrows to `browser`
and `wallet` (`surfaces.ts:39`), so a reviewer sees two cards, one of them
offering to install a screen that is already in the binary.

Meanwhile the thing the product actually wants — a user's frequently-visited
websites reachable from the rail instead of buried in Spaces — does not exist.

This spec does both: deletes the store, and builds the pinned-site rail.

## Decisions taken

| question | decision |
|---|---|
| what the rail holds | two built-in apps (Payments, Browser) + websites the user pinned |
| offline storage of pinned sites | **out of scope**, recorded as Phase 2 with its compliance cost (§7) |
| a browsable directory | **no** — a small default set only, Safari's Favorites model |
| the web preview's thirteen fictional apps | kept reachable in demo builds as pre-seeded pins; the store chrome is deleted from the codebase, not flag-gated |
| launch behaviour | app-like (no URL bar) with a persistent origin chip |
| naming | section is **Web3 Apps**; the subtitle and verbs carry the "these are bookmarks" work |

## 1. Data model and state

`RailEntry` already exists as `{type:'app',slug} | {type:'group',id,name,apps[],color}`
(`hub-provider.tsx:190`). Groups hold `AppSlug[]`, so a folder cannot hold a
site. Widen the reference, not the entry:

```ts
type RailRef =
  | { kind: "app"; slug: AppSlug }      // browser | wallet — in the binary
  | { kind: "site"; id: SiteId };       // a pinned website

type RailEntry =
  | { type: "single"; ref: RailRef }
  | { type: "group"; id: string; name: string; color?: string; members: RailRef[] };

interface PinnedSite {
  id: SiteId;             // opaque, generated locally; not derived from the URL
  title: string;          // user-editable, defaults to the page's <title>
  url: string;            // full launch URL
  origin: string;         // derived from url; never user-editable
  icon?: string;          // fetched favicon, cached as a data URI
  sortOrder: number;
  createdAt: string;
}
```

Pins are **deduped by `url`**. Adding a URL that is already pinned focuses the
existing pin rather than creating a second one — the same check the favourites
path already makes at `hub-provider.tsx:1192`.

`origin` is stored derived and **re-derived on every launch and every navigation**
rather than trusted from storage. It is what the chip renders, so it must not be
settable by anything but the URL itself.

Three pieces of state replace `installedApps`:

- **`builtinApps`** — a constant, not user state. `["wallet","browser"]` in
  shipping builds, the fifteen in demo builds. Nothing removes them.
- **`pinnedSites: PinnedSite[]`** — new `localStorage` key with its own
  `useSyncExternalStore`, following the `INSTALLED_APPS_EVENT` pattern at
  `hub-provider.tsx:497`.
- **`railLayout`** — migrated in the reader: `{type:'app',slug}` becomes
  `{type:'single',ref:{kind:'app',slug}}`, `apps[]` becomes `members[]`. Same
  shape as the slug migration already at `hub-provider.tsx:516`, so an unknown id
  drops rather than throws.

`reconcileRail` reconciles against `builtins ∪ pinnedSites` instead of
`installedApps`.

`HubApp` loses `essential`, `defaultInstalled`, `popularity`, `version` and
`pricing` — every one of them was read only by the store surface and its detail
panel, both of which are deleted in §4. Non-removability stops being a flag and
becomes structural: a built-in is not in `pinnedSites`, so no code path can
remove it.

**Active-entry state.** `activeApp: AppSlug | null` cannot express "a pinned site
is open", so the rail would have nothing to highlight. Replace it with
`activeRef: RailRef | null`, and derive `activeApp` from it for the `kind:'app'`
case so the eleven files that read `AppSlug` keep working unchanged.

Approaches considered and rejected: widening `HubApp` with an optional `url`
(makes every `AppSlug` lookup stringly-typed and lets a website flow into code
that assumes an in-binary screen — that distinction is the whole compliance
argument); and promoting the existing `Favorite` with a `pinnedToRail` flag
(`Favorite` is browser-scoped and per-space, rail entries are global and
cross-space; the first divergence forces the split anyway). `Favorite`'s
drag-a-tab gesture is reused, its type is not.

## 2. Rail and launch

The rail renders `RailRef`s. `{kind:'app'}` resolves through `getHubApp` as
today; `{kind:'site'}` resolves through `pinnedSites` and draws the favicon on
the same `AppTile` geometry, so the rail looks unchanged.

Tapping a site sets `activeRef` to that site and opens it in the native tab layer
through the existing `NativeSiteFrame` path in `browser-app.tsx` — the measured
`<div>` that already drives `tabs.create/setBounds/setActive/destroy`. **No new
shell bridge methods.** The rail is a different way to reach a tab, not a new kind
of tab, so nothing under `apps/desktop` or `apps/mobile` changes in this phase.
(The one change outside `apps/ui` is the `tools/` build assertion in §6.)

The canvas renders app-like: no URL bar, no tab strip, full-bleed to the measured
rect. One persistent element — an **origin chip** top-left showing `origin`
(e.g. `example.com`). Tapping it opens a sheet with the full URL, the scheme
indicator, "Open in Browser", and "Remove from rail". Back and forward come from
the existing `goBack`/`goForward` bridge methods, driven by edge-swipe on mobile
and the trackpad gesture on desktop.

The chip is not decoration. When the wallet substrate is bound to browsed tabs, a
payment prompt can originate from this page, and a chromeless surface would leave
the user unable to see who is asking. **Note the current state honestly:** both
shells still answer `getPublicKey` with a spike constant and throw on
`createAction` (`useTabHost.ts:256`, `tabManager.mjs:49`). The real surface
exists (`packages/substrate/src/browser/cwiHost.ts`, and
`WalletConnectionContext`'s permitted-method list) but is not bound to browsed
tabs. The chip is a constraint for when that lands, not a fix for something live
today.

When it does land, the spend-authorization dialog
(`components/hub/spend-authorization.tsx`) must name the same `origin` the chip
shows, from the same derivation, so the two cannot disagree.

Three ways to pin:

1. drag a tab onto the rail — the gesture at `hub-provider.tsx:1192`, retargeted
2. "Add to rail" in the browser's page menu
3. an "Add a site" URL field on the Web3 Apps surface

## 3. The Web3 Apps surface

`app-store.tsx` (673 lines) is replaced by `web3-apps.tsx`, roughly 200.

Heading **Web3 Apps**. Subtitle: *"Websites you've pinned to your rail. Opening
one opens the website."*

Two sections. No category folders, no sort control, no developer filter.

- **On your rail** — pinned sites. Each row: favicon, title, `origin`, "Remove
  from rail". Title editable inline.
- **Suggested** — defaults not currently pinned. Each row: favicon, title,
  origin, a one-line description, "Add to rail". No ratings, no counts, no
  publisher badge, no price.

**The default set** is at most eight entries, shipped as plain data. On first run
they are **pre-pinned** onto the rail, as Safari ships Favorites — a new user
should not meet an empty rail and have to discover pinning. They are ordinary
`PinnedSite` rows from that moment: removable, renamable, reorderable, with no
special status in the type or in the UI. Removing one moves it back into
Suggested; there is no way to distinguish a shipped default from a user's own pin
afterwards, and nothing should try.

Plus the "Add a site" field (§8 for validation).

Built-ins are **not listed on this screen at all**. They are on the rail
unconditionally and nothing here can affect them, which is the clearest available
statement that they are a different kind of thing.

### Copy

| old | new |
|---|---|
| Install / Uninstall | Add to rail / Remove from rail |
| Installed / Available | On your rail / Suggested |
| "Essential" badge | *removed — non-removability is structural* |
| "Add apps to your Nexus. Installed apps appear in the sidebar rail." | "Websites you've pinned to your rail. Opening one opens the website." |
| "You can remove this app any time from the App Store." | "You can remove any site from your rail at any time." |
| "Installs", "GitHub stars", star ratings, reviews | *removed* |
| "Third-party developers" filter, verified checkmarks | *removed* |

The "App Store" string at `content.ts:1165` is non-negotiable: it is Apple's
trademark naming Nexus's own distribution surface.

## 4. Deletions

- `app-store.tsx` — replaced by `web3-apps.tsx`
- `repositories-button.tsx`, `AppRepository`, `getDefaultRepositories`,
  `suggestedRepositories`, `storageKeys.repositories` — a user-addable
  app-source hostname list is the strongest alternative-distribution signal in
  the codebase, and Phase 1 has nothing for it to serve
- `AppPricing` and the in-app-purchases block — a "Subscription" tag on a
  third-party website invites 3.1.1 scrutiny for revenue Nexus never touches
- reviews, ratings and install counts in `app-detail-panel.tsx`
- `AppDeveloper` and its badges — a verified-publisher checkmark on a website is
  a claim Nexus cannot back
- `app-collections.tsx` persona bundles — meaningless once built-ins are fixed
  and sites are user-pinned; in demo builds the collection rows become plain seed
  data for the pre-seeded pins
- `HubApp.essential`, `.defaultInstalled`, `.popularity`, `.version`, `.pricing`

Demo builds keep the thirteen fictional apps reachable by seeding them as rail
entries, so the designer's screens still demo. The store chrome is deleted from
the codebase rather than flag-gated — `DEMO_SURFACES` gates reachability, not
bundle contents (`data-mode.ts`), so flag-gating would leave store UI compiled
into the shipping binary.

## 5. Permissions and consent

**Pinning grants nothing.** A bookmark is not a grant.

The current model is wrong for a website twice over — wrong moment and wrong
granularity: a 620-line sheet (`app-permission-sheet.tsx`) hands over Identity,
Payments and Data at install time.

Consent moves to first request, keyed on `origin`:

- site calls `getPublicKey` → identity sheet, once per origin, revocable
- site calls `createAction` → the existing spend-authorization path, which
  already prompts above the auto-approve limit
- auto-approve limits stay where they already are, in Settings

The permission sheet is retained, repurposed as that first-request sheet, and
shrinks accordingly. This is also what 4.7.3 requires if Phase 2 ever lands —
per-instance consent rather than a blanket grant — so building it this way now
costs nothing later.

## 6. The compliance position

Stated so it survives the people who made it:

> Nexus is a web browser. Payments and Browser are screens in the binary. Every
> other rail icon is a bookmark the user created, pointing at a website that
> loads over the network and runs in the system web view. Nexus operates no
> catalog, hosts no software, and stores no web app on the device. Guideline 4.7
> governs software an app *offers*; Nexus offers none, so 4.7 does not engage.

Supporting points:

- **2.5.2** — all interpreted code runs in `WKWebView` on iOS and
  `WebContentsView` on desktop. The standard browser exception; never a
  Nexus-owned runtime.
- **3.1.1** — no purchase path exists for third-party sites.
- **5.1** — per-origin, per-capability consent at first request (§5).
- **4.2 / 2.3.1** — the section does something real and hides nothing.

### Tripwires

Named so nobody trips one by accident. Each of these turns 4.7 on:

1. **A browsable directory** of sites. The line between this and §3's default
   set is not size, it is shape. A fixed list of at most eight entries, compiled
   into the binary, with no search, no categories, no pagination and no remote
   fetch, is a browser's starting bookmarks. Add a search field, category
   browsing, or a server that supplies or updates the list, and it becomes a
   catalog Nexus operates — which is offering software. **The default set must
   never be fetched at runtime.**
2. **Repositories returning** — user-addable app sources are an alternative
   distribution channel on their face.
3. **Offline archiving** — Phase 2, §7.

### The 4.7.2 invariant, enforced mechanically

`window.nexus` must never expose camera, radios, share or filesystem to a browsed
page. It is four wallet methods today — `ping`, `getVersion`, `getPublicKey`,
`createAction` (`packages/substrate/src/protocol.js:14`).

Add an assertion to `tools/check-injection-sources.mjs`, which already guards the
injected sources, so growing that list fails `npm run check`. That converts
"may not extend or expose native platform APIs to the software" from a promise
into a build step.

## 7. Phase 2 — offline pinned sites (recorded, not built)

Its price, stated up front so the trade is visible to whoever picks it up:

- **All of 4.7.1–4.7.5 engage**: objectionable-content filtering; in-app
  reporting with timely response; user blocking; a published index of software
  and metadata with **universal links to every site offered**; and an age
  restriction mechanism on verified or declared age.
- **The likely-unavailable path.** Service workers in `WKWebView` require the
  `WKAppBoundDomains` entitlement, capped at ten domains, and enabling it
  restricts script injection to those same domains — which would break
  `window.nexus` everywhere else. **Verify against current iOS before designing
  around this**; it has held since iOS 14 but has not been re-checked here.
- **The viable path.** A shell-side archive, with assets served from a local
  origin per site. Both shells need a scheme handler or an on-device server.
  Substantial work, and it is what "storing downloaded web apps" actually means.

## 8. Error handling

- **Off-origin redirect** — the chip re-derives from the live URL on every
  navigation and shows where the user actually is. It must never keep displaying
  the pinned origin. This is the phishing case, and the reason the chip exists.
- **Unreachable site** — the rail icon dims and the canvas shows a Nexus retry
  state, not a raw web-view error page.
- **URL validation on add** — `https:` only, plus `http:` for `localhost`.
  Reject `javascript:`, `data:` and `file:` explicitly rather than by omission.
- **Favicon fetch fails** — letter tile on the existing `AppTile` geometry.
- **Unknown site id in a persisted layout** — dropped by `reconcileRail`, as an
  unknown slug is today.
- **Storage full** — in-memory for the session, matching the fallback in
  `repositories-button.tsx` before it is deleted.

## 9. Definition of done

Unit tests:

- origin derivation, and re-derivation across a cross-origin redirect
- URL validation, including the three rejected schemes
- rail-layout migration from old persisted payloads (`{type:'app'}`, `apps[]`)
- `reconcileRail` with mixed refs, and with a site inside a group

Build step:

- `check-injection-sources.mjs` asserts the substrate method list has not grown

Gates:

- `apps/ui`: `npm run typecheck`, `npm run build` at `DEMO=0` and at `DEMO=1`
- `npm run check` passes with no new failures

Manual:

- pin via tab-drag, via page menu, via the URL field
- launch a pinned site; the chip shows the real origin
- force a cross-origin redirect; the chip follows
- remove, reorder, and drop a site into a folder alongside an app
- `?data=demo` still shows the thirteen seeded pins

## 10. Out of scope, recorded

- Offline storage of pinned sites (§7).
- Binding the real wallet substrate to browsed tabs. Both shells still answer
  with spike constants; that wiring is its own change, and this spec only
  constrains what it must show the user when it happens.
- Any discovery or directory surface (§6, tripwire 1).
- Per-site data isolation beyond what the web view already gives each origin.
