# Releasing Nexus

One version number covers all five platforms. It lives in five metadata files, is
stamped by one script, is displayed in the chrome's bottom-left rail (hover it for
shell/platform), and is what users quote in bug reports.

Nothing publishes on merge to `main`. The only release trigger is a `vX.Y.Z` tag.

## During development: build for one platform

```bash
npm run build:mac       # signed .app in apps/desktop/out (one-time keychain "Always Allow")
npm run build:win       # win-unpacked in apps/desktop/out
npm run build:linux     # linux-unpacked in apps/desktop/out
npm run build:ios       # EAS local dev-client build
npm run build:android   # EAS local dev-client build
npm run desktop         # Electron shell against the last ui:bundle
npm run ios / android   # Expo dev client
```

Dev builds carry the NEXT patch version (the roll happens right after each tag), so
a build handed to a tester can never claim to be a released version.

### Local mobile builds and the prebuild trap

`apps/mobile/ios` and `apps/mobile/android` are gitignored prebuild output. **When
either exists, Expo and EAS read the native values and ignore `app.json`** — so a
stale directory silently overrides every file `tools/version.mjs` stamps.

This has already cost one App Store submission: a local IPA shipped
`CFBundleVersion 1` / version `0.0.1` from a months-old prebuild while `app.json`
said `0.1.0`, and App Store Connect rejected it with *"The bundle version must be
higher than the previously uploaded version: '1'"*.

`npm run build:ios` / `build:android` now refuse to run when the native projects
disagree with `app.json`. When that fires:

```bash
npm run prebuild        # expo prebuild --clean, in apps/mobile
```

Cloud builds — everything CI does — were never affected: `.easignore` keeps both
directories out of the archive, so EAS prebuilds fresh from `app.json` every time.
Store build numbers (`CFBundleVersion` / `versionCode`) come from EAS's remote
counter with `autoIncrement`, which only works on cloud builds for the same reason.
**Prefer cloud builds for anything you intend to submit.**

## Rehearse the release, before spending a version number

A tag cannot be un-cut. Both release workflows therefore accept a **branch** ref as a
rehearsal: every leg builds and signs exactly as a release does, and nothing is
published, submitted or attached.

```bash
gh workflow run release-desktop.yml --ref my-branch   # mac/win/linux, signed + notarized
gh workflow run release-mobile.yml  --ref my-branch   # AAB, IPA, APK — no store submission
```

The binaries land in each run's **Artifacts** panel. What a rehearsal deliberately
does NOT do: create or touch a GitHub release, submit to TestFlight, or push to Play
internal testing. On mobile that matters twice over — a submitted TestFlight build
consumes a build number and becomes visible to testers, and neither can be undone.

Rehearse whenever the packaging, signing, certificate or store-credential path has
changed. Both platforms have already spent a version number learning this the other
way: `v0.1.0` died on desktop because `apps/desktop/build` had never been committed,
and on mobile because a Google service account could not be set up non-interactively.
A rehearsal costs runner minutes; a burnt version number costs a version number.

## Cutting a release

