#!/usr/bin/env node
/**
 * Prepare the exported Nexus UI for offline use inside the app.
 *
 * Next emits absolute asset URLs ("/_next/..."), which under file:// resolve to the
 * filesystem root and load nothing. `assetPrefix` cannot fix this — next/font rejects any
 * prefix that is not a leading slash or an absolute URL — so the export is rewritten here
 * instead. That is safe only because the UI is a single route (app/page.tsx): with no
 * nested route documents, "./" always resolves against the same directory.
 *
 *   node tools/bundle-ui.mjs           # rewrite apps/ui/out and copy into the app
 *   node tools/bundle-ui.mjs --check   # report what would change, touch nothing
 */
import { readFileSync, writeFileSync, existsSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'apps/ui/out')
const DEST = join(ROOT, 'apps/mobile/assets/ui')
const CHECK = process.argv.includes('--check')

if (!existsSync(join(OUT, 'index.html'))) {
  console.error(`No export at ${OUT}.\nRun: npm run ui:build`)
  process.exit(1)
}

/** Walk a directory, yielding every file path. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

// Rewrite only the reference forms Next actually emits. A blanket s|/_next/|./_next/|
// would also corrupt source maps, JSON payloads and any string that merely contains the
// sequence, so each pattern is anchored to the character that precedes it.
const REWRITES = [
  [/(["'`])\/_next\//g, '$1./_next/'],
  [/(\(\s*)\/_next\//g, '$1./_next/'],
  [/(["'`])\/(images|icons|avatars|tokens|media|members|ordinals|collectibles|ecosystems)\//g, '$1./$2/'],
  // Root-level files the metadata layer emits. Harmless in a WebView if broken, but a
  // 404 per launch is noise in the logs when something real goes wrong later.
  [/(["'`])\/(site\.webmanifest|favicon\.ico)/g, '$1./$2']
]

// HTML ONLY, deliberately. Rewriting the JS breaks Next: its runtime derives the public
// path from document.currentScript.src and asserts that src contains the configured
// prefix. Rewriting the literal to "./_next/" made it demand that an absolute file:// URL
// contain "./_next/", which threw InvariantError before the app rendered a single pixel.
// Left alone, the assertion passes and Next resolves chunks against the script's own URL —
// which is precisely the behaviour that makes file:// work.
const REWRITABLE = new Set(['.html'])
let filesChanged = 0
let edits = 0

for (const file of walk(OUT)) {
  if (!REWRITABLE.has(extname(file))) continue
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [pattern, replacement] of REWRITES) after = after.replace(pattern, replacement)
  if (after === before) continue
  filesChanged++
  edits += after.split('./_next/').length - before.split('./_next/').length
  if (!CHECK) writeFileSync(file, after)
}

console.log(`${CHECK ? 'would rewrite' : 'rewrote'} ${filesChanged} file(s), ${edits} asset reference(s)`)

// No publicPath patching: Next already computes it from document.currentScript.src, so
// under file:// it lands on the directory the scripts were loaded from. Patching it was
// tried and actively broke the app — see the note on REWRITABLE.

const remaining = []
for (const file of walk(OUT)) {
  if (extname(file) !== '.html') continue
  const html = readFileSync(file, 'utf8')
  const hits = html.match(/(?:src|href)="\/[^"]*"/g)
  if (hits) remaining.push(`${file.replace(OUT, '')}: ${hits.slice(0, 3).join(', ')}`)
}
if (remaining.length) {
  console.warn('\n⚠ absolute references still present in HTML:')
  for (const r of remaining) console.warn('  ' + r)
}

if (CHECK) process.exit(0)

rmSync(DEST, { recursive: true, force: true })
cpSync(OUT, DEST, { recursive: true })

let bytes = 0
let count = 0
for (const f of walk(DEST)) {
  bytes += statSync(f).size
  count++
}
console.log(`\ncopied ${count} files (${(bytes / 1024 / 1024).toFixed(1)} MB) → ${DEST.replace(ROOT + '/', '')}`)
