/**
 * Semantic haptic vocabulary. Import `haptics` directly in plain modules; use
 * `useHaptics()` in components for symmetry with other hooks.
 *
 * The names are semantic rather than physical so a screen asks for the meaning of
 * the moment and not for a waveform — that is what keeps two screens confirming
 * the same kind of thing from feeling different.
 *
 * | semantic | iOS                         | Android |
 * |----------|-----------------------------|---------|
 * | tap      | selectionAsync              | no-op   |
 * | confirm  | impactAsync(Light)          | no-op   |
 * | success  | notificationAsync(Success)  | vibrate |
 * | warning  | notificationAsync(Warning)  | vibrate |
 * | error    | notificationAsync(Error)    | vibrate |
 *
 * The light iOS-only cases are suppressed on Android because Android has no
 * equivalent: it would fall back to a coarse buzz, and a buzz on every selection
 * is worse than silence.
 *
 * All calls are fire-and-forget and never throw. Haptics fail for reasons the
 * caller cannot act on — no motor, a system setting, a backgrounded app — so a
 * rejection here must never surface as an error in a payment flow.
 */
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

const swallow = (p: Promise<void>) => { p.catch(() => {}) }
const isIOS = () => Platform.OS === 'ios'

export const haptics = {
  tap: () => { if (isIOS()) swallow(Haptics.selectionAsync()) },
  confirm: () => { if (isIOS()) swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)) },
  success: () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
} as const

export type HapticName = keyof typeof haptics

export const useHaptics = () => haptics
