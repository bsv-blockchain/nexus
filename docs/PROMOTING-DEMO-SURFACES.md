# Promoting a demo surface

Status: **process**, agreed 2026-08-11.

`apps/ui` carries nineteen app surfaces. Two are real — Browse runs native WebViews,
Wallet spends real satoshis through `@nexus/wallet-core`. The other seventeen are drawn
against ~9k lines of typed fixtures in `lib/data` and reachable only when
`NEXT_PUBLIC_DEMO_DATA` is on (`lib/surfaces.ts`, `lib/data-mode.ts`).

That flag has so far been a way of *not* shipping something. This document makes it a
waiting room with a door on the far side.

## The four stages

A surface is always at exactly one of these, and the stage is recorded in
`lib/data/roadmap.ts` next to the feature it describes.

### 1. Drawn

Somebody designed it. It renders against fixtures, it is reachable in demo builds, and
nothing behind it exists. Every surface that is not Browse or Wallet is here today.

Cost of being wrong: a screenshot.

### 2. Validated

The idea has been tested against people who would use it, and against the protocol work
it would need. **A surface does not leave this stage on enthusiasm.** It leaves when
three questions have written answers:

- **Who asked for it?** Named users, a support thread, a partner conversation, a roadmap
  vote with backers on it. "It would be cool" is not an answer.
- **What has to exist first?** The BRCs, the services, the key material. Written as a
  dependency list, because that is usually what decides the phase — a feature is in Now
  because everything else leans on it, not because it is easy. `lib/phase.ts` already
  records `impact`, `effort` and `depends` per feature for exactly this argument.
- **What does it cost to be wrong?** A surface that spends money, signs something, or
  publishes on someone's behalf has a different bar from one that lists things.

Artefact: a section in `docs/` — a spec, not a ticket.

### 3. Built

The service behind it exists and answers. This is the stage the flag was invented for:
the surface has a real backing, but it is not yet reachable in a shipped build.

Rules, all of them learned the expensive way:

- **The fixture path and the live path are the same component.** `wallet-app.tsx` is the
  worked example: one screen, `resolveDataMode()` deciding where the rows come from, and
  the live path refusing to fall back to fixtures when the service is silent. A second
  component for the live version means two designs that drift.
- **A live surface with no service shows nothing, not zeros.** A `$0.00` is a claim.
- **Anything that can only be a fixture is guarded, not defaulted.** 24-hour price moves,
  ratings, review counts, "updated 5 days ago" — a live device does not know these, and
  rendering a neutral value answers as if it did. `useHolding`'s `showTrend` is the
  pattern.
- **Tests before the flag flips.** Whatever `node --test` can reach without React
  (`lib/rail/*.test.mts` is the model), plus a manual pass on both shells.

### 4. Shipped

Reachable with `NEXT_PUBLIC_DEMO_DATA=0`. Two ways in, and the choice is a real one:

**a. Into the binary.** Add the slug to `SHIPPED` in `lib/surfaces.ts`. Appropriate when
the surface needs the wallet's keys directly, needs to work offline, or is part of what
Nexus *is* — Wallet, Identity, Settings, Browse.

The cost: it ships on the App Store's schedule, it is reviewed by Apple and Google, and
every user carries it whether or not they want it.

**b. As a web app somebody connects.** Deploy it as an ordinary site, talk to the wallet
over `window.nexus` (BRC-100), and let a user connect it from the Apps surface like any
other web app. It arrives in their rail with an origin-scoped grant against their
profile's wallet, and it updates when its authors deploy rather than when we release.

The cost: it needs network, and it is subject to the same permission prompts as any
third-party origin — which is the point.

**Prefer (b).** It is the cheaper mistake, it ships on its own schedule, it proves the
provider seam works by using it, and a surface that cannot survive as a connected web app
probably has not earned a place in the binary. Roadmap, Market, Learn, Publisher and Vote
are all better as (b) than as (a).

Reach for (a) when the answer to "why can this not be a website?" is a key, an offline
requirement, or the OS.

## Promoting one, end to end

1. Open the entry in `lib/data/roadmap.ts`; set its stage and record why.
2. Write the spec in `docs/SPEC-<surface>.md` — the three validation questions answered,
   the BRCs it depends on, the failure modes.
3. Build the service. If it is (b), it is its own repository.
4. Wire the surface: one component, `resolveDataMode()` at the seam, guards on every
   fixture-only field.
5. Tests. Node tests for the pure parts; a manual pass on iOS, Android, macOS.
6. Ship: either `SHIPPED` in `lib/surfaces.ts`, or a deployment and a listing on the Apps
   surface.
7. Delete the fixtures the surface no longer reads, and say so in the commit.

## What stays demo forever

Some surfaces exist to make the product legible in a conversation, and that is a real job.
The onboarding guides, the phase switcher (`Now` / `Next` / `Later`), and the seeded
profiles are demo devices by design. They are not waiting for a service, and nothing here
applies to them.

## Current stages

| Surface | Stage | Route out |
|---|---|---|
| Browse | shipped | in the binary — it is the browser |
| Wallet | shipped | in the binary — it holds the keys |
| Settings (wallet section) | shipped | in the binary — keys, network, BRC-157 backup |
| Identity | drawn | (a) — certificates are key material |
| Messages | drawn | (b) — needs MessageBox, no key requirement beyond signing |
| Roadmap | drawn | (b) |
| Market, Mail, Vault, Vote, Publisher, Signer, Learn, Baskets, Attestations, Tx viewer, Connect | drawn | (b) |
