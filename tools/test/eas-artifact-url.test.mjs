/**
 * The extractor that took the v0.2.0 mobile release red.
 *
 *   node --test tools/test/eas-artifact-url.test.mjs
 *
 * The bug it pins: with `--auto-submit`, eas-cli emits `artifacts.applicationArchiveUrl`
 * and drops the legacy `artifacts.buildUrl`. The inline `[0].artifacts.buildUrl` named
 * only the legacy key, so it evaluated to undefined, `node -p` printed the STRING
 * "undefined" with exit 0, and curl was handed a hostname called "undefined" — AFTER
 * the build and the Play submission had both succeeded.
 *
 * The first test below is the exact v0.2.0 payload. The one after it is the envelope
 * change that did NOT happen, kept because it is the shape a reader will assume was to
 * blame: it would have thrown a TypeError and killed the step before curl, which is how
 * we know it wasn't that.
 *
 * These cases are the whole reason this is a module: the rehearsal path never passes
 * --auto-submit, so no amount of rehearsing exercises the payload that broke. A test
 * can.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findArtifactUrl } from '../eas-artifact-url.mjs'

const URL_A = 'https://expo.dev/artifacts/eas/aaaa.aab'
const URL_B = 'https://expo.dev/artifacts/eas/bbbb.apk'

describe('findArtifactUrl', () => {
  /*
   * THE v0.2.0 PAYLOAD. `--auto-submit` emits applicationArchiveUrl and no buildUrl,
   * which is the whole of the bug: the old line named buildUrl and nothing else.
   */
  it('reads applicationArchiveUrl when buildUrl is absent — the --auto-submit payload', () => {
    assert.equal(findArtifactUrl([{ artifacts: { applicationArchiveUrl: URL_A } }]), URL_A)
  })

  it('reads the bare array with only the legacy buildUrl — plain `eas build --json`', () => {
    assert.equal(findArtifactUrl([{ artifacts: { buildUrl: URL_A } }]), URL_A)
  })

  /*
   * The envelope change that did NOT happen. Handled anyway — an extractor that only
   * copes with shapes already observed is the thing that just failed — but recorded
   * as innocent: it would have thrown a TypeError on `[0].artifacts` and killed the
   * step before curl ever ran, and curl ran.
   */
  it('reads a builds envelope too, though that is not what broke v0.2.0', () => {
    const payload = {
      builds: [{ artifacts: { buildUrl: URL_A } }],
      submissions: [{ status: 'FINISHED' }]
    }
    assert.equal(findArtifactUrl(payload), URL_A)
  })

  /* The real `eas build:view --json` shape, which carries both keys. */
  it('reads the build:view shape, which carries both keys', () => {
    const payload = {
      id: 'b069370f-9f45-483a-9865-b70ac012705a',
      status: 'FINISHED',
      artifacts: { buildUrl: URL_B, applicationArchiveUrl: URL_A }
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
