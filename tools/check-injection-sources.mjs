#!/usr/bin/env node
/**
 * The injected sources in @nexus/bridge and @nexus/substrate are template-interpolated
 * into a JS string, so a stray backtick or `${` inside them silently ends the template
 * and produces a syntax error far from the cause. That happened once already — a
 * backtick inside a COMMENT in the source string took down the Metro bundle.
 *
 * Also checks the sources still parse standalone, which is the property that makes them
 * safe to hand to a WebView.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const failures = []

const targets = [
  ['@nexus/bridge CREATE_HOST_CLIENT_SOURCE', require('@nexus/bridge/src/client').CREATE_HOST_CLIENT_SOURCE],
  ['@nexus/substrate CREATE_PROVIDER_SOURCE', require('@nexus/substrate/src/provider').CREATE_PROVIDER_SOURCE]
]

for (const [name, source] of targets) {
  if (typeof source !== 'string') {
    failures.push(`${name}: not a string (got ${typeof source})`)
    continue
  }
  const backticks = (source.match(/`/g) || []).length
  const interpolations = (source.match(/\$\{/g) || []).length
  if (backticks) failures.push(`${name}: contains ${backticks} backtick(s) — will terminate the template literal`)
  if (interpolations) failures.push(`${name}: contains ${interpolations} \${ — will interpolate unexpectedly`)
  try {
    new Function(source)
  } catch (err) {
    failures.push(`${name}: does not parse standalone — ${err.message}`)
  }
  console.log(`ok  ${name} (${source.length} chars)`)
}

// The built scripts must parse too, and must never carry a Hermes bytecode stub.
const built = [
  ['chrome bridge script', require('@nexus/bridge').buildChromeBridgeScript({ shell: 'expo', platform: 'ios' })],
  ['substrate script', require('@nexus/substrate').buildSubstrateScript()]
]

for (const [name, script] of built) {
  if (/\[bytecode\]|\[native code\]/.test(script)) {
    failures.push(`${name}: contains a bytecode/native-code stub — a function was stringified instead of using the source constant`)
  }
  if (!script.trim().endsWith('true;')) {
    failures.push(`${name}: must end with 'true;' — react-native-webview on iOS discards scripts that do not`)
  }
  try {
    new Function(script)
  } catch (err) {
    failures.push(`${name}: does not parse — ${err.message}`)
  }
  console.log(`ok  ${name} (${script.length} chars)`)
}

// Repo-wide scan for the anti-pattern itself, not just for the two sources we already
// know about. The BSV Browser port arrived carrying exactly this bug in
// injectedPolyfills.ts — a real function stringified into an injected script — and the
// earlier version of this check would not have caught it, because it only knew about
// packages/{bridge,substrate}/src/*.js by name.
const { readdirSync, statSync, readFileSync } = await import('node:fs')
const { join, extname: ext } = await import('node:path')

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'out' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

const ROOT = new URL('..', import.meta.url).pathname
const STRINGIFIED = /\$\{\s*([A-Za-z_$][\w$]*)\s*\.toString\(\)\s*\}/g

for (const dir of ['packages', 'apps/mobile/src', 'apps/desktop/src']) {
  let files
  try {
    files = [...walk(join(ROOT, dir))]
  } catch {
    continue // directory may not exist in every checkout
  }
  for (const file of files) {
    if (!['.js', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext(file))) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(STRINGIFIED)) {
      failures.push(
        `${file.replace(ROOT, '')}: interpolates ${m[1]}.toString() into a template literal. ` +
          'Hermes discards function source and yields a [bytecode] stub, so the injected script ' +
          'silently becomes garbage on device. Hold the code as a string constant instead.'
      )
    }
  }
}

if (failures.length) {
  console.error('\nFAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log('\nall injection sources clean')
