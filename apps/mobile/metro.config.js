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

module.exports = config
