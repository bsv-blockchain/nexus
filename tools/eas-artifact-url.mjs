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
 * Two things made that possible, and this file fixes both:
 *
 *   1. `eas build --json` does not always emit a bare array. With `--auto-submit` the
 *      payload carries submissions alongside builds, so `[0].artifacts.buildUrl` reads
 *      a property off the wrong object and yields undefined. The rehearsal path runs
 *      WITHOUT --auto-submit, so it exercises the other shape and cannot catch this —
 *      which is exactly why the extractor has to be shape-agnostic rather than
 *      rehearsed. That is what `findArtifactUrl` below is for, and what
 *      test/eas-artifact-url.test.mjs pins.
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
 * name; `buildUrl` is the older one and both have been seen in the wild.
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
