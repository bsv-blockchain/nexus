#!/usr/bin/env node
/**
 * Haven app icon — generator.
 *
 * The mark: a dragon coiled into a closed ring around a single luminous core. The ring
 * IS the haven — the canonical image of a dragon guarding a hoard, except the hoard is
 * your identity. The core is a hexagon with three short connector stubs, so "node on a
 * network of other dragons" is the same shape as "the thing being guarded", rather than
 * extra clutter competing for the 60px silhouette.
 *
 * Geometry is computed rather than hand-drawn: the body is a tapering annulus sampled
 * parametrically, so thickness, coil radius, fin spacing and head proportions are all
 * tunable constants instead of magic path data nobody can edit later.
 *
 * Output: assets/icon.svg (1024×1024, opaque — iOS icons must not carry alpha, and the
 * system applies its own corner mask, so no rounded corners here).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../../assets/icon.svg')

// ---- tunables ---------------------------------------------------------------
const S = 1024
const C = S / 2

const R0 = 316 // coil radius at the tail
const SPIRAL = 18 // how much the coil opens up by the time it reaches the head
const W_MIN = 11 // half-width at the tail tip
const W_MAX = 64 // half-width at the neck
const BULGE = 0.1 // slight mid-body swell so the coil reads as a body, not a tube

const THETA_TAIL = 250 // degrees, standard math orientation
const SWEEP = -320 // negative = clockwise on screen; leaves a 40° gap at the bottom

// Crest, not a ring of spikes: evenly spaced fins all the way round read as a cog.
// Confining them to the dorsal arc and swelling them in the middle reads as a back.
const FIN_COUNT = 11
const FIN_FROM = 0.22
const FIN_TO = 0.74
const FIN_LEN = 46

const HEAD_LEN = 236
const GEM_R = 112

const SAMPLES = 260

// ---- helpers ----------------------------------------------------------------
const rad = (d) => (d * Math.PI) / 180
const n2 = (v) => Math.round(v * 10) / 10

/** Polar → SVG point. y is flipped so positive angles read counter-clockwise on screen. */
function P(angleDeg, r) {
  return [C + r * Math.cos(rad(angleDeg)), C - r * Math.sin(rad(angleDeg))]
}

const theta = (t) => THETA_TAIL + t * SWEEP
const radius = (t) => R0 + SPIRAL * t

/** Half-width along the body: thin whip at the tail, thick at the neck. */
function halfWidth(t) {
  const base = W_MIN + (W_MAX - W_MIN) * Math.pow(t, 0.72)
  // Taper the last tenth as well. Without it the coil stops at full width in a flat cut
  // that reads as unfinished rather than as a creature.
  const endTaper = Math.min(1, Math.max(0.16, (1 - t) / 0.1))
  return base * (1 + BULGE * Math.sin(Math.PI * t)) * endTaper
}

function centreline(t) {
  return P(theta(t), radius(t))
}

/** Unit tangent (direction of travel) and outward normal at parameter t. */
function frame(t) {
  const e = 0.0015
  const a = centreline(Math.max(0, t - e))
  const b = centreline(Math.min(1, t + e))
  let tx = b[0] - a[0]
  let ty = b[1] - a[1]
  const len = Math.hypot(tx, ty) || 1
  tx /= len
  ty /= len
  const c = centreline(t)
  let ox = c[0] - C
  let oy = c[1] - C
  const olen = Math.hypot(ox, oy) || 1
  return { pos: c, t: [tx, ty], out: [ox / olen, oy / olen] }
}

function edgePoint(t, side) {
  const { pos, out } = frame(t)
  const w = halfWidth(t) * side
  return [pos[0] + out[0] * w, pos[1] + out[1] * w]
}

