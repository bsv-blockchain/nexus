import { KeyDeriver, PrivateKey } from '@bsv/sdk'
import {
  Monitor,
  PrivilegedKeyManager,
  Services,
  SimpleWalletManager,
  StorageProvider,
  Wallet,
  WalletPermissionsManager,
  WalletSigner,
  WalletStorageManager
} from '@bsv/wallet-toolbox-mobile'
import { StorageExpoSQLite } from '@nexus/wallet-storage/src/StorageExpoSQLite'
import { openNodeDriver } from '@nexus/wallet-storage/src/drivers/nodeDriver'
import { processOfflineActions } from '@nexus/wallet-storage/src/methods/processOfflineActions'
import { recoverMnemonicWallet } from '@nexus/wallet-core/src/utils/mnemonicWallet'
import { TaskSendOffline } from '@nexus/wallet-core/src/utils/monitor/TaskSendOffline'
import { configureNewHeaderPolling } from '@nexus/wallet-core/src/utils/walletMonitor'

/**
 * The wallet, assembled in the Electron MAIN process.
 *
 * ── WHY MAIN, AND NOT THE RENDERER ──
 *
 * bsv-desktop, the shipping reference, builds its wallet in the renderer and pushes
 * only storage across IPC. That is why it needs a 467-line storage proxy with a
 * hand-maintained 76-method allow-list on the other side — and why its own design
 * notes list "defending a compromised renderer that can call post-unlock IPC" as a
 * non-goal: `vault.ts` hands primaryKeyHex and mnemonic12 to the renderer, which
 * caches them in plaintext.
 *
 * Nexus cannot accept that. Its renderer is a BROWSER CHROME that also hosts
 * arbitrary third-party pages in sibling WebContentsViews. Key material must never
 * be in that process. So the whole manager stack lives here, the chrome asks for
 * answers over the existing `wallet.*` bridge methods, and no storage wire exists
 * at all — which also means the proxy and its allow-list are work nobody has to do.
 *
 * ── WHAT THIS IS AND IS NOT ──
 *
 * This is deliberately the same SEQUENCE as apps/mobile's WalletContext buildWallet,
 * minus its React state, permission queues and UI callbacks. It is not a port of
 * that component and must not become one: the mobile version holds real funds, and
 * the shared thing between the two shells is the sequence, not the component.
 *
 * Kept identical to mobile on purpose, because these decide what keys and rows
 * exist: the KeyDeriver from the primary key, the `sat/kb` fee model value, the
 * database naming, and `migrate('bsv-wallet', identityKey)`.
 */

export interface DesktopWalletDeps {
  /** Absolute directory for wallet databases. The shell supplies it (userData). */
  databaseDir: string
  /** 'main' | 'test'. Toolbox chain ids; Nexus's 'teratest' is not offered here yet. */
  chain: 'main' | 'test'
  adminOriginator: string
  /**
   * The Monitor changed a transaction, or the offline queue moved one. Nothing in
   * main re-reads on its own, so this is how the chrome learns a 'pending' row has
   * become 'confirmed' without the user navigating away and back.
   */
  onTransactionStatusChanged?: () => void
  /**
   * A page wants to spend, and the permissions manager wants an answer.
   *
   * Supplied by host.mjs, which owns the threshold, the queue and the push to the
   * chrome. Bound below rather than left unbound: the manager BLOCKS the page's
   * createAction until this is granted or denied, so leaving it unbound is not a
   * safe default — it is a payment that never resolves.
   */
  onSpendingAuthorizationRequested?: (request: {
    requestID: string
    originator: string
    reason?: string
    renewal?: boolean
    spending: { satoshis: number; lineItems?: unknown[] }
  }) => void
}

export interface DesktopWallet {
  manager: WalletPermissionsManager
  storage: StorageExpoSQLite
  identityKey: string
  userId: number | null
  /**
   * Built, NOT started — see the factory's note. Null when construction failed,
   * which is survivable: the wallet still spends, it just stops learning about
   * proofs and releasing held payments by itself.
   */
  monitor: Monitor | null
}

/**
 * The background Monitor, assembled but left switched off.
 *
 * Same task set and the same registration ORDER as mobile's WalletContext, because
 * the order is what keeps a queued parent ahead of its child (see below). What it
 * does not have is mobile's SSE.
 *
 * ── NO SSE HERE, DELIBERATELY ──
 *
 * Mobile hands the Monitor an EventSourceClass (react-native-sse) and gets ARC
 * status pushes. Electron's main process has no EventSource at all: Electron 43
 * runs Node 24, where the global is still behind --experimental-eventsource, and
 * main's Node flags are not ours to set. Even with the global, ArcSSEClient
 * constructs `new ESClass(url, { headers, pollingInterval })` while the WHATWG
 * EventSource accepts only `{ withCredentials }` — the Last-Event-ID and
 * Authorization headers would be silently dropped, so catch-up and the ARC api key
 * would both stop working while appearing to be configured.
 *
 * So no EventSourceClass, no callbackToken and no 'sse_last_event_id' cursor.
 * TaskArcadeSSE stays in the default set and switches itself off at setup — it
 * logs 'no callbackToken configured; SSE disabled' to monitor_events and never
 * opens a connection — and the polling tasks do the whole job: TaskNewHeader →
 * TaskCheckForProofs for proofs, TaskSendWaiting for broadcast. The cost is
 * latency, not correctness: a status lands on the next poll instead of the moment
 * ARC sees it. The only fix is a new dependency, and this shell does not take one
 * for that.
 */
