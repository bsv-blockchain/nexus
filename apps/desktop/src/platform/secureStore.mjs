/**
 * The desktop stand-in for `expo-secure-store`, over Electron's `safeStorage`.
 *
 * Mirrors the secure half of apps/mobile/src/wallet/LocalStorageProvider.tsx
 * method for method — same three secrets (mnemonic, password, recovered key),
 * same `set* -> Promise<boolean>` / `get* -> Promise<string | null>` contract,
 * same `hasWalletKeys` gate in front of every read. The boolean return already
 * means "I did not store it" on mobile (the user dismissed Face ID), so the
 * refusal path below needs no new contract — callers that handle `false` today
 * handle it here.
 *
 * Biometric gating has no equivalent yet and is out of scope per SPEC §6; the OS
 * keychain is the whole of the protection on desktop.
 *
 * ## Why this file refuses to write
 *
 * `safeStorage` on Linux picks a backend from the desktop environment. With no
 * gnome-libsecret and no kwallet it falls back to `basic_text`, which "encrypts"
 * with a hardcoded key compiled into Chromium — public, identical on every
 * machine, and therefore not encryption at all. Electron will happily do this and
 * report success. A recovery phrase written that way is a plaintext seed phrase in
 * a predictable path, which is strictly worse than a wallet that will not start:
 * the user believes it is protected and behaves accordingly.
 *
 * So the gate is `isEncryptionAvailable()` AND, on Linux, a real keyring backend.
 * `setUsePlainTextEncryption(true)` — the API that would make the fallback
 * "available" — is deliberately never called.
 */
import { app, safeStorage } from 'electron'
import { readFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomic } from './atomicWrite.mjs'
import * as keyValue from './keyValue.mjs'

const FILE_NAME = 'secure-store.json'

// Byte-for-byte the mobile key names, so a future export/import between shells
// does not have to translate them.
const MNEMONIC_KEY = 'mnemonic'
const SNAPSHOT_KEY = 'snap'
const PASSWORD_KEY = 'password'
const RECOVERED_KEY = 'recoveredKey'
// Lives in the plain key/value store, exactly as on mobile: it is a boolean about
// whether secrets exist, not a secret, and the read gate has to work before we
// touch the keychain at all.
const HAS_WALLET_KEYS = 'hasWalletKeys'

/** @type {Record<string, string> | null} in-memory copy: key -> base64 ciphertext */
let cache = null

/**
 * The in-flight load, so two concurrent callers share one.
 *
 * Without it both see `cache === null`, both read the file, and each assigns its
 * OWN fresh object to `cache`; whichever lost the assignment race then mutates an
 * orphan, and `persist()` serialises the winner — so one caller's secret is
 * dropped while its `setMnemonic` still returns true. Reproduced: a cold
 * `Promise.all([setMnemonic, setPassword])` persisted only the password.
 */
let loading = null

/**
 * Serialises writes. Two `persist()` calls can otherwise both stringify, and the
 * one that renames last wins with a snapshot taken before the other's mutation —
 * the warm-cache half of the same bug.
 */
let writeChain = Promise.resolve()

function filePath() {
  return path.join(app.getPath('userData'), FILE_NAME)
}

async function load() {
  if (cache) return cache
  if (loading) return await loading
  loading = readStore().finally(() => {
    loading = null
  })
  return await loading
}

async function readStore() {
  const target = filePath()
  try {
    const raw = await readFile(target, 'utf8')
    const parsed = JSON.parse(raw)
    cache = parsed && typeof parsed.entries === 'object' && parsed.entries ? parsed.entries : {}
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Never start empty over a file we failed to parse — that would let the next
      // write destroy a recoverable mnemonic. Move it aside and say so loudly.
      const aside = `${target}.unreadable-${Date.now()}`
      await rename(target, aside).catch(() => {})
      console.error(`[secureStore] unreadable store (${err.message}); moved to ${aside}`)
    }
    cache = {}
  }
  return cache
}

async function persist() {
  // Chained, not concurrent: each write stringifies the cache at the moment it is
  // its turn, so a later write can never publish a snapshot that predates an
  // earlier one's mutation.
  const next = writeChain.then(
    () =>
      writeFileAtomic(filePath(), JSON.stringify({ version: 1, entries: cache }, null, 2), {
        mode: 0o600
      }),
    () =>
      writeFileAtomic(filePath(), JSON.stringify({ version: 1, entries: cache }, null, 2), {
        mode: 0o600
      })
  )
  // Keep the chain alive across a failed write; a rejection here must not wedge
  // every later write, and the caller still sees this one's error.
  writeChain = next.then(
    () => undefined,
    () => undefined
  )
  await next
}

/**
 * Whether it is safe to write a secret, and why not when it isn't.
 *
 * Exposed so the shell can put the reason in front of the user before they type a
 * recovery phrase into a wallet that cannot keep it — SPEC §2, "say so in the UI".
 *
 * @returns {Promise<{available: boolean, backend: string, reason: string | null}>}
 */