function poly(points) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n2(x)} ${n2(y)}`).join(' ')
}

// ---- body -------------------------------------------------------------------
const outer = []
const inner = []
for (let i = 0; i <= SAMPLES; i++) {
  const t = i / SAMPLES
  outer.push(edgePoint(t, 1))
  inner.push(edgePoint(t, -1))
}

// Head frame: everything below is expressed as forward/side offsets from the neck, so
// the head stays glued to the body no matter how the coil constants change.
const neck = frame(1)
const F = neck.t
const N = neck.out
const hp = (f, s) => [neck.pos[0] + F[0] * f + N[0] * s, neck.pos[1] + F[1] * f + N[1] * s]
const w1 = halfWidth(1)

// The coil terminates in a taper rather than a modelled head. Three attempts at a
// polygon dragon head (see git history) each read as a rodent, a fish or a mitten at
// icon size; the coil plus dorsal crest carries the dragon far more reliably than bad
// anatomy does. A designer replacing this only has to touch this file.

// ---- spine fins -------------------------------------------------------------
const fins = []
for (let i = 0; i < FIN_COUNT; i++) {
  const t = FIN_FROM + (FIN_TO - FIN_FROM) * (i / (FIN_COUNT - 1))
  const { pos, t: tan, out } = frame(t)
  const scale = 0.45 + 0.55 * t
  const base = halfWidth(t)
  const bx = pos[0] + out[0] * base
  const by = pos[1] + out[1] * base
  const spread = 30 * scale
  fins.push(
    poly([
      [bx - tan[0] * spread, by - tan[1] * spread],
      [bx + out[0] * FIN_LEN * scale - tan[0] * spread * 0.35, by + out[1] * FIN_LEN * scale - tan[1] * spread * 0.35],
      [bx + tan[0] * spread * 0.5, by + tan[1] * spread * 0.5]
    ])
  )
}


// ---- core -------------------------------------------------------------------
const hex = []
for (let i = 0; i < 6; i++) {
  const a = 90 + i * 60
  hex.push(P(a, GEM_R))
}
const gem = poly(hex) + ' Z'

// Facet history, so nobody re-adds these: a centre line plus two upper diagonals turned
// the hexagon into an isometric CUBE (read as a shipping-box icon); an outlined polygon
// read as a scribble. A single filled highlight over the upper-left third gives the
// sense of a cut stone with one shape and never suggests a third dimension.
const facetHighlight = poly([hex[1], hex[2], [C, C + GEM_R * 0.18], [C - GEM_R * 0.2, C - GEM_R * 0.5]])

// ---- assemble ---------------------------------------------------------------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#241246"/>
      <stop offset="0.55" stop-color="#1A0E31"/>
      <stop offset="1" stop-color="#120A22"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFB347" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#FF7A2F" stop-opacity="0.13"/>
      <stop offset="1" stop-color="#FF7A2F" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scale" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#FFD98A"/>
      <stop offset="0.34" stop-color="#F5A63C"/>
      <stop offset="0.68" stop-color="#DE6127"/>
      <stop offset="1" stop-color="#9E3320"/>
    </linearGradient>
    <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFC46B"/>
      <stop offset="1" stop-color="#C2451F"/>
    </linearGradient>
    <!-- The head sits at the tail end of the body gradient, where it is darkest. Its own
         ramp keeps it the second-brightest element after the core, so it reads. -->
    <linearGradient id="headGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#E8873A"/>
      <stop offset="1" stop-color="#FFDC96"/>
    </linearGradient>
    <radialGradient id="core" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.42" stop-color="#FFE7AE"/>
      <stop offset="1" stop-color="#FFA53D"/>
    </radialGradient>
  </defs>

  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <circle cx="${C}" cy="${C}" r="${Math.round(GEM_R * 3.1)}" fill="url(#halo)"/>

  <g fill="url(#finGrad)">
    ${fins.map((d) => `<path d="${d} Z"/>`).join('\n    ')}
  </g>

  <path d="${poly(outer)} ${poly(inner.reverse()).replace(/^M/, 'L')} Z" fill="url(#scale)"/>

  <path d="${gem}" fill="url(#core)"/>
  <path d="${facetHighlight} Z" fill="#FFFFFF" opacity="0.34"/>
</svg>
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, svg)
console.log(`wrote ${OUT} (${(svg.length / 1024).toFixed(1)} KB)`)
