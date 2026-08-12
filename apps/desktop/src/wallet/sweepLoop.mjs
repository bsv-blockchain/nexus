import { getOnline, subscribeOnline } from '@nexus/wallet-core/src/utils/net/online'
import {
  ADDRESS_SCREEN_LEASE_MS,
  ADDRESS_SCREEN_POLL_MS,
  shouldSweepNow
} from '@nexus/wallet-core/src/utils/pay/sweeper'
import { sweepAddress, wocConfigFor } from '@nexus/wallet-core/src/utils/pay/rails/address'

/**
 * The address sweep, on the desktop shell, for as long as an address is showing.
 *
 * "Get paid → to an address" tells the user that money sent there is added to
 * their wallet automatically. Before this the sentence was false here: payHost
 * put every issued address on the watchlist and nothing ever polled it, so the
 * only sweep on desktop was the screen's "Check this address now" button.
 *
 * IT RUNS ONLY WHILE THAT SCREEN IS OPEN, and only against the address the
 * screen is displaying. The interaction it serves is short and synchronous — the
 * address is showing, the payer is paying, and the screen is closed by the money
 * arriving — so the sweep is a 5s poll on one address, and it stops as soon as
 * something lands. Off that screen there is nothing to poll for: the manual
 * button and the 30-day recovery stepper are what reach an address nobody is
 * looking at, which is what they were built for.
 *
 * Note the shape this is NOT. It is not runSweep over the whole watchlist on a
 * timer: at 8 watched days that would be eight WhatsOnChain requests every tick
 * for seven addresses nobody has open. The watchlist still exists and still
 * bounds what may ever be polled — it is what the manual button and mobile's
 * background loop read — but a held sweep is pointed at one address.
 *
 * A LEASE, NOT A STOP CALL. The screen holds the loop open by being heard from;
 * it never asks for it to close. An explicit stop is a message that has to
 * arrive, and the cases where it would not are exactly the ones that matter — a
 * killed window, a crashed renderer, a hard navigation — each leaving a loop
 * polling forever with nothing on screen. Absence survives all of them, so the
 * lease expires unless something renews it.
 *
 * What renews it is what the screen already does: `pay.address.receive` when it
 * opens or the day changes, `pay.address.history` on its own 5s poll, and
 * `pay.address.sweep` on the button. Only that screen reaches any of the three.
 */
export function createSweepLoop({ getWallet, getNetwork, adminOriginator, onSwept }) {
  let timer = null
  let stopOnlineFeed = null
  let inFlight = false
  let quitting = false
  /** Epoch ms the lease runs out. 0 means nobody is watching. */
  let heldUntil = 0
  /** The address on screen, and the prefix a sweep of it needs. */
  let target = null
  /**
   * Set once a pass has imported something.
   *
   * The fast poll exists to answer one question — has the payment arrived — and
   * once it has, the answer does not change by asking again. Cleared when a new
   * address is displayed, so stepping back a day starts asking afresh.
   */
  let arrived = false
  /*
   * Assume online until told otherwise, as mobile does: a first pass on a dead
   * network costs one failed fetch and leaves the address watched, while waiting
   * for the first probe result would delay the common case.
   */
  let online = true
  let stopped = true

  const stopPolling = () => {
    if (timer) clearInterval(timer)
    timer = null
    if (stopOnlineFeed) stopOnlineFeed()
    stopOnlineFeed = null
    stopped = true
    heldUntil = 0
    target = null
    arrived = false
  }

  const tick = async () => {
    if (Date.now() > heldUntil) {
      // Nobody has been on the screen for a lease's worth of time. Tear the
      // interval down rather than idling on it, so a session that visited the
      // screen once is not left with a timer for the rest of the day.
      stopPolling()
      return
    }
    /*
     * The wallet is read fresh every pass and compared again after every await.
     * `wallet` is swapped wholesale by logout, restore and setNetwork, so a pass
     * that began before a swap must not write after it — without this a network
     * switch mid-pass would sweep a mainnet address into a testnet wallet. Same
     * check startMonitorSoon makes, for the same reason.
     */
    const built = getWallet()
    if (
      !built ||
      !target ||
      arrived ||
      !shouldSweepNow({
        walletBuilt: true,
        appActive: !quitting,
        online,
        inFlight
      })
    ) {
      return
    }
    const swept = target
    inFlight = true
    try {
      const woc = wocConfigFor(await getNetwork())
      // Re-checked after the await: reading the network touches storage, which
      // is long enough for a logout or a day-step to land.
      if (getWallet() !== built || target !== swept) return
      const { importedSatoshis } = await sweepAddress({
        wallet: built.manager,
        adminOriginator,
        woc,
        address: swept.address,
        derivationPrefix: swept.derivationPrefix
      })
      if (getWallet() !== built) return
      if (importedSatoshis > 0) {
        /*
         * The internalizeAction inside the sweep IS the history entry — labels
         * legacy, inbound, bsvbrowser, <address> — so there is nothing to push
         * but the fact that something moved. notifyTxChanged is the same
         * trailing publish the Monitor's status changes ride, which the chrome
         * already re-reads accounts and transactions on. That is what makes the
         * balance change on its own, which is the whole of what was promised.
         */
        arrived = true
        console.log(`[sweep] imported ${importedSatoshis} sats from ${swept.address}`)
        onSwept?.()
      }
    } catch (err) {
      // Best-effort. The address stays watched and the next tick retries, so a
      // dead WoC host or a locked wallet costs one poll rather than the visit.
      console.warn('[sweep] pass failed:', err?.message)
    } finally {
      inFlight = false
    }
  }

  return {
    /**
     * The address screen is open, or still open. Extend the lease, and start
     * polling if it had lapsed.
     *
     * `next` is passed by `pay.address.receive` only — the one call that knows
     * which address is being displayed. The heartbeat calls pass nothing and
     * only push the lease out, because the address has not changed.
     *
     * Sweeps once immediately on the way in: somebody who just opened the screen
     * is asking now, and a payment made a minute ago should not wait for a tick.
     */
    hold(next) {
      heldUntil = Date.now() + ADDRESS_SCREEN_LEASE_MS
      if (next && next.address !== target?.address) {
        // A different day, so a different question. Ask it from scratch.
        target = { address: next.address, derivationPrefix: next.derivationPrefix }
        arrived = false
      }
      if (!stopped) {
        // Already polling; if a new address just arrived, ask about it now
        // rather than at the next tick.
        if (next) setTimeout(() => void tick(), 0)
        return
      }
      stopped = false
      quitting = false
      void getOnline().then(value => {
        online = value
      })
      stopOnlineFeed = subscribeOnline(value => {
        online = value
        // Coming back online is worth a pass now rather than at the next tick:
        // the money has usually been sitting there for the whole outage.
        if (online) void tick()
      })
      timer = setInterval(() => void tick(), ADDRESS_SCREEN_POLL_MS)
      setTimeout(() => void tick(), 0)
    },

    /**
     * Stop polling. Called before every teardown — logout, the setNetwork
     * rebuild, quit — and reached by the lease lapsing on its own.
     *
     * Does not abort a pass already in flight: that pass re-reads the wallet and
     * the target after each await and drops its own result the moment either has
     * changed. What this controls is that no NEXT pass starts.
     */
    stop() {
      stopPolling()
    },

    /** Quit has begun: refuse further passes even before stop() lands. */
    shuttingDown() {
      quitting = true
    }
  }
}
