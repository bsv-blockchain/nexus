/**
 * The extractor that took the v0.2.0 mobile release red.
 *
 *   node --test tools/test/eas-artifact-url.test.mjs
 *
 * The bug it pins: `eas build --json` emits one shape on its own and another with
 * `--auto-submit`, the inline `[0].artifacts.buildUrl` read the wrong one, and
 * `node -p` printed the string "undefined" with exit 0 — so curl got a hostname
 * called "undefined" and the job failed AFTER the build and the Play submission had
 * both succeeded.
 *
 * These cases are the whole reason this is a module: the rehearsal path never passes
 * --auto-submit, so no amount of rehearsing exercises the shape that broke. A test
 * can.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findArtifactUrl } from '../eas-artifact-url.mjs'

const URL_A = 'https://expo.dev/artifacts/eas/aaaa.aab'
const URL_B = 'https://expo.dev/artifacts/eas/bbbb.apk'

describe('findArtifactUrl', () => {
  it('reads the bare array shape — plain `eas build --json`', () => {
    assert.equal(findArtifactUrl([{ artifacts: { buildUrl: URL_A } }]), URL_A)
  })

  it('reads the builds-envelope shape — `--auto-submit`, which is what broke v0.2.0', () => {
    const payload = {
      builds: [{ artifacts: { buildUrl: URL_A } }],
      submissions: [{ status: 'FINISHED' }]
    }
    assert.equal(findArtifactUrl(payload), URL_A)
  })

  it('reads a single build object with no envelope at all', () => {
    assert.equal(findArtifactUrl({ artifacts: { buildUrl: URL_A } }), URL_A)
  })

  it('prefers applicationArchiveUrl, the current field name', () => {
    const build = { artifacts: { applicationArchiveUrl: URL_A, buildUrl: URL_B } }
    assert.equal(findArtifactUrl([build]), URL_A)
  })

  it('falls back to a url hoisted onto the build itself', () => {
    assert.equal(findArtifactUrl([{ buildUrl: URL_A }]), URL_A)
    assert.equal(findArtifactUrl([{ applicationArchiveUrl: URL_B }]), URL_B)
  })

  it('takes the first build that actually has an artifact', () => {
    const payload = { builds: [{ artifacts: {} }, { artifacts: { buildUrl: URL_B } }] }
    assert.equal(findArtifactUrl(payload), URL_B)
  })

  /*
   * The exact failure, as a test. Every one of these used to become the string
   * "undefined" (or worse) on the command line and reach curl as a hostname.
   */
  it('returns null rather than a non-URL, for every shape that has no artifact', () => {
    for (const payload of [
      [],
      [{}],
      [{ artifacts: {} }],
      [{ artifacts: { buildUrl: undefined } }],
      [{ artifacts: { buildUrl: null } }],
      // The literal string, which is what a missing property stringifies to.
      [{ artifacts: { buildUrl: 'undefined' } }],
      // A relative or scheme-less value is not something curl can be handed either.
      [{ artifacts: { buildUrl: '/artifacts/eas/aaaa.aab' } }],
      { builds: [] },
      { submissions: [{ status: 'FINISHED' }] },
      {},
      null,
      undefined,
      'undefined',
      42
    ]) {
      assert.equal(findArtifactUrl(payload), null, `expected null for ${JSON.stringify(payload)}`)
    }
  })
})
