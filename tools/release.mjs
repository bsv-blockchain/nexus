#!/usr/bin/env node
/**
 * Release a new version across all five platforms.
 *
 * The whole ceremony is: prove the tree is releasable, tag it, push, and roll the
 * working version forward. Everything heavy — desktop signing and notarization,
 * store uploads, APK builds — happens in GitHub Actions, triggered by the tag.
 * Nothing publishes on merge to main; the tag is the one and only release trigger.
 *
 *   node tools/release.mjs                 release the CURRENT version (the one
 *                                          development has been running as)
 *   node tools/release.mjs --minor         re-stamp as next minor, then release
 *   node tools/release.mjs --major         re-stamp as next major, then release
 *   node tools/release.mjs --version 2.0.0 re-stamp explicitly, then release
 *   node tools/release.mjs --dry-run       show every step, execute none
 *   node tools/release.mjs --yes           skip the confirmation prompt
 *
 * What actually happens, in order:
 *   1. preflight: on main, clean tree, in sync with origin, versions consistent
 *   2. optional re-stamp (--minor/--major/--version) + release commit
 *   3. annotated tag vX.Y.Z → push main + tag  (CI takes over from here)
 *   4. roll every metadata file to X.Y.(Z+1), commit, push — so development
 *      immediately continues on the NEXT number and no experimental build can
 *      masquerade as the released one
 */
import { execFileSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}
const DRY = flag('--dry-run')

function sh(cmd, argv, opts = {}) {
  const line = `${cmd} ${argv.join(' ')}`
  if (DRY && opts.mutates) {
    console.log(`[dry-run] ${line}`)
    return ''
  }
  // execFileSync returns null (not '') when stdout is not piped — .trim() on that
  // took the whole script down at preflight.
  const out = execFileSync(cmd, argv, { cwd: ROOT, encoding: 'utf8', ...opts })
  return typeof out === 'string' ? out.trim() : ''
}

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// ── 1. preflight ──────────────────────────────────────────────────────────────
// Every check here guards the tag: a tag is forever, so nothing ambiguous may be
// under it. Releases come only from main — a release from a feature branch would
// tag code that main never saw.
const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') fail(`releases are cut from main; this is ${branch}`)

if (sh('git', ['status', '--porcelain']) !== '') {
  fail('working tree is not clean — commit or stash first')
}

sh('git', ['fetch', 'origin', 'main', '--tags'])
const local = sh('git', ['rev-parse', 'HEAD'])
const remote = sh('git', ['rev-parse', 'origin/main'])
if (local !== remote) {
  fail('main is not in sync with origin/main — pull/push first, the tag must land on a commit origin has')
}

// versions consistent before anything moves (drift details arrive on stderr,
// which execFileSync passes through by default)
sh('node', ['tools/version.mjs', '--check'])

// ── 2. optional re-stamp ──────────────────────────────────────────────────────
const explicit = value('--version')
const bump = flag('--major') ? 'major' : flag('--minor') ? 'minor' : null
if (explicit && bump) fail('--version and --major/--minor are mutually exclusive')
if (explicit && !/^\d+\.\d+\.\d+$/.test(explicit)) {
  // Validated here, not only inside version.mjs --set: dry-run skips the --set call,
  // and a dry run that says "About to release vbanana" predicts nothing.
  fail(`--version wants x.y.z, got "${explicit}"`)
}

/**
 * Refuse a taken version BEFORE anything is written. Two different checks on
 * purpose: origin owning the tag means this version has shipped; only the local
 * repo owning it means a previous run died between tagging and pushing, and the
 * remedy is cleanup, not burning the version number.
 */
function assertTagFree(candidate) {
  if (DRY) return
  if (sh('git', ['ls-remote', '--tags', 'origin', `refs/tags/${candidate}`]) !== '') {
    fail(`${candidate} already exists on origin — that version has shipped; pick the next one`)
  }
  try {
    sh('git', ['rev-parse', '--verify', `refs/tags/${candidate}`], { stdio: 'pipe' })
    fail(`${candidate} exists locally but not on origin — a previous run died mid-release.\n  Clean up with: git tag -d ${candidate}   (and git reset --hard origin/main if it also committed)`)
  } catch (e) {
    if (e.status === undefined) throw e
    // unresolvable ref — good, the tag is free
  }
}

// What version WOULD this run release? Compute before mutating anything.
const current = sh('node', ['tools/version.mjs'])
const plannedVersion = explicit ?? (bump ? bumped(current, bump) : current)
function bumped(v, kind) {
  const [maj, min] = v.split('.').map(Number)
  return kind === 'major' ? `${maj + 1}.0.0` : `${maj}.${min + 1}.0`
}
assertTagFree(`v${plannedVersion}`)

if (explicit) sh('node', ['tools/version.mjs', '--set', explicit], { mutates: true })
if (bump) sh('node', ['tools/version.mjs', '--bump', bump], { mutates: true })

const version = DRY ? plannedVersion : sh('node', ['tools/version.mjs'])
const tag = `v${version}`

if ((explicit || bump) && !DRY) {
  sh('git', ['add', '-A'], { mutates: true })
  sh('git', ['commit', '-m', `release: ${tag}`], { mutates: true })
}

// ── confirm ───────────────────────────────────────────────────────────────────
console.log(`\nAbout to release ${tag}`)
console.log('  → push main + tag to origin (GitHub workflows build and upload everything)')
console.log(`  → roll development forward to the next patch\n`)
if (!flag('--yes') && !DRY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`type "${tag}" to proceed: `)).trim()
  rl.close()
  if (answer !== tag) fail('aborted')
}

// ── 3. tag and push ───────────────────────────────────────────────────────────
sh('git', ['tag', '-a', tag, '-m', `Nexus ${tag}`], { mutates: true })
try {
  sh('git', ['push', 'origin', 'main'], { mutates: true })
} catch {
  // Almost always a merge that landed after preflight (the confirm prompt is an
  // unbounded window). Nothing has been published: the tag is local-only.
  fail(`push of main was rejected — someone merged since preflight.\n  Nothing was released. Recover with:\n    git tag -d ${tag}\n    git pull --rebase origin main\n  then run the release again.`)
}
sh('git', ['push', 'origin', tag], { mutates: true })
console.log(`✓ ${tag} pushed — release workflows are running`)

// ── 4. roll development forward ───────────────────────────────────────────────
// AFTER the tag, deliberately: the released commit carries the released number, and
// every commit thereafter carries the next one. An experimental build handed to a
// tester can never claim to be the release.
sh('node', ['tools/version.mjs', '--bump', 'patch'], { mutates: true })
const next = DRY ? '«next»' : sh('node', ['tools/version.mjs'])
sh('git', ['add', '-A'], { mutates: true })
sh('git', ['commit', '-m', `chore: begin v${next} development`], { mutates: true })
try {
  sh('git', ['push', 'origin', 'main'], { mutates: true })
} catch {
  // The release itself is out (tag pushed, CI running); only the roll-forward is
  // stranded. Retry once over whatever just landed — the bump commit touches only
  // version fields, so a rebase is near-certain to apply cleanly.
  console.log('roll-forward push rejected — rebasing over the new main and retrying once')
  sh('git', ['pull', '--rebase', 'origin', 'main'], { mutates: true })
  try {
    sh('git', ['push', 'origin', 'main'], { mutates: true })
  } catch {
    fail(`${tag} IS released, but the roll to v${next} did not reach origin.\n  Finish by hand: resolve the rebase if needed, then git push origin main.\n  Until that lands, main still carries the RELEASED version number.`)
  }
}
console.log(`✓ development continues on v${next}`)
