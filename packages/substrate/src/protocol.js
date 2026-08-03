'use strict'

/**
 * Wire protocol for the wallet substrate: the code that lives INSIDE a browsed
 * third-party page (`window.nexus`) talking to whichever shell hosts the tab.
 *
 * Deliberately transport-free. The same envelopes travel over
 * `ReactNativeWebView.postMessage` on mobile and over an Electron preload
 * bridge on desktop.
 */

const CHANNEL = 'nexus.substrate.v1'

const METHODS = {
  PING: 'ping',
  GET_VERSION: 'getVersion',
  GET_PUBLIC_KEY: 'getPublicKey',
  CREATE_ACTION: 'createAction'
}

/** @param {string} id @param {string} method @param {unknown} params */
function request(id, method, params) {
  return { channel: CHANNEL, kind: 'request', id, method, params: params === undefined ? null : params }
}

/** @param {string} id @param {unknown} result */
function response(id, result) {
  return { channel: CHANNEL, kind: 'response', id, result: result === undefined ? null : result }
}

/** @param {string} id @param {string} error */
function failure(id, error) {
  return { channel: CHANNEL, kind: 'failure', id, error }
}

/** Cheap shape check before we trust anything arriving from a browsed page. */
function isRequest(msg) {
  return !!msg && msg.channel === CHANNEL && msg.kind === 'request' && typeof msg.id === 'string' && typeof msg.method === 'string'
}

module.exports = { CHANNEL, METHODS, request, response, failure, isRequest }
