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
 * and neither shell has to special-case the other. The snap is deliberately in
 * the plain key/value store, as on mobile: a SimpleWalletManager snapshot is
 * already encrypted-at-rest by the toolbox and is not a secret in its own right.
 */
export function createLocalStorage() {
  return {
    /* non-secure */
    setSnap: async (snap) => {
      try {
        await keyValue.setItem(SNAP_KEY, typeof snap === 'string' ? snap : JSON.stringify(snap))
      } catch (err) {
        console.warn('[setSnap]', err)
      }
    },
    getSnap: async () => {
      try {
        const raw = await keyValue.getItem(SNAP_KEY)
        return raw ? JSON.parse(raw) : null
      } catch (err) {
        console.warn('[getSnap]', err)
        return null
      }
    },
    deleteSnap: async () => {
      try {
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
