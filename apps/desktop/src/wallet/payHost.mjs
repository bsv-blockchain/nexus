import { MerklePath } from '@bsv/sdk'
import {
  buildTransactionsCsv,
  collectAllActions,
  exportFileName
} from '@nexus/wallet-core/src/utils/exportTransactions'

/**
 * Transactions, as the DOM chrome sees them — the desktop half of the six tx.*
 * methods apps/mobile/src/wallet/usePayBridge.ts answers. Same wire shapes, so the
 * chrome's live transactions pager needs no branch per shell.
 *
 * What is deliberately NOT here: the pay.* rails and the offline queue. Desktop
 * runs no Monitor, no outbox and no radios (see buildWallet.ts on why the factory
 * starts no timers), so `tx.list` answers `offline: {}` always — an empty overlay
 * rather than a missing field, because the chrome merges it unconditionally.
 */
export function createPayHost({ getWallet, getNetwork, adminOriginator }) {
  // Read through the getter on every call, never captured: restore, logout and
  // setNetwork all swap the wallet out from under this table.
  const require_ = () => {
    const w = getWallet()
    if (!w) throw new Error('wallet is not ready')
    return w
  }

  return {
    methods: {
      'tx.list': async (params) => {
        const { manager } = require_()
        const result = await manager.listActions(
          { labels: [], limit: params?.limit ?? 30, offset: params?.offset ?? 0 },
          adminOriginator
        )
        return { actions: result.actions, totalActions: result.totalActions, offline: {} }
      },

      'tx.abort': async ({ reference }) => {
        const { manager } = require_()
        await manager.abortAction({ reference: String(reference) }, adminOriginator)
        return { ok: true }
      },

      /**
       * WoC's BUMP endpoint written straight into storage, ported from mobile's
       * WalletContext.refreshProof. With no Monitor on desktop this nudge is the
       * ONLY proof path — without it a mined transaction sits at 'unproven'
       * forever.
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
