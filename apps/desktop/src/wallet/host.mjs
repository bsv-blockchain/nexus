import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrivateKey } from '@bsv/sdk'
import {
  generateMnemonicWallet,
  parseMnemonic,
  recoverMnemonicWallet
} from '@nexus/wallet-core/src/utils/mnemonicWallet'
import { isWordCount } from '@nexus/wallet-core/src/utils/entropy'
import {
  DEFAULT_THRESHOLD,
  DEFAULT_TOTAL_SHARES,
  generateEntropyShares,
  generatePrintHTML,
  parseShareSet,
  recoverKeyFromShares,
  recoverMnemonicFromShares
} from '@nexus/wallet-core/src/utils/backupShares'
import { TaskSendOffline } from '@nexus/wallet-core/src/utils/monitor/TaskSendOffline'
import { getOnline, subscribeOnline } from '@nexus/wallet-core/src/utils/net/online'
import { DEFAULT_MESSAGE_BOX_URL, MESSAGE_BOX_URL_KEY } from '@nexus/wallet-core/src/utils/pay/rails/handle'
import {
  AUTO_APPROVE_COOLDOWN_MS,
  AUTO_APPROVE_STORAGE_KEY,
  DEFAULT_AUTO_APPROVE_THRESHOLD
} from '@nexus/wallet-core/src/spending'
import { restoreDesktopWallet, restoreDesktopWalletFromKey } from './buildWallet.ts'
import { createExchangeRate } from './exchangeRate.mjs'
import { createPayHost } from './payHost.mjs'
import { createSweepLoop } from './sweepLoop.mjs'
import { printHtmlDocument } from './printDocument.mjs'
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
// A sync burst changes a dozen rows inside a second and every push costs the chrome
// a full refetch, so transaction-change pushes are collected into one.
const TX_NOTIFY_COALESCE_MS = 500

/** A base64 reference masquerading as a description; see the mobile bridge. */
const LOOKS_LIKE_A_REFERENCE = /^[A-Za-z0-9+/]{16,}={0,2}$/

function humanMemo(description) {
  const text = (description ?? '').trim()
  return LOOKS_LIKE_A_REFERENCE.test(text) ? '' : text
}

/**
 * The phrase gate, in one place for both routes in.
 *
 * This used to be `words.length !== 12 && words.length !== 24` inline, which rejected
 * the 15-, 18- and 21-word phrases BIP-39 defines and BRC-157 requires — someone
 * holding a 15-word phrase from another wallet could not get in at all. It now defers
 * to wallet-core's `parseMnemonic`, which is the SAME call the build path makes, so a
 * phrase that passes here cannot fail there.
 *
 * @returns the normalised phrase
 */