function buildMonitor(args: {
  chain: 'main' | 'test'
  storageManager: WalletStorageManager
  services: Services
  storage: StorageExpoSQLite
  onTransactionStatusChanged?: () => void
}): Monitor | null {
  const { chain, storageManager, services, storage, onTransactionStatusChanged } = args
  try {
    const options = Monitor.createDefaultWalletMonitorOptions(chain, storageManager, services)
    options.onTransactionStatusChanged = async () => {
      onTransactionStatusChanged?.()
    }
    const monitor = new Monitor(options)

    // Registered BEFORE the defaults, and the order is the point. Monitor.runOnce
    // runs due tasks in registration order, awaiting each, so with the drain last
    // TaskSendWaiting could post a child of a still-queued transaction in the same
    // pass — and a child broadcast without its parent is refused as an orphan,
    // which is exactly what the release ordering exists to prevent.
    monitor.addTask(
      new TaskSendOffline(monitor, async () => {
        const r = await processOfflineActions({ storage })
        // `TaskSendOffline.lastStall` still holds the PREVIOUS run's value right
        // here — runTask assigns the new one only after this lambda returns — so
        // comparing against it is what makes a stall appearing, changing or
        // clearing reach the chrome. Without it a pure stall (nothing sent,
        // nothing rejected, a queued row whose request vanished) would never
        // nudge anything and the queue line would stay invisible.
        if (r.sent > 0 || r.rejected > 0 || r.stalledOn !== TaskSendOffline.lastStall) {
          onTransactionStatusChanged?.()
        }
        return r
      })
    )
    // Rows may be sitting in offline_actions from a previous session. Pessimistic:
    // one idle drain clears the flag the first time this machine is online.
    TaskSendOffline.noteEnqueued()

    monitor.addDefaultTasks()

    // TaskNewHeader declares a one-minute interval but its trigger currently fires
    // on every five-second cycle, which is a Chaintracks request every five
    // seconds. The fix is shared with mobile rather than copied.
    const newHeader = monitor._tasks.find((t) => t.name === 'NewHeader') as any
    if (newHeader) {
      configureNewHeaderPolling(newHeader, {
        onFailure: (error, retryAt) => {
          const message = error instanceof Error ? error.message : String(error)
          console.warn(`[wallet] chaintracks header poll failed; retrying at ${new Date(retryAt).toISOString()}: ${message}`)
        }
      })
    }

    // TaskReviewProvenTxs crawls every block height looking for merkle-root
    // mismatches. Mobile drops it as redundant; here the same call is made with a
    // narrower fallback, which is worth being explicit about: with no SSE and no
    // chaintracksWithEvents subscription, a reorg is caught by
    // ChaintracksChainTracker's on-demand lookups during beef.verify() rather than
    // by a live feed. Revisit if desktop ever gains an events subscription.
    monitor.removeTask('ReviewProvenTxs')

    return monitor
  } catch (err: any) {
    // A wallet without a Monitor is degraded, not broken — and the alternative is
    // refusing to build a wallet that can still spend.
    console.warn('[wallet] no background monitor:', err?.message)
    return null
  }
}

/**
 * Build the stack from a primary key.
 *
 * The Monitor is BUILT HERE AND NOT STARTED, which is the one rule this factory
 * keeps: starting timers from a factory hands the caller a wallet it cannot switch
 * off, and this shell has to switch it off three times over — at logout, when
 * settings.setNetwork rebuilds onto the other chain, and at quit. So it comes back
 * on the result and src/wallet/host.mjs owns start and stop.
 *
 * Still absent compared with mobile: the address-rail background sweeper
 * (wallet-core's utils/pay/sweeper). The rails themselves now answer from
 * src/wallet/payHost.mjs and they keep the watchlist up to date, so what is missing
 * is the periodic pass over it — until that lands, an address is swept when someone
 * asks (pay.address.sweep), not while nobody is looking.
 */
