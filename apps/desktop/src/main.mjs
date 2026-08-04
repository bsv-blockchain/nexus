import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import bridgePkg from '@nexus/bridge'
import { createTabManager } from './tabManager.mjs'

// @nexus/bridge is CommonJS; destructure off the default import rather than using
// named ESM imports so this doesn't depend on cjs-module-lexer correctly tracing the
// `module.exports = { ...protocol, ... }` spread in packages/bridge/src/index.js.
const { METHODS, createHostRouter } = bridgePkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * Where the chrome comes from.
 *
 * Default is the copy bundled beside this file by `npm run ui:bundle`, so a packaged
 * app has no network dependency and ships the UI it was tested with — the same rule
 * apps/mobile/src/config.ts follows. It used to default to http://localhost:8099,
 * which is tools/serve.mjs answering with the SPIKE HARNESS: the product chrome had
 * never actually been loaded in Electron.
 */
const BUNDLED_CHROME = app.isPackaged
  // Packaged: __dirname is INSIDE app.asar, and the 28 MB export is deliberately
  // kept out of the archive (electron-builder `extraResources`) so it can be read
  // as ordinary files. That puts it beside the asar, not within it.
  ? path.join(process.resourcesPath, 'ui', 'index.html')
  : path.join(__dirname, '..', 'ui', 'index.html')
const CHROME_URL = process.env.NEXUS_CHROME_URL ?? null

let win = null
let tabManager = null
let router = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload-chrome.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  // `emit` is a thin closure over `router` (assigned just below) rather than a direct
  // reference, because the tab manager needs to start wiring webContents listeners
  // before the router exists to receive their output.
  tabManager = createTabManager({ win, emit: (name, payload) => router.emit(name, payload) })

  router = createHostRouter({
    methods: {
      [METHODS.HOST_INFO]: () => ({
        shell: 'electron',
        platform: process.platform,
        version: app.getVersion(),
        tabCount: tabManager.count()
      }),
      [METHODS.TAB_CREATE]: ({ url, options }) => tabManager.create(url, options),
      [METHODS.TAB_DESTROY]: ({ id }) => tabManager.destroy(id),
      [METHODS.TAB_NAVIGATE]: ({ id, url }) => tabManager.navigate(id, url),
      [METHODS.TAB_SET_BOUNDS]: ({ id, rect }) => tabManager.setBounds(id, rect),
      [METHODS.TAB_SET_ACTIVE]: ({ id }) => tabManager.setActive(id),
      [METHODS.TAB_GO_BACK]: ({ id }) => tabManager.goBack(id),
      [METHODS.TAB_GO_FORWARD]: ({ id }) => tabManager.goForward(id),
      [METHODS.TAB_RELOAD]: ({ id }) => tabManager.reload(id),
      [METHODS.TAB_STOP]: ({ id }) => tabManager.stop(id),
      [METHODS.TAB_LIST]: () => tabManager.list()
    },
    send: (envelope) => win.webContents.send('nexus:host:in', envelope)
  })

  ipcMain.on('nexus:host:out', (_event, msg) => router.handle(msg))

  // Forward the harness's own log to stdout so gate evidence can be collected without
  // a human watching the window. Electron 36+ passes a single details object here;
  // older versions passed positional args, so accept both shapes.
  if (process.env.NEXUS_DEBUG) {
    win.webContents.on('console-message', (...args) => {
      const d = args[0]
      const message = d && typeof d === 'object' && 'message' in d ? d.message : args[1]
      console.log(`[chrome] ${message}`)
    })
  }

  // Gate G1 evidence: capture the chrome once it has settled, so "the real UI renders
  // in the Electron renderer" is a file someone can look at rather than an assertion.
  if (process.env.NEXUS_SCREENSHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage()
          await writeFile(process.env.NEXUS_SCREENSHOT, image.toPNG())
          console.log(`[screenshot] wrote ${process.env.NEXUS_SCREENSHOT}`)
        } catch (err) {
          console.log(`[screenshot] failed: ${err.message}`)
        }
      }, 4000)
    })
  }

  if (CHROME_URL) win.loadURL(CHROME_URL)
  else if (existsSync(BUNDLED_CHROME)) win.loadFile(BUNDLED_CHROME)
  else {
    // Fail loudly. A blank window is indistinguishable from a hung one, and the fix
    // is a single command.
    win.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<body style="font:14px system-ui;padding:2rem;background:#1A0E31;color:#fff">' +
            '<h2>No chrome bundled</h2><p>Run <code>npm run ui:bundle</code>, then start again.</p></body>'
        )
    )
  }

  // Gate G2 needs window-geometry changes the chrome cannot trigger itself. Drive them
  // from here so the run is reproducible rather than a hand-resized window.
  if (process.env.NEXUS_AUTOTEST) {
    const steps = [
      [3000, 'setSize 1100×700', () => win.setSize(1100, 700)],
      [5000, 'setSize 1500×950', () => win.setSize(1500, 950)],
      [7000, 'maximize', () => win.maximize()],
      [9000, 'unmaximize', () => win.unmaximize()],
      [11000, 'setSize 900×600', () => win.setSize(900, 600)]
    ]
    for (const [delay, label, fn] of steps) {
      setTimeout(() => {
        console.log(`[autotest] ${label}`)
        fn()
      }, delay)
    }
    setTimeout(() => {
      console.log('[autotest] done — final tab list: ' + JSON.stringify(tabManager.list()))
    }, 13000)
  }
}

app.whenReady().then(createWindow)

// Spec calls out darwin as the exception: mac apps conventionally stay resident
// with no windows open (dock icon remains), every other desktop platform quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
