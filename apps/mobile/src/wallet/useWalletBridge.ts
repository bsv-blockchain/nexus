import { useCallback, useContext, useMemo, useRef } from 'react'
import { InteractionManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { METHODS } from '@nexus/bridge'
import { createCwiHost, type CwiWallet } from '@nexus/substrate/src/browser/cwiHost'
import {
  generateMnemonicWallet,
  parseMnemonic,
  recoverMnemonicWallet
} from '@nexus/wallet-core/src/utils/mnemonicWallet'
import { isWordCount, type WordCount } from '@nexus/wallet-core/src/utils/entropy'
import {
  DEFAULT_THRESHOLD,
  DEFAULT_TOTAL_SHARES,
  generateEntropyShares,
  generatePrintHTML,
  parseShareSet,
  recoverKeyFromShares,
  recoverMnemonicFromShares
} from '@nexus/wallet-core/src/utils/backupShares'
import { shareFile } from '../native/shareFile'
import { DEFAULT_MESSAGE_BOX_URL, MESSAGE_BOX_URL_KEY } from '@nexus/wallet-core/src/utils/pay/rails/handle'
import {
  AUTO_APPROVE_STORAGE_KEY,
  DEFAULT_ARC_URLS,
  DEFAULT_AUTO_APPROVE_THRESHOLD,
  arcApiTokenStorageKey,
  arcUrlStorageKey
} from '@nexus/wallet-core/src/constants'
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

/**
 * The phrase gate, shared by both routes in and identical to the desktop host's.
 *
 * This was `words.length !== 12 && words.length !== 24` inline, which rejected the
 * 15-, 18- and 21-word phrases BIP-39 defines and BRC-157 requires. It now defers to
 * wallet-core's `parseMnemonic` — the SAME call the build path makes, so a phrase that
 * passes here cannot fail there.
 */
function requirePhrase(raw: unknown): string {
  const phrase = String(raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  const parsed = parseMnemonic(phrase)
  if (!parsed.valid) throw new Error(parsed.error)
  return phrase
}

/** A printed word count, or undefined so the trim falls back to BRC-157's heuristic. */
function optionalWordCount(value: unknown): WordCount | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const count = Number(value)
  if (!isWordCount(count)) {
    throw new Error(`a recovery phrase is 12, 15, 18, 21 or 24 words; got ${String(value)}`)
  }
  return count
}

/** Shares arrive as an array of strings from the chrome, and nothing else will do. */
function requireShares(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('backup shares are a list of strings')
  const shares = value.map((s) => String(s ?? '').trim()).filter(Boolean)
  const { error } = parseShareSet(shares)
  if (error) throw new Error(error)
  return shares
}

/**
 * What the chrome is told about a spend request.
 *
 * A deliberate subset of the shell's SpendingRequest. The running totals it also
 * carries (`totalPastSpending`, `amountPreviouslyAuthorized`) are zero at every
 * call site today, and sending fields that are always zero invites a sheet that
 * renders them as facts.
 */
export interface SpendPayload {
  requestID: string
  originator: string
  description?: string
  authorizationAmount: number
  renewal?: boolean
  lineItems: any[]
}

function toSpendPayload(request: any): SpendPayload {
  return {
    requestID: String(request.requestID),
    originator: String(request.originator ?? ''),
    description: request.description,
    authorizationAmount: Number(request.authorizationAmount ?? 0),
    renewal: Boolean(request.renewal),
    lineItems: Array.isArray(request.lineItems) ? request.lineItems : []
  }
}

export interface WalletBridge {
  methods: Record<string, (params: any) => any>
  handleCwi: ReturnType<typeof createCwiHost>
  /** Coarse lifecycle, for the shell to push to the chrome when it changes. */
  state: { ready: boolean; building: boolean }
  /**
   * The spend request at the head of the queue, or null.
   *
   * Surfaced here rather than read from WalletContext in App.tsx so the wallet
   * coupling stays in one file — App.tsx only knows it has something to push.
   */
  pendingSpend: SpendPayload | null
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
        const phrase = requirePhrase(params?.mnemonic)
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
        if (!mnemonic) {
          // A legacy share recovery has no phrase because it never had one. Telling
          // the user to write down words that do not exist is worse than saying why.
          if (await localRef.current.getRecoveredKey()) {
            throw new Error(
              'This wallet was recovered from pre-BRC-157 backup shares, which carry no ' +
                'recovery phrase. Its backup is those shares; keep them.'
            )
          }
          throw new Error('no recovery phrase is stored on this device')
        }
        // The word count travels with the words, so the reveal screen lays out 24 of
        // them without counting and a share recovery can be told what to expect.
        return { mnemonic, wordCount: parseMnemonic(mnemonic).wordCount }
      },

      /**
       * The other way in: BRC-140 backup shares.
       *
       * Under BRC-157 the shares reconstruct the wallet's ENTROPY, so this path
       * recovers the RECOVERY PHRASE and stores it through the ordinary
       * `buildWalletFromMnemonic` — which is what makes a share-recovered wallet
       * indistinguishable from a phrase-restored one, and what puts the words back in
       * the user's hands. Before BRC-157 the shares split `m/0'/0'` and this was
       * impossible; `buildWalletFromRecoveredKey` is that old world, kept for the
       * pages it printed.
       *
       * Both builds swallow their own errors, so `settleBuilt()` is the only honest
       * report — see its comment for the Android race that made this necessary.
       */
      [METHODS.WALLET_RESTORE_SHARES]: async (
        params: { shares?: unknown; wordCount?: unknown; legacy?: boolean } | null
      ) => {
        if (ref.current.walletBuilt) {
          throw new Error('a wallet already exists on this device — sign out first')
        }

        const shares = requireShares(params?.shares)
        const wordCount = optionalWordCount(params?.wordCount)
        const legacy = params?.legacy === true

        // Recovered BEFORE the build starts, so a wrong or incomplete share set fails
        // as a share error rather than as a build that quietly did nothing.
        if (legacy) {
          const key = recoverKeyFromShares(shares)
          await ref.current.buildWalletFromRecoveredKey(key.toWif())
          if (!(await settleBuilt())) throw new Error('the wallet could not be built from those shares')
          return { ok: true, legacy: true, mnemonic: null }
        }

        const phrase = recoverMnemonicFromShares(shares, wordCount)
        await ref.current.buildWalletFromMnemonic(phrase)
        if (!(await settleBuilt())) throw new Error('the wallet could not be built from those shares')
        return { ok: true, legacy: false, mnemonic: phrase }
      },

      /**
       * Split this wallet's entropy into BRC-140 backup shares and hand the printable
       * document to the OS share sheet.
       *
       * ── WHAT DOES NOT CROSS THE BRIDGE ──
       *
       * Shares. Any `threshold` of them together ARE the wallet, and the chrome is a
       * WebView that also hosts arbitrary browsed pages. So this renders the document
       * and shares it from here, and answers with counts.
       *
       * ── THE COST OF THE SHARE SHEET ──
       *
       * Unlike desktop, which prints from an in-memory data: URL, this writes the
       * document to cache for the seconds the sheet is up (see ../native/shareFile.ts,
       * which deletes it unconditionally afterwards). That file holds EVERY share, so
       * a user who saves it to iCloud Drive has put the whole wallet in one place —
       * which is the exact thing the 2-of-3 split exists to prevent. There is no API
       * fix for that: the filename and the chrome's copy carry the warning.
       */
      [METHODS.BACKUP_SHARES]: async (params: { threshold?: number; totalShares?: number } | null) => {
        const threshold = Math.round(Number(params?.threshold ?? DEFAULT_THRESHOLD))
        const totalShares = Math.round(Number(params?.totalShares ?? DEFAULT_TOTAL_SHARES))

        // getMnemonic sits behind LocalStorageProvider's biometric gate, so the OS
        // prompt is the access control on this whole operation.
        const mnemonic = await localRef.current.getMnemonic()
        if (!mnemonic) {
          if (await localRef.current.getRecoveredKey()) {
            throw new Error(
              'This wallet was recovered from pre-BRC-157 backup shares and has no entropy ' +
                'to split. Its backup is the shares you already hold.'
            )
          }
          throw new Error('no recovery phrase is stored on this device')
        }

        // Decoding the phrase produces the entropy and re-validates it, so a stored
        // phrase that has somehow been corrupted fails here rather than printing
        // shares of something that is not this wallet.
        const { entropy, wordCount, identityKey: walletIdentityKey } = recoverMnemonicWallet(mnemonic)

        // Throws with user-facing text for the one reachable refusal: a phrase whose
        // entropy is all zeros ("abandon … about") is a good wallet that cannot be
        // Shamir-split. The chrome shows the message verbatim.
        const shares = generateEntropyShares(entropy, threshold, totalShares)
        const html = await generatePrintHTML(shares, walletIdentityKey, { wordCount, threshold })

        const stamp = new Date().toISOString().split('T')[0]
        const result = await shareFile({
          filename: `nexus-backup-shares-ALL-${threshold}-of-${totalShares}-${stamp}.html`,
          contents: html,
          mimeType: 'text/html'
        })

        return { ok: true, shared: result.shared, threshold, totalShares, wordCount }
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
        // Per network, because an endpoint that serves mainnet is not the one that
        // serves testnet — a single override would silently follow you across a
        // network switch and broadcast to the wrong chain's ARC.
        const network = w.selectedNetwork === 'main' ? 'main' : 'test'
        const [arcUrl, arcToken, autoApprove] = await Promise.all([
          AsyncStorage.getItem(arcUrlStorageKey(network)),
          AsyncStorage.getItem(arcApiTokenStorageKey(network)),
          AsyncStorage.getItem(AUTO_APPROVE_STORAGE_KEY)
        ])
        return {
          network,
          networks: ['main', 'test'],
          messageBoxUrl,
          arc: {
            url: arcUrl || DEFAULT_ARC_URLS[network] || '',
            // NEVER the token itself. The chrome only needs to know whether one is
            // set so it can say so and offer to replace it; sending the secret to a
            // WebView to render in an input is how it ends up in a screenshot.
            hasToken: Boolean(arcToken),
            defaultUrl: DEFAULT_ARC_URLS[network] || '',
            isDefault: !arcUrl || arcUrl === DEFAULT_ARC_URLS[network]
          },
          autoApprove: {
            satoshis: autoApprove === null ? DEFAULT_AUTO_APPROVE_THRESHOLD : Number(autoApprove) || 0,
            defaultSatoshis: DEFAULT_AUTO_APPROVE_THRESHOLD
          },
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
      },

      /**
       * Point this network's broadcasts somewhere else, or back at the default.
       *
       * The rebuild is the whole point: Services is constructed once with the
       * endpoint baked in (WalletContext reads these same keys at build time), so
       * writing the key without rebuilding would leave the wallet broadcasting to
       * the old ARC while the settings screen showed the new one. switchNetwork to
       * the CURRENT network is the rebuild — it is the same teardown, and there is
       * no cheaper one to reach for.
       */
      [METHODS.SETTINGS_SET_ARC]: async (params: { url?: string | null; token?: string | null } | null) => {
        const w = ref.current
        const network = w.selectedNetwork === 'main' ? 'main' : 'test'
        const url = params?.url == null ? null : String(params.url).trim().replace(/\/+$/, '')
        const token = params?.token == null ? null : String(params.token).trim()

        // null resets; a string sets. An empty string is a user who cleared the
        // field, which means the same thing as reset rather than "broadcast to ''".
        if (!url) await AsyncStorage.removeItem(arcUrlStorageKey(network))
        else await AsyncStorage.setItem(arcUrlStorageKey(network), url)

        // A token is only rewritten when one was supplied. Passing null must not
        // silently discard a working key just because the user edited the URL.
        if (token !== null) {
          if (token) await AsyncStorage.setItem(arcApiTokenStorageKey(network), token)
          else await AsyncStorage.removeItem(arcApiTokenStorageKey(network))
        }

        await w.switchNetwork(network)
        return { ok: true }
      },

      /**
       * The user's answer to a spend request, from the chrome's sheet.
       *
       * `advanceSpendingQueue` is what closes the loop: it pops the head, which
       * both releases the blocked permissions manager and lets the next queued
       * request through. Granting without advancing leaves the queue stuck with a
       * request nobody will ever answer again.
       *
       * Deny is not an error condition — it is the user saying no — so a failure
       * inside denyPermission is swallowed rather than reported back as if the
       * chrome had done something wrong.
       */
      [METHODS.PERMISSION_RESOLVE]: async (params: {
        requestID?: string
        approved?: boolean
        amount?: number
        ephemeral?: boolean
      } | null) => {
        const requestID = String(params?.requestID ?? '')
        if (!requestID) throw new Error('permission.resolve needs a requestID')
        const w = ref.current
        const manager = w.managers.permissionsManager
        if (!manager) throw new Error('wallet is not ready')

        // Only ever answer the request the chrome was actually shown. A stale
        // reply — the sheet unmounting after the queue moved on — must not grant
        // a spend the user never saw.
        const head = w.spendingRequests?.[0]
        if (!head || head.requestID !== requestID) return { ok: false, stale: true }

        if (params?.approved) {
          manager.grantPermission({
            requestID,
            ephemeral: params?.ephemeral !== false,
            ...(typeof params?.amount === 'number' ? { amount: params.amount } : {})
          })
        } else {
          try {
            await manager.denyPermission(requestID)
          } catch {
            // Expected: denial is a user choice, and the manager rejects the
            // underlying call as a consequence rather than as a fault here.
          }
        }
        w.advanceSpendingQueue()
        return { ok: true }
      },

      /**
       * The ceiling under which a page's spend goes through without asking.
       *
       * Clamped at zero, and zero is meaningful: it means ask every time. There is
       * no upper clamp — someone who wants a high limit on their own wallet is
       * entitled to one, and inventing a maximum here would be this screen deciding
       * how much of their money they are allowed to be trusted with.
       */
      [METHODS.SETTINGS_SET_AUTO_APPROVE]: async (params: { satoshis?: number } | null) => {
        const satoshis = Math.max(0, Math.round(Number(params?.satoshis ?? 0)))
        if (!Number.isFinite(satoshis)) throw new Error('the limit must be a number of satoshis')
        await AsyncStorage.setItem(AUTO_APPROVE_STORAGE_KEY, String(satoshis))
        // No rebuild and nothing to notify: WalletContext's spending-authorization
        // callback re-reads this key on every request, so the next spend already
        // sees it. That re-read is why this is a write and not a restart.
        return { ok: true, satoshis }
      },

      /**
       * Whatever spend request is outstanding, if any.
       *
       * The push is the normal path; this exists for the one case the push cannot
       * cover — the chrome reloading while a request is already queued, after the
       * event has been and gone.
       */
      [METHODS.PERMISSION_PENDING]: async () => {
        const head = ref.current.spendingRequests?.[0]
        return head ? toSpendPayload(head) : null
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

  // Keyed on requestID rather than on the object: the queue array is rebuilt on
  // every render, and pushing an identical request each time would re-open the
  // sheet under the user's finger.
  const head = wallet.spendingRequests?.[0]
  const headId = head?.requestID
  const pendingSpend = useMemo(
    () => (head ? toSpendPayload(head) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headId]
  )

  return { methods, handleCwi, state, pendingSpend }
}