`main` is protected — changes land through pull requests, and most of the team
cannot bypass that. `release.mjs` never pushes `main` directly; it only pushes
**tags** (not branch pushes, so protection doesn't apply) and opens **PRs** for
the two commits that do need to land on `main`.

```bash
npm run release                 # release the CURRENT version
npm run release -- --minor      # open a PR re-stamping the next minor — see below
npm run release -- --major      # open a PR re-stamping the next major
npm run release -- --version 2.0.0   # open a PR re-stamping to an exact version
npm run release -- --dry-run    # print every step, do nothing
```

**Plain release** (no flags — the common case, since development already runs as
the version about to ship):

1. refuses to run unless you are on `main`, clean, and in sync with `origin/main`
2. refuses if the tag already exists — on origin (shipped, pick the next version)
   or only locally (a previous run died mid-release; `git tag -d vX.Y.Z` and retry)
3. tags `vX.Y.Z` and pushes the **tag** — this is what fires CI
4. opens a PR rolling every metadata file to `X.Y.(Z+1)` and enables auto-merge
   (`chore: begin vX.Y.(Z+1) development`) — **merge it promptly**: until it lands,
   `main` still carries the just-released version number

**Re-stamp first** (`--minor` / `--major` / `--version`): the tag has to point at a
commit that already carries the new number, and getting a commit onto `main` means
a PR. So these flags open the re-stamp PR and **stop**:

1. opens a PR (`release: vX.Y.Z`) and enables auto-merge
2. merge it
3. run `npm run release` again with no flags — the re-stamped version is now
   current, so this is a plain release

If your repo has auto-merge disabled, both PR types just wait for a human to
approve and merge — that's the branch protection working as intended, not the
script failing.

The tag then drives CI:

- **release-desktop.yml** — signed + notarized mac dmg/zip, signed Windows
  installer (DigiCert), GPG-signed Linux AppImage/deb → attached to a **draft**
  GitHub release `vX.Y.Z`
- **release-mobile.yml** — production builds for both stores on EAS (credentials
  and build numbers live there). **iOS auto-submits to TestFlight**, and **Android
  now auto-submits to Play's internal testing track** — the service account exists
  and its key is in EAS credentials, scoped so that "Release to production" is not
  granted. The AAB and a signed sideloadable APK are attached to the draft GitHub
  release as well.

  Promotion out of internal testing stays a human act, by design and now also by
  permission: the service account cannot release to production even if asked.

  **The artifact URL comes from `eas build:view`, not from `eas build --json`.**
  Under `--auto-submit` the streaming command emits its build record before the
  artifact is published — every field present, `artifacts` empty — while the very
  same build queried afterwards carries both `buildUrl` and
  `applicationArchiveUrl`. This took the `aab` job red on v0.2.0 and again on
  v0.2.1, both times *after* the build and the store submission had succeeded, so
  what failed was the attach step and not the release. Both legs now read the id
  out of `build.json` and ask for the finished build.

Publishing the draft GitHub release stays a human act. So does promotion out of
internal testing / TestFlight.

## Publishing is what ships the desktop update

Desktop clients update themselves from the newest **published** GitHub release.
electron-updater cannot see a draft, so cutting a tag builds the artifacts and
changes nothing for anybody running Nexus; publishing the draft is the moment
every desktop install starts converging on it. That gate is deliberate — it is
the last point at which a release can be abandoned without recalling anything.

What makes it work, and what breaks it:

- `latest.yml`, `latest-mac.yml` and `latest-linux.yml` are built by
  electron-builder and attached alongside the installers. Each names an artifact
  and its sha512, and electron-updater refuses an update whose download does not
  hash to the declared value. **A release missing them ships no update at all.**
- **Nothing may rewrite an artifact after electron-builder has hashed it.**
  Windows signing runs inside the build through `apps/desktop/build/win-sign.cjs`
  for exactly this reason; a post-build signtool step leaves latest.yml
  describing the unsigned installer and every Windows client aborts with
  "sha512 checksum mismatch". bsv-desktop shipped that twice — see its
  `scripts/repair-published-update-metadata.mjs`, which exists to unbreak clients
  after the fact. The Windows leg now verifies the hash in latest.yml against the
  installer before the release job runs.
- macOS updates ride the **zip**, not the dmg, and require the app to be signed
  and notarized. Both are already true of a release build.
- **Linux AppImage updates; .deb does not.** electron-updater cannot replace a
  file the package manager owns, so on a deb install the updater never starts and
  Settings › About links to the releases page instead.

Because the signing path is now part of the update path, `gh workflow run
release-desktop.yml --ref my-branch` is worth more than it used to be: a
rehearsal builds and signs exactly as a release does, and the hash gate runs. Store review flows are watched on the EAS, App Store
and Play dashboards, not in Actions.

## What a release asks of you

| | |
|---|---|
| merge the roll-forward PR | every release |
| ~~upload the AAB to Play~~ | now automatic — lands in internal testing |
| publish the draft GitHub release | every release |
| promote out of internal testing / TestFlight | when you want testers on it |

## Version plumbing

```bash
node tools/version.mjs              # print, fail on drift
node tools/version.mjs --check      # CI gate; add --tag v1.2.3 to pin
node tools/version.mjs --set 1.2.3  # stamp everywhere
```

Files carrying the version: root/desktop/mobile/ui `package.json`s +
`apps/mobile/app.json` (`expo.version` — what iOS/Android actually ship and what
the mobile shell reports at run time). Store build numbers are EAS-owned
(`appVersionSource: remote`, `autoIncrement`) and deliberately not in git.

Secrets the workflows need: the 12 signing secrets shared with bsv-desktop
(Apple cert/notarization, DigiCert, GPG) plus `EXPO_TOKEN` for EAS.
