#!/usr/bin/env node
/**
 * Release a new version across all five platforms.
 *
 * The ceremony: prove origin/main's HEAD is releasable, tag it, push the TAG, and
 * open a PR that rolls the working version forward. Everything heavy — desktop
 * signing and notarization, store uploads, APK builds — happens in GitHub Actions,
 * triggered by the tag.
 *
 * ── WHY THIS SCRIPT NEVER PUSHES MAIN ──
 *
 * main is protected: changes land through pull requests, and most of the team
 * cannot bypass that. Tags are not branch pushes, so `git push origin vX.Y.Z`
 * clears branch protection for everyone. The two commits a release wants on main —
 * an optional re-stamp and the roll-forward — therefore travel as PRs:
 *
 *   plain release      nothing needs to land first (development already runs as the
 *                      version being released), so: tag → push tag → roll PR.
 *   --minor/--major/   the re-stamp must be ON main before the tag, so the script
 *   --version X.Y.Z    pushes a branch, opens the PR, and STOPS. Merge it, run
 *                      `npm run release` again — now it is a plain release.
 *
 *   node tools/release.mjs                 release the CURRENT version
 *   node tools/release.mjs --minor         open the re-stamp PR for the next minor
 *   node tools/release.mjs --major         open the re-stamp PR for the next major
 *   node tools/release.mjs --version 2.0.0 open the re-stamp PR for 2.0.0
 *   node tools/release.mjs --dry-run       show every step, execute none
 *   node tools/release.mjs --yes           skip the confirmation prompt
 */
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
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
  // took the whole script down at preflight once already.
  const out = execFileSync(cmd, argv, { cwd: ROOT, encoding: 'utf8', ...opts })
  return typeof out === 'string' ? out.trim() : ''
}

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// ── 1. preflight ──────────────────────────────────────────────────────────────
// Every check guards the tag: a tag is forever, so nothing ambiguous may be under
// it. Releases come only from main, and only from the commit origin already has.
try {
  sh('gh', ['--version'])
} catch {
  fail('the GitHub CLI (gh) is required — the roll-forward and re-stamp travel as PRs')
}

const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') fail(`releases are cut from main; this is ${branch}`)

if (sh('git', ['status', '--porcelain']) !== '') {
  fail('working tree is not clean — commit or stash first')
}

sh('git', ['fetch', 'origin', 'main', '--tags'])
const local = sh('git', ['rev-parse', 'HEAD'])
const remote = sh('git', ['rev-parse', 'origin/main'])
if (local !== remote) {
  fail('main is not in sync with origin/main — the tag must land on a commit origin has')
}

// versions consistent before anything moves (drift details arrive on stderr,
// which execFileSync passes through by default)
sh('node', ['tools/version.mjs', '--check'])

// ── 2. what version is this run about? ───────────────────────────────────────
const explicit = value('--version')
const bump = flag('--major') ? 'major' : flag('--minor') ? 'minor' : null
if (explicit && bump) fail('--version and --major/--minor are mutually exclusive')
if (explicit && !/^\d+\.\d+\.\d+$/.test(explicit)) {
  fail(`--version wants x.y.z, got "${explicit}"`)
}

const current = sh('node', ['tools/version.mjs'])
function bumped(v, kind) {
  const [maj, min, pat] = v.split('.').map(Number)
  return kind === 'major' ? `${maj + 1}.0.0`
    : kind === 'minor' ? `${maj}.${min + 1}.0`
    : `${maj}.${min}.${pat + 1}`
}
const plannedVersion = explicit ?? (bump ? bumped(current, bump) : current)
const tag = `v${plannedVersion}`

/**
 * Refuse a taken version BEFORE anything is written. Two different checks on
 * purpose: origin owning the tag means the version has shipped; only the local
 * repo owning it means a previous run died between tagging and pushing, and the
 * remedy is cleanup, not burning the version number.
 */
