#!/usr/bin/env node
/**
 * Make a DEVELOPMENT run call itself Nexus rather than Electron.
 *
 * `app.setName('Nexus')` in src/main.mjs is not enough on macOS. The menu bar title,
 * the app switcher and "About / Hide / Quit <name>" are all read by the system from the
 * running bundle's CFBundleName, before any JavaScript executes — and in dev that bundle
 * is node_modules/electron/dist/Electron.app, which says "Electron". Nothing the app can
 * call at runtime overrides it.
 *
 * Packaged builds never need this: electron-builder writes productName ("Nexus", see
 * package.json) into the .app it generates. This is dev-only cosmetics, which is why it
 * is a separate script rather than something main.mjs tries to do to itself.
 *
 * Editing that Info.plist is safe here specifically because Electron's macOS bundle is
 * linker-signed ad-hoc with `Info.plist=not bound` and `Sealed Resources=none` — the
 * signature covers the Mach-O only, so a plist edit does not invalidate it and the
 * binary still launches on Apple Silicon. Verify with `codesign -dv` before assuming
 * that still holds after an Electron upgrade.
 *
 * node_modules is not tracked, so a reinstall silently restores "Electron". Running from
 * the `dev` script rather than a one-off postinstall is what makes that self-healing.
 *
 *   node dev-app-name.mjs            patch the dev bundle if needed
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const NAME = 'Nexus'
const PLIST_BUDDY = '/usr/libexec/PlistBuddy'

// Only macOS reads a bundle for the app name. Windows takes it from the executable and
// Linux from the .desktop entry, neither of which exists in a dev run — there is nothing
// to patch there, so this exits quietly rather than pretending it did something.
if (process.platform !== 'darwin') process.exit(0)

const require = createRequire(import.meta.url)

/**
 * The Electron.app the `electron` package would actually spawn.
 *
 * Resolved through the package rather than hardcoded, because this is a workspace: the
 * dependency hoists to the repo root today and could sit in apps/desktop tomorrow, and a
 * wrong guess here would silently patch nothing.
 */
function bundlePath() {
  // electron's main export IS the executable path — see node_modules/electron/index.js.
  // Requiring it can trigger a download, so read the file it points at instead.
  const executable = require('electron')
  if (typeof executable !== 'string') return null
  // .../dist/Electron.app/Contents/MacOS/Electron -> .../dist/Electron.app
  const contents = dirname(dirname(executable))
  const app = dirname(contents)
  return app.endsWith('.app') ? app : null
}

const app = bundlePath()
if (!app) process.exit(0)

const plist = join(app, 'Contents', 'Info.plist')
if (!existsSync(plist)) process.exit(0)

/** Read one key, or null when the key is absent. */
function read(key) {
  try {
    return execFileSync(PLIST_BUDDY, ['-c', `Print :${key}`, plist], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// Both keys matter and they are not interchangeable: CFBundleName is the menu bar,
// CFBundleDisplayName is the Finder and the app switcher. Setting only one leaves the
// app half-renamed.
const keys = ['CFBundleName', 'CFBundleDisplayName']

// CFBundleIdentifier is deliberately NOT touched. It is the key macOS files permission
// grants, keychain items and TCC prompts under, so rewriting it would orphan whatever
// this machine has already approved for the dev bundle — a rename is not worth that.
if (keys.every((key) => read(key) === NAME)) {
  console.log(`[dev-app-name] already ${NAME}`)
  process.exit(0)
}

for (const key of keys) {
  const current = read(key)
  try {
    // Add when absent, Set when present: PlistBuddy fails rather than upserting.
    const command = current === null ? `Add :${key} string ${NAME}` : `Set :${key} ${NAME}`
    execFileSync(PLIST_BUDDY, ['-c', command, plist], { stdio: 'pipe' })
  } catch (err) {
    // A dev-only cosmetic must never be the reason the app will not start.
    console.warn(`[dev-app-name] could not set ${key}: ${err.message.trim()}`)
    process.exit(0)
  }
}

// LaunchServices caches bundle metadata by mtime; without this the old name can survive
// the next launch and make a correct patch look like a failed one.
try {
  execFileSync('touch', [app])
} catch {
  // Cosmetic on top of cosmetic.
}

console.log(`[dev-app-name] ${app} now reports as ${NAME}`)
