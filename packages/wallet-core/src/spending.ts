/**
 * The spending-authorization limits, in a file with no platform in it.
 *
 * These lived in constants.ts, which imports `react-native` on its first line for
 * the browser-chrome constants it also holds — fine for the Expo shell, fatal for
 * Electron main, where esbuild walks into react-native/index.js and dies on the
 * flow types. Both shells now enforce the same limit, so the limit cannot live
 * somewhere only one of them can reach.
 *
 * constants.ts re-exports all three, so nothing on the mobile side had to change.
 */

/**
 * Spend up to this many satoshis without asking.
 *
 * Not zero: a wallet that asks about every dust payment trains people to approve
 * without reading, which is worse than the small standing risk of the limit. The
 * user can set it to zero if they want every one.
 */
export const DEFAULT_AUTO_APPROVE_THRESHOLD = 100_000

/**
 * The floor between two silent approvals, globally rather than per origin.
 *
 * A page that stays under the threshold could otherwise drain a wallet in a loop
 * with nobody ever seeing a prompt. The second payment inside this window goes to
 * a human — which is exactly when a person should be looking.
 */
export const AUTO_APPROVE_COOLDOWN_MS = 10_000

/** Where the user's chosen limit is persisted. Same key on both shells. */
export const AUTO_APPROVE_STORAGE_KEY = 'autoApproveThreshold'
