'use strict'

/**
 * Protocol between the Nexus chrome (the Next.js DOM UI) and whichever shell
 * hosts it. Distinct from @nexus/substrate: that one faces untrusted browsed
 * pages, this one faces our own trusted UI.
 */

const CHANNEL = 'nexus.host.v1'

const METHODS = {
  HOST_INFO: 'host.info',
  TAB_CREATE: 'tabs.create',
  TAB_DESTROY: 'tabs.destroy',
  TAB_NAVIGATE: 'tabs.navigate',
  TAB_SET_BOUNDS: 'tabs.setBounds',
  TAB_SET_ACTIVE: 'tabs.setActive',
  TAB_GO_BACK: 'tabs.goBack',
  TAB_GO_FORWARD: 'tabs.goForward',
  TAB_RELOAD: 'tabs.reload',
  TAB_STOP: 'tabs.stop',
  TAB_LIST: 'tabs.list',

  // Wallet surface. The UI reads these instead of its demo fixtures when a shell is
  // present; see apps/ui/lib/data-mode.ts. Deliberately shaped like the fixtures the 89
  // consuming components already expect, so screens migrate one at a time rather than in
  // one enormous change.
  WALLET_INFO: 'wallet.info',
  WALLET_ACCOUNTS: 'wallet.accounts',
  WALLET_TRANSACTIONS: 'wallet.transactions',
  // Onboarding. Restoring from a recovery phrase is how a wallet comes into being
  // here; the chrome collects the words and the shell owns every key operation.
  // Twelve, fifteen, eighteen, twenty-one or twenty-four words — every length BIP-39
  // defines, which is what BRC-157 requires. Both shells used to accept only 12 and
  // 24, so a 15-word phrase from another wallet could not get in at all.
  WALLET_RESTORE: 'wallet.restore',
  /**
   * The other way in: BRC-140 backup shares.
   *
   * A separate method rather than an overload of WALLET_RESTORE, because the input,
   * the failure modes and the trust question are all different. Under BRC-157 the
   * shares reconstruct the wallet's ENTROPY, so recovery ends with the recovery phrase
   * back in the user's hands and the wallet indistinguishable from a phrase-restored
   * one — that is the whole point of the standard.
   *
   * `{ shares: string[], wordCount?: 12|15|18|21|24, legacy?: boolean }`
   *
   * `wordCount` is printed on the share page and is the one fact shares cannot carry;
   * without it the shell falls back to BRC-157's leading-zero heuristic. `legacy` is
   * for pages printed by BSV Browser / metanet-mobile, which split the primary key
   * itself: BRC-140 has no version marker, so the two are indistinguishable and the
   * user has to say which they hold. A legacy recovery has no phrase, ever.
   */
  WALLET_RESTORE_SHARES: 'wallet.restoreShares',
  // Create-new is the same trust split in the other direction: the shell generates
  // and stores the words, and hands them to the chrome ONCE for the user to write
  // down. Refused while a wallet exists — creating over someone's keys is a wipe.
  WALLET_CREATE: 'wallet.create',
  // The stored recovery phrase, for the backup screen. Behind the platform's
  // biometric gate where there is one; the chrome must treat the result as
  // radioactive — render, never persist.
  WALLET_BACKUP: 'wallet.backup',
  // Deletes key material (phrase, recovered key, snapshot) and tears the managers
  // down. Deliberately NOT the ledger databases: transaction history is not a
  // secret, and a re-restore onto the same device should find its history waiting.
  WALLET_LOGOUT: 'wallet.logout',

  // The wallet-facing settings surface. Small on purpose: everything here must be
  // answerable by both shells, or the Settings screen forks per platform.
  SETTINGS_GET: 'settings.get',
  SETTINGS_SET_NETWORK: 'settings.setNetwork',
  /**
   * The broadcast endpoint, per network. Both halves are real settings rather than
   * developer conveniences: an ARC that needs a token is unusable without somewhere
   * to put one, and a wallet pinned to a dead endpoint cannot broadcast at all.
   * Passing null resets to the shipped default.
   */
  SETTINGS_SET_ARC: 'settings.setArc',
  /**
   * How much a page may spend before the wallet stops asking. Storing it is not the
   * hard part — WalletContext has read this key since the port — but nothing has
   * ever been able to change it, so every wallet runs on the compiled-in default.
   */
  SETTINGS_SET_AUTO_APPROVE: 'settings.setAutoApprove',

  /**
   * Backup and recovery, beyond the words.
   *
   * `backup.shares` splits the wallet's ENTROPY 2-of-3 (Shamir, BRC-140) behind
   * whatever gate the platform has, renders the printable document, and hands it
   * straight to the OS — print dialogue on desktop, share sheet on mobile. It answers
   * with counts and NEVER with a share: any `threshold` shares together are the
   * wallet, and the chrome is a renderer that also hosts third-party pages.
   *
   * Entropy and not the primary key, per BRC-157: splitting `m/0'/0'` is what used to
   * make the shares recover a different wallet than the phrase did.
   *
   * `exportDb`/`importDb` move the ledger itself, which is the only copy of
   * transaction history a local-only wallet has. Import REPLACES that ledger and
   * rebuilds the wallet. Both are still declared and still unimplemented — they share
   * nothing with the key material above except the word "backup", and they need a
   * native file dialogue on two shells.
   */
  BACKUP_SHARES: 'backup.shares',
  BACKUP_EXPORT_DB: 'backup.exportDb',
  BACKUP_IMPORT_DB: 'backup.importDb',

  /**
   * Native surfaces. Three things the chrome cannot do itself — read a camera,
   * drive the local radios, open a share sheet — so it asks the shell to put a
   * native screen in front of it and hand back the result. See
   * apps/mobile/src/native/NativeModalHost.tsx.
   */
  SCAN_QR: 'scan.qr',
  PAY_NEARBY_OPEN: 'pay.nearby.open',
  SHARE_TEXT: 'share.text',
  SHARE_FILE: 'share.file',

  // Overlay arbitration. Native tab WebViews always paint above the chrome (a native
  // view sits above a WebView's content regardless of z-index), so a chrome sheet or
  // menu would be half-hidden behind the page. The chrome tells the shell when it is
  // covering itself, and the shell takes the tab layer down for the duration.
  CHROME_SET_OVERLAY: 'chrome.setOverlay',

  /**
   * The user's answer to a permission request the shell asked for.
   *
   * The request travels the other way, as PERMISSION_REQUEST below. This is the only
   * way a queued request is ever resolved: the wallet's permissions manager is
   * BLOCKED on it — `createAction` from a browsed page does not return until someone
   * grants or denies — so a chrome that drops one hangs the page until the bridge
   * times out.
   */
  PERMISSION_RESOLVE: 'permission.resolve',
  /**
   * Whatever request is outstanding, for a chrome that reloaded after the push.
   * The event is the normal path; this closes the one hole it cannot.
   */
  PERMISSION_PENDING: 'permission.pending'
}

