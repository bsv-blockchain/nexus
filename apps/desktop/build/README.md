# Electron build resources — these are source, not output

`electron-builder` reads this directory as `buildResources` (see `directories.buildResources`
in `../package.json`). Everything here must be **tracked in git**:

| file | used by |
|---|---|
| `entitlements.mac.plist` | macOS signing — `mac.entitlements` and `mac.entitlementsInherit` |
| `icon.icns` | macOS app icon |
| `icon.ico` | Windows app icon and NSIS installer |
| `icon.png` | Linux app icon (AppImage, deb) |

The repository's `.gitignore` has a blanket `build/` rule for real build output, which
silently swallowed this directory. Nothing complained locally — the files are on disk, so
every dev machine signed and packaged correctly — and CI, which only ever sees what git
tracks, failed at the first `codesign` with:

```
build/entitlements.mac.plist: cannot read entitlement data
```

with `default Electron icon is used  reason=application icon is not set` a few lines above
it, on every platform. `!apps/desktop/build/` in `.gitignore` is what keeps this directory
tracked; do not remove it.
