#!/usr/bin/env node
/**
 * Idempotent UI fetcher for Nexus.
 * Prepares the vincemedia/bsvnexus UI for static export.
 *
 * Usage:
 *   node tools/fetch-ui.mjs         # fetch and configure
 *   node tools/fetch-ui.mjs --build # fetch, configure, and build
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const uiDir = join(import.meta.dirname, '..', 'apps', 'ui')
const shouldBuild = process.argv.includes('--build')

/**
 * Step 1: Clone the UI if not already present
 */
function ensureCloned () {
  if (existsSync(uiDir)) {
    console.log(`✓ ${uiDir} already exists`)
    return
  }

  console.log(`Cloning vincemedia/bsvnexus into ${uiDir}...`)
  try {
    execSync(
      `git clone --depth 1 https://github.com/vincemedia/bsvnexus "${uiDir}"`,
      { stdio: 'inherit' }
    )
  } catch (err) {
    console.error(`✗ Clone failed: ${err.message}`)
    process.exit(1)
  }

  // Remove the nested .git so outer repo doesn't see it as a submodule
  const gitDir = join(uiDir, '.git')
  if (existsSync(gitDir)) {
    console.log('Removing nested .git...')
    rmSync(gitDir, { recursive: true, force: true })
  }
}

/**
 * Step 2: Install dependencies if not already done
 */
function ensureInstalled () {
  const nodeModules = join(uiDir, 'node_modules')
  if (existsSync(nodeModules)) {
    console.log(`✓ ${uiDir}/node_modules exists`)
    return
  }

  console.log('Installing dependencies...')
  try {
    execSync(`npm install --prefix "${uiDir}"`, { stdio: 'inherit' })
  } catch (err) {
    console.error(`✗ npm install failed: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Step 3: Ensure next.config.mjs exists with output: 'export'
 */
function ensureConfig () {
  // Check if a config file already exists
  const configNames = ['next.config.js', 'next.config.mjs', 'next.config.ts']
  let existingConfig = null
  let hasExportOutput = false

  for (const name of configNames) {
    const path = join(uiDir, name)
    if (existsSync(path)) {
      existingConfig = name
      const content = readFileSync(path, 'utf-8')
      // Check if output: 'export' is present (simple string search)
      if (content.includes("output: 'export'") || content.includes('output: "export"')) {
        hasExportOutput = true
      }
      break
    }
  }

  if (existingConfig && hasExportOutput) {
    console.log(`✓ ${existingConfig} already has output: 'export'`)
    return
  }

  if (existingConfig && !hasExportOutput) {
    console.log(
      `⚠ Found ${existingConfig} but it does not set output: 'export'.\n` +
      `  Please edit ${existingConfig} to add output: 'export' and\n` +
      `  images: { unoptimized: true }, trailingSlash: true`
    )
    return
  }

  // Create next.config.mjs
  const configPath = join(uiDir, 'next.config.mjs')
  const configContent = `/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true
}

export default config
`

  console.log(`Writing ${configPath}...`)
  try {
    writeFileSync(configPath, configContent, 'utf-8')
  } catch (err) {
    console.error(`✗ Failed to write config: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Step 4: Build if --build was passed
 */
function maybeBuild () {
  if (!shouldBuild) {
    return
  }

  console.log('Building static export...')
  const result = spawnSync('npm', ['run', 'build', '--prefix', uiDir], {
    encoding: 'utf-8'
  })

  if (result.status !== 0) {
    // Capture and print the tail of the error
    const stderr = result.stderr || ''
    const stdout = result.stdout || ''
    const output = stderr || stdout

    if (output) {
      // Print the last 30 lines of output (or whatever fits)
      const lines = output.split('\n').filter(l => l.trim())
      const tail = lines.slice(-30).join('\n')
      if (tail) {
        console.error('\nBuild error output:')
        console.error(tail)
      }
    }

    console.error('\n✗ Build failed')
    process.exit(1)
  }

  // Check if build succeeded
  const outIndex = join(uiDir, 'out', 'index.html')
  if (existsSync(outIndex)) {
    console.log(`✓ Build succeeded: ${outIndex}`)
  } else {
    console.warn(`⚠ Build completed but ${outIndex} not found`)
  }
}

/**
 * Step 5: Print next steps
 */
function printNextSteps () {
  console.log('\n=== Next Steps ===')
  console.log('Dev server (live reloading, http://localhost:3000):')
  console.log('  npm run ui:dev')
  console.log('\nStatic export (if built), point a shell at apps/ui/out:')
  console.log('  NEXUS_CHROME_URL=file://$(pwd)/apps/ui/out/index.html npm run desktop')
  console.log('  NEXUS_CHROME_URL=file://$(pwd)/apps/ui/out/index.html npm run mobile')
}

// Run all steps
try {
  ensureCloned()
  ensureInstalled()
  ensureConfig()
  maybeBuild()
  printNextSteps()
} catch (err) {
  console.error(`Unexpected error: ${err.message}`)
  process.exit(1)
}
