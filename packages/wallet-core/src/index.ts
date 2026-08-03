/**
 * @nexus/wallet-core — portable wallet logic ported verbatim from BSV Browser.
 *
 * This barrel re-exports every module's public surface. A handful of modules
 * still import app-level modules with the source repo's `@/` alias
 * (`@/context/config`, `@/storage/...`, `@/shared/constants`) that were NOT
 * part of this port — those are cross-subsystem boundaries, not resolvable
 * from inside this package, and are called out in the port report. A smaller
 * set of modules import `react-native` / `expo-file-system` directly and are
 * candidates to move back into the app shell rather than stay here — also
 * called out in the port report.
 */

// ── services ────────────────────────────────────────────────────────────────
export * from './services/arcadeBroadcastProvider'
export * from './services/exchangeRate' // RN-coupled: @react-native-async-storage/async-storage
export * from './services/walletServiceConfig' // app-coupled: @/context/config (AppChain, toWalletChain)

// ── utils/identity ──────────────────────────────────────────────────────────
export * from './utils/identity/resolveIdentity'

// ── utils/monitor ───────────────────────────────────────────────────────────
export * from './utils/monitor/TaskSendOffline' // app-coupled: @/storage/methods/processOfflineActions (type-only)

// ── utils/net ───────────────────────────────────────────────────────────────
export * from './utils/net/online' // RN-coupled: @react-native-community/netinfo

// ── utils/offline ───────────────────────────────────────────────────────────
export * from './utils/offline/hold' // app-coupled: @/storage/methods/offlineActions (type-only)
export * from './utils/offline/order'
export * from './utils/offline/payerHold' // app-coupled: @/storage/methods/offlineActions, @/storage/StorageExpoSQLite
export * from './utils/offline/plan' // app-coupled: @/storage/methods/offlineActions (type-only)

// ── utils/localpay ──────────────────────────────────────────────────────────
export * from './utils/localpay/build'
export * from './utils/localpay/codec'
export * from './utils/localpay/pending'
export * from './utils/localpay/session'
export * from './utils/localpay/verify'

// ── utils/localpay/transport ────────────────────────────────────────────────
export * from './utils/localpay/transport/awdl' // RN-coupled via ./socket: react-native-localpay-transport
export * from './utils/localpay/transport/nearby' // RN-coupled via ./socket: react-native-localpay-transport
export * from './utils/localpay/transport/nearbyPermissions' // RN-coupled: react-native (PermissionsAndroid, Platform)
export * from './utils/localpay/transport/qr'
export * from './utils/localpay/transport/select' // RN-coupled: react-native (Platform), react-native-localpay-transport
export * from './utils/localpay/transport/socket' // RN-coupled: react-native-localpay-transport
export * from './utils/localpay/transport/types'

// ── utils/headers ───────────────────────────────────────────────────────────
export * from './utils/headers/checkpoints'
export * from './utils/headers/fs' // RN/Expo-coupled: expo-file-system (lazy require inside expoHeaderFs())
export * from './utils/headers/headerStore'
export * from './utils/headers/OfflineFirstChaintracks'
export * from './utils/headers/prewarm'
export * from './utils/headers/syncHeaders'

// ── top-level utils ─────────────────────────────────────────────────────────
export * from './utils/mnemonicWallet'
export * from './utils/backupShares'
export { default as config } from './utils/config'
export * from './utils/logging'
export { default as loggingConfig } from './utils/logging.config'
export * from './utils/errorHandler' // RN-coupled: react-native (ErrorUtils) — candidate to move back into the app shell
export * from './utils/generalHelpers' // app-coupled: @/shared/constants (kNEW_TAB_URL)
export * from './utils/amountFormatHelpers'
