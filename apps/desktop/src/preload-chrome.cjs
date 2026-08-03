// Electron preload for the chrome BrowserWindow, run at document-start in an
// isolated world (contextIsolation: true). `sandbox: false` here is a spike
// concession — it lets this preload `require('@nexus/bridge')` straight out of the
// workspace instead of loading a bundle, since a sandboxed preload cannot use
// Node's `require`. Production must bundle this file (esbuild) and restore
// `sandbox: true`.
'use strict'

const { contextBridge, ipcRenderer } = require('electron')
const { createHostClient, CHANNEL } = require('@nexus/bridge')

const client = createHostClient({
  channel: CHANNEL,
  shell: 'electron',
  platform: process.platform,
  post: (msg) => ipcRenderer.send('nexus:host:out', msg)
})

ipcRenderer.on('nexus:host:in', (_event, envelope) => {
  client.__deliver(envelope)
})

contextBridge.exposeInMainWorld('nexusHost', client)

// Belt and braces: the harness (apps/harness/index.html) also polls for
// `window.nexusHost` every 50ms up to 5s as a fallback, but firing this event lets
// it pick the client up the moment it's actually available. `window.dispatchEvent`
// from an isolated-world preload still reaches main-world listeners — DOM
// EventTarget dispatch is shared at the underlying document level even though
// contextIsolation keeps plain JS globals/properties separate per world.
function announceReady() {
  window.dispatchEvent(new Event('nexushost:ready'))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announceReady, { once: true })
} else {
  announceReady()
}
