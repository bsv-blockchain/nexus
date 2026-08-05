#!/usr/bin/env node
/**
 * Builds the Nexus UI static export.
 *
 * Replaces tools/fetch-ui.mjs, which cloned vincemedia/bsvnexus at build time and carried
 * our changes as patch files. That made sense only while the UI was someone else's
 * repository during the architecture spike. apps/ui IS our source now — tracked here and
 * edited like any other code — so the clone-and-patch machinery is gone with it.
 *
 * apps/ui is deliberately NOT an npm workspace member: it pins its own React version, and
 * hoisting that to the root confuses Metro's resolution for the mobile app.
 */
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UI = join(ROOT, 'apps/ui')

if (!existsSync(join(UI, 'package.json'))) {
  console.error(`No UI source at ${UI}. It is tracked in this repository — did a checkout go wrong?`)
  process.exit(1)
}

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  // On Windows there is no npm.exe — only npm.cmd — and a shell-less spawn tries
  // just .com/.exe, so execFileSync('npm', ...) dies with ENOENT (and 'npm.cmd'
  // without a shell throws EINVAL under Node's batch-file hardening). The shell is
  // required there; the args here are static, so shell quoting is not a concern.
  const win = process.platform === 'win32'
  execFileSync(win ? 'npm.cmd' : cmd, args, { cwd, stdio: 'inherit', shell: win })
}

if (!existsSync(join(UI, 'node_modules'))) run('npm', ['install'], UI)
else console.log('✓ apps/ui/node_modules present')

run('npm', ['run', 'build'], UI)

if (!existsSync(join(UI, 'out/index.html'))) {
  console.error('\nBuild finished but apps/ui/out/index.html is missing — the export did not run.')
  console.error("Check that apps/ui/next.config.ts still sets output: 'export'.")
  process.exit(1)
}

console.log('\n✓ export at apps/ui/out — next: node tools/bundle-ui.mjs')
