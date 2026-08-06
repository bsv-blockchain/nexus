import { createElement, useCallback, useContext, useMemo, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PeerPayClient, type IncomingPayment } from '@bsv/message-box-client'

import {
  MAX_RECOVERY_DAYS,
  derivationPrefixFor,
  getCurrentDate,
  getPaymentAddress,
  getProcessedTransactions,
  sendToAddress,
  sweepAddress,
  wocConfigFor
} from '@nexus/wallet-core/src/utils/pay/rails/address'
import {
  CONSEQUENCE_KEYS,
  PRECONDITION_KEYS,
  classifyScan,
  isValidBsvAddress,
  normalizeAddressInput
} from '@nexus/wallet-core/src/utils/pay/rails'
import { watchAddress } from '@nexus/wallet-core/src/utils/pay/watchlist'
import { takeProofNudge } from '@nexus/wallet-core/src/utils/pay/proofNudge'
import {
  makeIdentityClient,
  resolveIdentity,
  searchIdentities
} from '@nexus/wallet-core/src/utils/identity/resolveIdentity'
import {
  DEFAULT_MESSAGE_BOX_URL,
  MESSAGE_BOX_URL_KEY,
  NO_MESSAGE_BOX,
  acceptWithRetry,
  autoAcceptInbox,
  discardIncoming,
  internalizeIncoming,
  peerPayLinkFor,
  retryDelivery,
  sendViaHandle,
  type InboxAttempt
} from '@nexus/wallet-core/src/utils/pay/rails/handle'
import { getOutboxEntries, removeOutboxEntry } from '@nexus/wallet-core/src/utils/peerpay/outbox'
import {
  buildTransactionsCsv,
  collectAllActions,
  exportFileName
} from '@nexus/wallet-core/src/utils/exportTransactions'
import { TaskSendOffline } from '@nexus/wallet-core/src/utils/monitor/TaskSendOffline'
import { findOfflineActions } from '@nexus/wallet-storage/src/methods/offlineActions'

import NearbyFlow, { type NearbySettled } from '../native/NearbyFlow'
import { useNativeModal } from '../native/NativeModalHost'
import { WalletContext } from './WalletContext'

/**
 * Payments and transactions, as the DOM chrome sees them.
 *
 * Every rail's behaviour already exists in @nexus/wallet-core, ported verbatim
 * from BSV Browser — the derivation, the sweep, the outbox-before-delivery order,
 * the retry policy. Nothing in this file re-implements any of it. What it does is
 * carry those functions across the one boundary BSV Browser did not have: its pay
 * screens were React Native and could call the wallet directly, and ours are a DOM
 * document that can only send messages.
 *
 * So this is deliberately a thin, dumb layer. Any behaviour that looks like policy
 * belongs in wallet-core where both shells and the tests can reach it.
 */

const INBOX_DESCRIPTION = 'PeerPay payment'

/** Chrome-facing shape of an inbox row: the payment plus why it is still sitting there. */
export interface InboxRow {
  messageId: string
  sender: string
  amount: number
  attempts: number
  error: string
}

/**
 * How a nearby session ended, as the chrome sees it.
 *
 * `cancelled` is the honest answer for every non-settling exit, including the
 * `already_paid` terminal: that payment was queued by an earlier delivery, so
 * nothing moved during this session and reporting an arrival would have the
 * chrome celebrate one payment twice. The queue processor credits it either way.
 */
export interface NearbyResult {
  /**
   * `queued` is its own answer and must not be folded into `received`: the frame
   * is durably stored and cannot be lost, but the money is not in the wallet and
   * is not spendable yet. The background queue credits it later.
   */
  outcome: 'paid' | 'received' | 'queued' | 'cancelled'
  satoshis?: number
}

