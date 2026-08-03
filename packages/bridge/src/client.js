'use strict'

/**
 * `window.nexusHost` — the single API the DOM chrome codes against, identical on
 * Expo and Electron. Swapping shells must never touch UI code; that is the whole
 * point of the A′ architecture.
 *
 * HARD CONSTRAINT: self-contained (stringified for WebView injection on mobile,
 * imported directly by the Electron chrome preload). No imports, ES5-flavoured.
 *
 * @param {{channel: string, shell: string, platform: string, post: (msg: any) => void, timeoutMs?: number}} options
 */
function createHostClient(options) {
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
      listeners[name] = (listeners[name] || []).filter(function (fn) {
        return fn !== cb
      })
    }
  }

  function deliver(envelope) {
    if (!envelope || envelope.channel !== channel) return
    if (envelope.kind === 'event') {
      var subs = listeners[envelope.event] || []
      for (var i = 0; i < subs.length; i++) {
        try {
          subs[i](envelope.payload)
        } catch (e) {
          console.error('nexusHost: listener for ' + envelope.event + ' threw', e)
        }
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
      create: function (url, opts) {
        return call('tabs.create', { url: url, options: opts || {} })
      },
      destroy: function (id) {
        return call('tabs.destroy', { id: id })
      },
      navigate: function (id, url) {
        return call('tabs.navigate', { id: id, url: url })
      },
      /** rect in CSS px of the chrome document; shells convert to dp/DIP 1:1 */
      setBounds: function (id, rect) {
        return call('tabs.setBounds', { id: id, rect: rect })
      },
      setActive: function (id) {
        return call('tabs.setActive', { id: id })
      },
      goBack: function (id) {
        return call('tabs.goBack', { id: id })
      },
      goForward: function (id) {
        return call('tabs.goForward', { id: id })
      },
      reload: function (id) {
        return call('tabs.reload', { id: id })
      },
      stop: function (id) {
        return call('tabs.stop', { id: id })
      },
      list: function () {
        return call('tabs.list', null)
      }
    },
    info: function () {
      return call('host.info', null)
    },
    __deliver: deliver
  }
}

module.exports = { createHostClient }
