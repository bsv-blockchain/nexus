export type AppChain = 'main' | 'test' | 'teratest'

/**
 * The wallet-toolbox `Chain` type used by @bsv/wallet-toolbox-mobile.
 * Mirrors `Chain = 'main' | 'test' | 'ttn' | 'mock'` from the toolbox sdk.
 */
export type WalletChain = 'main' | 'test' | 'ttn'

/**
 * Map our app-level chain id to the wallet-toolbox `Chain` value.
 * The app persists/displays `'teratest'`, but the toolbox (and its default
 * wallet-client service paths — e.g. WhatsOnChain `api.woc-ttn.bsvblockchain.tech`)
 * identify TeraTestNet as `'ttn'`. Keep `'teratest'` for AsyncStorage keys,
 * env var names (`EXPO_PUBLIC_TERATEST_*`) and UI; convert only at toolbox boundaries.
 */
export function toWalletChain(chain: AppChain): WalletChain {
  return chain === 'teratest' ? 'ttn' : chain
}

export const DEFAULT_WAB_URL = 'noWAB'
export const DEFAULT_STORAGE_URL = 'local'
// The MessageBox host lives in ONE place: DEFAULT_MESSAGE_BOX_URL in the handle rail,
// which reads it from the environment. A copy here had no importers and had already
// drifted to a host nothing was talking to.
export const DEFAULT_CHAIN: AppChain = 'main'
export const ADMIN_ORIGINATOR = 'admin.com'
