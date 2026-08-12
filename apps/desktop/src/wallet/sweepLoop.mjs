import { getOnline, subscribeOnline } from '@nexus/wallet-core/src/utils/net/online'
import { SWEEP_INTERVAL_MS, runSweep, shouldSweepNow, sweptTotal } from '@nexus/wallet-core/src/utils/pay/sweeper'
import { wocConfigFor } from '@nexus/wallet-core/src/utils/pay/rails/address'

/**
 * The background address sweep, on the desktop shell.
 *
 * "Get paid → a conventional wallet" tells the user, in those words, that money
 * sent to the address is added to their wallet automatically. Until now that
 * sentence was true on mobile and false here: payHost put every issued address
 * on the watchlist and nothing ever polled it, so the only sweep on desktop was
 * the screen's "Check this address now". This is the loop that makes the
 * sentence true on both shells.
 *
 * The pass itself is shared — utils/pay/sweeper.ts — so what lives here is only
 * the lifecycle. Same shape as the Monitor's beside it: started when a wallet is
 * built, stopped on every teardown, and identity-guarded so a logout or a
 * network switch landing mid-pass cannot sweep into a manager nobody owns.
 *
 * ONE DELIBERATE DIVERGENCE FROM MOBILE. shouldSweepNow takes `appActive`, and
 * WalletContext passes `AppState.currentState === 'active'` because iOS suspends
 * a backgrounded process and a timer there is a promise the OS will not keep.
 * Electron suspends nothing. Gating on window focus would mean a desktop user
 * who leaves Nexus behind their editor — the ordinary case, and precisely the
 * one the copy is about — gets no sweep at all. So on desktop `appActive` is
 * true for as long as the app is running, and false only once quitting has
 * begun. The other three conditions are unchanged.
 */
export function createSweepLoop({ getWallet, getNetwork, adminOriginator, onSwept }) {
  let timer = null
  let stopOnlineFeed = null
  let inFlight = false
  let quitting = false
  /**
   * The wallet this loop belongs to.
   *
   * Compared by reference against the live one on both sides of every await.
   * `wallet` is swapped wholesale by logout, restore and setNetwork, so a pass
   * that began before a swap must not write after it — the same check
   * startMonitorSoon makes, for the same reason.
   */
  let owner = null
  /*
   * Assume online until told otherwise, as mobile does: a first pass on a dead
   * network costs one failed fetch and leaves every address watched, while
   * waiting for the first probe result would delay the common case.
   */
  let online = true

  const tick = async () => {
    const built = owner
    if (
      !built ||
      !shouldSweepNow({
        walletBuilt: getWallet() === built,
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
       * legacy, inbound, bsvbrowser, <address> — so there is nothing to push
       * but the fact that something moved. notifyTxChanged is the same trailing
       * publish the Monitor's status changes ride, which the chrome already
       * re-reads accounts and transactions on. That is what makes the balance
       * change on its own, which is the whole of what was promised.
       */
      const total = sweptTotal(outcomes)
      if (total > 0) {
        // Worth a line in the log, and only when something moved: money
        // arriving with no window open is the case this loop exists for, and
        // "did it ever run" is the first question a bug report about a missing
        // balance has to answer.
        console.log(`[sweep] imported ${total} sats across ${outcomes.length} address(es)`)
        onSwept?.()
      }
    } catch (err) {
      // Best-effort by construction. runSweep already swallows per-address
      // failures and leaves each one watched; this catches the pass-level ones
      // — a dead WoC host, a locked wallet — so a bad minute cannot kill the
      // interval and silently end the automatic sweep for the session.
      console.warn('[sweep] pass failed:', err?.message)
    } finally {
      inFlight = false
    }
  }

  return {
    /**
     * Take ownership of a freshly built wallet and start polling it.
     *
     * The first pass is deferred a turn for the reason startMonitorSoon defers
     * the Monitor: a build is the most contended moment of a launch, and this
     * one opens a network fetch per watched address.
     */
    start(built) {
      this.stop()
      owner = built
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
     * Stop polling. Called before every teardown, and on quit.
     *
     * Does not abort a pass already in flight — that pass is identity-guarded
     * and will drop its own result the moment it sees the wallet has changed.
     * What this controls is that no NEXT pass starts.
     */
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      if (stopOnlineFeed) stopOnlineFeed()
      stopOnlineFeed = null
      owner = null
    },

    /** Quit has begun: refuse further passes even before stop() lands. */
    shuttingDown() {
      quitting = true
    }
  }
}
