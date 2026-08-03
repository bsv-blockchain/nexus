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

## Run every `eas` command from `apps/mobile`

Not the repo root. `eas` resolves both the Expo config and `eas.json` from the current
directory, and the root has neither. Running it there fails with
`eas.json could not be found at /Users/personal/git/nexus/eas.json` — and, worse, does so
*after* creating the EAS project and dropping a stray `app.json` at the root containing
only a `projectId`. That stray file will confuse Expo tooling later, so delete it if it
reappears; the real one is `apps/mobile/app.json`.

The project already exists: **`@bsvb/nexus`**, id `59d9d49d-07e1-455c-8f93-1607a2f54341`,
recorded in `apps/mobile/app.json` under `extra.eas.projectId`. Do not run `eas init`
again — it would offer to make a second one.

`app.json` also pins `"owner": "bsvb"`, so a teammate logged into their personal Expo
account still resolves to the org project instead of silently creating their own.

## One-time setup (credential owner)

```bash
cd apps/mobile                    # ← required, see above
eas login                         # as, or with access to, the bsvb org
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

## The macOS 26 (Tahoe) concern — cleared

A real, unpatched bug exists in eas-cli `v21.4.0`: the ephemeral build keychain lacks
Apple's WWDR/Root CA trust chain, and `security find-identity -v -s "(<teamId>)"` can
then reject a perfectly good certificate. The tracking issue was auto-closed by a stale
bot on 2026-07-13 without a fix, so "closed" did not mean "fixed", and
`credentialsSource: "local"` would not have avoided it either.

**It does not bite us.** A full `eas build --platform ios --profile production --local`
succeeded on macOS 26.6 on 2026-08-03 with remote credentials. Treat this section as
history, not a live risk — but if a teammate on a different macOS 26 point release hits
`certificate not found` on a build that should work, this is the first thing to suspect,
and the workaround is patching the cached `@expo/build-tools` `keychain.js` to drop the
`-v` flag.

## Submission

`eas submit` accepts a locally produced archive — confirmed in eas-cli source, where
`--path` is defined as *"Path to the .apk/.aab/.ipa file"*:

```bash
eas submit --platform ios --path ./build.ipa
```

It does not care whether the `.ipa` came from EAS Build, `--local`, or a hand-rolled
Xcode archive. With the ASC API key stored against the project, any teammate logged
into the Expo org can submit — which retires the manual Transporter step.

**The app record is the exception, and it is what blocks a first upload.** Creating a new
App Store Connect app record is *not* supported via the API key — eas-cli's
`ensureAppExists.ts` carries the literal comment `Does not support App Store Connect API
(CI)` and requires an interactively authenticated Apple ID. A build will happily succeed
and then have nowhere to go.

### v0.0.1 — built and verified 2026-08-03

`apps/mobile/nexus-v0.0.1.ipa` (8.0 MB), produced by
`eas build --platform ios --profile production --local` on macOS 26.6. Verified by
unpacking the archive rather than trusting the build log:

| Property | Value |
|---|---|
| `CFBundleIdentifier` | `org.bsvassociation.nexus` |
| `CFBundleShortVersionString` / `CFBundleVersion` | `0.0.1` / `2` (build number from EAS remote versioning) |
| `ITSAppUsesNonExemptEncryption` | `false` — skips the export-compliance prompt |
| Provisioning profile | `[expo] org.bsvassociation.nexus AppStore`, **no `ProvisionedDevices`** → App Store, not ad-hoc |
| `get-task-allow` | `false` (release signing) |
| Team | `SV8SWTHA2H`, expires 2027-05-02 |
| App icon | embedded |

Notably, the machine that produced it **never authenticated to Apple** — credentials came
from EAS ("All credentials are ready to build @bsvb/nexus"). That is the four-engineer
model working in practice, not just on paper.

Two non-fatal `expo-doctor` checks fail during the build: Metro config, and packages
matching the SDK's expected versions (react-native 0.83.6 against a recommended 0.83.10).
Neither blocks the archive.

### Creating the App Store Connect record (once)

Either let eas-cli do it, run interactively (**not** `--non-interactive`):

```bash
cd apps/mobile
npx eas-cli submit --platform ios --path /path/to/nexus.ipa
```

It signs in with an Apple ID, creates the record, then uploads. Or create it by hand at
appstoreconnect.apple.com → **Apps → + → New App**:

| Field | Value |
|---|---|
| Platform | iOS |
| Bundle ID | `org.bsvassociation.nexus` (already registered — the build's provisioning profile proves it) |
| Name | **must be unique across the entire App Store** — "Nexus" alone is almost certainly taken |
| Primary language | e.g. English (U.S.) |
| SKU | any unique internal string, e.g. `nexus-ios-001` |
| User access | Full |

The App Store **name** is independent of the bundle identifier and of `expo.name`, so a
display name like "BSV Nexus" costs nothing structurally — pick one that is actually
free rather than fighting for "Nexus".

### After it exists

Copy the app's Apple ID number (App Store Connect → App Information) into `eas.json`:

```json
"submit": { "production": { "ios": { "ascAppId": "1234567890" } } }
```

Documented as *"When set, results in skipping the app creation step"* — which is what
makes every later submission runnable non-interactively by any teammate. Until then the
key must be absent, not a placeholder: a dummy `ascAppId` makes `eas submit` fail rather
than fall back to creating the record.

`ITSAppUsesNonExemptEncryption: false` is already set in `app.json`, so uploads skip the
export-compliance question. Keep it accurate — if Nexus ever ships non-exempt crypto,
that flag has to change.

`--path`, `--id`, `--latest` and `--url` are mutually exclusive, and `--path` cannot be
combined with `--platform all`.

## Naming: Nexus is the working title, Haven is the candidate brand

**Nexus** is internal only — repo, EAS project (`@bsvb/nexus`), bundle identifier. It is
not user-facing. **Haven** is the intended production brand, pending trademark clearance.

Current bundle identifier: **`org.bsvassociation.nexus`** (iOS `bundleIdentifier` and
Android `package`), matching the shipped `org.bsvassociation.browser` and the "BSV
Association" Apple team.

### What is reversible, and what is not

| Identifier | User-facing | Changeable after launch |
|---|---|---|
| Bundle ID | No — store URLs use a numeric Apple ID | **No. Frozen the moment an App Store Connect record exists** |
| App Store display name | Yes | Yes, freely |
| Home-screen label (`expo.name`) | Yes | Yes, freely |
| URL scheme (`nexus://`) | Yes — third parties hardcode it | Yes, and additional schemes can be added while keeping the old one |
| EAS project / repo name | No | Yes |