function requirePhrase(raw) {
  const phrase = (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  const parsed = parseMnemonic(phrase)
  if (!parsed.valid) throw new Error(parsed.error)
  return phrase
}

/** A printed word count, or undefined so the trim falls back to BRC-157's heuristic. */
function optionalWordCount(value) {
  if (value === undefined || value === null || value === '') return undefined
  const count = Number(value)
  if (!isWordCount(count)) {
    throw new Error(`a recovery phrase is 12, 15, 18, 21 or 24 words; got ${value}`)
  }
  return count
}

/** Shares arrive as an array of strings from the chrome, and nothing else will do. */
function requireShares(value) {
  if (!Array.isArray(value)) throw new Error('backup shares are a list of strings')
  const shares = value.map((s) => String(s ?? '').trim()).filter(Boolean)
  const { error } = parseShareSet(shares)
  if (error) throw new Error(error)
  return shares
}

export function createWalletHost({ userDataDir, onStateChange, onPermissionRequest, getParentWindow }) {
  // One directory for wallet databases, under userData so the OS backs it up and
  // uninstall removes it. bsv-desktop puts its databases in ~/.bsv-desktop, outside
  // every OS convention, and has accumulated dozens of stale files plus plaintext
  // mnemonics there — not a pattern to copy.
  const databaseDir = join(userDataDir, 'wallets')
  mkdirSync(databaseDir, { recursive: true })

  installDesktopOnlineProbe()
  const localStorage = createLocalStorage()
  const exchangeRate = createExchangeRate(localStorage)

  /**
   * Feed the offline drain's online gate.
   *
   * TaskSendOffline.trigger refuses to run at all while `onlineNow` is false, and
   * nothing else in main sets it. Both halves are needed: the desktop probe reports
   * CHANGES only — Electron has no connectivity event, so platform/online.mjs polls
   * and compares — so without the initial read a machine that has been online all
   * along would never arm the drain, and a held payment would wait for the network
   * to flap before going out.
   */
  const stopOnlineFeed = subscribeOnline((online) => TaskSendOffline.noteConnectivity(online))
  void getOnline().then((online) => TaskSendOffline.noteConnectivity(online))

  /** @type {{ manager: any, storage: any, identityKey: string, userId: number|null, monitor: any } | null} */
  let wallet = null
  let building = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let notifyTimer = null

  const publish = () => onStateChange?.({ ready: wallet !== null, building })

  /**
   * Spend requests waiting on a human, oldest first.
   *
   * A queue rather than a single slot because two pages — or one page twice — can
   * ask while the sheet is up, and the manager blocks each of them independently.
   * Only the head is ever shown; answering it admits the next.
   */
  const spendQueue = []
  /** Guards the burst case: one approval must not silently cover a run of them. */
  let lastAutoApproveAt = 0

  const pushHead = () => onPermissionRequest?.(spendQueue[0] ?? null)

  /**
   * The stored spend limit, or the compiled default.
   *
   * One reader for both callers — the gate below and settings.get — so the number
   * the settings screen shows is by construction the number the next payment is
   * measured against, rather than a second lookup that could disagree with it.
   */
  const currentAutoApprove = async () => {
    try {
      const stored = await localStorage.getItem(AUTO_APPROVE_STORAGE_KEY)
      return stored === null ? DEFAULT_AUTO_APPROVE_THRESHOLD : Number(stored) || 0
    } catch {
      // Unreadable settings must never become "approve everything".
      return DEFAULT_AUTO_APPROVE_THRESHOLD
    }
  }

  /**
   * Decide whether a spend needs a person, and get it in front of one if it does.
   *
   * The threshold is re-read from storage on EVERY request rather than cached at
   * build time: a limit changed in Settings has to take effect on the next spend,
   * not on the next launch. Mobile learned this the same way — a mount-time read
   * left the old value live and made auto-approve feel stuck on.
   */
  const onSpendingAuthorizationRequested = (request) => {
    const requestID = request?.requestID
    const spending = request?.spending
    if (!requestID || !spending) return
    const satoshis = Number(spending.satoshis ?? 0)

    void (async () => {
      // Read on EVERY request, not cached at build: a limit changed in Settings has
      // to apply to the next spend, not the next launch. Mobile's comment records
      // the same lesson — a mount-time read left the old value live and made
      // auto-approve feel stuck on.
      const threshold = await currentAutoApprove()

      const now = Date.now()
      if (threshold > 0 && satoshis <= threshold && now - lastAutoApproveAt >= AUTO_APPROVE_COOLDOWN_MS) {
        lastAutoApproveAt = now
        wallet?.manager?.grantPermission({ requestID, ephemeral: true, amount: satoshis })
        return
      }

      spendQueue.push({
        requestID: String(requestID),
        originator: String(request.originator ?? ''),
        description: request.reason,
        authorizationAmount: satoshis,
        renewal: Boolean(request.renewal),
        lineItems: Array.isArray(spending.lineItems) ? spending.lineItems : []
      })
      // Only the head is displayed, so a second request while one is up changes
      // nothing on screen — pushing unconditionally would replace the sheet the
      // user is reading with a different payment.
      if (spendQueue.length === 1) pushHead()
    })()
  }

  /** Answer the head and admit the next. Nothing else may resolve a request. */
  const resolveSpend = async ({ requestID, approved, amount, ephemeral }) => {
    const head = spendQueue[0]
    // A stale reply — the sheet unmounting after the queue moved on — must never
    // grant a spend the user was not shown.
    if (!head || head.requestID !== requestID) return { ok: false, stale: true }
    const manager = wallet?.manager
    if (!manager) throw new Error('wallet is not ready')

    if (approved) {
      manager.grantPermission({
        requestID,
        ephemeral: ephemeral !== false,
        ...(typeof amount === 'number' ? { amount } : {})
      })
    } else {
      try {
        await manager.denyPermission(requestID)
      } catch {
        // Denial is a user choice; the manager rejecting the underlying call is
        // the consequence, not a fault here.
      }
    }
    spendQueue.shift()
    pushHead()
    return { ok: true }
  }

  /**
   * Tell the chrome a transaction moved.
   *
   * The protocol has no transaction-changed event, and wallet.state is the push the
   * chrome already re-reads accounts and transactions on (apps/ui/lib/wallet-data.ts
   * useSource), so the Monitor's status changes ride that one. Trailing rather than
   * immediate, for the reason on TX_NOTIFY_COALESCE_MS.
   */
  const notifyTxChanged = () => {
    if (notifyTimer) return
    notifyTimer = setTimeout(() => {
      notifyTimer = null
      publish()
    }, TX_NOTIFY_COALESCE_MS)
  }

  /**
   * The address sweeper.
   *
   * Constructed once and re-pointed at each wallet, rather than rebuilt per
   * build: the getters and the callback are arrows, so this can be declared
   * before `currentNetwork` exists and still read the live value at tick time.
   */
  const sweepLoop = createSweepLoop({
    getWallet: () => wallet,
    getNetwork: () => currentNetwork(),
    adminOriginator: ADMIN_ORIGINATOR,
    onSwept: () => notifyTxChanged()
  })

  /**
   * Stop the background work the current wallet owns.
   *
   * Called before every teardown — logout, the setNetwork rebuild, quit — because
   * the Monitor holds the storage manager: one left running after the reference is
   * dropped keeps polling a wallet the user has signed out of, and after a network
   * switch two of them would poll two chains at once.
   */
  const stopMonitor = () => {
    try {
      wallet?.monitor?.stopTasks()
    } catch (err) {
      console.warn('[wallet] monitor did not stop cleanly:', err?.message)
    }
    /*
     * The address sweeper is the same kind of thing and has the same lifetime:
     * a loop holding this wallet's manager and storage. Left running past the
     * swap it would poll WhatsOnChain for a signed-out wallet, and after a
     * network switch it would sweep mainnet addresses into a testnet wallet.
     */
    sweepLoop.stop()
    /*
     * Drop any spend request the outgoing wallet raised.
     *
     * Its permissions manager is going away, so nothing could answer these even if
     * the user tried — and leaving them queued would put a sheet in front of the
     * NEXT wallet asking it to approve a payment it knows nothing about. The pages
     * that raised them lose their calls either way; that is what signing out or
     * switching chains mid-payment means.
     */
    if (spendQueue.length > 0) {
      spendQueue.length = 0
      pushHead()
    }
  }

  /**
   * Set a freshly built wallet's Monitor running, on the next turn of the loop.
   *
   * Deferred for the reason mobile defers it past interactions: startTasks opens
   * header polling and proof crawls, and the build that just finished is the most
   * contended moment of a launch. The identity check is what makes deferring safe —
   * a logout or a network switch landing between the build and this callback would
   * otherwise start a background loop against a wallet nobody owns any more.
   */
  /**
   * Set the address sweeper running for a freshly built wallet.
   *
   * Beside startMonitorSoon rather than inside it because the two answer to
   * different things — the Monitor to the chain, this to WhatsOnChain — but they
   * are started and stopped at exactly the same moments, which is why every
   * caller of one calls the other.
   */
  const startSweeperSoon = (built) => {
    sweepLoop.start(built)
  }

  const startMonitorSoon = (built) => {
    if (!built.monitor) return
    setTimeout(() => {
      if (wallet !== built) return
      // startTasks only settles when stopTasks is called, so this catch is for a
      // failed loop, not for completion.
      built.monitor.startTasks().catch((err) => console.warn('[wallet] monitor stopped:', err?.message))
    }, 0)
  }

  /**
   * Build the wallet from a phrase. Every path that produces one goes through here,
   * so the Monitor is created and started exactly once per build and the deps object
   * has a single definition rather than a copy per caller.
   */
  const buildDeps = (chain) => ({
    databaseDir,
    chain,
    adminOriginator: ADMIN_ORIGINATOR,
    onTransactionStatusChanged: notifyTxChanged,
    onSpendingAuthorizationRequested
  })

  const buildFrom = async (phrase, chain) => {
    const built = await restoreDesktopWallet(phrase, buildDeps(chain))
    startMonitorSoon(built)
    startSweeperSoon(built)
    return built
  }

  /**
   * The LEGACY share route: a bare primary key, with no phrase above it.
   *
   * Separate from buildFrom rather than a branch inside it, so that no code path can
   * reach it without having been told, explicitly, that these shares came from a
   * pre-BRC-157 page. See restoreDesktopWalletFromKey.
   */
  const buildFromKey = async (key, chain) => {
    const built = await restoreDesktopWalletFromKey(key, buildDeps(chain))
    startMonitorSoon(built)
    startSweeperSoon(built)
    return built
  }

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

  /**
   * How this device would rebuild its wallet, or null if it holds no keys.
   *
   * One reader for the two callers that need it — `resume()` at launch and
   * `settings.setNetwork`'s rebuild — because they must agree about which secret is
   * authoritative. The phrase wins when both exist: it is the BRC-157 root, and the
   * `recoveredKey` beside it could only be a legacy artifact of the same wallet or a
   * leftover an incomplete sign-out failed to erase. Rebuilding from the phrase is
   * correct in both readings.
   *
   * @returns {Promise<((chain: 'main'|'test') => Promise<any>) | null>}
   */
  const keyedRebuild = async () => {
    const phrase = await localStorage.getMnemonic()
    if (phrase) return (chain) => buildFrom(phrase, chain)

    const wif = await localStorage.getRecoveredKey()
    if (!wif) return null
    // Parsed here rather than inside the rebuild, so an unusable stored key fails
    // once, loudly, instead of on every network switch.
    const key = PrivateKey.fromWif(wif)
    return (chain) => buildFromKey(key, chain)
  }

  const require_ = () => {
    if (!wallet) throw new Error('wallet is not ready')
    return wallet
  }

  /** Admin-originator call into our own wallet, for what the chrome asks on its own behalf. */
  const asAdmin = (fn) => fn(require_().manager, ADMIN_ORIGINATOR)

  // The pay.* and tx.* surfaces read through the same wallet. Getters, not
  // snapshots: restore, logout and setNetwork all swap `wallet` (and the chain) at
  // runtime. The key-value store is shared rather than re-created, so the message
  // box URL the pay rails read is the same one this host's settings write.
  const payHost = createPayHost({
    getWallet: () => wallet,
    getNetwork: currentNetwork,
    adminOriginator: ADMIN_ORIGINATOR,
    localStorage
  })

  return {
    /** For the shell: whether a wallet exists, so it can decide what to show. */
    get isReady() {
      return wallet !== null
    },

    /** pay.* and tx.* as a separate table, so main.mjs wires (and a reader audits) it as a unit. */
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
            // WhatsOnChain, cached, timeout-bounded, and never fabricated: zero
            // means no source has answered yet, and the chrome renders an em dash
            // with "Exchange rate unavailable" rather than $0.00.
            fiatRate: (await exchangeRate.usdPerBsv()) ?? 0,
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
        const phrase = requirePhrase(params?.mnemonic)
        if (wallet) return { ok: true }

        building = true
        publish()
        try {
          wallet = await buildFrom(phrase, await currentNetwork())
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

      /**
       * The other way in: BRC-140 backup shares.
       *
       * Under BRC-157 the shares reconstruct the wallet's ENTROPY, so this path ends
       * with the RECOVERY PHRASE recovered and stored — the wallet that comes out is
       * indistinguishable from a phrase-restored one, and can be backed up either way
       * again. That is the whole point of the standard, and it is why `mnemonic` comes
       * back on the reply: the user has just proved they hold enough shares, and the
       * words are the thing they did not have a moment ago.
       *
       * `legacy: true` is for pages printed by BSV Browser / metanet-mobile, which
       * split `m/0'/0'` itself. There is no phrase for such a wallet and never will
       * be; the reply says so with `mnemonic: null` rather than pretending.
       *
       * Refused while a wallet or a stored secret exists, exactly as wallet.create is
       * and for the same reason: restoring over live keys is a wipe, and a wipe must go
       * through the explicit sign-out with its warning.
       */
      'wallet.restoreShares': async (params) => {
        const shares = requireShares(params?.shares)
        const wordCount = optionalWordCount(params?.wordCount)
        const legacy = params?.legacy === true

        if (wallet || building) {
          throw new Error('a wallet already exists on this device — sign out first')
        }
        if ((await localStorage.getMnemonic()) || (await localStorage.getRecoveredKey())) {
          throw new Error('keys are already stored on this device — sign out first')
        }

        // Recovered BEFORE the build starts, so a wrong or incomplete share set fails
        // as a share error and not as a mysterious build failure.
        const phrase = legacy ? null : recoverMnemonicFromShares(shares, wordCount)
        const legacyKey = legacy ? recoverKeyFromShares(shares) : null

        building = true
        publish()
        try {
          const chain = await currentNetwork()
          wallet = legacy ? await buildFromKey(legacyKey, chain) : await buildFrom(phrase, chain)

          // Same ordering rule as restore and create: never store a secret the build
          // has not proven usable.
          const stored = legacy
            ? await localStorage.setRecoveredKey(legacyKey.toWif())
            : await localStorage.setMnemonic(phrase)
          if (!stored) {
            console.warn('[wallet] built from shares, but the key could not be stored: no OS keychain')
          }
          return { ok: true, storedSecurely: stored, legacy, mnemonic: phrase }
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
        // A legacy share recovery stores a key and no phrase, and it is just as
        // irrecoverable to write over.
        if (await localStorage.getRecoveredKey()) {
          throw new Error('a recovered key is already stored on this device — sign out first')
        }

        const { mnemonic } = generateMnemonicWallet()
        building = true
        publish()
        try {
          wallet = await buildFrom(mnemonic, await currentNetwork())
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
        if (!mnemonic) {
          // Distinguish the legacy share wallet from an empty device: one of them has
          // no phrase because it never had one, and telling the user to write down
          // words that do not exist is worse than saying why.
          if (await localStorage.getRecoveredKey()) {
            throw new Error(
              'This wallet was recovered from pre-BRC-157 backup shares, which carry no ' +
                'recovery phrase. Its backup is those shares; keep them.'
            )
          }
          throw new Error('no recovery phrase is stored on this device')
        }
        // The word count travels with the words so the reveal screen lays out 24 of
        // them without counting, and so a caller can pass it back to a share recovery.
        return { mnemonic, wordCount: parseMnemonic(mnemonic).wordCount }
      },

      /**
       * Split this wallet's entropy into BRC-140 backup shares and print them.
       *
       * ── WHAT DOES NOT CROSS THE BRIDGE ──
       *
       * Shares. Any `threshold` of them together ARE the wallet, and the chrome is a
       * renderer that also hosts arbitrary third-party pages in sibling
       * WebContentsViews — the same reason the whole manager stack lives in main (see
       * buildWallet.ts). So this method renders the document and hands it to the OS
       * print dialogue itself, and answers with counts.
       *
       * ── WHAT IS SPLIT ──
       *
       * The ENTROPY, per BRC-157 — not `m/0'/0'`, which is what the old dead
       * `generateBackupShares` did and what made shares and phrase recover two
       * different wallets. A recovery from these shares gets the phrase back.
       */
      'backup.shares': async (params) => {
        const threshold = Math.round(Number(params?.threshold ?? DEFAULT_THRESHOLD))
        const totalShares = Math.round(Number(params?.totalShares ?? DEFAULT_TOTAL_SHARES))

        const mnemonic = await localStorage.getMnemonic()
        if (!mnemonic) {
          if (await localStorage.getRecoveredKey()) {
            throw new Error(
              'This wallet was recovered from pre-BRC-157 backup shares and has no entropy ' +
                'to split. Its backup is the shares you already hold.'
            )
          }
          throw new Error('no recovery phrase is stored on this device')
        }

        // Decoding the phrase is what produces the entropy; it also re-validates it,
        // so a stored phrase that has somehow been corrupted fails here rather than
        // printing shares of something that is not this wallet.
        const { entropy, wordCount, identityKey } = recoverMnemonicWallet(mnemonic)

        // Throws with a user-facing reason for the one reachable refusal: a phrase
        // whose entropy is all zeros ("abandon … about") is a perfectly good wallet
        // that cannot be Shamir-split. The chrome shows this text verbatim.
        const shares = generateEntropyShares(entropy, threshold, totalShares)
        const html = await generatePrintHTML(shares, identityKey, { wordCount, threshold })

        const result = await printHtmlDocument(html, {
          parent: getParentWindow?.() ?? undefined,
          title: 'Nexus backup shares'
        })

        return { ok: true, printed: result.printed, threshold, totalShares, wordCount }
      },

      'wallet.logout': async () => {
        // Keys and managers go; the ledger databases stay. Transaction history is
        // not a secret, and a re-restore onto this device should find it waiting.
        // The Monitor goes FIRST — it is the only thing here holding a reference
        // that outlives `wallet = null`.
        stopMonitor()
        wallet = null

        /*
         * Every delete is attempted even if an earlier one fails, then the results
         * are judged together.
         *
         * secureStore swallows its own errors — deliberately, so one failure does
         * not abort the deletes after it — which means the only way to know a
         * secret is actually gone is the boolean it returns. Reporting ok:true
         * regardless is the dangerous default here: "sign out" is what someone
         * presses before handing over a laptop, and a phrase that survived a full
         * disk or a read-only volume while the screen said the keys were erased is
         * exactly the failure that matters.
         */
        const results = await Promise.all([
          localStorage.deleteMnemonic(),
          localStorage.deleteSnap(),
          localStorage.deleteRecoveredKey(),
          localStorage.deletePassword()
        ])
        publish()

        // deleteSnap clears two locations and reports nothing useful, so it is not
        // judged here; the three keychain secrets are.
        const [mnemonicGone, , recoveredGone, passwordGone] = results
        if (mnemonicGone && recoveredGone && passwordGone) return { ok: true }

        throw new Error(
          'Signed out of this session, but the stored keys could not be erased from ' +
            'this device. Do not treat this machine as wiped — check disk space and ' +
            'permissions, then sign out again.'
        )
      },

      'settings.get': async () => {
        // encryptionStatus is the honest answer to "can this machine keep a
        // secret"; the chrome owns the warning copy.
        const status = await localStorage.encryptionStatus()
        // The same source pay.handle.messageBox answers from (payHost.mjs): the
        // saved override or the default. Read directly rather than through the pay
        // host — the settings surface must not couple to the pay surface — which is
        // the same split mobile's useWalletBridge makes.
        const messageBoxUrl = (await localStorage.getItem(MESSAGE_BOX_URL_KEY)) || DEFAULT_MESSAGE_BOX_URL
        return {
          network: await currentNetwork(),
          networks: ['main', 'test'],
          messageBoxUrl,
          /*
           * Null means "this shell cannot answer for it", and the chrome renders no
           * row rather than a control that does nothing.
           *
           * ARC is the one honest absence left: buildWallet.ts constructs
           * `new Services(chain)` with no options, so the override keys wallet-core
           * defines are never read here. Wiring it means moving desktop onto
           * createServices(), which also changes which broadcast providers it uses —
           * a change that deserves its own verification rather than riding along
           * with a settings row.
           */
          arc: null,
          /*
           * Real, now that this shell has a gate for it to raise or lower. The
           * threshold is read on every spending request (see
           * onSpendingAuthorizationRequested above), so what is reported here is
           * what the next payment will actually be measured against.
           */
          autoApprove: {
            satoshis: await currentAutoApprove(),
            defaultSatoshis: DEFAULT_AUTO_APPROVE_THRESHOLD
          },
          secure: {
            storedSecurely: status.available,
            method: status.available ? 'keychain' : 'none'
          }
        }
      },

      /**
       * The spend limit. Answered here because this shell now enforces it.
       *
       * A write and nothing more: onSpendingAuthorizationRequested re-reads the key
       * per request, so the next payment already sees the new number. Zero means
       * ask every time, and there is no upper clamp — inventing a maximum would be
       * this shell deciding how much of their own money a user may be trusted with.
       */
      'settings.setAutoApprove': async (params) => {
        const satoshis = Math.max(0, Math.round(Number(params?.satoshis ?? 0)))
        if (!Number.isFinite(satoshis)) throw new Error('the limit must be a number of satoshis')
        await localStorage.setItem(AUTO_APPROVE_STORAGE_KEY, String(satoshis))
        return { ok: true, satoshis }
      },

      'permission.resolve': async (params) => {
        const requestID = String(params?.requestID ?? '')
        if (!requestID) throw new Error('permission.resolve needs a requestID')
        return resolveSpend({
          requestID,
          approved: Boolean(params?.approved),
          amount: params?.amount,
          ephemeral: params?.ephemeral
        })
      },

      /** For a chrome that reloaded after the push had already gone out. */
      'permission.pending': async () => spendQueue[0] ?? null,

      'settings.setNetwork': async (params) => {
        const network = params?.network
        if (network !== 'main' && network !== 'test') {
          throw new Error(`unknown network "${network}" — offered chains are 'main' and 'test'`)
        }
        if (building) throw new Error('the wallet is still building; try again shortly')

        // Persist first: even if the rebuild below fails, the next launch should
        // come up on the chain the user chose rather than silently reverting.
        await localStorage.setItem(NETWORK_KEY, network)

        // Either stored secret can be the one this device has: a phrase, or a legacy
        // share recovery's primary key. Reading only the phrase would have left a
        // legacy wallet torn down and never rebuilt by a network switch.
        const rebuild = await keyedRebuild()
        if (rebuild) {
          // Teardown + rebuild, not mutation: the chain decides which database and
          // which services the whole stack points at. Same class of work as
          // restore, and the same key finds its per-chain database by name.
          // Stopping the old Monitor is part of the teardown, not housekeeping:
          // skip it and two of them poll two chains against two databases.
          stopMonitor()
          wallet = null
          building = true
          publish()
          try {
            wallet = await rebuild(network)
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
        // Either secret: a recovery phrase, or a legacy share recovery's primary key.
        // Before keyedRebuild existed this read only the phrase, so a wallet restored
        // from pre-BRC-157 shares came up empty on every relaunch and looked like a
        // wallet that had lost its funds.
        const rebuild = await keyedRebuild()
        if (!rebuild) return
        building = true
        publish()
        wallet = await rebuild(await currentNetwork())
      } catch (err) {
        console.warn('[wallet] resume failed:', err?.message)
      } finally {
        building = false
        publish()
      }
    },

    /**
     * Stop everything this host started. main.mjs calls it on 'before-quit'.
     *
     * All three are timers that would otherwise outlive the window: the Monitor's
     * task loop, the connectivity poll behind the offline drain, and a pending
     * refetch push. Stopping the loop does not abort a task already in flight — it
     * stops the NEXT pass from starting while the app is tearing down, which is the
     * part we control.
     */
    shutdown() {
      // Before stopMonitor, so a pass that is mid-await drops its result rather
      // than writing into a wallet the process is tearing down.
      sweepLoop.shuttingDown()
      stopMonitor()
      stopOnlineFeed()
      if (notifyTimer) clearTimeout(notifyTimer)
      notifyTimer = null
    }
  }
}
