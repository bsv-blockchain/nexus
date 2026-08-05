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
// Both shells get their own copy of the same rewritten export. The rewrite is what
// makes it loadable without a server (see REWRITES below), and Electron loading it
// over file:// needs exactly the same treatment a WebView does.
const DESTS = [join(ROOT, 'apps/mobile/assets/ui'), join(ROOT, 'apps/desktop/ui')]
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
/**
 * Static assets under public/. These appear as bare strings in the JS bundles too —
 * an app's `iconSrc`, a member's avatar — and a WebView resolves "/icons/x.svg"
 * against the FILESYSTEM ROOT under file://, so every one of them 404s. Left
 * unrewritten the app store and the icon rail render nothing but broken images.
 *
 * Safe to apply to JS because the leading quote anchors each match to a complete
 * string literal, and a relative URL in an `img src` resolves against the document —
 * which is the directory these files are actually in.
 */
const ASSET_REWRITES = [
  [/(["'`])\/(images|icons|avatars|tokens|media|members|ordinals|collectibles|ecosystems)\//g, '$1./$2/'],
  // Root-level files the metadata layer emits. Harmless in a WebView if broken, but a
  // 404 per launch is noise in the logs when something real goes wrong later.
  [/(["'`])\/(site\.webmanifest|favicon\.ico)/g, '$1./$2']
]

/**
 * `/_next/` is HTML ONLY, deliberately. Rewriting it in the JS breaks Next: its
 * runtime derives the public path from document.currentScript.src and asserts that
 * src contains the configured prefix. Rewriting the literal to "./_next/" made it
 * demand that an absolute file:// URL contain "./_next/", which threw InvariantError
 * before the app rendered a single pixel. Left alone, the assertion passes and Next
 * resolves chunks against the script's own URL — which is what makes file:// work.
 */
const CHUNK_REWRITES = [
  [/(["'`])\/_next\//g, '$1./_next/'],
  [/(\(\s*)\/_next\//g, '$1./_next/']
]

const REWRITES_FOR = { '.html': [...CHUNK_REWRITES, ...ASSET_REWRITES], '.js': ASSET_REWRITES }
let filesChanged = 0
let edits = 0

for (const file of walk(OUT)) {
  const rewrites = REWRITES_FOR[extname(file)]
  if (!rewrites) continue
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [pattern, replacement] of rewrites) after = after.replace(pattern, replacement)
  if (after === before) continue
  filesChanged++
  edits += after.split('"./').length - before.split('"./').length
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

/*
 * Imagery that exists only for the demo surfaces.
 *
 * 27 MB of apps/ui/public is ordinal art, member portraits, avatars and stock photos
 * for the thirteen prototype apps — plus the PWA icons and OG card, which only the
 * web preview ever serves. Every byte of it was being copied into all five shipped
 * binaries. A shipping build has no app that can reference any of it, so it goes.
 *
 * Directory names match the ASSET_REWRITES list above, which is the other place that
 * knows what public/ contains; keep the two in step.
 */
const DEMO_ASSET_DIRS = ['collectibles', 'media', 'avatars', 'ordinals', 'members', 'img']
const DEMO_ASSET_FILES = [
  // The OG card and PWA icons are served by the web preview and nothing else — a
  // native app has its own launcher icon and is never linked to in a feed.
  'og-image.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png',
  // Referenced by nothing in any build. public/images/ as a whole is NOT prunable:
  // getting-started-page.tsx is chrome, not a demo app, and reads one photo from it.
  'images/consumer.webp',
  'images/creative.webp',
  'images/dev.webp',
  'christian-regg-FNaFLvbLFuk-unsplash.jpg',
]

function prune(dest) {
  let freed = 0
  const drop = (p) => {
    if (!existsSync(p)) return
    for (const f of statSync(p).isDirectory() ? walk(p) : [p]) freed += statSync(f).size
    rmSync(p, { recursive: true, force: true })
  }
  for (const dir of DEMO_ASSET_DIRS) drop(join(dest, dir))
  for (const file of DEMO_ASSET_FILES) drop(join(dest, file))
  return freed
}

// Written by build-ui.mjs, which is the process that actually knew. Absent means the
// export predates this and its provenance is unknown — treat it as a demo build and
// prune nothing, so a stale export never silently ships a half-stripped payload.
const buildInfo = existsSync(join(OUT, 'build.json'))
  ? JSON.parse(readFileSync(join(OUT, 'build.json'), 'utf8'))
  : { demo: true }

for (const dest of DESTS) {
  rmSync(dest, { recursive: true, force: true })
  cpSync(OUT, dest, { recursive: true })
  if (!buildInfo.demo) {
    const freed = prune(dest)
    console.log(`pruned ${(freed / 1024 / 1024).toFixed(1)} MB of demo assets from ${dest.replace(ROOT + '/', '')}`)
  }
}
const DEST = DESTS[0]

let bytes = 0
let count = 0
for (const f of walk(DEST)) {
  bytes += statSync(f).size
  count++
}
console.log(`\ncopied ${count} files (${(bytes / 1024 / 1024).toFixed(1)} MB) → ${DESTS.map(d => d.replace(ROOT + '/', '')).join(', ')}`)
