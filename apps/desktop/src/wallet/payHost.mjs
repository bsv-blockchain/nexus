import { MerklePath } from '@bsv/sdk'
import { PeerPayClient } from '@bsv/message-box-client'
import {
  buildTransactionsCsv,
  collectAllActions,
  exportFileName
} from '@nexus/wallet-core/src/utils/exportTransactions'
import { TaskSendOffline } from '@nexus/wallet-core/src/utils/monitor/TaskSendOffline'
import {
  CONSEQUENCE_KEYS,
  PRECONDITION_KEYS,
  classifyScan,
  isValidBsvAddress,
  normalizeAddressInput
} from '@nexus/wallet-core/src/utils/pay/rails'
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
  DEFAULT_MESSAGE_BOX_URL,
  MESSAGE_BOX_URL_KEY,
  NO_MESSAGE_BOX,
  acceptWithRetry,
  autoAcceptInbox,
  discardIncoming,
  internalizeIncoming,
  peerPayLinkFor,
  retryDelivery,
  sendViaHandle
} from '@nexus/wallet-core/src/utils/pay/rails/handle'
import {
  makeIdentityClient,
  resolveIdentity,
  searchIdentities
} from '@nexus/wallet-core/src/utils/identity/resolveIdentity'
import { takeProofNudge } from '@nexus/wallet-core/src/utils/pay/proofNudge'
import { watchAddress } from '@nexus/wallet-core/src/utils/pay/watchlist'
import { getOutboxEntries, removeOutboxEntry } from '@nexus/wallet-core/src/utils/peerpay/outbox'
import { findOfflineActions } from '@nexus/wallet-storage/src/methods/offlineActions'

/**
 * Payments and transactions, as the DOM chrome sees them — the desktop half of what
 * apps/mobile/src/wallet/usePayBridge.ts answers. Same method names and the same wire
 * shapes, so the chrome's payment grid, its transactions pager and its queue notice
 * need no branch per shell.
 *
 * The queue is real here now. StorageExpoSQLite.holdReqsOffline is shared code
 * reached from any broadcast attempt, so a payment made while this machine is
 * offline is held rather than failed, and buildWallet.ts registers TaskSendOffline
 * to release it — which is why `tx.list` overlays held rows instead of the empty
 * object it used to send.
 *
 * The rails are the SAME CODE mobile runs, not a second implementation: the
 * derivation, the sweep, the outbox-before-delivery order and the inbox retry policy
 * all come from @nexus/wallet-core, so every rule about money is stated once and
 * tested once. This file only carries them across the boundary a DOM document cannot
 * cross by itself. Anything added here that starts to look like policy belongs in
 * wallet-core instead, where both shells and the tests can reach it.
 *
 * What is deliberately NOT here is the nearby rail. It is a camera and two local
 * radios driving a multi-minute exchange with a second device, and Electron has an
 * equivalent of none of them — which is why preload-chrome.cjs declares 'pay' but
 * still withholds 'nearby' and 'scan'.
 */

/**
 * What a credited inbox payment is called in the ledger. The same string mobile
 * writes, so one wallet opened on both shells reads as one history.
 */
const INBOX_DESCRIPTION = 'PeerPay payment'

