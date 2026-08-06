'use strict'

/**
 * `window.nexusHost` — the single API the DOM chrome codes against, identical on
 * Expo and Electron. Swapping shells must never touch UI code.
 *
 * WHY THIS IS A STRING AND NOT A FUNCTION
 *
 * The obvious implementation is a normal function stringified with
 * Function.prototype.toString() at injection time. That does not survive Hermes:
 * Hermes discards function source, so toString() returns a stub with a
 * `[bytecode]` body and mangled parameter names. Measured on the iOS simulator
 * (2026-08-03): 660 characters of garbage against 3540 in Node, and
 * `window.nexusHost` never appeared in the page.
 *
 * BSV Browser hit the same wall and landed on the same answer — see
 * `utils/webview/cwiProvider.ts` there: "Written as a plain string template (not
 * a .toString() serialized function) to avoid Metro/Hermes bytecode artifacts."
 *
 * So the string below is the single source of truth. Keep it ES5-flavoured (it
 * runs in whatever engine the page has) and free of backticks and `${`, since it
 * is interpolated into a template literal in injected.js.
 */
const CREATE_HOST_CLIENT_SOURCE = `function createHostClient(options) {
  var channel = options.channel
  var post = options.post
  var timeoutMs = options.timeoutMs || 15000
  var pending = Object.create(null)
  var listeners = Object.create(null)
  var seq = 0

  function call(method, params, overrideTimeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = 'h' + ++seq + '-' + Math.random().toString(36).slice(2)
      // Most calls are cheap reads and a short timeout is a useful liveness check.
      // A few are not: anything that derives keys or waits on a biometric prompt is
      // bounded by the user, not by us, and holding it to the default reports a
      // failure for an operation that is still running and will succeed.
      var ms = overrideTimeoutMs || timeoutMs
      var timer = setTimeout(function () {
        delete pending[id]
        reject(new Error('nexusHost: ' + method + ' timed out after ' + ms + 'ms'))
      }, ms)
      pending[id] = { resolve: resolve, reject: reject, timer: timer }
      post({ channel: channel, kind: 'request', id: id, method: method, params: params === undefined ? null : params })
    })
  }

  function on(name, cb) {
    if (!listeners[name]) listeners[name] = []
    listeners[name].push(cb)
    return function off() {
      listeners[name] = (listeners[name] || []).filter(function (fn) { return fn !== cb })
    }
  }

  function deliver(envelope) {
    if (!envelope || envelope.channel !== channel) return
    if (envelope.kind === 'event') {
      var subs = listeners[envelope.event] || []
      for (var i = 0; i < subs.length; i++) {
        try { subs[i](envelope.payload) }
        catch (e) { console.error('nexusHost: listener for ' + envelope.event + ' threw', e) }
      }
      return
    }
    var entry = pending[envelope.id]
    if (!entry) return
    delete pending[envelope.id]
    clearTimeout(entry.timer)
    if (envelope.kind === 'failure') entry.reject(new Error(envelope.error || 'nexusHost: call failed'))
    else entry.resolve(envelope.result)
  }

  return {
    shell: options.shell,
    platform: options.platform,
    /*
     * What this shell can actually DO, declared at injection time.
     *
     * The namespaces below are built unconditionally, because the chrome codes
     * against one API whichever shell hosts it. That makes presence useless as a
     * test: window.nexusHost.pay exists on a shell with no wallet, so a chrome
     * that probes for it renders a wallet whose every button answers
     * "unknown method". Ask this instead.
     *
     * Synchronous on purpose. A host.info round trip would mean the first render
     * happens before the answer arrives, which is exactly when the chrome decides
     * whether to show a balance.
     */
    capabilities: options.capabilities || [],
    has: function (name) { return (options.capabilities || []).indexOf(name) !== -1 },
    call: call,
    on: on,
    tabs: {
      create: function (url, opts) { return call('tabs.create', { url: url, options: opts || {} }) },
      destroy: function (id) { return call('tabs.destroy', { id: id }) },
      navigate: function (id, url) { return call('tabs.navigate', { id: id, url: url }) },
      setBounds: function (id, rect) {
        // CSS px are NOT the shell's unit. A WebView scales the page when the layout
        // does not fit (measured on an iPhone 17 Pro simulator: a desktop-width chrome
        // rendered at ~0.72 of its CSS size), so a px rect lands in the wrong place and
        // no single scale factor recovers it reliably.
        //
        // Normalized fractions of the document viewport are immune to that: they mean
        // the same thing under page zoom, WebKit shrink-to-fit, and devicePixelRatio.
        // The shell multiplies by its own frame size, in its own units. The px rect is
        // kept for desktop, where CSS px and DIP do coincide, and for debugging.
        var el = document.documentElement
        var vw = el.clientWidth || window.innerWidth || 1
        var vh = el.clientHeight || window.innerHeight || 1
        var vv = window.visualViewport
        return call('tabs.setBounds', {
          id: id,
          rect: rect,
          viewport: {
            width: vw,
            height: vh,
            zoom: vv && vv.scale ? vv.scale : 1,
            dpr: window.devicePixelRatio || 1,
            vvWidth: vv ? vv.width : vw
          },
          norm: { x: rect.x / vw, y: rect.y / vh, width: rect.width / vw, height: rect.height / vh }
        })
      },
      setActive: function (id) { return call('tabs.setActive', { id: id }) },
      goBack: function (id) { return call('tabs.goBack', { id: id }) },
      goForward: function (id) { return call('tabs.goForward', { id: id }) },
      reload: function (id) { return call('tabs.reload', { id: id }) },
      stop: function (id) { return call('tabs.stop', { id: id }) },
      list: function () { return call('tabs.list', null) }
    },
    info: function () { return call('host.info', null) },
    wallet: {
      // Whether a wallet is actually usable right now. The UI needs to tell "no wallet
      // configured" apart from "wallet is loading" apart from "shell has no wallet at
      // all" — showing an empty balance for any of those would be a lie.
      info: function () { return call('wallet.info', null) },
      accounts: function () { return call('wallet.accounts', null) },
      transactions: function (opts) { return call('wallet.transactions', opts || {}) },
      // The phrase crosses this boundary once and is never stored by the chrome —
      // the shell hands it straight to key derivation and the device keychain.
      // Five minutes: BIP-39 → BIP-32 derivation is seconds of pure JS, and the
      // device then puts up a Face ID / passcode sheet that waits on a human.
      restore: function (mnemonic) { return call('wallet.restore', { mnemonic: mnemonic }, 300000) },
      // The same trust split in the other direction: the shell generates and
      // stores the words, the chrome shows them ONCE for writing down. Same
      // five-minute bound as restore, for the same two reasons.
      create: function () { return call('wallet.create', null, 300000) },
      // The stored phrase, for the backup screen. Bounded by a biometric prompt
      // where the platform has one. Render it, never persist it.
      backup: function () { return call('wallet.backup', null, 300000) },
      logout: function () { return call('wallet.logout', null, 60000) }
    },
    settings: {
      get: function () { return call('settings.get', null) },
      // Tears the whole manager stack down and rebuilds it against the other
      // chain — the same class of work as restore, so the same bound.
      setNetwork: function (network) { return call('settings.setNetwork', { network: network }, 300000) }
    },
    // Payments. The rail is never chosen here — classify() infers it from how the
    // counterparty was identified, and the chrome renders whatever comes back.
    // Anything that broadcasts, sweeps or talks to a message box gets a long
    // timeout: those are bounded by the chain and the network, not by us.
    pay: {
      classify: function (text) { return call('pay.classify', { text: text }) },
      validateAddress: function (text) { return call('pay.validateAddress', { text: text }) },
      copyKeys: function () { return call('pay.copyKeys', null) },
      proofNudge: function () { return call('pay.proofNudge', null, 120000) },
      address: {
        receive: function (daysOffset) { return call('pay.address.receive', { daysOffset: daysOffset || 0 }, 60000) },
        history: function (address) { return call('pay.address.history', { address: address }, 60000) },
        sweep: function (address, daysOffset) { return call('pay.address.sweep', { address: address, daysOffset: daysOffset || 0 }, 180000) },
        send: function (address, satoshis) { return call('pay.address.send', { address: address, satoshis: satoshis }, 180000) }
      },
      handle: {
        identity: function (sats) { return call('pay.handle.identity', { sats: sats }, 60000) },
        messageBox: function () { return call('pay.handle.messageBox', null) },
        setMessageBox: function (url) { return call('pay.handle.setMessageBox', { url: url }) },
        send: function (identityKey, satoshis) { return call('pay.handle.send', { identityKey: identityKey, satoshis: satoshis }, 180000) },
        outbox: function () { return call('pay.handle.outbox', null, 30000) },
        retry: function (id) { return call('pay.handle.retry', { id: id }, 120000) },
        dismiss: function (id) { return call('pay.handle.dismiss', { id: id }) },
        inbox: function (retry) { return call('pay.handle.inbox', { retry: retry || [] }, 180000) },
        discard: function (messageId) { return call('pay.handle.discard', { messageId: messageId }, 60000) }
      },
      offline: {
        status: function () { return call('pay.offline.status', null) },
        sendNow: function () { return call('pay.offline.sendNow', null) }
      },
      nearby: {
        // Ten minutes. Every other timeout here bounds a network round trip; this
        // one bounds two people standing together holding phones, and a rejection
        // mid-exchange would abandon a payment that is still in flight.
        open: function (role) { return call('pay.nearby.open', { role: role }, 600000) }
      }
    },
    tx: {
      list: function (opts) { return call('tx.list', opts || {}, 60000) },
      abort: function (reference) { return call('tx.abort', { reference: reference }, 60000) },
      refreshProof: function (txid) { return call('tx.refreshProof', { txid: txid }, 120000) },
      rawHex: function (txid) { return call('tx.rawHex', { txid: txid }, 30000) },
      // Pages the entire history; on a busy wallet this is the slowest call here.
      exportCsv: function () { return call('tx.exportCsv', null, 300000) },
      explorerUrl: function (txid) { return call('tx.explorerUrl', { txid: txid }) }
    },
    // Native surfaces. Each of these puts a real native screen in front of the
    // chrome and resolves when the user finishes with it, so the timeout is long:
    // it is bounded by a person, not by the network.
    scan: {
      // Returns { text, target } — target is the classified rail when the scan was
      // one, so a caller wanting an address does not have to re-parse the string.
      // Resolves { cancelled: true } if the user backs out.
      qr: function (opts) { return call('scan.qr', opts || {}, 600000) }
    },
    share: {
      text: function (text, title) { return call('share.text', { text: text, title: title }, 300000) },
      file: function (filename, contents, mimeType) {
        return call('share.file', { filename: filename, contents: contents, mimeType: mimeType }, 300000)
      }
    },
    // True while the chrome is showing something over itself (sheet, menu, palette).
    // The shell hides its native tab layer for the duration; without this the page
    // paints straight through whatever the chrome just opened.
    setOverlay: function (open) { return call('chrome.setOverlay', { open: !!open }) },
    __deliver: deliver
  }
}`

/**
 * Electron preloads need the real function, not a string. Evaluating our own
 * source once — rather than maintaining a second copy as a live function — is what
 * keeps the two shells provably identical. The input is our own module constant,
 * never anything from a page.
 */
let cachedFactory = null
function createHostClient(options) {
  if (!cachedFactory) {
    cachedFactory = new Function(CREATE_HOST_CLIENT_SOURCE + '; return createHostClient')()
  }
  return cachedFactory(options)
}

module.exports = { CREATE_HOST_CLIENT_SOURCE, createHostClient }
