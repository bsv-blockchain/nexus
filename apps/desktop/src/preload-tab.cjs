// Electron preload for a browsed-page WebContentsView, run at document-start in an
// isolated world (contextIsolation: true). `sandbox: false` here is a spike
// concession — it lets this preload `require('@nexus/substrate')` straight out of
// the workspace instead of loading a bundle, since a sandboxed preload cannot use
// Node's `require`. Production must bundle this file (esbuild) and restore
// `sandbox: true`.
'use strict'

const { contextBridge, ipcRenderer, webFrame } = require('electron')
const { createProvider, CHANNEL } = require('@nexus/substrate')

const provider = createProvider({
  channel: CHANNEL,
  post: (msg) => ipcRenderer.send('nexus:tab:out', msg)
})

ipcRenderer.on('nexus:tab:in', (_event, envelope) => {
  provider.__deliver(envelope)
})

contextBridge.exposeInMainWorld('nexus', provider)

// tools/proof.html reads window.__nexusInjectedAt from its own (main-world) script
// to prove injection ran before the page's first script executed. A plain
// `window.__nexusInjectedAt = …` assignment here would only land on this preload's
// isolated-world copy of `window` — contextIsolation keeps custom JS properties
// (unlike native DOM event dispatch) genuinely separate per world — so this must
// run via webFrame.executeJavaScript to actually land in the main world the page reads.
webFrame.executeJavaScript('window.__nexusInjectedAt = Date.now()')
