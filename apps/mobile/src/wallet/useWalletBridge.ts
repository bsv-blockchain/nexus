import { useCallback, useContext, useMemo, useRef } from 'react'
import { InteractionManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { METHODS } from '@nexus/bridge'
import { createCwiHost, type CwiWallet } from '@nexus/substrate/src/browser/cwiHost'
import { generateMnemonicWallet } from '@nexus/wallet-core/src/utils/mnemonicWallet'
import { DEFAULT_MESSAGE_BOX_URL, MESSAGE_BOX_URL_KEY } from '@nexus/wallet-core/src/utils/pay/rails/handle'
import { WalletContext } from './WalletContext'
import { ExchangeRateContext } from './ExchangeRateContext'
import { useLocalStorage } from './LocalStorageProvider'

/**
 * The wallet, as the DOM chrome and browsed pages see it.
 *
 * Two consumers, one source of truth:
 *
 *   methods   → @nexus/bridge's host router, so the chrome's `window.nexusHost.wallet`
 *               calls resolve against the real WalletPermissionsManager
 *   handleCwi → the BRC-100 dispatcher TabLayer hands every `window.CWI` invocation
 *
 * Shapes returned to the chrome deliberately match apps/ui/lib/data/types.ts, because
 * that is what its 89 fixture-consuming components already expect — see
 * apps/ui/lib/wallet-data.ts for the seam.
 */

/** The single account a BRC-100 wallet has. There are no sub-accounts to enumerate. */
const ACCOUNT_ID = 'default'

/** A base64 reference: no spaces, base64 alphabet, and long enough not to be a word. */
const LOOKS_LIKE_A_REFERENCE = /^[A-Za-z0-9+/]{16,}={0,2}$/

/**
 * A transaction's `description` is meant to be what the user was told they were
 * paying for. Some rows carry the storage layer's own base64 reference there
 * instead, and showing that as a memo is worse than showing nothing: it reads like
 * corrupted data rather than like an absent note.
 */
function humanMemo(description: string | undefined): string {
  const text = (description ?? '').trim()
  return LOOKS_LIKE_A_REFERENCE.test(text) ? '' : text
}

export interface WalletBridge {
  methods: Record<string, (params: any) => any>
  handleCwi: ReturnType<typeof createCwiHost>
  /** Coarse lifecycle, for the shell to push to the chrome when it changes. */
  state: { ready: boolean; building: boolean }
}

export function useWalletBridge(): WalletBridge {
  const wallet = useContext(WalletContext)
  const { usdPerBsv } = useContext(ExchangeRateContext)

  // Every method below reads through this ref rather than closing over the context
  // value: `methods` is handed to createHostRouter once, and a stale closure would
  // pin it to the pre-wallet render forever.
  const ref = useRef(wallet)
  ref.current = wallet
  // Null until a real source answers. The context's hardcoded fallback exists so an
  // amount field stays usable offline; it must never reach the chrome as a quote.
  const rateRef = useRef(usdPerBsv)
  rateRef.current = usdPerBsv

  // The stored mnemonic never crosses WalletContext's value — it lives behind
  // LocalStorageProvider's biometric gate, so backup has to read it there directly.
  const localStorage = useLocalStorage()
  const localRef = useRef(localStorage)
  localRef.current = localStorage

  const permissioned = useCallback((): CwiWallet | null => {
    return (ref.current.managers.permissionsManager as unknown as CwiWallet) ?? null
  }, [])

  /** Admin-originator call into our own wallet, for questions the chrome asks on its own behalf. */
  const asAdmin = useCallback(
    async <T>(fn: (w: CwiWallet, originator: string) => Promise<T>): Promise<T> => {
      const w = permissioned()
      if (!w) throw new Error('wallet is not ready')
      return fn(w, ref.current.adminOriginator)
    },
    [permissioned]
  )

  /**
   * Wait for the build to be visible in `ref.current`.
   *
   * `buildWalletFromMnemonic` swallows its own errors, so the state it leaves behind
   * is the only honest report of whether it worked — but that state arrives through
   * React, and awaiting the call does not await the re-render that republishes it
   * here. Reading `walletBuilt` on the next line is therefore a race, and it is one
   * that LOSES on Android: verified on a Pixel 9 emulator, where create built the
   * wallet, threw "could not be built" anyway, and left a wallet whose owner had
   * never been shown the recovery phrase. iOS happened to win the same race.
   *
   * Polling rather than a subscription because there is nothing to subscribe to:
   * the context value is the notification.
   */
  const settleBuilt = useCallback(async (timeoutMs = 5000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (ref.current.walletBuilt && ref.current.managers.permissionsManager) return true
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return false
  }, [])

  const identityKey = useCallback(async (): Promise<string | undefined> => {
    try {
      const res = (await asAdmin((w, o) => w.getPublicKey({ identityKey: true }, o))) as { publicKey?: string }
      return res?.publicKey
    } catch {
      // A wallet that is up but can't answer this is still worth reporting as ready;
      // the identity key is decoration on the info payload, not the payload.
      return undefined
    }
  }, [asAdmin])

  const methods = useMemo<Record<string, (params: any) => any>>(
    () => ({
      [METHODS.WALLET_INFO]: async () => {
        const w = ref.current
        const ready = Boolean(w.walletBuilt && w.managers.permissionsManager)
        return {
          available: true,
          ready,
          building: w.walletBuilding,
          network: w.selectedNetwork === 'main' ? 'main' : 'test',
          identityKey: ready ? await identityKey() : undefined
        }
      },

      [METHODS.WALLET_ACCOUNTS]: async () => {
        const w = ref.current
        if (!w.walletBuilt || !w.managers.permissionsManager) return []

        // Spendable balance is the sum of the default basket, which is what the
        // wallet will actually draw on — not every output it has ever seen.
        const outputs = (await asAdmin((wal, o) =>
          wal.listOutputs({ basket: ACCOUNT_ID, limit: 1000, includeLockingScripts: false }, o)
        )) as { outputs?: { satoshis?: number }[] }

        const balanceSatoshis = (outputs?.outputs ?? []).reduce((sum, out) => sum + (out.satoshis ?? 0), 0)
        const key = await identityKey()

        return [
          {
            id: ACCOUNT_ID,
            label: 'Nexus',
            // A BRC-100 wallet has no single reusable address; the identity key is the
            // stable public handle, so that is what the UI's `address` slot carries.
            address: key ?? '',
            balanceSatoshis,
            fiatCurrency: 'USD',
            // Zero means "no rate", and the chrome renders an em dash for it.
            fiatRate: rateRef.current ?? 0,
            createdAt: new Date(0).toISOString()
          }
        ]
      },

      [METHODS.WALLET_TRANSACTIONS]: async (params: { limit?: number } | null) => {
        const w = ref.current
        const storage = w.storage
        if (!w.walletBuilt || !storage || w.walletUserId == null) return []

        // Read the ledger rows directly rather than via listActions: the UI groups by
        // day, and listActions does not return a timestamp at all.
        const rows = await storage.findTransactions({
          partial: { userId: w.walletUserId },
          paged: { limit: params?.limit ?? 50 },
          orderDescending: true
        } as any)

        return rows.map((tx) => {
          const satoshis = tx.satoshis ?? 0
          const txid = tx.txid ?? ''
          return {
          id: String(tx.transactionId),
          accountId: ACCOUNT_ID,
          txid,
          // The SIGN of the net change, not `isOutgoing`. `isOutgoing` means "this
          // wallet created the transaction", which is a different question: the
          // funding transaction was created here and still paid money IN.
          direction: satoshis < 0 ? 'outgoing' : 'incoming',
          amountSatoshis: Math.abs(satoshis),
          feeSatoshis: 0,
          // A BRC-100 ledger records no counterparty — the transaction identifies
          // itself and nothing else, so that is what the row is named after rather
          // than inventing a person.
          counterparty: txid ? `${txid.slice(0, 8)}…${txid.slice(-4)}` : 'unknown',
          memo: humanMemo(tx.description),
          status: tx.status === 'completed' ? 'confirmed' : 'pending',
          confirmations: tx.status === 'completed' ? 1 : 0,
          createdAt: new Date(tx.created_at).toISOString()
          }
        })
      },

      /**
       * Restore from a BIP-39 recovery phrase. One of the two ways a wallet comes into
       * existence here; the chrome collects the words and the shell owns every key
       * operation. The create flow below is the same split in the other direction.
       */
      [METHODS.WALLET_RESTORE]: async (params: { mnemonic?: string } | null) => {
        const phrase = (params?.mnemonic ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
        const words = phrase ? phrase.split(' ') : []
        if (words.length !== 12 && words.length !== 24) {
          throw new Error(`a recovery phrase is 12 or 24 words; got ${words.length}`)
        }
        await ref.current.buildWalletFromMnemonic(phrase)
        // buildWalletFromMnemonic swallows its own errors, so the honest report of
        // whether it worked is the state it left behind — once that state has had
        // time to arrive. See settleBuilt: reading it on the next line loses on
        // Android and reports a failure for a wallet that built perfectly well.
        if (!(await settleBuilt())) {
          throw new Error('the wallet could not be built from that phrase')
        }
        return { ok: true }
      },

      /**
       * Create a new wallet shell-side: generate 12 words, build, store. The phrase
       * crosses the bridge exactly once so the chrome can show it for writing down.
       * buildWalletFromMnemonic persists it (setMnemonic) before the reveal, so a
       * user who abandons the backup screen mid-flow has lost nothing.
       */
      [METHODS.WALLET_CREATE]: async () => {
        // Refused rather than replaced: building over an existing wallet's keys is a
        // wipe, and a wipe must go through the explicit sign-out with its warning.
        if (ref.current.walletBuilt) {
          throw new Error('a wallet already exists on this device — sign out first')
        }
        const { mnemonic } = generateMnemonicWallet()
        await ref.current.buildWalletFromMnemonic(mnemonic)
        // The build swallows its own errors, so the state it left behind is the only
        // true report — but it has to be given time to arrive. Throwing early here
        // means a wallet that exists and an owner who never saw its phrase.
        if (!(await settleBuilt())) throw new Error('the wallet could not be built')
        return { ok: true, mnemonic }
      },

      /**
       * The stored recovery phrase, for the backup screen. getMnemonic sits behind
       * LocalStorageProvider's biometric gate, so the OS prompt is the access control
       * here; the chrome's side of the contract is render-only, never persist.
       */
      [METHODS.WALLET_BACKUP]: async () => {
        const mnemonic = await localRef.current.getMnemonic()
        if (!mnemonic) throw new Error('no recovery phrase is stored on this device')
        return { mnemonic }
      },

      [METHODS.WALLET_LOGOUT]: async () => {
        // logout() is fire-and-forget internally (a .then chain that deletes
        // snap+mnemonic+recoveredKey and resets state), so the chrome learns the real
        // outcome from the wallet.state push, not from this reply. One microtask lets
        // the chain start before we acknowledge.
        ref.current.logout()
        await Promise.resolve()
        return { ok: true }
      },

      [METHODS.SETTINGS_GET]: async () => {
        const w = ref.current
        // The same source pay.handle.messageBox answers from (usePayBridge): the
        // saved override or the default. Replicated rather than reaching into the pay
        // bridge — the settings surface must not couple to the pay surface.
        const messageBoxUrl = (await AsyncStorage.getItem(MESSAGE_BOX_URL_KEY)) || DEFAULT_MESSAGE_BOX_URL
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync()
        ])
        return {
          network: w.selectedNetwork === 'main' ? 'main' : 'test',
          networks: ['main', 'test'],
          messageBoxUrl,
          // expo-secure-store keeps the phrase in the keychain either way; whether a
          // biometric stands in front of it is the device's answer, not ours.
          secure: {
            storedSecurely: true,
            method: hasHardware && enrolled ? 'keychain-biometric' : 'keychain'
          }
        }
      },

      [METHODS.SETTINGS_SET_NETWORK]: async (params: { network?: string } | null) => {
        const network = params?.network
        // teratest stays env/dev-only; the settings surface offers exactly what
        // settings.get advertised in `networks`.
        if (network !== 'main' && network !== 'test') {
          throw new Error(`network must be 'main' or 'test'; got ${String(network)}`)
        }
        await ref.current.switchNetwork(network)
        return { ok: true }
      }
    }),
    [asAdmin, identityKey, settleBuilt]
  )

  const handleCwi = useMemo(
    () =>
      createCwiHost({
        getWallet: permissioned,
        isBuilding: () => ref.current.walletBuilding,
        // Heavy calls wait for any in-flight chrome animation to settle; the
        // cheap ones skip this entirely (see CWI_NO_YIELD).
        yieldToInteractions: () => new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()))
      }),
    [permissioned]
  )

  const ready = Boolean(wallet.walletBuilt && wallet.managers.permissionsManager)
  const state = useMemo(
    () => ({ ready, building: wallet.walletBuilding }),
    [ready, wallet.walletBuilding]
  )

  return { methods, handleCwi, state }
}
