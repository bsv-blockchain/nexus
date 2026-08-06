import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateMnemonicWallet } from '@nexus/wallet-core/src/utils/mnemonicWallet'
import { restoreDesktopWallet } from './buildWallet.ts'
import { createPayHost } from './payHost.mjs'
import { createLocalStorage } from '../platform/index.mjs'
import { installDesktopOnlineProbe } from '../platform/onlineProbe.mjs'

/**
 * The desktop wallet, as the chrome sees it.
 *
 * The mobile shell answers these same methods from
 * apps/mobile/src/wallet/useWalletBridge.ts. This is the Electron half: identical
 * method names, identical return shapes, so `apps/ui` needs no branch and the
 * capability list is the only thing that differs between shells.
 *
 * Kept deliberately thin. Every answer is a question put to the manager stack — no
 * caching, no derived state — because two sources of truth for a balance is how a
 * wallet comes to show a number that is not the number.
 */

const SATS_PER_BSV = 100_000_000
const ACCOUNT_ID = 'default'
const ADMIN_ORIGINATOR = 'admin.com'
// Key-value key for the chosen chain. Plain storage, not the keychain: which
// network the user looks at is a preference, not a secret.
const NETWORK_KEY = 'network'

/** A base64 reference masquerading as a description; see the mobile bridge. */
const LOOKS_LIKE_A_REFERENCE = /^[A-Za-z0-9+/]{16,}={0,2}$/

function humanMemo(description) {
  const text = (description ?? '').trim()
  return LOOKS_LIKE_A_REFERENCE.test(text) ? '' : text
}

