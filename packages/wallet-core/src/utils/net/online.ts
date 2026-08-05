/**
 * The single definition of "online" for the whole app.
 *
 * `isInternetReachable` is tri-state: a probe reports `null` while it has not
 * finished. Treating `null` as offline would make every cold start look offline for
 * a beat, so only an explicit `false` counts against us — which is the same rule
 * the three call sites this replaced already used.
 *
 * ── WHY THIS FILE IMPORTS NOTHING ──
 *
 * It used to `import NetInfo from '@react-native-community/netinfo'` at module
 * scope. That one line made the entire storage layer unloadable outside React
 * Native: `StorageExpoSQLite` imports `getOnline` from here, NetInfo pulls in
 * `react-native`, and `react-native/index.js` is Flow source that no Node bundler
 * can parse. The Electron main process could not import the wallet at all, and the
 * error pointed at react-native rather than at anything a reader would connect to
 * connectivity.
 *
 * So the probe is now INJECTED, exactly as the SQL driver is: shared logic here, one
 * adapter per shell. Both are the same lesson — a module that names a platform API
 * in a shared package is a module only one platform can load.
 */

export interface OnlineState {
  isConnected: boolean | null
  isInternetReachable: boolean | null
}

/** What a shell must supply. Mirrors the slice of NetInfo this app actually used. */
export interface OnlineProbe {
  fetch(): Promise<OnlineState>
  /** Returns its own unsubscribe. */
  addEventListener(cb: (state: OnlineState) => void): () => void
}

export function isOnlineState(state: OnlineState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false
}

/**
 * Assume online until a shell says otherwise.
 *
 * Deliberately optimistic. Everything guarded by `getOnline` degrades safely when it
 * wrongly believes there is a connection — a request fails and is retried — whereas
 * wrongly believing there is none disables the handle and address rails outright and
 * looks like a broken app. A shell that forgets to install a probe therefore gets a
 * working wallet with slightly worse offline messaging, not a crippled one.
 */
let probe: OnlineProbe = {
  fetch: async () => ({ isConnected: true, isInternetReachable: null }),
  addEventListener: () => () => {}
}

/** Install the host's connectivity probe. Called once, early, by each shell. */
export function setOnlineProbe(next: OnlineProbe): void {
  probe = next
}

export async function getOnline(): Promise<boolean> {
  return isOnlineState(await probe.fetch())
}

/** Returns the unsubscribe function. */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  return probe.addEventListener(state => cb(isOnlineState(state)))
}
