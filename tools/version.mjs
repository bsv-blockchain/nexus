#!/usr/bin/env node
/**
 * The single authority on what version this product is.
 *
 * One version number covers all five platforms — iOS, Android, macOS, Windows,
 * Linux — because a bug report that says "v0.3.2" must mean one build of the shared
 * chrome and wallet logic, not five different ones. The number lives in several
 * metadata files (each shell's packager reads its own), and this script is the only
 * thing that writes it.
 *
 *   node tools/version.mjs                  print the version, fail if files disagree
 *   node tools/version.mjs --check          same, exit code only (CI)
 *   node tools/version.mjs --check --tag v1.2.3   also fail unless version == 1.2.3
 *   node tools/version.mjs --set 1.2.3      write 1.2.3 everywhere
 *   node tools/version.mjs --bump patch     roll x.y.z → x.y.(z+1) everywhere
 *
 * Store build numbers are deliberately NOT here: eas.json sets
 * appVersionSource=remote with autoIncrement, so EAS owns iOS buildNumber and
 * Android versionCode. This file owns the human-visible version only.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every file that carries the version, and how to reach it.
 *
 * apps/mobile/app.json is the one that matters most: Expo's prebuild copies
 * expo.version into CFBundleShortVersionString and android versionName, and
 * App.tsx reads it at run time (Constants.expoConfig.version) to answer
 * host.info. Desktop's package.json is what app.getVersion() reports.
 */
const FILES = [
  { path: 'package.json', get: (d) => d.version, set: (d, v) => { d.version = v } },
  { path: 'apps/desktop/package.json', get: (d) => d.version, set: (d, v) => { d.version = v } },
  { path: 'apps/mobile/package.json', get: (d) => d.version, set: (d, v) => { d.version = v } },
  { path: 'apps/mobile/app.json', get: (d) => d.expo.version, set: (d, v) => { d.expo.version = v } },
  { path: 'apps/ui/package.json', get: (d) => d.version, set: (d, v) => { d.version = v } },
  // The lockfiles too, or `npm ci` on the tagged commit dies before the first build
  // step: npm refuses to install when a workspace's package.json version disagrees
  // with what the lock recorded. Verified live — stamping only the manifests left
  // root/desktop/mobile at their old numbers in package-lock.json.
  {
    path: 'package-lock.json',
    get: (d) => d.version,
    set: (d, v) => {
      d.version = v
      for (const key of ['', 'apps/desktop', 'apps/mobile']) {
        if (d.packages?.[key]) d.packages[key].version = v
      }
    }
  },
  {
    path: 'apps/ui/package-lock.json',
    get: (d) => d.version,
    set: (d, v) => {
      d.version = v
      if (d.packages?.['']) d.packages[''].version = v
    }
  }
]

const SEMVER = /^\d+\.\d+\.\d+$/

function load(file) {
  const p = join(ROOT, file.path)
  const text = readFileSync(p, 'utf8')
  return { ...file, p, data: JSON.parse(text), text }
}

function currentVersions() {
  return FILES.map(load).map((f) => ({ path: f.path, version: f.get(f.data) }))
}

function writeAll(version) {
  for (const file of FILES) {
    const f = load(file)
    f.set(f.data, version)
    // Match the file's existing final-newline convention rather than imposing one.
    const out = JSON.stringify(f.data, null, 2) + (f.text.endsWith('\n') ? '\n' : '')
    writeFileSync(f.p, out)
  }
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

const setTo = value('--set')
const bump = value('--bump')
const tag = value('--tag')

if (setTo) {
  if (!SEMVER.test(setTo)) {
    console.error(`not a version: "${setTo}" (want x.y.z)`)
    process.exit(1)
  }
  writeAll(setTo)
  console.log(`version → ${setTo} (${FILES.length} files)`)
  process.exit(0)
}

if (bump) {
  const versions = currentVersions()
  const distinct = [...new Set(versions.map((v) => v.version))]
  if (distinct.length !== 1) {
    console.error('refusing to bump: files disagree —')
    for (const v of versions) console.error(`  ${v.path}: ${v.version}`)
    process.exit(1)
  }
  if (!SEMVER.test(distinct[0])) {
    console.error(`current version "${distinct[0]}" is not x.y.z — bumping it would write NaN into every file`)
    process.exit(1)
  }
  const [maj, min, pat] = distinct[0].split('.').map(Number)
  const next =
    bump === 'major' ? `${maj + 1}.0.0` :
    bump === 'minor' ? `${maj}.${min + 1}.0` :
    bump === 'patch' ? `${maj}.${min}.${pat + 1}` : null
  if (!next) {
    console.error(`unknown bump "${bump}" (major|minor|patch)`)
    process.exit(1)
  }
  writeAll(next)
  console.log(`version ${distinct[0]} → ${next} (${FILES.length} files)`)
  process.exit(0)
}

// Default and --check: report, and FAIL on drift. Drift is never acceptable —
// two platforms reporting different versions for the same code defeats the whole
// point of syncing them.
const versions = currentVersions()
const distinct = [...new Set(versions.map((v) => v.version))]
if (distinct.length !== 1) {
  console.error('version drift —')
  for (const v of versions) console.error(`  ${v.path}: ${v.version}`)
  process.exit(1)
}
if (tag) {
  const want = tag.replace(/^v/, '')
  if (want !== distinct[0]) {
    console.error(`tag ${tag} does not match version ${distinct[0]}`)
    process.exit(1)
  }
}
if (!flag('--check')) console.log(distinct[0])
