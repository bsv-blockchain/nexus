/**
 * Root entry point.
 *
 * Everything above registerRootComponent runs BEFORE any BSV code is imported, and
 * the order matters. The wallet's very first act — deriving keys from a recovery
 * phrase — needs a secure RNG, and React Native has none out of the box: without
 * the install below @bsv/sdk fails with "No secure random number generator is
 * available in this environment" and no wallet can ever be created.
 */

// react-native-quick-crypto first: install() sets global.Buffer and global.crypto
// through JSI, which every later import depends on.
import { install } from 'react-native-quick-crypto'
install()

// @bsv/sdk's Random.js probes globalThis.crypto, then self.crypto, then
// window.crypto. QuickCrypto only populates `global`, so the same object is
// propagated to each of those names — miss one and the failure is intermittent and
// reads like a wallet bug rather than a setup bug.
if (typeof globalThis === 'undefined') {
  global.globalThis = global
}

if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
  globalThis.crypto = global.crypto
  if (typeof global.self === 'undefined') global.self = global
  else if (!global.self.crypto) global.self.crypto = global.crypto
  if (typeof global.window === 'undefined') global.window = global
  else if (!global.window.crypto) global.window.crypto = global.crypto
} else {
  console.warn('[crypto] global.crypto missing after quick-crypto install(); key derivation will fail')
}

// Native secp256k1 (Nitro module over rust-secp256k1). The patched @bsv/sdk
// primitives look for `globalThis.__bsvSecpNative` and route EC hot paths to it.
// A no-op when the module is absent — the SDK keeps its pure-JS implementations.
try {
  const { installSecpNative } = require('react-native-secp-native')
  const installed = installSecpNative()
  if (__DEV__) console.log(`[secp-native] ${installed ? 'installed' : 'unavailable — pure-JS EC'}`)
} catch (e) {
  if (__DEV__) console.warn('[secp-native] install failed — pure-JS EC', e)
}

// Native transaction engine (Nitro module over bsv-rs). The patched
// Transaction.sign probes `globalThis.__bsvEngineNative` to batch-sign all-P2PKH
// input sets in one native crossing. Also a safe no-op when absent.
try {
  const { installEngineNative } = require('react-native-engine-native')
  const installed = installEngineNative()
  if (__DEV__) console.log(`[engine-native] ${installed ? 'installed' : 'unavailable — pure-JS tx path'}`)
} catch (e) {
  if (__DEV__) console.warn('[engine-native] install failed — pure-JS tx path', e)
}

import { registerRootComponent } from 'expo'

// `require`, not `import`: ES imports are hoisted above the install() calls above,
// so importing the app here would evaluate the entire wallet — @bsv/sdk included —
// before the RNG exists. Requiring it inline pins it to this point in the file.
const App = require('./App').default

// registerRootComponent both loads Expo's autolinked native module setup and
// calls AppRegistry.registerComponent('main', () => App), so this one call
// works identically from Expo Go, a dev client, or a native release build.
registerRootComponent(App)
