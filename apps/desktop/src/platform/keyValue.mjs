/**
 * The desktop stand-in for `@react-native-async-storage/async-storage`.
 *
 * Shape is deliberately the three methods the wallet actually uses — `getItem`,
 * `setItem`, `removeItem`, all async, all string-or-null — so shared wallet code
 * can take this as a port and not care which shell it is running in. (Counted
 * across apps/ and packages/: getItem 16, setItem 12, removeItem 6, and nothing
 * else. No multiGet, no mergeItem, no getAllKeys.)
 *
 * One JSON file under `app.getPath('userData')` rather than a file per key: the
 * whole store is a few kilobytes, and a single file means a single atomic write
 * instead of N independent ones that can half-apply. What lives here is wallet
 * settings, the ARC overrides, the cached exchange rate, the SimpleWalletManager
 * snapshot, and — the one that hurts most if lost — the wallet DB filename
 * registry, which is how the wallet finds its own database.
 */
import { app } from 'electron'
import { readFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomic } from './atomicWrite.mjs'

const FILE_NAME = 'key-value.json'

/** @type {Record<string, string> | null} */
let cache = null
/** @type {Promise<Record<string, string>> | null} */
let loading = null

// Tail of the write queue. Every flush chains off it so two overlapping writes
// cannot interleave their rename against the same destination.
let writeChain = Promise.resolve()
// A flush that is queued but has not yet serialised the cache. Anything that
// mutates the cache before that point is already covered by it, so it can share
// the same promise instead of scheduling a redundant write.
let pendingFlush = null

function filePath() {
  return path.join(app.getPath('userData'), FILE_NAME)
}

async function load() {
  if (cache) return cache
  if (loading) return loading

  loading = (async () => {
    const target = filePath()
    let raw
    try {
      raw = await readFile(target, 'utf8')
    } catch (err) {
      // First run. Any other error (permissions, I/O) is worth seeing, because
      // starting empty when the file exists but cannot be read would look like a
      // factory reset to the user.
      if (err.code !== 'ENOENT') console.warn('[keyValue] read failed, starting empty:', err.message)
      cache = {}
      return cache
    }

    try {
      const parsed = JSON.parse(raw)
      cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (err) {
      // Do not overwrite an unparseable file in place — move it aside first. It is
      // the only copy of the user's settings, and a human can still read most of a
      // truncated JSON file.
      const aside = `${target}.corrupt-${Date.now()}`
      await rename(target, aside).catch(() => {})
      console.error(`[keyValue] corrupt store (${err.message}); moved to ${aside}`)
      cache = {}
    }
    return cache
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

function flush() {
  if (pendingFlush) return pendingFlush

  const p = writeChain.then(async () => {
    // Cleared before serialising, not after: from this line on, a mutation is no
    // longer guaranteed to make it into this write and must schedule its own.
    pendingFlush = null
    // 0o600: nothing here is a secret, but it is a full picture of the user's
    // wallet configuration and no other account needs to read it.
    await writeFileAtomic(filePath(), JSON.stringify(cache, null, 2), { mode: 0o600 })
  })

  pendingFlush = p
  // Swallow on the chain only — the caller still sees the rejection through `p`.
  // A failed write must not wedge every write after it.
  writeChain = p.catch(() => {})
  return p
}

/** @returns {Promise<string | null>} */
export async function getItem(key) {
  const store = await load()
  return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
}

/** @returns {Promise<void>} resolves once the value is on disk, not just in memory. */
export async function setItem(key, value) {
  const store = await load()
  // AsyncStorage coerces; callers that pass a number here should not silently get
  // a different type back on the next read.
  store[key] = typeof value === 'string' ? value : String(value)
  await flush()
}

/** @returns {Promise<void>} */
export async function removeItem(key) {
  const store = await load()
  if (!Object.prototype.hasOwnProperty.call(store, key)) return
  delete store[key]
  await flush()
}

/**
 * Drops the in-memory copy so the next read comes off disk. Test seam; does not
 * touch the file.
 */
export function __resetForTests() {
  cache = null
  loading = null
  pendingFlush = null
  writeChain = Promise.resolve()
}

/** The AsyncStorage-shaped port, for injecting into shared wallet code. */
export function createKeyValuePort() {
  return { getItem, setItem, removeItem }
}
