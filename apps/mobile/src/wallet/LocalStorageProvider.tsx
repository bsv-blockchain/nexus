import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
// BLOCKER(nexus-port): app-level i18n singleton (used only for the biometric-prompt
// strings below) — not yet ported to apps/mobile/src; expected path guessed here.
import i18n from './support/translations'

export interface LocalStorageContextType {
  /* non-secure */
  setSnap: (snap: number[]) => Promise<void>
  getSnap: () => Promise<number[] | null>
  deleteSnap: () => Promise<void>

  /* secure */
  setPassword: (password: string) => Promise<boolean>
  getPassword: () => Promise<string | null>
  deletePassword: () => Promise<void>
  setMnemonic: (mnemonic: string) => Promise<boolean>
  getMnemonic: () => Promise<string | null>
  deleteMnemonic: () => Promise<void>
  setRecoveredKey: (wif: string) => Promise<boolean>
  getRecoveredKey: () => Promise<string | null>
  deleteRecoveredKey: () => Promise<void>

  /* general */
  setItem: (item: string, value: string) => Promise<void>
  getItem: (item: string) => Promise<string | null>
  deleteItem: (item: string) => Promise<void>
}

const SNAP_KEY = 'snap'
const PASSWORD_KEY = 'password'
const MNEMONIC_KEY = 'mnemonic'
const RECOVERED_KEY = 'recoveredKey'
const HAS_WALLET_KEYS = 'hasWalletKeys'

export const LocalStorageContext = createContext<LocalStorageContextType>({
  /* non-secure */
  setSnap: async () => {},
  getSnap: async () => null,
  deleteSnap: async () => {},

  /* secure */
  setPassword: async () => false,
  getPassword: async () => null,
  deletePassword: async () => {},
  setMnemonic: async () => false,
  getMnemonic: async () => null,
  deleteMnemonic: async () => {},
  setRecoveredKey: async () => false,
  getRecoveredKey: async () => null,
  deleteRecoveredKey: async () => {},

  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  deleteItem: AsyncStorage.removeItem
})

export const useLocalStorage = () => useContext(LocalStorageContext)

