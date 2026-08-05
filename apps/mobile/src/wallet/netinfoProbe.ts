import NetInfo from '@react-native-community/netinfo'
import { setOnlineProbe } from '@nexus/wallet-core/src/utils/net/online'

/**
 * The mobile half of the connectivity seam.
 *
 * `net/online.ts` used to import NetInfo itself, which made every module that
 * touched it — including the whole storage layer — impossible to load outside React
 * Native. The logic stayed shared; the platform API moved here.
 *
 * Installed for its import side effect from index.js, BEFORE the app renders: the
 * default probe assumes online, so anything that asks before this runs gets an
 * optimistic answer rather than a wrong pessimistic one.
 */
setOnlineProbe({
  fetch: async () => {
    const state = await NetInfo.fetch()
    return { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable }
  },
  addEventListener: cb =>
    NetInfo.addEventListener(state =>
      cb({ isConnected: state.isConnected, isInternetReachable: state.isInternetReachable })
    )
})