export function createPayHost({ getWallet, getNetwork, adminOriginator, localStorage, holdSweeper }) {
  // Read through the getter on every call, never captured: restore, logout and
  // setNetwork all swap the wallet out from under this table.
  const require_ = () => {
    const w = getWallet()
    if (!w) throw new Error('wallet is not ready')
    return w
  }

  /**
   * Inbox attempt state, held for the life of the host rather than in the chrome.
   *
   * autoAcceptInbox's contract is that a payment which has failed MAX_AUTO_ATTEMPTS
   * times stops being retried until a human asks. If the chrome owned this map, a
   * closed and reopened Pay sheet would silently restart the retry loop against a
   * payment that can never succeed.
   */
  let inboxAttempts = {}

  const messageBoxUrl = async () => {
    const saved = await localStorage.getItem(MESSAGE_BOX_URL_KEY)
    return saved || DEFAULT_MESSAGE_BOX_URL
  }

  /**
   * A PeerPay client for the configured box.
   *
   * Constructed per call, never eagerly: the library anoints lazily on first use and
   * anointing needs a funded wallet, so an init at startup would fail silently on an
   * empty wallet and latch itself against every later retry.
   */
  const peerPay = async () => {
    const url = await messageBoxUrl()
    if (!url || url === NO_MESSAGE_BOX) throw new Error('no message box is configured')
    const { manager } = require_()
    const client = new PeerPayClient({ messageBoxHost: url, walletClient: manager, originator: adminOriginator })
    return { client, url }
  }

  /**
   * The queue rows worth showing, or none.
   *
   * Advisory at both call sites — a read failure must not take down the transaction
   * list or the pay screen — so it answers with an empty queue rather than throwing.
   * The userId is a FILTER, not a gate: an unscoped wallet reads every row rather
   * than none, matching the tolerance buildWallet.ts applies when getAuth fails.
   */
  const offlineRows = async () => {
    try {
      const { storage, userId } = require_()
      const db = storage.sqliteDb
      if (!db) return []
      return await findOfflineActions(db, {
        status: ['queued', 'posting', 'rejected'],
        ...(userId == null ? {} : { userId })
      })
    } catch {
      return []
    }
  }

  return {
    methods: {
      // ── Classification ────────────────────────────────────────────────────
      // The rail is inferred from how the counterparty was identified, never
      // chosen. This is the only place a pasted string becomes a rail, and it
      // stays on the shell side because it needs @bsv/sdk to validate.
      'pay.classify': ({ text }) => classifyScan(String(text ?? '')),

      'pay.validateAddress': ({ text }) => {
        const normalized = normalizeAddressInput(String(text ?? ''))
        return { normalized, valid: isValidBsvAddress(normalized) }
      },

      /** Copy keys the chrome renders, so both shells say the same thing about consequences. */
      'pay.copyKeys': () => ({ preconditions: PRECONDITION_KEYS, consequences: CONSEQUENCE_KEYS }),

      // ── Address rail: getting paid ────────────────────────────────────────
      /**
       * Derive the day's address, put it on the watchlist, and return what has
       * already been imported to it.
       *
       * The watchlist write is what the sweeper is allowed to poll, so it has to
       * happen before any sweep can find this address.
       *
       * This is also the screen opening, so it takes the sweeper's lease. Only
       * this screen reaches this method, which is what makes the call a reliable
       * signal that somebody is waiting for money at an address — see
       * sweepLoop.mjs.
       */
      'pay.address.receive': async (params) => {
        const { manager, storage } = require_()
        const offset = Math.min(MAX_RECOVERY_DAYS, Math.max(0, Math.round(params?.daysOffset ?? 0)))
        const woc = wocConfigFor(await getNetwork())
        const date = getCurrentDate(offset)
        const derivationPrefix = derivationPrefixFor(date)
        const address = await getPaymentAddress(manager, adminOriginator, derivationPrefix, woc.network)
        await watchAddress(storage, { address, date, derivationPrefix })
        // After the watchlist write, so the first pass can already see this one.
        holdSweeper?.()
        const processed = await getProcessedTransactions(manager, adminOriginator, address)
        return { address, date, derivationPrefix, daysOffset: offset, maxRecoveryDays: MAX_RECOVERY_DAYS, processed }
      },

      /**
       * Poll-only. Never sweeps, so it cannot race a sweep the user asked for.
       *
       * It does renew the sweeper's lease, though: this is the screen's own 5s
       * poll, so it is the heartbeat that says the screen is still open. The
       * sweep it keeps alive is the one that actually imports.
       */
      'pay.address.history': async ({ address }) => {
        const { manager } = require_()
        holdSweeper?.()
        return getProcessedTransactions(manager, adminOriginator, String(address))
      },

      /**
       * Sweep now — import whatever has landed on the address into the wallet.
       * Idempotent per output: the address label sweepAddress writes is how the next
       * pass recognises what it already took, so pressing it twice is a no-op rather
       * than a double credit.
       */
      'pay.address.sweep': async ({ address, daysOffset }) => {
        const { manager } = require_()
        holdSweeper?.()
        const offset = Math.min(MAX_RECOVERY_DAYS, Math.max(0, Math.round(daysOffset ?? 0)))
        return sweepAddress({
          wallet: manager,
          adminOriginator,
          woc: wocConfigFor(await getNetwork()),
          address: String(address),
          derivationPrefix: derivationPrefixFor(getCurrentDate(offset))
        })
      },

      // ── Address rail: paying ──────────────────────────────────────────────
      // sendToAddress guards the amount and the address before touching the
      // wallet: an invalid address here is money burned to an unspendable script.
      'pay.address.send': async ({ address, satoshis }) => {
        const { manager } = require_()
        await sendToAddress({
          wallet: manager,
          adminOriginator,
          address: String(address),
          satoshis: Number(satoshis)
        })
        return { ok: true }
      },

      // ── Handle rail ───────────────────────────────────────────────────────
      'pay.handle.identity': async (params) => {
        const { manager } = require_()
        const { publicKey } = await manager.getPublicKey({ identityKey: true }, adminOriginator)
        return { identityKey: publicKey, link: peerPayLinkFor(publicKey, params?.sats) }
      },

      /**
       * `defaultUrl` and `noneValue` travel with the answer so the chrome can offer
       * "reset" and "use no server" without hardcoding either. The sentinel in
       * particular is a rail-level constant — a chrome that spelled it itself would
       * silently stop disabling the rail the day the rail renamed it.
       */
      'pay.handle.messageBox': async () => {
        const url = await messageBoxUrl()
        return {
          url,
          isDefault: url === DEFAULT_MESSAGE_BOX_URL,
          disabled: url === NO_MESSAGE_BOX,
          defaultUrl: DEFAULT_MESSAGE_BOX_URL,
          noneValue: NO_MESSAGE_BOX
        }
      },

      'pay.handle.setMessageBox': async ({ url }) => {
        const trimmed = String(url ?? '').trim().replace(/\/+$/, '')
        if (!trimmed) throw new Error('enter a message box URL')
        await localStorage.setItem(MESSAGE_BOX_URL_KEY, trimmed)
        return { url: trimmed }
      },

      /**
       * Mint, persist, deliver, mark sent — in that order. A throw from delivery
       * leaves an `unsent` outbox entry, which the chrome offers for retry; the
       * transaction is already broadcast, so losing the token would lose the money.
       */
      'pay.handle.send': async ({ identityKey, satoshis }) => {
        const { client, url } = await peerPay()
        return sendViaHandle({
          client,
          storage: require_().storage,
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
      'pay.handle.resolve': async ({ identityKey }) => {
        const client = makeIdentityClient(require_().manager, adminOriginator)
        if (!client) return { identity: null }
        const [, identity] = await resolveIdentity(client, String(identityKey))
        return { identity }
      },

      'pay.handle.search': async ({ query }) => {
        const text = String(query ?? '').trim()
        if (!text) return { results: [] }
        const client = makeIdentityClient(require_().manager, adminOriginator)
        if (!client) return { results: [] }
        try {
          return { results: await searchIdentities(client, text) }
        } catch {
          // searchIdentities DOES throw, unlike resolveIdentity. A failed lookup
          // must leave the field usable for a pasted key.
          return { results: [] }
        }
      },

      'pay.handle.outbox': async () => getOutboxEntries(require_().storage),

      'pay.handle.retry': async ({ id }) => {
        const { client } = await peerPay()
        const { storage } = require_()
        const entry = (await getOutboxEntries(storage)).find((e) => e.id === id)
        if (!entry) throw new Error('that payment is no longer in the outbox')
        await retryDelivery({ client, storage, entry })
        return { ok: true }
      },

      'pay.handle.dismiss': async ({ id }) => {
        await removeOutboxEntry(require_().storage, String(id))
        return { ok: true }
      },

      /**
       * Credit everything in the box that is still worth attempting, and report only
       * what is left needing a person. Accepting was never a decision a user could
       * act on — the money is already theirs — so the chrome shows the failures, not
       * the arrivals.
       */
      'pay.handle.inbox': async (params) => {
        const { client, url } = await peerPay()
        const { manager } = require_()
        const payments = await client.listIncomingPayments(url)

        const result = await autoAcceptInbox({
          payments,
          attempts: inboxAttempts,
          force: params?.retry,
          accept: (payment) =>
            acceptWithRetry(client, url, payment, INBOX_DESCRIPTION, (p, d) =>
              internalizeIncoming(manager, client, adminOriginator, p, d)
            )
        })
        inboxAttempts = result.attempts

        const stuck = payments
          .filter((p) => result.attempts[String(p.messageId)])
          .map((p) => ({
            messageId: String(p.messageId),
            sender: p.sender,
            amount: p.token?.amount ?? 0,
            attempts: result.attempts[String(p.messageId)].attempts,
            error: result.attempts[String(p.messageId)].error
          }))

        // Everything NOT left in the attempt map was credited, so that is what the
        // figure sums. The chrome shows it on the receipt: a count alone tells a
        // payee that something arrived without telling them whether it was theirs.
        const creditedSatoshis = payments
          .filter((p) => !result.attempts[String(p.messageId)])
          .reduce((sum, p) => sum + (p.token?.amount ?? 0), 0)

        return { accepted: result.accepted, creditedSatoshis, stuck }
      },

      /**
       * ABANDONS money. The acknowledge removes the message from the box, so this
       * wallet can never credit it and the only recovery is asking the sender to send
       * again. Exposed because a structurally corrupt payment would otherwise sit in
       * the list for good — the chrome must confirm before calling it.
       */
      'pay.handle.discard': async ({ messageId }) => {
        const { client } = await peerPay()
        await discardIncoming(client, { messageId: String(messageId) })
        delete inboxAttempts[String(messageId)]
        return { ok: true }
      },

      // ── The offline queue ─────────────────────────────────────────────────
      'pay.offline.status': async () => {
        const rows = await offlineRows()
        return {
          queued: rows.filter((r) => r.status !== 'rejected').length,
          // A payer's own held payment can be rejected too, but it carries no
          // sender or receivedVia — those are only recorded on the receiving side.
          // Reporting one as "someone handed you this" would misdescribe the user's
          // own failed payment as fraud against them, so the two are separate keys.
          rejected: rows.filter((r) => r.status === 'rejected' && r.role === 'received'),
          sentRejected: rows.filter((r) => r.status === 'rejected' && r.role === 'sent'),
          queuedSent: rows.filter((r) => r.status !== 'rejected' && r.role === 'sent'),
          // Nothing else in the system records a stall, and it is the one state that
          // retrying cannot clear — so the drain's last verdict is reported as-is.
          stalled: TaskSendOffline.lastStall
        }
      },

      /**
       * The user's "Send now". Arms the drain rather than draining here: the task
       * owns the ordering (parents before children) and its own online gate, and a
       * second release path running beside it is how the same transaction gets
       * posted twice.
       *
       * Deliberately does not require a wallet — the flags are process-global and
       * the task checks for itself — which keeps it identical to mobile's.
       */
      'pay.offline.sendNow': () => {
        TaskSendOffline.requestNow()
        return { ok: true }
      },

      /**
       * One deferred proof sweep per visit of the Pay sheet, 10-minute gated.
       *
       * Best-effort by design: a failed pass leaves the Monitor's own header-driven
       * trigger as the backstop and must never surface on the screen. A wallet with
       * no Monitor (buildWallet tolerates one that failed to construct) answers
       * `ran: false` rather than pretending — the gate is spent either way, and
       * nothing here could have run.
       */
      'pay.proofNudge': async () => {
        if (!takeProofNudge(Date.now())) return { ran: false }
        try {
          const { monitor } = require_()
          if (!monitor) return { ran: false }
          await monitor.runTask('CheckForProofs')
          return { ran: true }
        } catch {
          return { ran: false }
        }
      },

      // ── Transactions ──────────────────────────────────────────────────────
      /**
       * A page of actions, plus the queue rows that overlay them. The queue row is
       * live held-state and outranks the raw status: a held transaction sits at
       * 'nosend', which is indistinguishable from a deliberate pending-signature
       * noSend, so without this overlay a payment waiting for signal reads as one
       * waiting for a person.
       */
      'tx.list': async (params) => {
        const { manager } = require_()
        const result = await manager.listActions(
          { labels: [], limit: params?.limit ?? 30, offset: params?.offset ?? 0 },
          adminOriginator
        )
        const rows = await offlineRows()
        return {
          actions: result.actions,
          totalActions: result.totalActions,
          offline: Object.fromEntries(rows.map((r) => [r.txid, r]))
        }
      },

      'tx.abort': async ({ reference }) => {
        const { manager } = require_()
        await manager.abortAction({ reference: String(reference) }, adminOriginator)
        return { ok: true }
      },

      /**
       * WoC's BUMP endpoint written straight into storage, ported from mobile's
       * WalletContext.refreshProof. The Monitor's TaskCheckForProofs now covers the
       * background case, so this is the manual nudge for the one transaction someone
       * is actually looking at — and the fallback when Chaintracks is down and the
       * header-driven trigger never fires at all.
       */
      'tx.refreshProof': async ({ txid: rawTxid }) => {
        const { storage } = require_()
        const txid = String(rawTxid)
        const network = await getNetwork()

        const res = await fetch(`https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/proof/bump`)
        if (!res.ok) throw new Error(`BUMP not available (HTTP ${res.status}) — transaction may not be mined yet`)

        const bumpHex = (await res.text()).trim()
        const merklePath = MerklePath.fromHex(bumpHex)
        const merkleRoot = merklePath.computeRoot(txid)
        const leaf = merklePath.path[0].find((l) => l.txid === true && l.hash === txid)
        if (!leaf) throw new Error('txid not found in BUMP path')

        const reqs = await storage.findProvenTxReqs({ partial: { txid } })
        if (!reqs.length) throw new Error('no pending record found for this transaction')

        const req = reqs[0]
        await storage.updateProvenTxReqWithNewProvenTx({
          provenTxReqId: req.provenTxReqId,
          status: req.status,
          txid,
          attempts: req.attempts,
          history: req.history,
          index: leaf.offset,
          height: merklePath.blockHeight,
          blockHash: '',
          merklePath: merklePath.toBinary(),
          merkleRoot
        })
        return { ok: true }
      },

      'tx.rawHex': async ({ txid }) => {
        const { storage } = require_()
        const rawTx = await storage.getRawTxOfKnownValidTransaction(String(txid))
        if (!rawTx) throw new Error('this transaction is not stored locally')
        return {
          hex: Array.from(rawTx)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        }
      },

      /**
       * The CSV itself, not a file: the chrome decides what to do with the text.
       * Same seam as mobile, and the column order diffs clean against BSV Browser.
       */
      'tx.exportCsv': async () => {
        const { manager, storage } = require_()
        const actions = await collectAllActions(manager, adminOriginator)
        if (actions.length === 0) return { count: 0, filename: exportFileName(), csv: '' }
        // An action with no proven height exports an empty cell, not a zero — zero
        // is a real block height and "not yet proven" is not.
        const heightMap = new Map()
        const proven = await storage.findProvenTxs({ partial: {} })
        for (const p of proven) {
          if (p.txid && typeof p.height === 'number') heightMap.set(p.txid, p.height)
        }
        return { count: actions.length, filename: exportFileName(), csv: buildTransactionsCsv(actions, heightMap) }
      },

      /** Which explorer a txid belongs to, so the chrome can open it in a tab. */
      'tx.explorerUrl': async ({ txid }) => {
        const network = await getNetwork()
        const base = network === 'main' ? 'https://whatsonchain.com' : 'https://test.whatsonchain.com'
        return { url: `${base}/tx/${String(txid)}` }
      }
    }
  }
}
