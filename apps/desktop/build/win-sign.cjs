/**
 * electron-builder's Windows signing hook.
 *
 * ── WHY SIGNING HAS TO HAPPEN IN HERE ──
 *
 * Signing an .exe changes its bytes. electron-builder computes the sha512 that
 * goes into `latest.yml` AFTER it has finished packaging, so anything that
 * rewrites an artifact after that point leaves the metadata describing a file
 * that no longer exists. electron-updater downloads the installer, hashes it,
 * compares, and aborts the update — "sha512 checksum mismatch" — for every
 * installed client, on a release whose artifacts are all perfectly good.
 *
 * That is not hypothetical. bsv-desktop shipped exactly this in v2.6.x and
 * v2.7.x by running signtool as a workflow step after `electron-builder --win`,
 * and had to write a script to repair the published metadata of releases that
 * were already in the wild. This repository had the same shape — a "sign and
 * verify Windows installers" step after the build — and got away with it only
 * because it published no update metadata at all. Turning auto-updates on is
 * what makes it a bug, so the signing moved in here in the same commit.
 *
 * electron-builder calls this before it computes update metadata, so the hash
 * written to latest.yml is the hash of the signed artifact by construction.
 *
 * ── WHAT IT EXPECTS ──
 *
 * `smctl windows certsync` has already put the DigiCert KeyLocker certificate
 * into the Windows certificate store, and WIN_SIGN_SHA1 holds its thumbprint.
 * The workflow does both before invoking electron-builder.
 *
 * `.cjs` because apps/desktop/package.json declares `"type": "module"` and
 * electron-builder loads this hook with require().
 */

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const TIMESTAMP_URL = process.env.WIN_SIGN_TIMESTAMP_URL || 'http://timestamp.digicert.com'

/** The newest signtool.exe on the runner, or a thrown error naming where it looked. */
function findSigntool() {
  if (process.env.WIN_SIGNTOOL_PATH) return process.env.WIN_SIGNTOOL_PATH

  const kitsRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  if (!fs.existsSync(kitsRoot)) {
    throw new Error(`signtool.exe not found: ${kitsRoot} does not exist`)
  }
  const candidates = fs
    .readdirSync(kitsRoot)
    .sort()
    .reverse()
    .map((dir) => path.join(kitsRoot, dir, 'x64', 'signtool.exe'))
    .filter((candidate) => fs.existsSync(candidate))

  if (candidates.length === 0) throw new Error(`signtool.exe not found under ${kitsRoot}`)
  return candidates[0]
}

exports.default = async function sign(configuration) {
  const file = configuration.path
  const sha1 = process.env.WIN_SIGN_SHA1

  if (!sha1) {
    /*
     * A developer packaging locally has no certificate and should still be able
     * to build. CI has one and must never produce an unsigned artifact — not
     * because unsigned is merely bad, but because the release would then publish
     * a latest.yml describing an installer nobody can verify, and the failure
     * would surface on users' machines rather than in this log.
     */
    if (process.env.CI) {
      throw new Error(
        'WIN_SIGN_SHA1 is not set. Refusing to produce unsigned Windows artifacts in CI: ' +
          'latest.yml would describe an installer that was never signed.'
      )
    }
    console.warn(`[win-sign] WIN_SIGN_SHA1 not set — skipping ${path.basename(file)}`)
    return
  }

  const signtool = findSigntool()

  console.log(`[win-sign] signing ${file}`)
  execFileSync(
    signtool,
    ['sign', '/tr', TIMESTAMP_URL, '/td', 'SHA256', '/fd', 'SHA256', '/sha1', sha1, file],
    { stdio: 'inherit' }
  )

  // Verify here rather than in a later step: a signature that does not verify
  // must fail the build before electron-builder hashes the file into latest.yml.
  console.log(`[win-sign] verifying ${file}`)
  execFileSync(signtool, ['verify', '/pa', file], { stdio: 'inherit' })
}
