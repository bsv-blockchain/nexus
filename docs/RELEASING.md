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

## Cutting a release

```bash
npm run release                 # release the current version
npm run release -- --minor      # re-stamp as next minor first
npm run release -- --major      # re-stamp as next major first
npm run release -- --dry-run    # print every step, do nothing
```

The script:

1. refuses to run unless you are on `main`, clean, and in sync with `origin/main`
2. re-stamps if asked (`release: vX.Y.Z` commit)
3. tags `vX.Y.Z`, pushes `main` + the tag
4. immediately rolls every metadata file to `X.Y.(Z+1)` and pushes
   (`chore: begin vX.Y.(Z+1) development`)

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
