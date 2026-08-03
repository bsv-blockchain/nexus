/**
 * Demo data versus real wallet data.
 *
 * The UI began as a demo: ~9k lines of typed fixtures in lib/data, consumed by 89
 * components. Those fixtures are genuinely useful — screenshots, sales demos, App Store
 * review, and UI work with no wallet or funds — so they are not being deleted. They are
 * being put behind a switch.
 *
 * Two independent controls, because they answer different questions:
 *
 *   resolveDataMode()        which source THIS SESSION reads from
 *   DEMO_DATA_COMPILED_IN    whether the fixtures are in the BUNDLE at all
 *
 * The second is what "switch it off before we go live" means: with
 * NEXT_PUBLIC_DEMO_DATA=0 the guard below is statically false, so bundlers drop the
 * fixture imports entirely and no invented balance can ever reach a real user's screen.
 */
export type DataMode = 'demo' | 'live'

const OVERRIDE_KEY = 'nexus.dataMode'

/**
 * Whether fixtures are compiled in. Written as a literal comparison on purpose — a
 * bundler can only tree-shake this if it can see the answer statically.
 */
export const DEMO_DATA_COMPILED_IN = process.env.NEXT_PUBLIC_DEMO_DATA !== '0'

/**
 * Precedence: explicit override, then whether a shell is present to answer at all.
 *
 * A `?data=demo` query parameter beats a stored preference so a link can pin the mode for
 * a screenshot or a bug report without disturbing the tester's own setting.
 */
export function resolveDataMode(): DataMode {
  // Server render / static export: no shell, no storage. Fixtures render something real
  // enough to prerender, and the client corrects on hydration.
  if (typeof window === 'undefined') return DEMO_DATA_COMPILED_IN ? 'demo' : 'live'

  const forced = readOverride()
  if (forced) {
    // Refuse to promise demo data that was compiled out — better a visibly empty screen
    // than a silent fallback nobody can explain.
    if (forced === 'demo' && !DEMO_DATA_COMPILED_IN) {
      console.warn('data-mode: demo requested but fixtures were compiled out; using live')
      return 'live'
    }
    return forced
  }

  const hasShell = Boolean((window as unknown as { nexusHost?: unknown }).nexusHost)
  if (hasShell) return 'live'
  return DEMO_DATA_COMPILED_IN ? 'demo' : 'live'
}

function readOverride(): DataMode | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('data')
    if (fromQuery === 'demo' || fromQuery === 'live') return fromQuery
    const stored = window.localStorage.getItem(OVERRIDE_KEY)
    if (stored === 'demo' || stored === 'live') return stored
  } catch {
    // Private mode, or a sandboxed WebView with storage disabled. Not worth failing over.
  }
  return null
}

/** Persist a mode for this browser/WebView. Pass null to fall back to auto-detection. */
export function setDataMode(mode: DataMode | null): void {
  try {
    if (mode) window.localStorage.setItem(OVERRIDE_KEY, mode)
    else window.localStorage.removeItem(OVERRIDE_KEY)
  } catch {
    console.warn('data-mode: could not persist preference')
  }
}