export async function encryptionStatus() {
  // `isEncryptionAvailable()` is documented to answer honestly only after `ready`
  // (it returns false on Linux and Windows before it, and `unknown` from
  // getSelectedStorageBackend), so never ask it early.
  await app.whenReady()

  if (!safeStorage.isEncryptionAvailable()) {
    return {
      available: false,
      backend: 'none',
      reason:
        process.platform === 'linux'
          ? 'No OS keyring is available (install and unlock gnome-keyring or KWallet).'
          : 'The OS keychain is unavailable.'
    }
  }

  // getSelectedStorageBackend is Linux-only; on macOS and Windows availability is
  // the whole answer, because the backends there are Keychain and DPAPI.
  if (process.platform !== 'linux') {
    return { available: true, backend: process.platform === 'darwin' ? 'keychain' : 'dpapi', reason: null }
  }

  const backend = safeStorage.getSelectedStorageBackend()
  if (backend === 'basic_text') {
    return {
      available: false,
      backend,
      reason:
        'Only the plaintext fallback keyring is available, which encrypts with a ' +
        'publicly known key. Install and unlock gnome-keyring or KWallet, then restart.'
    }
  }
  if (backend === 'unknown') {
    // Documented as the pre-`ready` answer, which the await above rules out — so
    // reaching here means an unrecognised desktop environment. Refuse: we cannot
    // tell a real keyring from the plaintext fallback, and the wrong guess writes
    // a seed phrase in the clear.
    return {
      available: false,
      backend,
      reason: 'The keyring backend could not be identified, so secrets cannot be stored safely.'
    }
  }
  return { available: true, backend, reason: null }
}

async function setSecret(key, value) {
  try {
    const status = await encryptionStatus()
    if (!status.available) {
      console.error(`[secureStore] refusing to store "${key}" in the clear: ${status.reason}`)
      return false
    }

    const store = await load()
    store[key] = safeStorage.encryptString(value).toString('base64')
    await persist()
    await keyValue.setItem(HAS_WALLET_KEYS, 'true')
    return true
  } catch (err) {
    console.warn(`[secureStore] set ${key}`, err)
    return false
  }
}

async function getSecret(key) {
  try {
    // Same short-circuit as mobile: if we never stored keys, do not prompt the OS
    // and do not touch the file.
    if (!(await keyValue.getItem(HAS_WALLET_KEYS))) return null

    const status = await encryptionStatus()
    // Decrypting with an unavailable backend throws; returning null keeps the
    // "no secret here" contract and lets the caller fall through to onboarding.
    if (!status.available) {
      console.error(`[secureStore] cannot read "${key}": ${status.reason}`)
      return null
    }

    const store = await load()
    const encoded = store[key]
    if (!encoded) return null
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch (err) {
    // Reached when the ciphertext was produced by a different OS user, a restored
    // machine, or a keychain the user has since reset. Not recoverable here.
    console.warn(`[secureStore] get ${key}`, err)
    return null
  }
}

/**
 * Remove a secret, and say whether it is actually gone.
 *
 * The return value exists because "delete my keys from this device" is the one
 * operation where a swallowed failure is dangerous: persist() can reject on a
 * full disk, a read-only volume or a permissions change, and a caller that
 * assumed success would tell the user their phrase was erased while it sat in
 * the file. Callers that genuinely do not care (best-effort cleanup) can ignore
 * the boolean; wallet.logout must not.
 *
 * Errors are still not thrown — a delete that fails should not abort the deletes
 * that follow it — so the boolean is the whole signal.
 *
 * @returns {Promise<boolean>} true when the store no longer holds the key.
 */
async function deleteSecret(key) {
  try {
    const store = await load()
    if (store[key] !== undefined) {
      delete store[key]
      await persist()
    }
    // Mobile clears the flag on any single delete; keep that, or a wallet that
    // deleted one secret would keep answering reads for the others.
    await keyValue.removeItem(HAS_WALLET_KEYS)
    return true
  } catch (err) {
    console.warn(`[secureStore] delete ${key}`, err)
    // The in-memory mutation above may have succeeded while the write did not, so
    // the file is the authority here, not `cache`. Re-read it rather than trust
    // either: a rejected persist leaves the previous contents on disk.
    cache = null
    try {
      const onDisk = await load()
      return onDisk[key] === undefined
    } catch {
      return false
    }
  }
}

/* ------------------------------- mnemonic -------------------------------- */

/** @returns {Promise<boolean>} false when the OS cannot protect it — see the header. */
export const setMnemonic = (mnemonic) => setSecret(MNEMONIC_KEY, mnemonic)
/** @returns {Promise<string | null>} */
export const getMnemonic = () => getSecret(MNEMONIC_KEY)
/** @returns {Promise<boolean>} true when the secret is gone from the store. */
export const deleteMnemonic = () => deleteSecret(MNEMONIC_KEY)

/* ------------------------------- password -------------------------------- */

/** @returns {Promise<boolean>} */
export const setPassword = (password) => setSecret(PASSWORD_KEY, password)
/** @returns {Promise<string | null>} */
export const getPassword = () => getSecret(PASSWORD_KEY)
/** @returns {Promise<boolean>} true when the secret is gone from the store. */
export const deletePassword = () => deleteSecret(PASSWORD_KEY)

/* ----------------------------- recovered key ----------------------------- */

/** @returns {Promise<boolean>} */
/**
 * The SimpleWalletManager snapshot.
 *
 * A secret, despite the name and despite mobile keeping it in AsyncStorage today.
 * saveSnapshot emits [ snapshotKey (32 bytes, PLAINTEXT) || encrypt(primaryKey,
 * snapshotKey) ] — the decryption key travels in front of its own ciphertext, so
 * the bytes are equivalent to the primary key in the clear.
 */
export const setSnapshot = (snapshot) => setSecret(SNAPSHOT_KEY, snapshot)

export const getSnapshot = () => getSecret(SNAPSHOT_KEY)

export const deleteSnapshot = () => deleteSecret(SNAPSHOT_KEY)

export const setRecoveredKey = (wif) => setSecret(RECOVERED_KEY, wif)
/** @returns {Promise<string | null>} */
export const getRecoveredKey = () => getSecret(RECOVERED_KEY)
/** @returns {Promise<boolean>} true when the secret is gone from the store. */
export const deleteRecoveredKey = () => deleteSecret(RECOVERED_KEY)

/** Drops the in-memory copy; the file is untouched. Test seam. */
export function __resetForTests() {
  cache = null
}
