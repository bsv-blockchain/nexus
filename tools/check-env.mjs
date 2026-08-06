#!/usr/bin/env node
/**
 * Keep the service endpoints in step.
 *
 * The MessageBox host used to exist as three separate literals in three source files.
 * Two of them had no importers, one of those had drifted to a host nothing was talking
 * to, and nothing anywhere would have told you. Moving the value into /.env fixes the
 * "which one is real" problem but creates a smaller one: the value has to be repeated,
 * because Expo reads .env from the project directory rather than the workspace root,
 * EAS build profiles override .env entirely, and the source constants carry a literal
 * fallback for a checkout with no env at all.
 *
 * Four places, then, and this fails if any two disagree:
 *
 *   /.env                              the source of truth
 *   apps/mobile/.env                   generated; Expo cannot see the root file
 *   apps/mobile/eas.json               profile env, which OVERRIDES .env on EAS
 *   packages/wallet-core/.../handle.ts the no-env fallback literal
 *
 *   node tools/check-env.mjs           verify
 *   node tools/check-env.mjs --write   regenerate apps/mobile/.env from /.env
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const write = process.argv.includes('--write')

const MOBILE_ENV = join(ROOT, 'apps/mobile/.env')
const EAS_JSON = join(ROOT, 'apps/mobile/eas.json')
const HANDLE_TS = join(ROOT, 'packages/wallet-core/src/utils/pay/rails/handle.ts')

const GENERATED_HEADER = `# Expo loads .env from the PROJECT directory, not the workspace root, so the mobile
# build cannot see /.env — this file exists for that reason alone.
#
# Do not edit it by hand. It is generated from the root /.env, which is the source of
# truth for every service endpoint; tools/check-env.mjs fails the build if the two
# drift apart. Run \`node tools/check-env.mjs --write\` after changing the root file.
`

function parseEnv(path) {
  /** @type {Record<string, string>} */
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values[match[1]] = match[2].trim()
  }
  return values
}

const root = parseEnv(join(ROOT, '.env'))
const problems = []

// The two names in the root file are the same value seen by two bundlers. If they
// diverge, mobile and desktop ship pointing at different hosts.
for (const [expo, nexus] of [['EXPO_PUBLIC_MESSAGEBOX_URL', 'NEXUS_MESSAGEBOX_URL']]) {
  if (root[expo] !== root[nexus]) {
    problems.push(`/.env: ${expo} (${root[expo]}) != ${nexus} (${root[nexus]})`)
  }
}

// apps/mobile/.env — generated, so --write just rewrites it.
const expoOnly = Object.entries(root).filter(([name]) => name.startsWith('EXPO_PUBLIC_'))
const generated = GENERATED_HEADER + expoOnly.map(([n, v]) => `${n}=${v}`).join('\n') + '\n'
if (write) {
  writeFileSync(MOBILE_ENV, generated)
  console.log(`wrote apps/mobile/.env (${expoOnly.length} value(s))`)
} else if (readFileSync(MOBILE_ENV, 'utf8') !== generated) {
  problems.push('apps/mobile/.env is stale — run: node tools/check-env.mjs --write')
}

// eas.json profile env OVERRIDES .env on an EAS build, so a stale entry here is the
// one that would actually ship.
const eas = JSON.parse(readFileSync(EAS_JSON, 'utf8'))
for (const [profile, config] of Object.entries(eas.build ?? {})) {
  for (const [name, value] of Object.entries(config.env ?? {})) {
    if (name in root && root[name] !== value) {
      problems.push(`eas.json ${profile}: ${name} is ${value}, /.env says ${root[name]}`)
    }
  }
}

// The fallback literal in the rail, for a checkout with no env at all.
const handle = readFileSync(HANDLE_TS, 'utf8')
const fallback = /process\.env\.NEXUS_MESSAGEBOX_URL \|\|\s*'([^']+)'/.exec(handle)
if (!fallback) {
  problems.push('handle.ts: could not find the MessageBox fallback literal')
} else if (fallback[1] !== root.NEXUS_MESSAGEBOX_URL) {
  problems.push(`handle.ts fallback is ${fallback[1]}, /.env says ${root.NEXUS_MESSAGEBOX_URL}`)
}

// Nothing may reintroduce a hardcoded host. This is the failure the whole file exists
// to prevent, and it is cheap to test for directly.
const RETIRED = ['messagebox.babbage.systems', 'message-box-us-1.bsvb.tech']
for (const host of RETIRED) {
  if (handle.includes(host)) problems.push(`handle.ts still mentions the retired host ${host}`)
}

if (problems.length > 0) {
  console.error('env drift:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log('ok  service endpoints agree across /.env, apps/mobile/.env, eas.json and handle.ts')
