'use strict'

const { isRequest, response, failure, event } = require('./protocol')

/**
 * Shell-side dispatcher for chrome traffic. Both shells build one of these and
 * hand it a `TabHost` implementation — react-native-webview refs on mobile,
 * WebContentsView instances on desktop.
 *
 * @param {{methods: Record<string, (params: any) => any>, send: (envelope: any) => void}} config
 */
function createHostRouter(config) {
  const methods = config.methods || {}
  const send = config.send

  async function handle(raw) {
    let msg
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      return
    }
    if (!isRequest(msg)) return

    const fn = methods[msg.method]
    if (!fn) {
      send(failure(msg.id, 'nexusHost: unknown method ' + msg.method))
      return
    }
    try {
      const result = await fn(msg.params)
      send(response(msg.id, result))
    } catch (err) {
      send(failure(msg.id, err && err.message ? err.message : String(err)))
    }
  }

  /** Push an event to the chrome. */
  function emit(name, payload) {
    send(event(name, payload))
  }

  return { handle, emit }
}

module.exports = { createHostRouter }
