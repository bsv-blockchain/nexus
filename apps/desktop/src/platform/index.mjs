/**
 * The desktop platform adapters, assembled into the shapes shared wallet code
 * expects. Everything the wallet needs that is not SQL lives under this folder.
 *
 * | need         | mobile                        | here            |
 * |--------------|-------------------------------|-----------------|
 * | key storage  | expo-secure-store (+ Face ID) | secureStore.mjs |
 * | key/value    | AsyncStorage                  | keyValue.mjs    |
 * | connectivity | @react-native-community/netinfo | online.mjs    |
 * | platform     | Platform.OS                   | process.platform |
 *
 * `platform` needs no module: `process.platform` is already what main.mjs and
 * preload-chrome.cjs report.
 */
import * as keyValue from './keyValue.mjs'
import * as secureStore from './secureStore.mjs'
import * as online from './online.mjs'

export { keyValue, secureStore, online }

const SNAP_KEY = 'snap'

/**
 * The exact `LocalStorageContextType` from
 * apps/mobile/src/wallet/LocalStorageProvider.tsx, minus React.
 *
 * Same object shape means the wallet factory can take one `localStorage` argument
 * and neither shell has to special-case the other.
 *
 * THE SNAP IS A SECRET. An earlier version of this file put it in the plain
 * key/value store and justified it by claiming the toolbox encrypts a snapshot at
 * rest. It does not, in any useful sense. Read
 * SimpleWalletManager.saveSnapshot: the format is
 *
 *     [ snapshotKey (32 bytes, PLAINTEXT) || encrypt(primaryKey, snapshotKey) ]
 *
 * — the decryption key is prepended to its own ciphertext, so anyone holding the
 * bytes recovers the primary key immediately. The toolbox's own doc comment says
 * the snapshot "contains the primary key". It therefore goes in the keychain
 * beside the mnemonic, and bsv-desktop reached the same conclusion: its vault's
 * allow-list names 'snap' first, next to primaryKeyHex and mnemonic12.
 */
export function createLocalStorage() {
  return {
    /* non-secure */
    setSnap: async (snap) => {
      try {
        // Keychain, not the JSON file — see the header. Unlike the other secrets
        // this one swallows its failure to match the mobile contract, so a refusal
        // costs a re-authentication next launch rather than breaking the build.
        const stored = await secureStore.setSnapshot(
          typeof snap === 'string' ? snap : JSON.stringify(snap)
        )
        if (!stored) console.warn('[setSnap] not stored: no OS keychain available')
      } catch (err) {
        console.warn('[setSnap]', err)
      }
    },
    getSnap: async () => {
      try {
        // Reads the keychain, then falls back to the old plaintext location so a
        // machine written by an earlier build still starts — and re-seals it.
        let raw = await secureStore.getSnapshot()
        if (raw === null) {
          const legacy = await keyValue.getItem(SNAP_KEY)
          if (legacy !== null) {
            await secureStore.setSnapshot(legacy)
            await keyValue.removeItem(SNAP_KEY)
            raw = legacy
          }
        }
        return raw ? JSON.parse(raw) : null
      } catch (err) {
        console.warn('[getSnap]', err)
        return null
      }
    },
    deleteSnap: async () => {
      try {
        // Both locations. setSnap writes the KEYCHAIN (see the header), so deleting
        // only the key-value copy left the real snapshot behind and a logged-out
        // wallet could resume on the next launch. The legacy plaintext key goes
        // too, for stores written by earlier builds.
        await secureStore.deleteSnapshot()
        await keyValue.removeItem(SNAP_KEY)
      } catch (err) {
        console.warn('[deleteSnap]', err)
      }
    },

    /* secure */
    setPassword: secureStore.setPassword,
    getPassword: secureStore.getPassword,
    deletePassword: secureStore.deletePassword,
    setMnemonic: secureStore.setMnemonic,
    getMnemonic: secureStore.getMnemonic,
    deleteMnemonic: secureStore.deleteMnemonic,
    setRecoveredKey: secureStore.setRecoveredKey,
    getRecoveredKey: secureStore.getRecoveredKey,
    deleteRecoveredKey: secureStore.deleteRecoveredKey,

    /* general */
    getItem: keyValue.getItem,
    setItem: keyValue.setItem,
    deleteItem: keyValue.removeItem,

    /* desktop-only: why a set* returned false, for the UI to show */
    encryptionStatus: secureStore.encryptionStatus
  }
}
