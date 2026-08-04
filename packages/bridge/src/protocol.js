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
  WALLET_RESTORE: 'wallet.restore',

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
  CHROME_SET_OVERLAY: 'chrome.setOverlay'
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
  WALLET_STATE: 'wallet.state'
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
