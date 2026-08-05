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
- **release-mobile.yml** — `eas build --profile production --auto-submit` for both
  stores (credentials and build numbers live on EAS), plus a signed sideloadable
  APK attached to the same draft release

Publishing the draft GitHub release stays a human act. Store review flows are
watched on the EAS/App Store/Play dashboards, not in Actions.

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
