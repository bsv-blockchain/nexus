# Designing Nexus — start here

For whoever is doing UX work in this repository, with Claude alongside.

This is the one document you need on day one. `docs/DECISIONS.md` is the product
argument, `docs/ARCHITECTURE.md` is the machinery; both are worth reading once,
neither is worth reading first.

---

## The prompt

Paste this into Claude Code at the repository root. It is written to be reused —
start every session with it, then say what you want to build.

> You are working on the Nexus UI in `apps/ui` — a Next.js 16 + Tailwind 4 app
> that is the chrome for a BSV wallet and browser, shipped inside an Electron
> shell on desktop and an Expo shell on mobile.
>
> Before you change anything, read `docs/DESIGN-HANDOVER.md`, then
> `apps/ui/lib/surfaces.ts` and `apps/ui/lib/data-mode.ts`. Those two files
> decide what any given build is allowed to show, and most mistakes here are
> mistakes about them.
>
> Rules that are not negotiable:
> - **Copy lives in `apps/ui/lib/data/content.ts`.** Never hard-code a
>   user-visible string in a component.
> - **Fixtures live in `apps/ui/lib/data/`.** A screen reads them through the
>   accessors in `lib/data/index.ts`, never by importing a table directly.
> - **Never invent a number a real build could not know.** Balances, ratings,
>   version chips, "updated 3 days ago" — if a shipping build has no service that
>   answers, the value is demo-only and must be behind `DEMO_SURFACES`. This is
>   the single rule this codebase cares most about.
> - **Do not touch anything under `packages/`, `apps/desktop` or `apps/mobile`**
>   unless I ask. That is wallet, shell and native code.
> - The live wallet paths — `lib/wallet-live.ts`, `lib/wallet-data.ts`,
>   `lib/pay-data.ts`, `components/apps/wallet/pay-flow.tsx`,
>   `components/apps/wallet/transactions.tsx` — spend real money. Leave them
>   alone unless the task is explicitly about them.
>
> Start the dev server with `npm run web` and verify your work in the browser
> before telling me it is done. Run `npx tsc --noEmit` and `npm run lint` from
> `apps/ui` before you finish.
>
> Today I want to: **‹what you want›**

---

## Three ways to run it, and when each is the right one

### 1. `npm run web` — the design loop

```bash
npm run web
```

Every app, every fixture, no wallet. This is where nearly all UX work happens:
hot reload, all nineteen surfaces reachable, nothing that can lose money. If you
are moving pixels, writing copy, or building a screen, stay here.

To put it in front of somebody:

```bash
npm run web:deploy          # a preview URL, noindex, one per run
npm run web:deploy -- --prod
```

### 2. `npm run dev:shell` — desktop, with a real wallet

Two terminals:

```bash
npm run dev:wallet    # the chrome, fixtures OFF, narrowed to Wallet + Browse
```
```bash
npm run dev:shell     # Electron, pointed at that dev server
```

You get hot reload **and** a real wallet: real balance, real send and receive,
real browser tabs in a native layer. Use it when the thing you are designing
touches money, tabs, or anything the shell provides.

**The chrome alone cannot do this.** `resolveDataMode()` goes live when
`window.nexusHost.has('wallet')`, which only a shell provides, and the wallet
refuses to fall back to fixtures — so a live-mode page in a plain browser is an
empty screen, correctly. Layout and copy work there. A balance does not.

To work on one surface at a time:

```bash
NEXT_PUBLIC_DEMO_DATA=0 NEXT_PUBLIC_SURFACES=identity,browser npm run ui:dev
```

`NEXT_PUBLIC_SURFACES` can only ever narrow — it cannot make a demo surface
appear in a live build. Keep `browser` in the list; it is the rail's fallback.

### 3. `npm run ios` — mobile, in the simulator

```bash
npm run ios          # or: npm run android
```

Builds the Expo dev client and boots the simulator. Slower than the other two —
minutes, not seconds — so use it to *check* a design rather than to iterate on
one. It is the only place to see the mobile browser chrome, the tab-switcher
deck, the bottom bar and the sheets behave for real.

To point the simulator at your local dev server instead of the bundled chrome,
so you get hot reload there too:

```bash
EXPO_PUBLIC_CHROME_URL=http://localhost:3000 npm run ios
```

Claude can drive the simulator directly — ask it to *"run the app in the iOS
simulator and show me the Payments screen"* and it will boot, build, screenshot
and tap through without you leaving the terminal.

If a build complains that the native projects disagree with `app.json`:

```bash
npm run prebuild
```

---

## The one rule worth internalising

**A build must not show a number it cannot stand behind.**

Two switches enforce it, and they answer different questions:

| | |
|---|---|
| `NEXT_PUBLIC_DEMO_DATA` | whether this **build** carries the demo surfaces at all |
| `resolveDataMode()` | which source **this session** reads from |

So: the web preview shows everything and is honest about being a demo. A shipped
binary carries Browse and Wallet, and where it has no answer it shows an empty
state rather than a plausible one. `apps/ui/lib/surfaces.ts` holds the list and
the reasoning; the bar for adding to it is a service that answers.

If you are designing something with no backend yet — and most of the roadmap is —
that is fine and expected. Build it against fixtures, keep it demo-gated, and
`docs/PROMOTING-DEMO-SURFACES.md` is the path from there to shipped.

---

## Where things live

```
apps/ui/
  app/                  layout, globals.css — the theme tokens
  components/
    hub/                the shell: rail, tabs, profiles, Apps surface, panes
    apps/               one directory per app surface
  lib/
    data/content.ts     EVERY user-visible string
    data/               typed fixtures, ~9k lines
    surfaces.ts         what a build ships
    data-mode.ts        demo vs live
    rail/               the rail model — pure, tested, has its own Node tests
```

Things that will bite if you do not know them:

- **The rail holds two kinds of thing.** A built-in app (`{kind:"app"}`) and a
  connected website (`{kind:"site"}`). They stay distinct in the type on purpose
  — see `docs/DECISIONS.md` §10.
- **Profiles own a handle, a wallet and their own connected apps.** A profile is
  an identity context, not a colour scheme.
- **`components/hub/origin-label.tsx` exists for a reason.** Never render a
  hostname with `truncate`; text-overflow clips the tail, and the tail is the
  part that says who the site really is.
- **Settings › Wallet is live**, not a mock. Everything else in Settings is drawn
  against `lib/settings-store.ts`.

---

## Before you hand work back

From `apps/ui`:

```bash
npx tsc --noEmit
npm run lint
```

From the root, if you touched anything outside `apps/ui`:

```bash
npm test
npm run check
```

And the check that catches the mistake this codebase most cares about — build it
the way a user gets it, and see whether anything invented survived:

```bash
NEXT_PUBLIC_DEMO_DATA=0 npm run build --prefix apps/ui
```

---

## Reading, in order of usefulness

| | |
|---|---|
| `docs/DECISIONS.md` | what was settled and why — start at §10 and §12 |
| `docs/PROMOTING-DEMO-SURFACES.md` | how a drawn screen becomes a shipped one |
| `docs/SPEC-design-catchup.md` | why the Apps surface and Profiles look like this |
| `docs/ARCHITECTURE.md` | the shells, the seams, why Electron and Expo |
| `docs/RELEASING.md` | how a build reaches a person |
