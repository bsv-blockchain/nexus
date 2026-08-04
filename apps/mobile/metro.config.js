'use strict'

// Metro (like babel.config.js) loads this file with Node's require() to
// configure the bundler process itself, so it stays CommonJS.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
// @nexus/bridge and @nexus/substrate live in <root>/packages/*, outside this
// app directory entirely. Metro's default config only watches/serves files
// under projectRoot, so without the two additions below `require('@nexus/bridge')`
// would resolve (Node module resolution still walks up to the root
// node_modules) but Metro's file watcher would never notice edits under
// packages/** and the dev server would serve a stale bundle after any change
// to the shared seam packages.
const workspaceRoot = path.resolve(projectRoot, '..', '..')

const config = getDefaultConfig(projectRoot)

// Watch the monorepo root too, not just this app directory, so changes under
// packages/** (and the root workspace node_modules) trigger a rebuild.
config.watchFolders = [workspaceRoot]

// Workspace packages are hoisted to <root>/node_modules by npm workspaces, but
// Metro's resolver, unlike Node's require(), does not walk up parent
// directories on its own — it needs both node_modules directories listed
// explicitly to find @nexus/bridge and @nexus/substrate.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
]

// --- Node-stdlib shims, carried over from BSV Browser -------------------------------
// @bsv/sdk reaches for node:crypto. Routing it to react-native-quick-crypto is not just a
// polyfill: it is what makes SHA256/PBKDF2/AES-GCM run natively rather than in JS, which
// the wallet's performance depends on.
config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-quick-crypto'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  ...config.resolver.extraNodeModules
}

const emptyShim = path.resolve(projectRoot, 'metro-shims/empty.js')
const quickCryptoMain = require.resolve('react-native-quick-crypto')

const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'node:crypto') return { type: 'sourceFile', filePath: quickCryptoMain }
  // node:buffer / node:process are reached for but unused on this path; an empty module is
  // safer than letting the bundler fail on a dependency the wallet never actually calls.
  if (moduleName === 'node:buffer' || moduleName === 'node:process') {
    return { type: 'sourceFile', filePath: emptyShim }
  }
  if (typeof upstream === 'function') return upstream(context, moduleName, platform)
  return context.resolveRequest(context, moduleName, platform)
}

// expo-sqlite ships a wasm build used on web.
config.resolver.assetExts.push('wasm')

module.exports = config
