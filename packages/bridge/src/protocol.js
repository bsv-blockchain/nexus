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
  WALLET_TRANSACTIONS: 'wallet.transactions'
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
  UI_NAVIGATE: 'ui.navigate'
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
