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
 *   DEMO_DATA_COMPILED_IN    whether this BUILD carries the demo surfaces
 *
 * The second is what "switch it off before we go live" means. It is the same
 * NEXT_PUBLIC_DEMO_DATA that lib/surfaces.ts reads, and it decides reachability, not
 * bundle contents: with it off the wallet refuses to fall back to fixtures and the
 * demo apps are gone from the catalog, so no invented balance can reach a screen.
 *
 * It does NOT tree-shake lib/data away — an earlier version of this comment claimed
 * it did, which was wrong. Ninety-nine modules import "@/lib/data" at the top level,
 * including the chrome itself for spaces, ecosystems and the token list, so the rows
 * stay in the JS whatever this is set to. Pruning them for real means untangling the
 * chrome's own dependency on seeded data, which is a project rather than a flag. The
 * imagery, which is where the weight actually is, is pruned by tools/bundle-ui.mjs.
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

  /*
   * A shell is not the same thing as a wallet.
   *
   * This used to flip to live the instant `window.nexusHost` existed, which is true
   * on the Electron shell too — and that shell has no wallet at all. The result was
   * a portfolio reading $0.00 with "unknown method wallet.accounts" printed under
   * it, because wallet-data deliberately refuses to fall back to fixtures. Ask what
   * the shell can actually do.
   */
  const host = (window as unknown as { nexusHost?: { has?: (n: string) => boolean } }).nexusHost
  if (host?.has?.('wallet')) return 'live'
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
