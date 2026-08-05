/**
 * The desktop stand-in for `@react-native-community/netinfo`, over Electron's
 * `net` module.
 *
 * Same three exports and same signatures as
 * packages/wallet-core/src/utils/net/online.ts, including the tri-state rule:
 * only an explicit `isInternetReachable === false` counts against us, because a
 * probe that has not finished yet must not make a cold start look offline.
 *
 * Electron gives us one of the two signals. `net.isOnline()` is link-layer — it
 * says a route exists, not that anything answers — so it maps to NetInfo's
 * `isConnected`. There is no reachability equivalent, and inventing one (a
 * periodic HEAD to some endpoint) would be a background network call the user did
 * not ask for and a new dependency on whatever host we picked. So
 * `isInternetReachable` stays `null` — "not determined" — which is exactly what
 * the shared rule is built to tolerate, and the offline-first paths in
 * wallet-storage and the Monitor already handle a request that fails despite the
 * link being up.
 *
 * `net` has no online/offline event in the main process, so subscribers are
 * served by a poll that only runs while somebody is listening. The renderer does
 * have real events, and `reportRendererOnline` lets the shell push them in so a
 * transition is seen immediately instead of up to POLL_MS later.
 */
import { app, net } from 'electron'

const POLL_MS = 5000

/** @typedef {{isConnected: boolean | null, isInternetReachable: boolean | null}} OnlineState */

/** Identical to the mobile rule — kept as its own export so both can be tested against the same table. */
export function isOnlineState(state) {
  return state.isConnected === true && state.isInternetReachable !== false
}

/** @type {Set<(online: boolean) => void>} */
const listeners = new Set()
let timer = null
// Last value we told listeners about, so the poll only emits on a transition.
// `null` means "nothing published yet", which is distinct from `false`.
let lastPublished = null

function currentState() {
  // `net` is only meaningful after `ready`; before it, report "not determined"
  // rather than a confident false that would trip the offline paths at startup.
  if (!app.isReady()) return { isConnected: null, isInternetReachable: null }
  return { isConnected: net.isOnline(), isInternetReachable: null }
}

/** @returns {Promise<boolean>} */
export async function getOnline() {
  await app.whenReady()
  return isOnlineState(currentState())
}

function publish(online) {
  if (online === lastPublished) return
  lastPublished = online
  for (const cb of listeners) {
    // One throwing subscriber must not stop the others from hearing about a
    // connectivity change — losing that notification strands the offline queue.
    try {
      cb(online)
    } catch (err) {
      console.warn('[online] subscriber threw', err)
    }
  }
}

function startPolling() {
  if (timer) return
  timer = setInterval(() => publish(isOnlineState(currentState())), POLL_MS)
  // The poll is a background nicety, not a reason to keep the process alive.
  if (typeof timer.unref === 'function') timer.unref()
}

function stopPolling() {
  if (!timer) return
  clearInterval(timer)
  timer = null
  // Next subscriber gets a fresh baseline rather than being compared against a
  // value from whenever the last one unsubscribed.
  lastPublished = null
}

/**
 * @param {(online: boolean) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribeOnline(cb) {
  listeners.add(cb)
  startPolling()

  // NetInfo delivers the current state to a new listener; match that, but do it
  // off the microtask queue so `subscribeOnline` returns its unsubscribe function
  // before the callback can run and try to use it.
  getOnline().then(online => {
    if (listeners.has(cb)) {
      lastPublished = online
      cb(online)
    }
  })

  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) stopPolling()
  }
}

/**
 * Push the renderer's `navigator.onLine` transition in from the shell.
 *
 * The renderer is told by Chromium the moment the link changes; the main process
 * is not. Without this the worst case is a five-second lag on coming back online,
 * which the user experiences as a payment that stays stuck for no visible reason.
 *
 * This is a head start, not an override: both signals come from the same Chromium
 * network-change notifier, and the next poll re-asserts `net.isOnline()` if they
 * ever disagree.
 *
 * @param {boolean} online
 */
export function reportRendererOnline(online) {
  publish(online === true)
}

/** The NetInfo-shaped port, for injecting into shared wallet code. */
export function createOnlinePort() {
  return { getOnline, subscribeOnline, isOnlineState }
}
