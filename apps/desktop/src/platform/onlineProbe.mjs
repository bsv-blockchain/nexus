import { net } from 'electron'
import { setOnlineProbe } from '@nexus/wallet-core/src/utils/net/online'

/**
 * The desktop half of the connectivity seam.
 *
 * wallet-core's net/online carries the shared rule and no platform API; each shell
 * installs its own probe. Electron's `net.isOnline()` is Chromium's own network-state
 * answer, which is the same thing NetInfo reports on mobile.
 *
 * `isInternetReachable` is left null rather than guessed: Chromium tells us there is
 * a link, not that the link reaches anything, and the shared rule only counts an
 * explicit `false` against us. Reporting a fabricated `true` here would be the same
 * mistake in the opposite direction.
 */
export function installDesktopOnlineProbe() {
  setOnlineProbe({
    fetch: async () => ({ isConnected: net.isOnline(), isInternetReachable: null }),
    addEventListener: (cb) => {
      // Electron has no connectivity event, so this polls. Slow on purpose: the only
      // consumer is the offline queue deciding whether to retry, and a payment that
      // waits five seconds longer costs nothing next to a timer that wakes the
      // process constantly.
      let last = net.isOnline()
      const timer = setInterval(() => {
        const now = net.isOnline()
        if (now === last) return
        last = now
        cb({ isConnected: now, isInternetReachable: null })
      }, 5000)
      return () => clearInterval(timer)
    }
  })
}
