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

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = 'h' + ++seq + '-' + Math.random().toString(36).slice(2)
      var timer = setTimeout(function () {
        delete pending[id]
        reject(new Error('nexusHost: ' + method + ' timed out after ' + timeoutMs + 'ms'))
      }, timeoutMs)
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
      transactions: function (opts) { return call('wallet.transactions', opts || {}) }
    },
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