export default function LocalStorageProvider({ children }: { children: React.ReactNode }) {
  /* --------------------------------- SECURE -------------------------------- */

  // keep "am I already biometrically unlocked?" in memory for this session
  const authenticatedRef = useRef(false)
  const authInProgress = useRef<Promise<boolean> | null>(null)

  const ensureAuth = useCallback(async (promptMessage: string): Promise<boolean> => {
    // If we already asked this frame, reuse the same promise so we don't show
    // the Face ID modal twice in parallel.
    if (authInProgress.current) return authInProgress.current

    const doAuth = async () => {
      // Use ref so the check is always up-to-date, even before React re-renders.
      if (authenticatedRef.current) return true

      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      })

      authenticatedRef.current = success
      authInProgress.current = null // reset latch
      return success
    }

    authInProgress.current = doAuth()
    return authInProgress.current
  }, [])

  /* ------------------------------- non-secure ------------------------------ */

  /*
   * The snapshot lives in the KEYCHAIN, not AsyncStorage.
   *
   * It sat under the "non-secure" heading because the name suggests session state,
   * but SimpleWalletManager.saveSnapshot emits
   *
   *     [ snapshotKey (32 bytes, PLAINTEXT) || encrypt(primaryKey, snapshotKey) ]
   *
   * so the decryption key travels in front of its own ciphertext and the bytes are
   * equivalent to the primary key in the clear. The toolbox's own doc comment says
   * the snapshot "contains the primary key". AsyncStorage is unencrypted, so this
   * was a root key in a readable file on every device.
   *
   * Deliberately NOT behind ensureAuth: this is read during the cold-start build,
   * around the mnemonic read that already prompts, and adding a second gate would
   * mean two prompts to open the app. The keychain's own at-rest protection —
   * AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, matching the mnemonic — is the point here.
   */
  const setSnap = useCallback(async (snap: number[]): Promise<void> => {
    try {
      const snapAsJSON = typeof snap === 'string' ? snap : JSON.stringify(snap)
      await SecureStore.setItemAsync(SNAP_KEY, snapAsJSON, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
      })
    } catch (err) {
      console.warn('[setSnap]', err)
    }
  }, [])

  const getSnap = useCallback(async (): Promise<number[] | null> => {
    try {
      let raw = await SecureStore.getItemAsync(SNAP_KEY)
      if (raw === null) {
        // A device written by an earlier build still has it in AsyncStorage. Move
        // it rather than ignoring it: leaving the plaintext copy behind would keep
        // the key readable, and dropping it would force a re-authentication for no
        // reason.
        const legacy = await AsyncStorage.getItem(SNAP_KEY)
        if (legacy !== null) {
          await SecureStore.setItemAsync(SNAP_KEY, legacy, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          })
          await AsyncStorage.removeItem(SNAP_KEY)
          raw = legacy
        }
      }
      return raw ? (JSON.parse(raw) as number[]) : null
    } catch (err) {
      console.warn('[getSnap]', err)
      return null
    }
  }, [])

  const deleteSnap = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SNAP_KEY)
    } catch (err) {
      console.warn('[deleteSnap]', err)
    }
  }, [])

  /* -------------------------------- secure --------------------------------- */

  const setMnemonic = useCallback(
    async (mnemonic: string): Promise<boolean> => {
      try {
        if (!(await ensureAuth(i18n.t('biometric_store_wallet')))) return false
        await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
        await AsyncStorage.setItem(HAS_WALLET_KEYS, 'true')
        return true
      } catch (err) {
        console.warn('[setMnemonic]', err)
        return false
      }
    },
    [ensureAuth]
  )

  const getMnemonic = useCallback(async (): Promise<string | null> => {
    try {
      const hasKeys = await AsyncStorage.getItem(HAS_WALLET_KEYS)
      if (!hasKeys) return null
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return null
      return await SecureStore.getItemAsync(MNEMONIC_KEY)
    } catch (err) {
      console.warn('[getMnemonic]', err)
      return null
    }
  }, [ensureAuth])

  const deleteMnemonic = useCallback(async (): Promise<void> => {
    try {
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return
      await SecureStore.deleteItemAsync(MNEMONIC_KEY)
      await AsyncStorage.removeItem(HAS_WALLET_KEYS)
    } catch (err) {
      console.warn('[deleteMnemonic]', err)
    }
  }, [ensureAuth])

  /* -------------------------------- secure --------------------------------- */

  const setPassword = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        if (!(await ensureAuth(i18n.t('biometric_store_wallet')))) return false
        await SecureStore.setItemAsync(PASSWORD_KEY, password, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
        await AsyncStorage.setItem(HAS_WALLET_KEYS, 'true')
        return true
      } catch (err) {
        console.warn('[setPassword]', err)
        return false
      }
    },
    [ensureAuth]
  )

  const getPassword = useCallback(async (): Promise<string | null> => {
    try {
      const hasKeys = await AsyncStorage.getItem(HAS_WALLET_KEYS)
      if (!hasKeys) return null
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return null
      return await SecureStore.getItemAsync(PASSWORD_KEY)
    } catch (err) {
      console.warn('[getPassword]', err)
      return null
    }
  }, [ensureAuth])

  const deletePassword = useCallback(async (): Promise<void> => {
    try {
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return
      await SecureStore.deleteItemAsync(PASSWORD_KEY)
      await AsyncStorage.removeItem(HAS_WALLET_KEYS)
    } catch (err) {
      console.warn('[deletePassword]', err)
    }
  }, [ensureAuth])

  /* ----------------------------- recovered key ------------------------------ */

  const setRecoveredKey = useCallback(
    async (wif: string): Promise<boolean> => {
      try {
        if (!(await ensureAuth(i18n.t('biometric_store_wallet')))) return false
        await SecureStore.setItemAsync(RECOVERED_KEY, wif, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
        await AsyncStorage.setItem(HAS_WALLET_KEYS, 'true')
        return true
      } catch (err) {
        console.warn('[setRecoveredKey]', err)
        return false
      }
    },
    [ensureAuth]
  )

  const getRecoveredKey = useCallback(async (): Promise<string | null> => {
    try {
      const hasKeys = await AsyncStorage.getItem(HAS_WALLET_KEYS)
      if (!hasKeys) return null
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return null
      return await SecureStore.getItemAsync(RECOVERED_KEY)
    } catch (err) {
      console.warn('[getRecoveredKey]', err)
      return null
    }
  }, [ensureAuth])

  const deleteRecoveredKey = useCallback(async (): Promise<void> => {
    try {
      if (!(await ensureAuth(i18n.t('biometric_load_wallet')))) return
      await SecureStore.deleteItemAsync(RECOVERED_KEY)
      await AsyncStorage.removeItem(HAS_WALLET_KEYS)
    } catch (err) {
      console.warn('[deleteRecoveredKey]', err)
    }
  }, [ensureAuth])

  /* -------------------------------- output --------------------------------- */

  const value: LocalStorageContextType = useMemo(
    () => ({
      /* non-secure */
      setSnap,
      getSnap,
      deleteSnap,

      /* secure */
      setPassword,
      getPassword,
      deletePassword,
      setMnemonic,
      getMnemonic,
      deleteMnemonic,
      setRecoveredKey,
      getRecoveredKey,
      deleteRecoveredKey,

      /* general */
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
      deleteItem: AsyncStorage.removeItem
    }),
    [
      setSnap,
      getSnap,
      deleteSnap,
      setPassword,
      getPassword,
      deletePassword,
      setMnemonic,
      getMnemonic,
      deleteMnemonic,
      setRecoveredKey,
      getRecoveredKey,
      deleteRecoveredKey
    ]
  )

  return <LocalStorageContext.Provider value={value}>{children}</LocalStorageContext.Provider>
}
