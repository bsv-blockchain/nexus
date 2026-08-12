/**
 * The background address sweep.
 *
 * "Get paid → a conventional wallet" is: show the address, and money appears.
 * That means the sweep cannot live in a screen — the screen is exactly what the
 * user no longer has to visit — so this module is the callable pass and
 * WalletContext owns its lifecycle, beside the localpay retry loop that already
 * runs there.
 *
 * Every bound is deliberate and tested: see shouldSweepNow for when a pass may
 * run at all, and utils/pay/watchlist.ts for which addresses it may touch.
 */
import { sweepAddress, type AddressRailWallet, type WocConfig } from '@nexus/wallet-core/src/utils/pay/rails/address'
import { getWatchlist, touchWatched, type KVStorage } from '@nexus/wallet-core/src/utils/pay/watchlist'

/** One poll every 30s — an order of magnitude cheaper than the 3s screen poll it replaces. */
export const SWEEP_INTERVAL_MS = 30_000

/**
 * The cadence while an address is actually on screen.
 *
 * Matches the chrome's own history poll, and for the same reason: this is not
 * background housekeeping but a short synchronous exchange. The address is
 * showing, the payer is paying, and the screen is closed by the money arriving —
 * so the wait between somebody sending and the wallet noticing is the whole of
 * the experience, and 30s of it is a screen that looks broken.
 *
 * Affordable because a held sweep polls the ONE address being displayed rather
 * than the whole watchlist: one WhatsOnChain request per tick, not one per
 * watched day. At 8 watched addresses the naive version would have been 1.6
 * requests a second against a public API that starts refusing around 3.
 */
export const ADDRESS_SCREEN_POLL_MS = 5_000

/**
 * How long the "Get paid → to an address" screen keeps the sweeper alive after
 * it was last heard from.
 *
 * The desktop shell sweeps only while that screen is open, because that is the
 * only moment anybody is expecting money at an address — see
 * apps/desktop/src/wallet/sweepLoop.mjs. It learns the screen is open from the
 * calls the screen already makes, and it learns the screen has gone from their
 * absence, which is the only signal that survives the window being killed or
 * the chrome navigating away without warning.
 *
 * So this has to exceed the chrome's own poll interval — HISTORY_POLL_MS in
 * apps/ui/components/apps/wallet/pay-flow.tsx, 5s at the time of writing — by
 * enough that a slow answer or a stalled frame does not read as a closed
 * screen. 20s is four missed polls of slack. Raising HISTORY_POLL_MS above this
 * would make the sweeper stop while the screen is still open, which is why the
 * relationship is written down here rather than left to be rediscovered.
 */
export const ADDRESS_SCREEN_LEASE_MS = 20_000

export interface SweepOutcome {
  address: string
  importedSatoshis: number
  failureCount: number
}

/**
 * Whether a pass may run right now.
 *
 * Pure so the four conditions are stated in one place and tested: no polling
 * before the wallet exists, none in the background, none offline, and never two
 * at once (each pass writes to the wallet).
 */
export function shouldSweepNow(state: {
  walletBuilt: boolean
  appActive: boolean
  online: boolean
  inFlight: boolean
}): boolean {
  return state.walletBuilt && state.appActive && state.online && !state.inFlight
}

export async function runSweep(args: {
  wallet: AddressRailWallet
  storage: KVStorage
  adminOriginator: string
  woc: WocConfig
}): Promise<SweepOutcome[]> {
  const { wallet, storage, adminOriginator, woc } = args
  const outcomes: SweepOutcome[] = []

  for (const watched of await getWatchlist(storage)) {
    try {
      const { importedSatoshis, failureCount } = await sweepAddress({
        wallet,
        adminOriginator,
        woc,
        address: watched.address,
        derivationPrefix: watched.derivationPrefix
      })
      outcomes.push({ address: watched.address, importedSatoshis, failureCount })
      // Money arrived here once, so it may again: keep this address alive
      // rather than retiring it the moment it pays out.
      if (importedSatoshis > 0) await touchWatched(storage, watched.address)
    } catch {
      // A dead WoC host or a locked wallet must not stop the rest of the pass.
      // The entry stays watched and the next pass retries it.
    }
  }

  return outcomes
}

export function sweptTotal(outcomes: SweepOutcome[]): number {
  return outcomes.reduce((sum, o) => sum + o.importedSatoshis, 0)
}
