#!/usr/bin/env node
/**
 * Web — the sixth platform, and the only one that is not a product.
 *
 * iOS, Android, macOS, Windows and Linux ship the shells: a real wallet, real
 * WebViews, and only the two apps backed by either (see apps/ui/lib/surfaces.ts).
 * The web build is the opposite of that — every prototype app, every fixture, no
 * wallet — because its job is to put an idea in front of a designer, a customer or
 * a partner this afternoon rather than to be anybody's wallet.
 *
 *   npm run web              serve it locally on :3000
 *   npm run web:deploy       push a preview build, get a URL to share
 *   npm run web:deploy -- --prod   publish to the project's own domain
 *
 * Deploys are noindex (vercel.json) and demo-only. Nothing here can reach a store.
 *
 * The Vercel CLI is deliberately NOT a dependency of this repo: it is ~200 MB that
 * five of the six platforms never touch. Install it once, globally.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UI = join(ROOT, 'apps/ui')

const [command = 'dev', ...rest] = process.argv.slice(2)
const PROD = rest.includes('--prod')

// Windows has no npm.exe/vercel.exe — only the .cmd shims — and a shell-less spawn
// tries just .com/.exe, so a bare execFileSync dies with ENOENT there. Same reasoning
// as tools/build-ui.mjs.
const WIN = process.platform === 'win32'
const bin = (name) => (WIN ? `${name}.cmd` : name)

/**
 * Run a command, and fail with a sentence rather than a stack.
 *
 * Everything this script shells out to is interactive and prints its own errors;
 * an execFileSync trace on top of that buries the message the dev needs.
 */
function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  try {
    execFileSync(bin(cmd), args, { cwd: UI, stdio: 'inherit', shell: WIN, ...opts })
  } catch {
    console.error(`\n${cmd} ${args[0] ?? ''} failed — see its output above.`)
    process.exit(1)
  }
}

/** Demo surfaces ON. The whole point of this target; see apps/ui/lib/surfaces.ts. */
const DEMO_ENV = { ...process.env, NEXT_PUBLIC_DEMO_DATA: '1' }

if (command === 'dev') {
  run('npm', ['run', 'dev'], { env: DEMO_ENV })
  process.exit(0)
}

if (command !== 'deploy') {
  console.error(`Unknown command "${command}". Expected: dev | deploy`)
  process.exit(1)
}

// --- deploy ----------------------------------------------------------------

const probe = spawnSync(bin('vercel'), ['--version'], { encoding: 'utf8', shell: WIN })
if (probe.status === 0) {
  // The build itself happens on Vercel's builders, so the local CLI is mostly an
  // uploader — but it does framework detection and vercel.json parsing locally, and
  // apps/ui is on Next 16. A CLI from before Next 15 shipped will not understand it.
  const major = Number((probe.stdout ?? '').trim().split('.')[0])
  if (Number.isFinite(major) && major < 41) {
    console.warn(
      `\n⚠ Vercel CLI ${probe.stdout.trim()} predates Next 15 and may misread apps/ui.\n` +
        '  npm i -g vercel@latest\n',
    )
  }
}
if (probe.status !== 0) {
  console.error(`
The Vercel CLI is not on your PATH.

  npm i -g vercel
  vercel login

It is not a dependency of this repo on purpose — it is ~200 MB, and only the web
target uses it.`)
  process.exit(1)
}

/*
 * Linking is per-checkout and interactive: it asks which team and which project,
 * and neither can be guessed. Doing it as its own step means a dev who is not yet
 * on the Vercel team gets the CLI's own "you don't have access" message at the
 * point it makes sense, rather than a confusing failure mid-build.
 */
const linked =
  existsSync(join(UI, '.vercel/project.json')) ||
  (process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID)

if (!linked) {
  // Linking asks which team and which project, and answers neither on its own —
  // `vercel link --yes` would silently create a NEW project named "ui" under your
  // personal scope, which is worse than stopping. So it only runs where a human
  // can answer it.
  if (!process.stdin.isTTY) {
    console.error(`
apps/ui is not linked to a Vercel project, and this is not an interactive shell.

  cd apps/ui && vercel link      # pick the BSV Association scope, then Nexus

Or set VERCEL_ORG_ID and VERCEL_PROJECT_ID in the environment.`)
    process.exit(1)
  }
  console.log('\napps/ui is not linked to a Vercel project yet — linking it now.')
  console.log('Pick the BSV Association scope, then the Nexus project.\n')
  run('vercel', ['link'])
}

// --build-env rather than a dashboard setting: which surfaces a build carries is
// the single most important fact about it, and it belongs in the command that
// produced it, where it can be read in a shell history six months later.
run('vercel', [
  'deploy',
  ...(PROD ? ['--prod'] : []),
  '--build-env',
  'NEXT_PUBLIC_DEMO_DATA=1',
  '--yes',
])

console.log(
  PROD
    ? '\n✓ published — the URL above is the shared demo'
    : '\n✓ preview deployed — the URL above is shareable and noindex',
)
