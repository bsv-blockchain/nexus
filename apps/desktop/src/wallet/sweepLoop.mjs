import { getOnline, subscribeOnline } from '@nexus/wallet-core/src/utils/net/online'
import {
  ADDRESS_SCREEN_LEASE_MS,
  SWEEP_INTERVAL_MS,
  runSweep,
  shouldSweepNow,
  sweptTotal
} from '@nexus/wallet-core/src/utils/pay/sweeper'
import { wocConfigFor } from '@nexus/wallet-core/src/utils/pay/rails/address'

/**
 * The address sweep, on the desktop shell, for as long as somebody is watching.
 *
 * "Get paid → to an address" tells the user that money sent there is added to
 * their wallet automatically. Before this the sentence was false here: payHost
 * put every issued address on the watchlist and nothing ever polled it, so the
 * only sweep on desktop was the screen's "Check this address now" button. The
 * pass itself is shared with mobile — utils/pay/sweeper.ts — and what lives here
 * is the lifecycle.
 *
 * IT RUNS ONLY WHILE THAT SCREEN IS OPEN. An always-on loop would put a
 * WhatsOnChain request per watched address on the wire every 30 seconds, for the
 * whole time the app is running, on behalf of nobody — the screen is where a
 * person is waiting for money, and it is the only place the promise is made. Off
 * that screen the manual button and the 30-day recovery stepper are the answer,
 * which is what they were built for.
 *
 * A LEASE, NOT A STOP CALL. The screen holds the loop open by being heard from;
 * it does not close it by asking. An explicit stop is a message that has to
 * arrive, and the cases where it would not are exactly the ones that matter — a
 * killed window, a crashed renderer, a hard navigation — each leaving a loop
 * polling forever with nothing on screen. Absence is the only signal that
 * survives all of them, so the loop expires unless something renews it.
 *
 * What renews it is the calls the screen already makes: `pay.address.receive`
 * when it opens, `pay.address.history` on its own 5s poll, and
 * `pay.address.sweep` when the button is pressed. No new method, and nothing for
 * the chrome to remember to do. See ADDRESS_SCREEN_LEASE_MS for why the lease
 * has to be longer than that poll.
 */
export function createSweepLoop({ getWallet, getNetwork, adminOriginator, onSwept }) {
  let timer = null
  let stopOnlineFeed = null
  let inFlight = false
  let quitting = false
  /** Epoch ms the lease runs out. 0 means nobody is watching. */
  let heldUntil = 0
  /*
   * Assume online until told otherwise, as mobile does: a first pass on a dead
   * network costs one failed fetch and leaves every address watched, while
   * waiting for the first probe result would delay the common case.
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
  }

  const tick = async () => {
    /*
     * The wallet is read fresh every pass and compared on both sides of every
     * await. `wallet` is swapped wholesale by logout, restore and setNetwork, so
     * a pass that began before a swap must not write after it — without this a
     * network switch mid-pass would sweep mainnet addresses into a testnet
     * wallet. Same check startMonitorSoon makes, for the same reason.
     */
    const built = getWallet()
    if (Date.now() > heldUntil) {
      // Nobody has been on the screen for a lease's worth of time. Tear the
      // interval down rather than idling on it, so a session that visited the
      // screen once is not left with a timer for the rest of the day.
      stopPolling()
      return
    }
    if (
      !built ||
      !shouldSweepNow({
        walletBuilt: true,
        appActive: !quitting,
        online,
        inFlight
      })
    ) {
      return
    }
    inFlight = true
    try {
      const woc = wocConfigFor(await getNetwork())
      // Re-checked after the await: reading the network touches storage, which
      // is long enough for a logout to land.
      if (getWallet() !== built) return
      const outcomes = await runSweep({
        wallet: built.manager,
        storage: built.storage,
        adminOriginator,
        woc
      })
      if (getWallet() !== built) return
      /*
       * The internalizeAction inside the sweep IS the history entry — labels
       * legacy, inbound, bsvbrowser, <address> — so there is nothing to push but
       * the fact that something moved. notifyTxChanged is the same trailing
       * publish the Monitor's status changes ride, which the chrome already
       * re-reads accounts and transactions on. That is what makes the balance
       * change on its own, which is the whole of what was promised.
       */
      const total = sweptTotal(outcomes)
      if (total > 0) {
        console.log(`[sweep] imported ${total} sats across ${outcomes.length} address(es)`)
        onSwept?.()
      }
    } catch (err) {
      // Best-effort by construction. runSweep already swallows per-address
      // failures and leaves each one watched; this catches the pass-level ones —
      // a dead WoC host, a locked wallet — so a bad minute cannot kill the
      // interval and silently end the sweep for the rest of the visit.
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
     * Called from every payHost method that only that screen reaches. Sweeps
     * once immediately on the way in, because somebody who just opened it is
     * asking the question now and should not wait a full interval for it.
     */
    hold() {
      heldUntil = Date.now() + ADDRESS_SCREEN_LEASE_MS
      if (!stopped) return
      stopped = false
      quitting = false
      void getOnline().then(next => {
        online = next
      })
      stopOnlineFeed = subscribeOnline(next => {
        online = next
        // Coming back online is worth a pass now rather than at the next tick:
        // the money has usually been sitting there for the whole outage.
        if (online) void tick()
      })
      timer = setInterval(() => void tick(), SWEEP_INTERVAL_MS)
      setTimeout(() => void tick(), 0)
    },

    /**
     * Stop polling. Called before every teardown — logout, the setNetwork
     * rebuild, quit — and reached by the lease lapsing on its own.
     *
     * Does not abort a pass already in flight: that pass re-reads the wallet
     * after each await and drops its own result the moment it sees a different
     * one. What this controls is that no NEXT pass starts.
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
