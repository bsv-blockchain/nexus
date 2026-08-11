/**
 * Extensionless-specifier resolution, so Node can import this package's sources.
 *
 * Every relative import in `packages/wallet-core/src` is extensionless
 * (`./entropy`, `./utils/pay/rails`) because that is what Metro and the desktop
 * bundler resolve. Node's ESM loader does not, so a test that imports one module
 * which imports another fails at load time on the inner specifier.
 *
 * Same shim as `packages/wallet-storage/test/nodeDriver.test.mjs` uses, minus its
 * react-native tripwire — nothing reachable from `entropy.ts` or `backupShares.ts`
 * touches the platform.
 *
 * IMPORT THIS FIRST, then reach the modules under test with `await import(...)`. A
 * static import would be RESOLVED during the load phase, before this file has had a
 * chance to evaluate and register anything.
 */

import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      // Already carries an extension: the failure is real, not a resolution style.
      if (/\.[cm]?[jt]sx?$/.test(specifier)) throw err
      for (const ext of ['.ts', '.tsx', '.js', '/index.ts']) {
        try {
          return nextResolve(specifier + ext, context)
        } catch {
          /* keep trying; the original error is the one worth reporting */
        }
      }
      throw err
    }
  }
})

/** The `src/` directory, for the dynamic imports each test file makes. */
export const SRC = new URL('../src/', import.meta.url).href
