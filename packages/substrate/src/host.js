'use strict'

const { isRequest, response, failure } = require('./protocol')

/**
 * Shell-side router for substrate traffic. Identical logic on both shells; only
 * `send` differs (injectJavaScript on mobile, ipc → preload on desktop).
 *
 * Every message here originates in an arbitrary third-party page, so it is
 * untrusted input: unknown methods are refused, handler throws become `failure`
 * envelopes, and nothing is echoed back that a handler did not produce.
 *
 * @param {{handlers: Record<string, (params: any, ctx: any) => Promise<any> | any>, send: (envelope: any, ctx: any) => void}} config
 */
function createSubstrateHost(config) {
  const handlers = config.handlers || {}
  const send = config.send

  /**
   * @param {string | object} raw message from the page
   * @param {any} [ctx] shell context (tab id, origin) passed through to handlers
   */
  async function handle(raw, ctx) {
    let msg
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      return // not ours; a page may postMessage anything
    }
    if (!isRequest(msg)) return

    const handler = handlers[msg.method]
    if (!handler) {
      send(failure(msg.id, 'nexus: unknown method ' + msg.method), ctx)
      return
    }
    try {
      const result = await handler(msg.params, ctx)
      send(response(msg.id, result), ctx)
    } catch (err) {
      send(failure(msg.id, err && err.message ? err.message : String(err)), ctx)
    }
  }

  return { handle }
}

module.exports = { createSubstrateHost }
