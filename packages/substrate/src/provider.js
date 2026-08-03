'use strict'

/**
 * `window.nexus` — the provider a browsed page sees.
 *
 * HARD CONSTRAINT: `createProvider` must be entirely self-contained. Its source
 * is stringified via Function.prototype.toString() and injected into WebViews
 * (see injected.js), so it may not reference imports, closures, or anything
 * outside its own body. ES5-flavoured on purpose — it runs in whatever engine
 * the browsed page got.
 *
 * The Electron tab preload imports this same function directly instead of
 * stringifying it, so both shells ship byte-identical provider logic.
 *
 * @param {{channel: string, post: (msg: any) => void, timeoutMs?: number, version?: string, walletEnabled?: boolean}} options
 */
function createProvider(options) {
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
    ping: function () {
      return call('ping', null)
    },
    getVersion: function () {
      return call('getVersion', null)
    },
    getPublicKey: function (args) {
      return call('getPublicKey', args || {})
    },
    createAction: function (args) {
      return call('createAction', args || {})
    },
    /** Host → page delivery hook. Not part of the public page-facing API. */
    __deliver: deliver
  }
}

module.exports = { createProvider }