export function usePayBridge(): Record<string, (params: any) => any> {
  const wallet = useContext(WalletContext)
  // The nearby flow is a camera and two radios — none of which a document in a
  // WebView can reach — so this one method answers with a native screen instead
  // of a value. See NativeModalHost.
  const { present } = useNativeModal()

  // Read through a ref for the same reason useWalletBridge does: this table is
  // handed to the host router once, and closing over the context value would pin
  // every method to the render that built it.
  const ref = useRef(wallet)
  ref.current = wallet

  /** The permissions manager, or a refusal. Every rail needs it and none can fake it. */
  const requireWallet = useCallback(() => {
    const w = ref.current.managers.permissionsManager
    if (!w || !ref.current.walletBuilt) throw new Error('wallet is not ready')
    return w as any
  }, [])

  const requireStorage = useCallback(() => {
    const s = ref.current.storage
    if (!s) throw new Error('wallet storage is not ready')
    return s
  }, [])

  /**
   * Attempt state for the inbox, held for the life of the shell rather than in the
   * chrome. autoAcceptInbox's contract is that a payment which has failed
   * MAX_AUTO_ATTEMPTS times stops being retried until a human asks; if the chrome
   * owned this map, a screen remount would silently restart the retry loop against
   * a payment that can never succeed.
   */
  const inboxAttempts = useRef<Record<string, InboxAttempt>>({})

  const messageBoxUrl = useCallback(async (): Promise<string> => {
    const saved = await AsyncStorage.getItem(MESSAGE_BOX_URL_KEY)
    return saved || DEFAULT_MESSAGE_BOX_URL
  }, [])

  const peerPay = useCallback(async (): Promise<{ client: PeerPayClient; url: string }> => {
    const url = await messageBoxUrl()
    if (!url || url === NO_MESSAGE_BOX) throw new Error('no message box is configured')
    // Constructed per call, never eagerly: the library anoints lazily on first use
    // and anointing needs a funded wallet, so an init at mount would fail silently
    // on an empty wallet and latch itself against any later retry.
    const client = new PeerPayClient({
      messageBoxHost: url,
      walletClient: requireWallet(),
      originator: ref.current.adminOriginator
    })
    return { client, url }
  }, [messageBoxUrl, requireWallet])

  return useMemo<Record<string, (params: any) => any>>(
    () => ({
      // ── Classification ────────────────────────────────────────────────────
      // The rail is inferred from how the counterparty was identified, never
      // chosen. This is the only place a scanned or pasted string becomes a rail,
      // and it stays on the shell side because it needs @bsv/sdk to validate.
      'pay.classify': ({ text }: { text: string }) => classifyScan(String(text ?? '')),

      'pay.validateAddress': ({ text }: { text: string }) => {
        const normalized = normalizeAddressInput(String(text ?? ''))
        return { normalized, valid: isValidBsvAddress(normalized) }
      },

      /** Copy keys the chrome renders, so both shells say the same thing about consequences. */
      'pay.copyKeys': () => ({ preconditions: PRECONDITION_KEYS, consequences: CONSEQUENCE_KEYS }),

      // ── Address rail: getting paid ────────────────────────────────────────
      /**
       * Derive the day's address, put it on the watchlist, and return what has
       * already been imported to it. Registering is what makes the background
       * sweeper poll it — every address the user is shown gets watched, including
       * a recovered one.
       */
      'pay.address.receive': async (params: { daysOffset?: number } | null) => {
        const w = requireWallet()
        const offset = Math.min(MAX_RECOVERY_DAYS, Math.max(0, Math.round(params?.daysOffset ?? 0)))
        const woc = wocConfigFor(ref.current.selectedNetwork)
        const date = getCurrentDate(offset)
        const derivationPrefix = derivationPrefixFor(date)
        const address = await getPaymentAddress(w, ref.current.adminOriginator, derivationPrefix, woc.network)
        const storage = ref.current.storage
        if (storage) await watchAddress(storage as any, { address, date, derivationPrefix })
        const processed = await getProcessedTransactions(w, ref.current.adminOriginator, address)
        return { address, date, derivationPrefix, daysOffset: offset, maxRecoveryDays: MAX_RECOVERY_DAYS, processed }
      },

      /** Poll-only. Never sweeps, so it cannot race the background sweeper. */
      'pay.address.history': async ({ address }: { address: string }) => {
        const w = requireWallet()
        return getProcessedTransactions(w, ref.current.adminOriginator, String(address))
      },

      /**
       * Sweep now. The background pass covers the common case; this exists for a
       * recovered day, where the user is standing in front of the screen precisely
       * because they want an answer immediately.
       */
      'pay.address.sweep': async ({ address, daysOffset }: { address: string; daysOffset?: number }) => {
        const w = requireWallet()
        const offset = Math.min(MAX_RECOVERY_DAYS, Math.max(0, Math.round(daysOffset ?? 0)))
        return sweepAddress({
          wallet: w,
          adminOriginator: ref.current.adminOriginator,
          woc: wocConfigFor(ref.current.selectedNetwork),
          address: String(address),
          derivationPrefix: derivationPrefixFor(getCurrentDate(offset))
        })
      },

      // ── Address rail: paying ──────────────────────────────────────────────
      // sendToAddress guards the amount and the address before touching the
      // wallet: an invalid address here is money burned to an unspendable script.
      'pay.address.send': async ({ address, satoshis }: { address: string; satoshis: number }) => {
        const w = requireWallet()
        await sendToAddress({
          wallet: w,
          adminOriginator: ref.current.adminOriginator,
          address: String(address),
          satoshis: Number(satoshis)
        })
        return { ok: true }
      },

      // ── Handle rail ───────────────────────────────────────────────────────
      'pay.handle.identity': async (params: { sats?: number } | null) => {
        const w = requireWallet()
        const { publicKey } = await w.getPublicKey({ identityKey: true }, ref.current.adminOriginator)
        return { identityKey: publicKey, link: peerPayLinkFor(publicKey, params?.sats) }
      },

      /**
       * `defaultUrl` and `noneValue` travel with the answer so the chrome can offer
       * "reset" and "use no server" without hardcoding either. The sentinel in
       * particular is a rail-level constant — a chrome that spelled it itself would
       * silently stop disabling the rail the day the rail renamed it.
       */
      'pay.handle.messageBox': async () => {
        // One read, not three: the previous form awaited messageBoxUrl() separately
        // for each field, so a write landing between them could report a URL that
        // was neither default nor disabled while being one of them.
        const url = await messageBoxUrl()
        return {
          url,
          isDefault: url === DEFAULT_MESSAGE_BOX_URL,
          disabled: url === NO_MESSAGE_BOX,
          defaultUrl: DEFAULT_MESSAGE_BOX_URL,
          noneValue: NO_MESSAGE_BOX
        }
      },

      'pay.handle.setMessageBox': async ({ url }: { url: string }) => {
        const trimmed = String(url ?? '').trim().replace(/\/+$/, '')
        if (!trimmed) throw new Error('enter a message box URL')
        await AsyncStorage.setItem(MESSAGE_BOX_URL_KEY, trimmed)
        return { url: trimmed }
      },

      /**
       * Mint, persist, deliver, mark sent — in that order. A throw from delivery
       * leaves an `unsent` outbox entry, which the chrome offers for retry; the
       * transaction is already broadcast, so losing the token would lose the money.
       */
      'pay.handle.send': async ({ identityKey, satoshis }: { identityKey: string; satoshis: number }) => {
        const { client, url } = await peerPay()
        return sendViaHandle({
          client,
          storage: requireStorage() as any,
          recipient: String(identityKey),
          satoshis: Number(satoshis),
          messageBoxUrl: url
        })
      },

      /**
       * Who a handle belongs to, and who matches a typed name.
       *
       * Both are DECORATIVE relative to the payment — a payer who pasted a key can
       * always pay it — so neither is allowed to break the screen. `resolve` never
       * rejects by contract (an unresolvable key and an unknown peer look the same
       * to a caller, because the UI treatment is the same), and `search` answers an
       * empty list rather than throwing when no identity client can be built.
       */
      'pay.handle.resolve': async ({ identityKey }: { identityKey: string }) => {
        const client = makeIdentityClient(requireWallet(), ref.current.adminOriginator)
        if (!client) return { identity: null }
        const [, identity] = await resolveIdentity(client, String(identityKey))
        return { identity }
      },

      'pay.handle.search': async ({ query }: { query: string }) => {
        const text = String(query ?? '').trim()
        if (!text) return { results: [] }
        const client = makeIdentityClient(requireWallet(), ref.current.adminOriginator)
        if (!client) return { results: [] }
        try {
          return { results: await searchIdentities(client, text) }
        } catch {
          // searchIdentities DOES throw, unlike resolveIdentity. A failed lookup
          // must leave the field usable for a pasted key.
          return { results: [] }
        }
      },

      'pay.handle.outbox': async () => getOutboxEntries(requireStorage() as any),

      'pay.handle.retry': async ({ id }: { id: string }) => {
        const { client } = await peerPay()
        const storage = requireStorage() as any
        const entry = (await getOutboxEntries(storage)).find(e => e.id === id)
        if (!entry) throw new Error('that payment is no longer in the outbox')
        await retryDelivery({ client, storage, entry })
        return { ok: true }
      },

      'pay.handle.dismiss': async ({ id }: { id: string }) => {
        await removeOutboxEntry(requireStorage() as any, String(id))
        return { ok: true }
      },

      /**
       * Credit everything in the box that is still worth attempting, and report
       * only what is left needing a person. Accepting was never a decision a user
       * could act on — the money is already theirs — so the chrome shows the
       * failures, not the arrivals.
       */
      'pay.handle.inbox': async (params: { retry?: string[] } | null) => {
        const { client, url } = await peerPay()
        const w = requireWallet()
        const payments = await client.listIncomingPayments(url)

        const result = await autoAcceptInbox<IncomingPayment>({
          payments,
          attempts: inboxAttempts.current,
          force: params?.retry,
          accept: payment =>
            acceptWithRetry(client, url, payment, INBOX_DESCRIPTION, (p, d) =>
              internalizeIncoming(w, client, ref.current.adminOriginator, p, d)
            )
        })
        inboxAttempts.current = result.attempts

        const stuck: InboxRow[] = payments
          .filter(p => result.attempts[String(p.messageId)])
          .map(p => ({
            messageId: String(p.messageId),
            sender: p.sender,
            amount: p.token?.amount ?? 0,
            attempts: result.attempts[String(p.messageId)]!.attempts,
            error: result.attempts[String(p.messageId)]!.error
          }))

        // Everything NOT left in the attempt map was credited, so that is what the
        // figure sums. The chrome shows it on the receipt: a count alone tells a
        // payee that something arrived without telling them whether it was theirs.
        const creditedSatoshis = payments
          .filter(p => !result.attempts[String(p.messageId)])
          .reduce((sum, p) => sum + (p.token?.amount ?? 0), 0)

        return { accepted: result.accepted, creditedSatoshis, stuck }
      },

      /**
       * ABANDONS money. The acknowledge removes the message from the box, so this
       * wallet can never credit it and the only recovery is asking the sender to
       * send again. Exposed because a structurally corrupt payment would otherwise
       * sit in the list for good — the chrome must confirm before calling it.
       */
      'pay.handle.discard': async ({ messageId }: { messageId: string }) => {
        const { client } = await peerPay()
        await discardIncoming(client, { messageId: String(messageId) })
        delete inboxAttempts.current[String(messageId)]
        return { ok: true }
      },

      // ── Nearby rail ───────────────────────────────────────────────────────
      /**
       * Hand the whole in-person exchange to a native screen and wait for it.
       *
       * Unlike every other method here this one is not a wrapper around a
       * wallet-core call: the flow it opens is a multi-minute conversation with
       * another device — mint, advertise, listen, scan, settle — and its money
       * safety lives in the ordering of those steps, not in any single result.
       * Splitting it into bridge calls would put a WebView message boundary in
       * the middle of that ordering, so the screen owns it end to end and the
       * chrome learns one thing: what happened.
       *
       * Resolving is deliberately deferred to `onExit`, not `onSettled`. The
       * success screen and the payee's receipt are part of the payment — the one
       * moment both people are looking at the phone — and resolving here unmounts
       * the modal, so settling early would snatch the receipt away mid-celebration.
       */
      'pay.nearby.open': async (params: { role?: unknown } | null): Promise<NearbyResult> => {
        const role = params?.role === 'payee' ? 'payee' : 'payer'
        return present<NearbyResult>((resolve) => {
          // Latched rather than resolved on the spot, and read back on exit.
          let settled: NearbySettled | null = null
          return createElement(NearbyFlow, {
            role,
            onSettled: (result: NearbySettled) => {
              settled = result
            },
            onExit: () =>
              resolve(settled ? { outcome: settled.outcome, satoshis: settled.satoshis } : { outcome: 'cancelled' })
          })
        })
      },

      // ── The offline queue ─────────────────────────────────────────────────
      // Advisory, never load-bearing: a read failure here must not break the
      // screen, so it reports an empty queue rather than throwing.
      'pay.offline.status': async () => {
        try {
          const db = ref.current.storage?.sqliteDb
          if (!db) return { queued: 0, rejected: [], sentRejected: [], queuedSent: [], stalled: undefined }
          const userId = ref.current.walletUserId
          const rows = await findOfflineActions(db, {
            status: ['queued', 'posting', 'rejected'],
            ...(userId === null ? {} : { userId })
          })
          return {
            queued: rows.filter(r => r.status !== 'rejected').length,
            // A payer's own held payment can be rejected too, but it carries no
            // sender or receivedVia — those are only recorded on the receiving
            // side. Reporting one as "someone handed you this" would misdescribe
            // the user's own failed payment as fraud against them.
            rejected: rows.filter(r => r.status === 'rejected' && r.role === 'received'),
            sentRejected: rows.filter(r => r.status === 'rejected' && r.role === 'sent'),
            queuedSent: rows.filter(r => r.status !== 'rejected' && r.role === 'sent'),
            stalled: TaskSendOffline.lastStall
          }
        } catch {
          return { queued: 0, rejected: [], sentRejected: [], queuedSent: [], stalled: undefined }
        }
      },

      'pay.offline.sendNow': () => {
        TaskSendOffline.requestNow()
        return { ok: true }
      },

      /**
       * One deferred proof sweep per visit, 10-minute gated. Best-effort by design:
       * a failed sweep leaves the 2h background trigger as the backstop and must
       * never surface on the screen.
       */
      'pay.proofNudge': async () => {
        if (!takeProofNudge(Date.now())) return { ran: false }
        try {
          await ref.current.runMonitorTask('CheckForProofs')
          return { ran: true }
        } catch {
          return { ran: false }
        }
      },

      // ── Transactions ──────────────────────────────────────────────────────
      /**
       * A page of actions, plus the offline-queue rows that overlay them. The queue
       * row is live held-state and outranks the raw status: a held transaction sits
       * at 'unproven' (indistinguishable from a broadcast one) or at 'nosend'
       * (indistinguishable from a deliberate pending-signature noSend).
       */
      'tx.list': async (params: { offset?: number; limit?: number } | null) => {
        const w = requireWallet()
        const result = await w.listActions(
          { labels: [], limit: params?.limit ?? 30, offset: params?.offset ?? 0 },
          ref.current.adminOriginator
        )
        let offline: Record<string, unknown> = {}
        try {
          const db = ref.current.storage?.sqliteDb
          if (db) {
            const userId = ref.current.walletUserId
            const rows = await findOfflineActions(db, {
              status: ['queued', 'posting', 'rejected'],
              ...(userId === null ? {} : { userId })
            })
            offline = Object.fromEntries(rows.map(r => [r.txid, r]))
          }
        } catch {
          // Advisory overlay only; the list still has to render.
        }
        return { actions: result.actions, totalActions: result.totalActions, offline }
      },

      'tx.abort': async ({ reference }: { reference: string }) => {
        const w = requireWallet()
        await w.abortAction({ reference: String(reference) }, ref.current.adminOriginator)
        return { ok: true }
      },

      'tx.refreshProof': async ({ txid }: { txid: string }) => {
        await ref.current.refreshProof(String(txid))
        return { ok: true }
      },

      'tx.rawHex': async ({ txid }: { txid: string }) => {
        const storage = requireStorage()
        const rawTx = await storage.getRawTxOfKnownValidTransaction(String(txid))
        if (!rawTx) throw new Error('this transaction is not stored locally')
        return {
          hex: Array.from(rawTx)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        }
      },

      /**
       * The CSV itself, not a share sheet. BSV Browser handed the file straight to
       * expo-sharing; that module is not in this app's native build, so the chrome
       * receives the text and decides. Column order and escaping are unchanged, so
       * an export from either app diffs clean.
       */
      'tx.exportCsv': async () => {
        const w = requireWallet()
        const actions = await collectAllActions(w, ref.current.adminOriginator)
        if (actions.length === 0) return { count: 0, filename: exportFileName(), csv: '' }
        const heightMap = new Map<string, number>()
        const storage = ref.current.storage
        if (storage) {
          const proven = await storage.findProvenTxs({ partial: {} } as any)
          for (const p of proven) {
            if (p.txid && typeof p.height === 'number') heightMap.set(p.txid, p.height)
          }
        }
        return { count: actions.length, filename: exportFileName(), csv: buildTransactionsCsv(actions, heightMap) }
      },

      /** Which explorer a txid belongs to, so the chrome can open it in a tab. */
      'tx.explorerUrl': ({ txid }: { txid: string }) => {
        const network = ref.current.selectedNetwork
        const base =
          network === 'main'
            ? 'https://whatsonchain.com'
            : network === 'teratest'
              ? 'https://woc-ttn.bsvblockchain.tech'
              : 'https://test.whatsonchain.com'
        return { url: `${base}/tx/${String(txid)}` }
      }
    }),
    [messageBoxUrl, peerPay, present, requireStorage, requireWallet]
  )
}
