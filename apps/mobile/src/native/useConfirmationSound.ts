/**
 * The confirmation tone — the audible half of the "money landed" moment.
 *
 * Companion to `./useHaptics`, and deliberately the same shape: a plain module
 * object you can import anywhere, plus a hook alias for symmetry inside
 * components. Fire-and-forget, and it never throws.
 *
 * Three rules, all of them non-negotiable, because this plays in public:
 *
 *  1. RESPECT THE SILENT SWITCH. `playsInSilentMode: false` — a phone set to
 *     silent stays silent. An app that overrides the ringer switch for its own
 *     receipt noise is an app people mute permanently.
 *  2. NEVER MIX BADLY. `interruptionMode: 'mixWithOthers'` — we are a 0.6s
 *     blip, not a media session. Ducking or pausing someone's music to announce
 *     a payment is rude and, on iOS, sticky.
 *  3. NEVER BLOCK, NEVER THROW. A payment is not a sound. Every call site is
 *     `void`; every failure — an audio session another app owns, a decode
 *     error — is swallowed to a single dev warning. A silent success screen is
 *     a complete success screen.
 *
 * BSV Browser loaded `expo-audio` lazily, inside a try/catch, so a build
 * missing the native module would degrade to silence instead of taking the
 * module graph down. That was always a half-truth and is dropped here: Metro
 * resolves `require` at bundle time, so the catch only ever caught a native
 * side that failed to link — and a shell whose audio module did not link is
 * broken in ways one silent tone will not hide. `expo-audio` is a declared
 * dependency of this app; it is imported like one.
 */
import { useMemo } from 'react'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

// The bundled tone: a two-note chime, ~0.6s, peaking well below full scale.
// A static require, not an import: Metro resolves this to an asset id at build
// time, which is exactly the `number` shape expo-audio accepts as a source.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TONE = require('../../assets/sounds/payment-confirmed.wav')

let player: ReturnType<typeof createAudioPlayer> | null = null
let modeSet = false

function warn(e: unknown): void {
  if (__DEV__) console.warn('[sound] confirmation tone unavailable:', e instanceof Error ? e.message : String(e))
}

/**
 * Plays the confirmation tone, if the device is willing.
 *
 * Returns immediately. The audio-session configuration is awaited *inside* the
 * fire-and-forget promise rather than by the caller, so nothing on a payment
 * path ever waits on CoreAudio.
 */
function playConfirmation(): void {
  void (async () => {
    try {
      if (!modeSet) {
        // Set once per process. Doing it before the first play (rather than at
        // startup) keeps the app from claiming an audio session it may never use.
        await setAudioModeAsync({
          playsInSilentMode: false,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
          allowsRecording: false
        })
        modeSet = true
      }
      // One player, reused. Constructing a fresh one per payment leaks native
      // objects on a screen a market stall might run all day.
      if (!player) player = createAudioPlayer(TONE)
      await player.seekTo(0)
      player.play()
    } catch (e) {
      warn(e)
    }
  })()
}

/**
 * Releases the shared player. Optional — call it when the last screen that can
 * play a tone unmounts, to hand the native object back early.
 */
function releaseConfirmation(): void {
  const p = player
  player = null
  modeSet = false
  try {
    p?.remove()
  } catch (e) {
    warn(e)
  }
}

export const sounds = {
  /** The money landed. Pairs with `haptics.success()`; never fires one for the other. */
  confirmation: playConfirmation,
  release: releaseConfirmation
} as const

export const useConfirmationSound = () => useMemo(() => sounds, [])
