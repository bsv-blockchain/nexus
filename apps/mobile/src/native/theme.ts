/**
 * Design tokens for the shell's native surfaces.
 *
 * BSV Browser carries two palettes and a ThemeContext that swaps between them at
 * runtime. Nexus is dark-only by declaration (`app.json` pins
 * `userInterfaceStyle: dark`), so there is no second palette to switch to and no
 * state for a context to hold. Porting the plumbing would add a provider whose
 * value can never change, and a contrast assertion for a pair of colours that can
 * never be re-paired.
 *
 * What survives is the values themselves — identical to
 * `bsv-browser/context/theme/{tokens,motion}.ts` — plus a `useTheme()` shim so a
 * ported component's `const { colors } = useTheme()` keeps compiling. New code in
 * this directory should import `colors` directly; the hook exists to keep ports
 * diffable against their source, not because there is anything to look up.
 *
 * Note that `easings.out` makes this module import react-native-reanimated for
 * real, not just for types — so every native surface that reads a token pulls the
 * animation runtime in at module scope. That is already true of the surfaces this
 * file was written for, and splitting the tokens across two files to spare the one
 * that does not animate would cost more than it saves.
 */

import { Easing } from 'react-native-reanimated'
import type { WithSpringConfig } from 'react-native-reanimated'

/* -------------------------------- Spacing -------------------------------- */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
} as const

/* --------------------------------- Radii --------------------------------- */

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999
} as const

/* ------------------------------- Typography ------------------------------ */

/**
 * The iOS type scale, close to a 1.25 (major third) ratio anchored on `body` at
 * 17pt: 13 · 17 · 22 · 28 · 34.
 *
 * `display` continues that ratio one step past `largeTitle` (34 × 1.25 ≈ 42,
 * rounded to 44 to sit on the 4pt grid). It is for a single focal figure on a
 * screen that has one — an amount being handed to another person — and nothing
 * else. Two `display` elements on one view means the view has no focal point.
 */
export const typography = {
  display: { fontSize: 44, fontWeight: '700' as const, lineHeight: 52, letterSpacing: -0.5 },
  largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption1: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  caption2: { fontSize: 11, fontWeight: '400' as const, lineHeight: 13 }
} as const

/* --------------------------------- Colors -------------------------------- */

export const colors = {
  // `textOnAccent` is the contrast partner of `accent`, and in a dark palette that
  // means the accent is light and the text on it is dark. Setting them to the same
  // brightness renders white-on-white buttons; there is no runtime check for it
  // here because there is no second palette that could drift out of step.
  accent: 'white',
  accentSecondary: '#e8e8e8',

  // Backgrounds
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  backgroundElevated: '#1C1C1E',

  // Translucent chrome
  chromeBackground: 'rgba(29, 29, 31, 0.94)',
  chromeBackgroundBlur: 'rgba(29, 29, 31, 0.72)',
  sheetBackground: 'rgba(28, 28, 30, 0.97)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235, 235, 245, 0.6)',
  textTertiary: 'rgba(235, 235, 245, 0.3)',
  textQuaternary: 'rgba(235, 235, 245, 0.18)',
  textOnAccent: '#000000',

  // Separators
  separator: 'rgba(84, 84, 88, 0.6)',
  separatorOpaque: '#38383A',

  // Fills
  fill: 'rgba(120, 120, 128, 0.36)',
  fillSecondary: 'rgba(120, 120, 128, 0.32)',
  fillTertiary: 'rgba(118, 118, 128, 0.24)',

  // Status
  success: '#30D158',
  error: '#FF453A',
  warning: '#FF9F0A',
  info: '#0A84FF',

  // Permission approval
  permissionProtocol: '#1fae4378',
  permissionBasket: '#1fae4378',
  permissionIdentity: '#24588dff',
  permissionSpending: '#FF9F0A'
} as const

/** The name ported components import it under. */
export const darkColors = colors

export type ThemeColors = typeof colors

/* ------------------------------ Hit Targets ------------------------------ */

export const hitTargets = {
  /** iOS HIG minimum touch target. */
  minimum: 44
} as const

/* --------------------------------- Motion -------------------------------- */

/**
 * Easing curves for `withTiming`.
 *
 * There is exactly one, and it decelerates. UI motion in this app models something
 * arriving and coming to rest, so it must start at full speed and settle — an
 * ease-IN reads as the interface hesitating before it obeys, and is never correct
 * for a response to a tap. Where a curve is not expressive enough on its own, reach
 * for `springs` instead of inventing a second curve.
 */
export const easings = {
  /** cubic-bezier(0.23, 1, 0.32, 1) — a long, soft deceleration. */
  out: Easing.bezier(0.23, 1, 0.32, 1)
} as const

export const springs = {
  /** Buttons, small elements, alert cards. Custom-tuned — NOT Reanimated's built-in presets. */
  snappy: { mass: 1, stiffness: 380, damping: 36 } satisfies WithSpringConfig,
  /** Larger surfaces: sheets, popovers, dropdowns. */
  settle: { mass: 1, stiffness: 280, damping: 32 } satisfies WithSpringConfig
} as const

/** Milliseconds. Nothing in this app animates longer than `moderate`. */
export const durations = {
  /** Crossfades, press feedback. */
  instant: 150,
  /** Small movements, toasts. */
  quick: 250,
  /** Largest allowed — full-surface transitions. */
  moderate: 350
} as const

/* ---------------------------------- Shim --------------------------------- */

/**
 * Constant by construction. Ports keep their `useTheme()` call rather than being
 * rewritten around a direct import, so a later diff against BSV Browser shows the
 * behavioural changes and not this one.
 */
export function useTheme(): { colors: ThemeColors } {
  return { colors }
}
