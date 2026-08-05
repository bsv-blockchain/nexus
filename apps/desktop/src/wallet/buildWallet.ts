import { KeyDeriver, PrivateKey } from '@bsv/sdk'
import {
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
import { recoverMnemonicWallet } from '@nexus/wallet-core/src/utils/mnemonicWallet'

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
}

export interface DesktopWallet {
  manager: WalletPermissionsManager
  storage: StorageExpoSQLite
  identityKey: string
  userId: number | null
}

/**
 * Build the stack from a primary key.
 *
 * Note what is NOT here compared with mobile: no Monitor, no background sweeper, no
 * offline queue processing. Those are timers that own their own lifecycle, and
 * starting them from a factory would give the caller no way to stop them. The shell
 * owns them, and until it does they are simply absent — which is a smaller lie than
 * a wallet that quietly runs background work nobody can cancel.
 */
export async function buildDesktopWallet(
  primaryKey: number[],
  privilegedKeyManager: PrivilegedKeyManager,
  deps: DesktopWalletDeps
): Promise<DesktopWallet> {
  const { databaseDir, chain, adminOriginator } = deps

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
    // No prompt surface exists in main yet, so nothing may DEPEND on a human
    // answering. These four are the ones mobile also auto-grants; the rest keep
    // their defaults and will refuse rather than hang.
    seekPermissionsForPublicKeyRevelation: false,
    seekPermissionsForIdentityKeyRevelation: false,
    seekPermissionsForKeyLinkageRevelation: false,
    seekPermissionsForIdentityResolution: false
  })

  return { manager, storage, identityKey, userId }
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
 * A SimpleWalletManager over the same build, for the snapshot path.
 *
 * Exported but not yet used by the shell: it is what will let desktop resume from a
 * stored snapshot instead of asking for the phrase every launch, and it is here so
 * the factory's shape does not have to change when that lands.
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