/** Shell → chrome pushes. */
const EVENTS = {
  TAB_NAV: 'tab.nav',
  TAB_TITLE: 'tab.title',
  TAB_LOADING: 'tab.loading',
  TAB_MESSAGE: 'tab.message',
  TAB_CRASH: 'tab.crash',

  // Shell → chrome UI requests. The wallet was written against a React Native UI that
  // could show a toast or push a screen directly; in Nexus the UI is a DOM document, so
  // those become events it reacts to. See apps/mobile/src/wallet/support/shell-ui.ts.
  UI_TOAST: 'ui.toast',
  UI_NAVIGATE: 'ui.navigate',

  /**
   * The wallet became ready, started building, or went away. Without this the chrome
   * would have to poll: wallet.info is answered once per mount, and a wallet that
   * finishes building thirty seconds into a cold start would never be noticed.
   */
  WALLET_STATE: 'wallet.state',

  /**
   * A browsed page wants to spend, and the amount is above the auto-approve limit.
   *
   * Pushed rather than polled because the wallet is BLOCKED while it waits — the
   * permissions manager holds `createAction` open until the answer comes back
   * through PERMISSION_RESOLVE. The chrome must always answer, including on unmount:
   * a dropped request is a page frozen mid-payment.
   *
   * Payload is the SpendingRequest shape from the mobile WalletContext, minus
   * anything the chrome has no business seeing. `requestID` is the correlation key.
   */
  PERMISSION_REQUEST: 'permission.request'
}

function isRequest(msg) {
  return !!msg && msg.channel === CHANNEL && msg.kind === 'request' && typeof msg.id === 'string' && typeof msg.method === 'string'
}

function response(id, result) {
  return { channel: CHANNEL, kind: 'response', id, result: result === undefined ? null : result }
}

function failure(id, error) {
  return { channel: CHANNEL, kind: 'failure', id, error }
}

function event(name, payload) {
  return { channel: CHANNEL, kind: 'event', event: name, payload: payload === undefined ? null : payload }
}

module.exports = { CHANNEL, METHODS, EVENTS, isRequest, response, failure, event }
