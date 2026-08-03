'use strict'

/**
 * `window.nexus` — the provider a browsed page sees.
 *
 * WHY THIS IS A STRING AND NOT A FUNCTION
 *
 * Hermes discards function source, so Function.prototype.toString() returns a stub
 * with a `[bytecode]` body and mangled parameter names — the injected provider is
 * then garbage and `window.nexus` never appears. Measured on the iOS simulator
 * (2026-08-03) against the sibling bridge client: 660 characters vs 3540 in Node.
 * BSV Browser reached the same conclusion for its CWI provider.
 *
 * So the string below is the single source of truth. Keep it ES5-flavoured, and
 * free of backticks and `${`, since injected.js interpolates it into a template
 * literal.
 */
const CREATE_PROVIDER_SOURCE = `function createProvider(options) {
  var channel = options.channel
  var post = options.post
  var timeoutMs = options.timeoutMs || 30000
  var pending = Object.create(null)
  var seq = 0

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = channel + ':' + ++seq + ':' + Math.random().toString(36).slice(2)
      var timer = setTimeout(function () {
        delete pending[id]
        reject(new Error('nexus: ' + method + ' timed out after ' + timeoutMs + 'ms'))
      }, timeoutMs)
      pending[id] = { resolve: resolve, reject: reject, timer: timer }
      post({ channel: channel, kind: 'request', id: id, method: method, params: params === undefined ? null : params })
    })
  }

  function deliver(envelope) {
    if (!envelope || envelope.channel !== channel) return
    var entry = pending[envelope.id]
    if (!entry) return
    delete pending[envelope.id]
    clearTimeout(entry.timer)
    if (envelope.kind === 'failure') entry.reject(new Error(envelope.error || 'nexus: call failed'))
    else entry.resolve(envelope.result)
  }

  return {
    version: options.version || '0.0.0-spike',
    walletEnabled: options.walletEnabled !== false,
    ping: function () { return call('ping', null) },
    getVersion: function () { return call('getVersion', null) },
    getPublicKey: function (args) { return call('getPublicKey', args || {}) },
    createAction: function (args) { return call('createAction', args || {}) },
    __deliver: deliver
  }
}`

/**
 * The Electron tab preload needs the real function. Evaluating our own source once
 * keeps both shells on one implementation instead of two that drift. The input is
 * this module's own constant — never anything originating in a browsed page.
 */
let cachedFactory = null
function createProvider(options) {
  if (!cachedFactory) {
    cachedFactory = new Function(CREATE_PROVIDER_SOURCE + '; return createProvider')()
  }
  return cachedFactory(options)
}

module.exports = { CREATE_PROVIDER_SOURCE, createProvider }
