import type { Chain as WalletChain } from '@bsv/wallet-toolbox-mobile/out/src/sdk'

/**
 * Chain identity, extracted from BSV Browser's app-level context/config.tsx because both
 * packages/wallet-storage and packages/wallet-core need it and neither may import from the
 * app.
 *
 * Defaults reflect docs/DECISIONS.md §3: storage is LOCAL on every platform, and there is
 * no WAB. Those two constants exist so that ported code reading them keeps working, not
 * because a remote option is coming back.
 */
export type AppChain = 'main' | 'test' | 'teratest'

/**
 * wallet-toolbox names the teratest network 'ttn'; the app calls it 'teratest'. Getting
 * this mapping wrong points the wallet at the wrong chain, which is why it lives in exactly
 * one place.
 */
export function toWalletChain(chain: AppChain): WalletChain {
  return chain === 'teratest' ? 'ttn' : chain
}

export const DEFAULT_CHAIN: AppChain = 'main'
export const ADMIN_ORIGINATOR = 'admin.com'

/** Local database, never a remote storage service — see DECISIONS.md §3. */
export const DEFAULT_STORAGE_URL = 'local'
/** No wallet authentication backend. */
export const DEFAULT_WAB_URL = 'noWAB'
export const DEFAULT_MESSAGEBOX_URL = 'https://message-box-us-1.bsvb.tech'