**Therefore: do not create the App Store Connect record until the trademark answer
lands**, unless TestFlight distribution is blocking. Creating that record is the single
irreversible act in the whole naming question — it welds `org.bsvassociation.nexus` on
permanently. Everything else can follow the brand later at no cost.

If TestFlight *is* blocking and the record has to exist first, that is a survivable
outcome: users never see a bundle identifier, and plenty of shipped apps carry one that
predates their branding. Make it a deliberate decision rather than a side effect of
running `eas submit`.

Trademark note for whoever is running the search: a prior crypto project **Haven
Protocol (XHV)** exists in the same goods class. It announced closure on 2024-12-12 after
a range-proof exploit, but havenprotocol.org is still live with trademark notices and the
token still nominally trades — "defunct but not formally abandoned" is a fact pattern
worth flagging to counsel explicitly.

## Not verified

Recorded so nobody treats inference as fact:

- **That `--local` builds consume zero build credits/minutes/concurrency.** Architecturally
  obvious (the build runs on your Mac, not Expo's workers) but stated nowhere in Expo's
  docs or pricing page. The Free plan's "15 iOS builds" is the *cloud* allowance.
- **The real distribution-certificate limit.** Expo's own docs say 1 in prose and 2 in a
  table on the same page; Apple publishes no number.
- Whether a **Viewer**-role member can read stored credentials, versus being blocked.
