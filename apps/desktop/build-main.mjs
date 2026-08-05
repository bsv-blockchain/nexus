#!/usr/bin/env node
/**
 * Bundle the Electron main process.
 *
 * Main used to be plain `src/main.mjs` that Electron ran directly, which was fine
 * while it only managed tabs. The wallet changes that: the storage layer and
 * wallet-core are TypeScript, and Electron strips no types — so main has to be built.
 *
 * esbuild rather than tsc: the point is one runnable file, not per-file emit. It also
 * resolves the `@nexus/*` workspace symlinks, which a tsc build would leave as bare
 * imports that fail inside an asar with pruned dependencies.
 *
 *   node build-main.mjs           build once
 *   node build-main.mjs --watch   rebuild on change
 */
import { build, context } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(HERE, 'src/main.mjs')],
  // .cjs, NOT .js: this package is "type": "module", so Node reads a .js file as ESM
  // and the CJS bundle died on its own first line with "require is not defined".
  // The extension is what selects the module system here — `format: 'cjs'` alone is
  // only half the decision.
  outfile: join(HERE, 'dist-electron/main.cjs'),
  bundle: true,
  platform: 'node',
  // Electron 43 ships Node 24. Targeting it keeps async/await and modern syntax
  // intact rather than downlevelling into helpers.
  target: 'node24',
  // CJS, not ESM. Electron's main can load ESM, but a bundled ESM output plus
  // `require`-shaped dependencies inside @bsv packages is a known source of
  // "require is not defined" at runtime; CJS sidesteps it entirely.
  format: 'cjs',
  sourcemap: true,
  // electron is provided by the runtime. node:sqlite and node:* are built in — and
  // must NOT be bundled, or esbuild tries to resolve them as packages.
  external: ['electron', 'node:sqlite', 'node:async_hooks'],
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    // CJS output has no import.meta, and esbuild's fallback is `{}` — so
    // `fileURLToPath(import.meta.url)` became `fileURLToPath(undefined)` and threw
    // before the first window could open. It is only a WARNING at build time, which
    // is exactly why it has to be handled deliberately here.
    'import.meta.url': '__nexusFileUrl'
  },
  // Rebuilt from __filename, so every collapsed module reports the bundle's own URL.
  // Both users (main.mjs, tabManager.mjs) only want the directory the bundle and the
  // preloads sit in, which is that same directory.
  banner: {
    js: "const __nexusFileUrl = require('node:url').pathToFileURL(__filename).href;"
  }
}

/**
 * The preloads are separate bundles, not copies.
 *
 * They `require('@nexus/bridge')` and `require('@nexus/substrate')` out of the
 * workspace, which works in dev and fails in a packaged app: electron-builder ships
 * only `dist-electron/` and `package.json`, so there is no node_modules on the other
 * side. Copying them produced an app whose window opened with no `window.nexusHost`
 * at all — the chrome would have sat there with a dead bridge.
 *
 * Bundling each one also removes the `sandbox: false` concession their own headers
 * flag, since a sandboxed preload can load a self-contained file but cannot `require`.
 */
async function buildPreloads() {
  for (const name of ['preload-chrome', 'preload-tab']) {
    await build({
      entryPoints: [join(HERE, `src/${name}.cjs`)],
      outfile: join(HERE, `dist-electron/${name}.cjs`),
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'cjs',
      sourcemap: true,
      external: ['electron'],
      logLevel: 'warning'
    })
  }
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  await buildPreloads()
  console.log('[build-main] watching')
} else {
  await build(options)
  await buildPreloads()
  console.log('[build-main] built dist-electron/main.cjs')
}
