'use strict'

const { createProvider } = require('./provider')
const { CHANNEL } = require('./protocol')

/**
 * Builds the document-start script for a browsed page.
 *
 * Mobile: handed to react-native-webview's `injectedJavaScriptBeforeContentLoaded`.
 * Desktop: NOT used — the Electron tab preload calls createProvider() directly and
 * publishes it with contextBridge, which is a stronger guarantee (real isolated
 * world, runs before page scripts by construction).
 *
 * The trailing `true;` is required by react-native-webview on iOS: without it the
 * injected script's completion value can throw an unhandled promise rejection.
 *
 * @param {{walletEnabled?: boolean, timeoutMs?: number, version?: string}} [opts]
 */
function buildSubstrateScript(opts) {
  const o = opts || {}
  const cfg = {
    channel: CHANNEL,
    walletEnabled: o.walletEnabled !== false,
    timeoutMs: o.timeoutMs || 30000,
    version: o.version || '0.0.0-spike'
  }

  return `(function(){
  if (window.nexus) return;
  var createProvider = ${createProvider.toString()};
  var cfg = ${JSON.stringify(cfg)};
  cfg.post = function (msg) {
    var json = JSON.stringify(msg);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) return window.ReactNativeWebView.postMessage(json);
    if (window.__nexusTabPost) return window.__nexusTabPost(json);
    console.warn('nexus: no host transport available');
  };
  var provider = createProvider(cfg);
  Object.defineProperty(window, 'nexus', { value: provider, writable: false, configurable: false, enumerable: true });
  window.__nexusDeliver = function (payload) {
    try { provider.__deliver(typeof payload === 'string' ? JSON.parse(payload) : payload) }
    catch (e) { console.error('nexus: deliver failed', e) }
  };
  window.__nexusInjectedAt = Date.now();
  try { window.dispatchEvent(new Event('nexus:ready')) } catch (e) {}
})();true;`
}

module.exports = { buildSubstrateScript }
