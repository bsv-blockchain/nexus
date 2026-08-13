# Working on Nexus with Claude

Standing context for every session in this repository. `docs/DESIGN-HANDOVER.md`
is the day-one read and this file does not replace it — it exists so the rules
below do not have to be pasted in by hand each time.

Most work here is UX work in `apps/ui`: a Next.js 16 + Tailwind 4 app that is the
chrome for a BSV wallet and browser, shipped inside an Electron shell on desktop
and an Expo shell on mobile.

Before changing anything, read `apps/ui/lib/surfaces.ts` and
`apps/ui/lib/data-mode.ts`. Those two files decide what a given build is allowed
to show, and most mistakes in this repository are mistakes about them.

## Rules that are not negotiable

- **Never invent a number a real build could not know.** Balances, ratings,
  version chips, "updated 3 days ago" — if a shipping build has no service that
  answers, the value is demo-only and must sit behind `DEMO_SURFACES`. This is
  the single rule this codebase cares most about.
- **Copy lives in `apps/ui/lib/data/content.ts`.** Never hard-code a
  user-visible string in a component.
- **Fixtures live in `apps/ui/lib/data/`.** A screen reads them through the
  accessors in `lib/data/index.ts`, never by importing a table directly.
- **Do not touch `packages/`, `apps/desktop` or `apps/mobile`** unless asked.
  That is wallet, shell and native code.
- **The live wallet paths spend real money.** `lib/wallet-live.ts`,
  `lib/wallet-data.ts`, `lib/pay-data.ts`,
  `components/apps/wallet/pay-flow.tsx`,
  `components/apps/wallet/transactions.tsx`. Leave them alone unless the task is
  explicitly about them.

## Running it

`npm run web` is the design loop — every app, every fixture, no wallet, hot
reload. Nearly all UX work belongs here. `npm run web:deploy` gives a shareable
preview URL per run.

`npm run dev:wallet` plus `npm run dev:shell` in two terminals is desktop with a
real wallet. `dev:shell` points Electron at `http://localhost:3000`, so if
something else holds that port Next falls back to `:3001` and the shell loads the
wrong app. Check the port Next actually prints.

`npm run ios` is the simulator — minutes rather than seconds, so a checking tool
rather than an iterating one. It is the only place the mobile browser chrome, the
tab-switcher deck and the sheets behave for real.

## Before handing work back

From `apps/ui`:

```bash
npx tsc --noEmit
npm run lint
```

`npm run lint` is **not** a CI gate and does not currently pass on a clean
checkout: five React 19 errors (`setState` in an effect, refs during render) sit
in `components/apps/wallet-app.tsx`,
`components/apps/wallet/pay-flow.tsx` and
`components/hub/spend-authorization.tsx` — all live-wallet paths. Judge lint by
whether it reports anything *new*, not by whether it is green.

From the root, if anything outside `apps/ui` changed:

```bash
npm test
npm run check
```

And the check that catches the mistake this codebase most cares about — build it
the way a user gets it, and see whether anything invented survived:

```bash
NEXT_PUBLIC_DEMO_DATA=0 npm run build --prefix apps/ui
```

## Setting up, and two things that will waste an afternoon

Use **Node 24**, the version `.nvmrc` and CI pin. On Node 23 and below,
`packages/wallet-core/test/loader.mjs` imports `registerHooks` from
`node:module`, which does not exist there; three test files abort and take
sixty-odd passing tests down with them — 50 pass on Node 23.4, 117 on Node 24.
The failure looks like broken code and is not.

Install in **two steps**. `apps/ui` is not a root workspace — it is its own npm
project with its own lockfile, because it carries its own React:

```bash
npm ci
npm ci --prefix apps/ui
```

**Do not commit `package-lock.json` churn.** An install can rewrite it for
reasons that have nothing to do with the dependencies:
`legacy-peer-deps=true` in a personal `~/.npmrc` strips every peer entry (~300
lines), and an npm older than the one that wrote it drops the `libc` fields on
Linux optional deps (npm 11.7 does, 11.17 does not). Node 24's bundled npm
writes the lockfile as committed. If `git status` shows a lockfile you did not
mean to change, restore it.

## Landing a change

`main` is protected by the `main-branches` org ruleset — pull request required,
no bypass. Branch, push, open a PR. CI runs `npm run check`, both typechecks,
`npm test` and `npm run ui:build`, each with `if: always()` so one run reports
everything that is wrong rather than the first thing.

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
  — `docs/DECISIONS.md` §10.
- **Profiles own a handle, a wallet and their own connected apps.** A profile is
  an identity context, not a colour scheme.
- **`components/hub/origin-label.tsx` exists for a reason.** Never render a
  hostname with `truncate`; text-overflow clips the tail, and the tail is the
  part that says who the site really is.
- **Settings › Wallet is live**, not a mock. Everything else in Settings is
  drawn against `lib/settings-store.ts`.

## Reading, in order of usefulness

| | |
|---|---|
| `docs/DESIGN-HANDOVER.md` | how to design here — start here |
| `docs/DECISIONS.md` | what was settled and why — §10 and §12 first |
| `docs/PROMOTING-DEMO-SURFACES.md` | how a drawn screen becomes a shipped one |
| `docs/SPEC-design-catchup.md` | why the Apps surface and Profiles look like this |
| `docs/ARCHITECTURE.md` | the shells, the seams, why Electron and Expo |
| `docs/RELEASING.md` | how a build reaches a person |
