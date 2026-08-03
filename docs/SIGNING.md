# Nexus iOS signing and credentials

Goal: four engineers can produce **dev and production** iOS builds, builds run
**locally** (speed, and no paid cloud-build tier), and credentials are shared
**through Expo** rather than passed around as `.p12` files.

That is achievable today. One live bug stands in the way on macOS 26 — read
[Blocker](#blocker-macos-26-tahoe-breaks-eas-build---local-ios) before promising
anyone a build.

## The model

| Thing | Where it lives |
|---|---|
| Distribution certificate + provisioning profiles | **EAS servers**, under the `bsvb` organization |
| Build execution | **Each engineer's Mac** (`eas build --local`) |
| Apple Developer team access | Only the person who *generates* credentials |
| App Store Connect app record | Created once, interactively |

`eas build --local` with `credentialsSource: "remote"` (the default, set explicitly
in `apps/mobile/eas.json`) does this at build time: downloads the `.p12` from EAS into
a **temporary keychain** in `os.tmpdir()`, writes the profile to
`~/Library/MobileDevice/Provisioning Profiles/<uuid>.mobileprovision`, builds, then
deletes both. Nothing lands in anyone's login keychain and no credential file is ever
committed or emailed.

Expo docs, verbatim: *"the only communication with EAS servers is: to make sure
project @account/slug exists; if you are using managed credentials to download them."*

### Who needs what

- **All four engineers** need: an Expo account in the `bsvb` org with the **Developer**
  role or higher (Developer's stated scope includes "manage credentials"), Xcode,
  CocoaPods, fastlane, Node. They do **not** need Apple Developer team membership.
- **One person** (the credential owner) needs Apple team access — **Account Holder or
  Admin** — to generate credentials the first time. Expo docs confirm: after generation,
  *"it's no longer necessary to have access to the Apple Developer team to start a
  build."* Everyone else answers `N` at the Apple login prompt and EAS reuses the
  stored credentials.
- Expo's **Free** plan lists **Unlimited** members and shows "Organization-wide app
  credential management" as included. So four seats cost nothing.

## One-time setup (credential owner)

```bash
cd apps/mobile
eas login                         # as the bsvb org
eas init                          # creates the EAS project, writes extra.eas.projectId
eas credentials --platform ios    # → Build Credentials → "All: Set up all required credentials"
```

There is **no standalone "add a provisioning profile" menu item** — profiles are created
by "Set up all required credentials" or automatically during a build.

Then, for submissions without an interactive Apple login every time:

```bash
eas credentials --platform ios    # → "Set up your project to use an API Key for EAS Submit"
```

Note: creating a *new* App Store Connect API key is **blocked in `--non-interactive`
mode** (eas-cli throws `"A new App Store Connect API Key cannot be created in
non-interactive mode."`). Create it interactively once; CI can then consume it via
`EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` / `EXPO_APPLE_TEAM_ID`.

### Reuse the existing distribution certificate

Expo's credential-limits table gives **2 distribution certificates per account**; Apple
publishes no number and community reports say ~3. Treat it as a small shared pool.

A distribution certificate is **per team, not per app** — provisioning profiles are the
per-app part, and those are unlimited. So Nexus should **reuse the certificate BSV
Browser already uses** rather than minting a second one and spending the pool.

## Per-engineer setup

```bash
npm install
cd apps/mobile
eas login                                                    # or export EXPO_TOKEN=…
eas build --platform ios --profile production --local        # credentials arrive from EAS
```

Local builds **ignore** the `image`, `node`, `yarn`, `fastlane`, `cocoapods` and `ndk`
fields in `eas.json` — that is documented and silent. Xcode version is whatever each
engineer's `xcode-select` points at, so pin it socially or with a check-in script, or
four machines will drift.

## Blocker: macOS 26 (Tahoe) breaks `eas build --local` iOS

**This machine is macOS 26.6.** eas-cli builds into an ephemeral keychain that does not
carry Apple's WWDR/Root CA trust chain, then verifies the identity with
`security find-identity -v -s "(<teamId>)" <keychainPath>`. On macOS 26 the `-v`
(valid-identities-only) filter rejects the imported certificate and the build fails
claiming the certificate is missing.

- The `-v` flag is **still present, unpatched**, in eas-cli `v21.4.0` — the current npm
  release.
- The tracking issue (eas-cli #3678) was **auto-closed by a stale bot on 2026-07-13
  without a fix**, so "closed" here does not mean "fixed."
- Setting `credentialsSource: "local"` does **not** avoid it — the same keychain code
  path runs either way.

Workaround in circulation: patch the cached `@expo/build-tools` `keychain.js` to drop
the `-v` flag. Before committing the team to local production builds, **one engineer
should run a real `--local` production build end to end and confirm**. Until that
passes, the fallback is a cloud build (Free plan: 15 iOS builds/month, 1 concurrency)
or a plain Xcode archive.

This is the single highest-risk item in the plan, and it is environmental, not
architectural.

## Submission

`eas submit` accepts a locally produced archive — confirmed in eas-cli source, where
`--path` is defined as *"Path to the .apk/.aab/.ipa file"*:

```bash
eas submit --platform ios --path ./build.ipa
```

It does not care whether the `.ipa` came from EAS Build, `--local`, or a hand-rolled
Xcode archive. With the ASC API key stored against the project, any teammate logged
into the Expo org can submit — which retires the manual Transporter step.

**The app record is the exception.** Creating a new App Store Connect app record is
*not* supported via the API key — eas-cli's `ensureAppExists.ts` carries the literal
comment `Does not support App Store Connect API (CI)` and requires an interactively
authenticated Apple ID. So:

1. Create the app record once (interactive `eas submit`, or by hand in App Store Connect).
2. Put its Apple ID number in `eas.json` as `submit.production.ios.ascAppId` — documented
   as *"When set, results in skipping the app creation step."*

`--path`, `--id`, `--latest` and `--url` are mutually exclusive, and `--path` cannot be
combined with `--platform all`.

## Bundle identifier — decided

**`org.bsvassociation.nexus`** (iOS `bundleIdentifier` and Android `package`), matching
the shipped `org.bsvassociation.browser` and the "BSV Association" Apple team. Settled
2026-08-03, before any App Store Connect record exists — which is the only cheap moment
to settle it.

## Not verified

Recorded so nobody treats inference as fact:

- **That `--local` builds consume zero build credits/minutes/concurrency.** Architecturally
  obvious (the build runs on your Mac, not Expo's workers) but stated nowhere in Expo's
  docs or pricing page. The Free plan's "15 iOS builds" is the *cloud* allowance.
- **The real distribution-certificate limit.** Expo's own docs say 1 in prose and 2 in a
  table on the same page; Apple publishes no number.
- Whether a **Viewer**-role member can read stored credentials, versus being blocked.
