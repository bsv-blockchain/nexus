#!/usr/bin/env node
/**
 * Pull the downloadable artifact URL out of `eas build --json` output.
 *
 * ── WHY THIS IS A FILE AND NOT A ONE-LINER ──
 *
 * It used to be this, inline in release-mobile.yml:
 *
 *   URL=$(node -p "JSON.parse(require('fs').readFileSync('build.json','utf8'))[0].artifacts.buildUrl")
 *
 * On the v0.2.0 release that printed the string "undefined", and the next line ran
 * `curl -fL undefined -o Nexus-v0.2.0.aab`, which failed with "Could not resolve host:
 * undefined" and took the job red — AFTER the build had succeeded and AFTER the Play
 * submission had gone through. The release was fine; the bookkeeping was not.
 *
 * ── THE ACTUAL CAUSE, NARROWED BY THE SYMPTOM ──
 *
 * The envelope did NOT change. Only one shape can produce what was observed, and the
 * observation is precise enough to identify it: `node -p` printed the STRING
 * "undefined" and curl then ran. Walk the alternatives —
 *
 *   [{artifacts:{applicationArchiveUrl}}]   -> undefined      ← what happened
 *   {builds:[{artifacts:{buildUrl}}]}       -> TypeError
 *   [{artifacts:{buildUrl}}]                -> the URL
 *
 * If the top level had become an object, `[0]` would be undefined and `[0].artifacts`
 * would THROW; `node -p` would exit non-zero and `set -e` would have killed the step
 * BEFORE curl. curl ran, so the top level was still an array whose element still had
 * an `artifacts` object — and that object simply had no `buildUrl`.
 *
 * So: with `--auto-submit`, eas-cli emits `artifacts.applicationArchiveUrl` and drops
 * the legacy `artifacts.buildUrl`. `eas build:view --json` on the very same build
 * carries BOTH keys, which is how a hand-check of the released artifact still worked
 * while the pipeline did not.
 *
 * Two things made it possible to ship, and this file fixes both:
 *
 *   1. The old line named ONE key. It now tries `applicationArchiveUrl` first (the
 *      current name) and `buildUrl` second (the legacy one), and tolerates either
 *      envelope besides — because the rehearsal path never passes --auto-submit, so no
 *      amount of rehearsing exercises the payload that broke. A test can, and
 *      test/eas-artifact-url.test.mjs does.
 *
 *   2. `node -p undefined` exits 0. Any failure to find the URL has to be LOUD, or a
 *      broken download reappears as a confusing curl error a step later. This exits 1
 *      and prints what it actually saw.
 *
 * Usage:
 *   node tools/eas-artifact-url.mjs build.json
 */
import { readFileSync } from 'node:fs'

/**
 * The artifact URL, or null.
 *
 * Deliberately tolerant about the envelope and strict about the value: any of the
 * shapes eas-cli has emitted is accepted, but the result must look like an http(s)
 * URL. Returning a non-URL truthy value is how "undefined" reached curl in the first
 * place.
 *
 * `applicationArchiveUrl` is preferred over `buildUrl` because it is the current field
 * name and the one `--auto-submit` emits; `buildUrl` is the legacy name that a plain
 * `eas build --json` still carries. Naming only the legacy one is what broke v0.2.0.
 */
export function findArtifactUrl(json) {
  const builds = Array.isArray(json)
    ? json
    : Array.isArray(json?.builds)
      ? json.builds
      : json && typeof json === 'object'
        ? [json]
        : []

  for (const build of builds) {
    const artifacts = build?.artifacts ?? {}
    const candidates = [
      artifacts.applicationArchiveUrl,
      artifacts.buildUrl,
      build?.applicationArchiveUrl,
      build?.buildUrl
    ]
    for (const url of candidates) {
      if (typeof url === 'string' && /^https?:\/\//.test(url)) return url
    }
  }
  return null
}

/** Enough of the payload to diagnose a shape change, without dumping a whole build. */
function describe(json) {
  if (Array.isArray(json)) {
    return `array(${json.length})${json.length ? ` first keys: ${Object.keys(json[0] ?? {}).join(', ')}` : ''}`
  }
  if (json && typeof json === 'object') return `object keys: ${Object.keys(json).join(', ')}`
  return typeof json
}

// Run as a script, not when imported by the test.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: node tools/eas-artifact-url.mjs <build.json>')
    process.exit(1)
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`✗ could not read ${path} as JSON: ${err.message}`)
    process.exit(1)
  }

  const url = findArtifactUrl(parsed)
  if (!url) {
    console.error(
      `✗ no artifact URL in ${path}.\n` +
        `  saw: ${describe(parsed)}\n` +
        '  eas-cli changed its --json shape, or the build produced no artifact.'
    )
    process.exit(1)
  }
  console.log(url)
}
