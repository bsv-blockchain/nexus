'use strict'

const { createHostClient } = require('./client')
const { CHANNEL } = require('./protocol')

/**
 * Document-start script that publishes `window.nexusHost` inside the chrome
 * WebView on mobile. On desktop the Electron chrome preload publishes the same
 * client through contextBridge instead.
 *
 * @param {{shell?: string, platform: string, timeoutMs?: number}} opts
 */
function buildChromeBridgeScript(opts) {
  const cfg = {
    channel: CHANNEL,
    shell: (opts && opts.shell) || 'expo',
    platform: opts.platform,
    timeoutMs: (opts && opts.timeoutMs) || 15000
  }

  return `(function(){
  if (window.nexusHost) return;
  var createHostClient = ${createHostClient.toString()};
  var cfg = ${JSON.stringify(cfg)};
  cfg.post = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)) };
  var client = createHostClient(cfg);
  window.nexusHost = client;
  window.__nexusHostDeliver = function (payload) {
    try { client.__deliver(typeof payload === 'string' ? JSON.parse(payload) : payload) }
    catch (e) { console.error('nexusHost: deliver failed', e) }
  };
  try { window.dispatchEvent(new Event('nexushost:ready')) } catch (e) {}
})();true;`
}

module.exports = { buildChromeBridgeScript }