export async function buildDesktopWallet(
  primaryKey: number[],
  privilegedKeyManager: PrivilegedKeyManager,
  deps: DesktopWalletDeps
): Promise<DesktopWallet> {
  const {
    databaseDir,
    chain,
    adminOriginator,
    onTransactionStatusChanged,
    onSpendingAuthorizationRequested
  } = deps

  const keyDeriver = new KeyDeriver(new PrivateKey(primaryKey))
  const identityKey = keyDeriver.identityKey
  const storageManager = new WalletStorageManager(identityKey)
  const signer = new WalletSigner(chain, keyDeriver, storageManager)
  const services = new Services(chain)

  const wallet = new Wallet(signer, services, undefined, privilegedKeyManager)

  // Same file-naming rule as mobile — last 8 of the identity key plus the chain —
  // so a database is recognisable across shells even though nothing moves one yet.
  const keySuffix = identityKey.slice(-8)
  const databaseName = `wallet-${keySuffix}-${chain}net.db`

  const storage = new StorageExpoSQLite({
    ...StorageProvider.createStorageBaseOptions(chain),
    feeModel: { model: 'sat/kb', value: 100 },
    identityKey,
    databaseName,
    // The one platform difference in this whole function. node:sqlite rather than
    // expo-sqlite; see packages/wallet-storage/src/drivers/nodeDriver.ts for why the
    // transaction model differs and what that costs.
    openDriver: (name: string) => openNodeDriver(`${databaseDir}/${name}`)
  })
  storage.setServices(services)
  await storage.migrate('bsv-wallet', identityKey)
  await storageManager.addWalletStorageProvider(storage as any)

  let userId: number | null = null
  try {
    const auth = await storageManager.getAuth()
    userId = auth.userId ?? null
  } catch {
    // Scoping is a filter, not a gate — the same tolerance mobile has. With no id
    // the queue reads fall back to unscoped rather than failing.
  }

  const manager = new WalletPermissionsManager(wallet, adminOriginator, {
    differentiatePrivilegedOperations: true,
    seekBasketInsertionPermissions: false,
    seekBasketListingPermissions: false,
    // These four are the ones mobile also auto-grants; the rest keep their
    // defaults and will refuse rather than hang. Spending is NOT among them —
    // see the binding below.
    seekPermissionsForPublicKeyRevelation: false,
    seekPermissionsForIdentityKeyRevelation: false,
    seekPermissionsForKeyLinkageRevelation: false,
    seekPermissionsForIdentityResolution: false
  })

  /*
   * Spending asks a human, on this shell too.
   *
   * This used to be unbound, with a comment saying main had no prompt surface —
   * true when it was written, and no longer: the chrome renders the sheet and
   * answers over permission.resolve. Leaving it unbound was never neutral. An
   * unbound onSpendingAuthorizationRequested means the manager raises a request
   * nothing consumes and holds the page's createAction open forever, so the
   * difference between the two shells was not "desktop asks less" but "desktop
   * hangs instead of asking".
   */
  if (onSpendingAuthorizationRequested) {
    manager.bindCallback('onSpendingAuthorizationRequested', onSpendingAuthorizationRequested as any)
  }

  const monitor = buildMonitor({ chain, storageManager, services, storage, onTransactionStatusChanged })

  return { manager, storage, identityKey, userId, monitor }
}

/**
 * Restore from a BIP-39 phrase and build.
 *
 * `recoverMnemonicWallet` is the shared implementation both shells use, so the same
 * phrase derives the same identity key on desktop as on mobile — which is the whole
 * point of putting it in wallet-core.
 */
export async function restoreDesktopWallet(
  mnemonic: string,
  deps: DesktopWalletDeps
): Promise<DesktopWallet & { manager: WalletPermissionsManager }> {
  const { rootKey, primaryKey } = recoverMnemonicWallet(mnemonic)
  const privileged = new PrivilegedKeyManager(async () => rootKey)
  return await buildDesktopWallet(primaryKey, privileged, deps)
}

/**
 * Restore from a bare primary key and build — the LEGACY backup-share path.
 *
 * Pages printed by BSV Browser / metanet-mobile Shamir-split `m/0'/0'` itself, so what
 * their shares reconstruct is the primary key with nothing above it: no entropy, no
 * phrase, and no way to ever produce either. BRC-157 exists to end that, and
 * `wallet.restoreShares` without `legacy` goes through `restoreDesktopWallet` with a
 * recovered phrase instead.
 *
 * This is here so a user holding one of those pages is not locked out. Note what it
 * gives the privileged key manager: the primary key itself, because there is no master
 * above it to hand over. That is a real difference from the phrase path and is the
 * cost of the old scheme, not a choice being made here.
 */
export async function restoreDesktopWalletFromKey(
  key: PrivateKey,
  deps: DesktopWalletDeps
): Promise<DesktopWallet & { manager: WalletPermissionsManager }> {
  const privileged = new PrivilegedKeyManager(async () => key)
  return await buildDesktopWallet(key.toArray('be', 32), privileged, deps)
}

/**
 * A SimpleWalletManager over the same build, for the snapshot path.
 *
 * Exported but not yet used by the shell: it is what will let desktop resume from a
 * stored snapshot instead of asking for the phrase every launch, and it is here so
 * the factory's shape does not have to change when that lands.
 *
 * Note what this path DROPS: the built Monitor goes out of scope with the rest of
 * the result. Nothing has started it, so it is inert rather than leaked — but
 * whoever wires this path must take it and stop it the way host.mjs does, or the
 * snapshot route quietly loses proofs and the offline queue.
 */
export function simpleManagerFor(
  deps: DesktopWalletDeps,
  snapshot?: number[]
): SimpleWalletManager {
  return new SimpleWalletManager(
    deps.adminOriginator,
    async (primaryKey, privilegedKeyManager) => {
      const built = await buildDesktopWallet(primaryKey, privilegedKeyManager, deps)
      return built.manager as any
    },
    snapshot
  )
}