if (!DRY) {
  if (sh('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]) !== '') {
    fail(`${tag} already exists on origin — that version has shipped; pick the next one`)
  }
  try {
    sh('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { stdio: 'pipe' })
    fail(`${tag} exists locally but not on origin — a previous run died mid-release.\n  Clean up with: git tag -d ${tag}`)
  } catch (e) {
    if (e.status === undefined) throw e
    // unresolvable ref — good, the tag is free
  }
}

/**
 * Land a one-commit version change on main, the compliant way: branch → PR.
 * Auto-merge is attempted so the PR completes itself once the repo's checks and
 * approvals are satisfied; where auto-merge is disabled the PR just waits for a
 * human, which is the policy working as designed.
 */
function openVersionPr(branchName, newVersion, title, body) {
  // Best-effort cleanup from a previous attempt that died before its own cleanup
  // (e.g. a rejected push). Errors ignored: most of the time there is nothing to
  // remove, and 'git switch -c' below is the check that actually matters.
  try {
    sh('git', ['branch', '-D', branchName], { mutates: true, stdio: 'pipe' })
  } catch {
    // no such branch — the common case
  }
  sh('git', ['switch', '-c', branchName], { mutates: true })
  sh('node', ['tools/version.mjs', '--set', newVersion], { mutates: true })
  sh('git', ['add', '-A'], { mutates: true })
  sh('git', ['commit', '-m', title], { mutates: true })
  sh('git', ['push', '-u', 'origin', branchName], { mutates: true })
  const url = sh('gh', ['pr', 'create', '--title', title, '--body', body, '--base', 'main', '--head', branchName], { mutates: true })
  try {
    sh('gh', ['pr', 'merge', branchName, '--auto', '--squash'], { mutates: true })
  } catch {
    console.log('  (auto-merge unavailable — the PR waits for a human merge)')
  }
  // Back to a clean main; the branch lives on origin inside the PR.
  sh('git', ['switch', 'main'], { mutates: true })
  sh('git', ['branch', '-D', branchName], { mutates: true })
  return url
}

// ── 3a. re-stamp requested: PR it and stop ────────────────────────────────────
// The tag must point at a commit that CARRIES the released version, so the stamp
// has to be merged before tagging. That merge is main-protected — PR, then rerun.
if (explicit || bump) {
  console.log(`\nRe-stamping ${current} → ${plannedVersion} (PR first, tag after merge)`)
  const url = openVersionPr(
    `release/stamp-${tag}`,
    plannedVersion,
    `release: ${tag}`,
    `Stamps every version-bearing file to ${plannedVersion} ahead of the ${tag} release.\n\nMerge this, then run \`npm run release\` again — it will tag the merged commit.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  )
  console.log(`\n✓ re-stamp PR open: ${url || '(dry-run)'}`)
  console.log(`  merge it, then run: npm run release`)
  process.exit(0)
}

// ── 3b. plain release: confirm, tag, push the tag ─────────────────────────────
console.log(`\nAbout to release ${tag} (= origin/main HEAD ${remote.slice(0, 7)})`)
console.log('  → push the tag (GitHub workflows build and upload everything)')
console.log('  → open the roll-forward PR for the next patch\n')
if (!flag('--yes') && !DRY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`type "${tag}" to proceed: `)).trim()
  rl.close()
  if (answer !== tag) fail('aborted')
}

sh('git', ['tag', '-a', tag, '-m', `Nexus ${tag}`], { mutates: true })
sh('git', ['push', 'origin', tag], { mutates: true })
console.log(`✓ ${tag} pushed — release workflows are running`)

// ── 4. roll development forward, as a PR ──────────────────────────────────────
// AFTER the tag, deliberately: the released commit carries the released number,
// and every commit after the roll merges carries the next one. Until the PR
// merges, main still SAYS the released version — merge it promptly; the release
// script itself refuses to re-release a shipped version, so the window is
// annoying, not dangerous.
const next = bumped(plannedVersion, 'patch')
const url = openVersionPr(
  `release/begin-v${next}`,
  next,
  `chore: begin v${next} development`,
  `Rolls every version-bearing file to ${next} now that ${tag} is released, so no experimental build can masquerade as the release.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`
)
console.log(`✓ roll-forward PR open: ${url || '(dry-run)'} — merge it to continue on v${next}`)