export function createWalletHost({ userDataDir, onStateChange }) {
  // One directory for wallet databases, under userData so the OS backs it up and
  // uninstall removes it. bsv-desktop puts its databases in ~/.bsv-desktop, outside
  // every OS convention, and has accumulated dozens of stale files plus plaintext
  // mnemonics there — not a pattern to copy.
  const databaseDir = join(userDataDir, 'wallets')
  mkdirSync(databaseDir, { recursive: true })

  installDesktopOnlineProbe()
  const localStorage = createLocalStorage()

  /** @type {{ manager: any, storage: any, identityKey: string, userId: number|null } | null} */
  let wallet = null
  let building = false

  const publish = () => onStateChange?.({ ready: wallet !== null, building })

  /**
   * The persisted chain choice, 'main' when nothing (or nonsense) is stored.
   *
   * Read per call rather than cached: settings.setNetwork writes through the same
   * key-value store, and a cache here would be a second source of truth that
   * survives it. Anything unrecognised collapses to 'main' so an old build reading
   * a future value degrades to the default instead of refusing to start.
   */
  const currentNetwork = async () => {
    const stored = await localStorage.getItem(NETWORK_KEY)
    return stored === 'test' ? 'test' : 'main'
  }

  const require_ = () => {
    if (!wallet) throw new Error('wallet is not ready')
    return wallet
  }

  /** Admin-originator call into our own wallet, for what the chrome asks on its own behalf. */
  const asAdmin = (fn) => fn(require_().manager, ADMIN_ORIGINATOR)

  // The tx.* surface reads through the same wallet. Getters, not snapshots:
  // restore, logout and setNetwork all swap `wallet` (and the chain) at runtime.
  const payHost = createPayHost({
    getWallet: () => wallet,
    getNetwork: currentNetwork,
    adminOriginator: ADMIN_ORIGINATOR
  })

  return {
    /** For the shell: whether a wallet exists, so it can decide what to show. */
    get isReady() {
      return wallet !== null
    },

    /** tx.* as a separate table, so main.mjs wires (and a reader audits) it as a unit. */
    payMethods: payHost.methods,

    methods: {
      'wallet.info': async () => {
        let identityKey
        if (wallet) {
          try {
            const res = await asAdmin((w, o) => w.getPublicKey({ identityKey: true }, o))
            identityKey = res?.publicKey
          } catch {
            // A wallet that is up but cannot answer this is still ready; the
            // identity key is decoration on the payload, not the payload.
          }
        }
        return {
          available: true,
          ready: wallet !== null,
          building,
          network: await currentNetwork(),
          identityKey
        }
      },

      'wallet.accounts': async () => {
        if (!wallet) return []
        const outputs = await asAdmin((w, o) =>
          w.listOutputs({ basket: ACCOUNT_ID, limit: 1000, includeLockingScripts: false }, o)
        )
        const balanceSatoshis = (outputs?.outputs ?? []).reduce((sum, out) => sum + (out.satoshis ?? 0), 0)
        let key = ''
        try {
          const res = await asAdmin((w, o) => w.getPublicKey({ identityKey: true }, o))
          key = res?.publicKey ?? ''
        } catch {
          // Same tolerance as wallet.info — a missing label must not hide a balance.
        }
        return [
          {
            id: ACCOUNT_ID,
            label: 'Nexus',
            address: key,
            balanceSatoshis,
            fiatCurrency: 'USD',
            // No exchange-rate service in main yet. Zero is visibly "unknown"
            // rather than a made-up number, and the chrome renders $0.00 for it —
            // which is worse than a real rate and better than a wrong one.
            fiatRate: 0,
            createdAt: new Date(0).toISOString()
          }
        ]
      },

      'wallet.transactions': async (params) => {
        if (!wallet) return []
        const limit = params?.limit ?? 50
        // Read the ledger rows, not listActions: the chrome groups by day and
        // listActions returns no timestamp. Same choice the mobile bridge makes.
        const rows = await wallet.storage.findTransactions({
          partial: wallet.userId == null ? {} : { userId: wallet.userId },
          paged: { limit },
          orderDescending: true
        })
        return rows.map((tx) => {
          const satoshis = tx.satoshis ?? 0
          const txid = tx.txid ?? ''
          return {
            id: String(tx.transactionId),
            accountId: ACCOUNT_ID,
            txid,
            // The SIGN of the net change, never `isOutgoing` — that means "this
            // wallet created it", which a swept-in payment also satisfies.
            direction: satoshis < 0 ? 'outgoing' : 'incoming',
            amountSatoshis: Math.abs(satoshis),
            feeSatoshis: 0,
            counterparty: txid ? `${txid.slice(0, 8)}…${txid.slice(-4)}` : 'unknown',
            memo: humanMemo(tx.description),
            status: tx.status === 'completed' ? 'confirmed' : 'pending',
            confirmations: tx.status === 'completed' ? 1 : 0,
            createdAt: new Date(tx.created_at).toISOString()
          }
        })
      },

      'wallet.restore': async (params) => {
        const phrase = (params?.mnemonic ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
        const words = phrase ? phrase.split(' ') : []
        if (words.length !== 12 && words.length !== 24) {
          throw new Error(`a recovery phrase is 12 or 24 words; got ${words.length}`)
        }
        if (wallet) return { ok: true }

        building = true
        publish()
        try {
          wallet = await restoreDesktopWallet(phrase, {
            databaseDir,
            chain: await currentNetwork(),
            adminOriginator: ADMIN_ORIGINATOR
          })
          // Only after the wallet is proven to build. Storing a phrase that turned
          // out to be unusable would make the next launch fail silently instead of
          // asking again.
          const stored = await localStorage.setMnemonic(phrase)
          if (!stored) {
            console.warn('[wallet] built, but the phrase could not be stored: no OS keychain')
          }
          return { ok: true, storedSecurely: stored }
        } finally {
          building = false
          publish()
        }
      },

      'wallet.create': async () => {
        // Refuse before generating anything: creating over live keys is a wipe.
        // A stored phrase counts even with no wallet built from it yet (a locked
        // keychain at resume, say) — the setMnemonic below would overwrite it
        // irrecoverably.
        if (wallet || building) {
          throw new Error('a wallet already exists on this device — sign out first')
        }
        if (await localStorage.getMnemonic()) {
          throw new Error('a recovery phrase is already stored on this device — sign out first')
        }

        const { mnemonic } = generateMnemonicWallet()
        building = true
        publish()
        try {
          wallet = await restoreDesktopWallet(mnemonic, {
            databaseDir,
            chain: await currentNetwork(),
            adminOriginator: ADMIN_ORIGINATOR
          })
          // Same order as restore: never store a phrase the build has not proven out.
          const stored = await localStorage.setMnemonic(mnemonic)
          if (!stored) {
            console.warn('[wallet] created, but the phrase could not be stored: no OS keychain')
          }
          return { ok: true, mnemonic, storedSecurely: stored }
        } finally {
          building = false
          publish()
        }
      },

      'wallet.backup': async () => {
        // No biometric gate on desktop (vault/TouchID is out of scope this pass);
        // the OS keychain is the whole of the protection here. The chrome renders
        // the phrase once and must never persist it.
        const mnemonic = await localStorage.getMnemonic()
        if (!mnemonic) throw new Error('no recovery phrase is stored on this device')
        return { mnemonic }
      },

      'wallet.logout': async () => {
        // Keys and managers go; the ledger databases stay. Transaction history is
        // not a secret, and a re-restore onto this device should find it waiting.
        wallet = null
        await localStorage.deleteMnemonic()
        await localStorage.deleteSnap()
        await localStorage.deleteRecoveredKey()
        await localStorage.deletePassword()
        publish()
        return { ok: true }
      },

      'settings.get': async () => {
        // encryptionStatus is the honest answer to "can this machine keep a
        // secret"; the chrome owns the warning copy. No messageBoxUrl on desktop:
        // nothing here reads one, and reporting a URL would imply the pay rails
        // exist.
        const status = await localStorage.encryptionStatus()
        return {
          network: await currentNetwork(),
          networks: ['main', 'test'],
          secure: {
            storedSecurely: status.available,
            method: status.available ? 'keychain' : 'none'
          }
        }
      },

      'settings.setNetwork': async (params) => {
        const network = params?.network
        if (network !== 'main' && network !== 'test') {
          throw new Error(`unknown network "${network}" — offered chains are 'main' and 'test'`)
        }
        if (building) throw new Error('the wallet is still building; try again shortly')

        // Persist first: even if the rebuild below fails, the next launch should
        // come up on the chain the user chose rather than silently reverting.
        await localStorage.setItem(NETWORK_KEY, network)

        const phrase = await localStorage.getMnemonic()
        if (phrase) {
          // Teardown + rebuild, not mutation: the chain decides which database and
          // which services the whole stack points at. Same class of work as
          // restore, and the same phrase finds its per-chain database by name.
          wallet = null
          building = true
          publish()
          try {
            wallet = await restoreDesktopWallet(phrase, {
              databaseDir,
              chain: network,
              adminOriginator: ADMIN_ORIGINATOR
            })
          } finally {
            building = false
            publish()
          }
        }
        return { ok: true }
      }
    },

    /**
     * Resume from a stored phrase, if there is one.
     *
     * Awaited by nothing: a cold start should show the chrome immediately and let
     * the wallet arrive, which is what the wallet.state event is for.
     */
    async resume() {
      try {
        const phrase = await localStorage.getMnemonic()
        if (!phrase) return
        building = true
        publish()
        wallet = await restoreDesktopWallet(phrase, {
          databaseDir,
          chain: await currentNetwork(),
          adminOriginator: ADMIN_ORIGINATOR
        })
      } catch (err) {
        console.warn('[wallet] resume failed:', err?.message)
      } finally {
        building = false
        publish()
      }
    }
  }
}
