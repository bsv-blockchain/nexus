import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync, appendFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bridgePkg from '@nexus/bridge'
import { createTabManager } from './tabManager.mjs'
import { createWalletHost } from './wallet/host.mjs'

// @nexus/bridge is CommonJS; destructure off the default import rather than using
// named ESM imports so this doesn't depend on cjs-module-lexer correctly tracing the
// `module.exports = { ...protocol, ... }` spread in packages/bridge/src/index.js.
const { METHODS, createHostRouter } = bridgePkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Boot tracing for a PACKAGED app.
 *
 * A packaged .app does not give us main's stdout the way `electron .` does, so a
 * startup that produces no window and no output is unreadable from a terminal. With
 * NEXUS_BOOT_LOG set, every milestone is appended to that file instead.
 */
const BOOT_LOG = process.env.NEXUS_BOOT_LOG ?? null
function boot(stage) {
  if (!BOOT_LOG) return
  try {
    appendFileSync(BOOT_LOG, `${Date.now()} ${stage}\n`)
  } catch {
    // Tracing must never be the thing that breaks startup.
  }
}
boot('module-evaluated')
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

// Electron derives userData from the package name, and this package is called
// "@nexus/desktop" — which put the wallet databases, the cache and the cookies in
// "~/Library/Application Support/@nexus/desktop". Same class of mistake as the Linux
// binary that shipped as "@nexusdesktop". Set before whenReady, or the paths are
// already resolved by the time it takes effect.
app.setName('Nexus')

/**
 * Dev harness only, like NEXUS_EVAL below: point the whole app at a throwaway
 * userData directory. Wallet tests exercise create/logout, and running those
 * against the developer's real profile would delete the stored phrase of a
 * funded wallet. Packaged apps never see this variable.
 */
if (process.env.NEXUS_USER_DATA) {
  app.setPath('userData', process.env.NEXUS_USER_DATA)
}

let win = null
let tabManager = null
let router = null
let walletHost = null

function createWindow() {
  boot('createWindow')
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

  // The wallet lives HERE, in main — never in the renderer. That renderer is a
  // browser chrome that also hosts arbitrary third-party pages in sibling
  // WebContentsViews, so key material must not share a process with it. See
  // src/wallet/buildWallet.ts for the full reasoning and how it differs from
  // bsv-desktop, which builds its wallet in the renderer.
  walletHost = createWalletHost({
    userDataDir: app.getPath('userData'),
    onStateChange: (state) => router?.emit('wallet.state', state)
  })

  router = createHostRouter({
    methods: {
      [METHODS.HOST_INFO]: () => ({
        shell: 'electron',
        platform: process.platform,
        version: app.getVersion(),
        tabCount: tabManager.count()
      }),
      ...walletHost.methods,
      // tx.* — the desktop port of the mobile pay bridge's transaction surface;
      // see src/wallet/payHost.mjs for what it deliberately leaves out.
      ...walletHost.payMethods,
      [METHODS.TAB_CREATE]: ({ url, options }) => tabManager.create(url, options),
      [METHODS.TAB_DESTROY]: ({ id }) => tabManager.destroy(id),
      [METHODS.TAB_NAVIGATE]: ({ id, url }) => tabManager.navigate(id, url),
      [METHODS.TAB_SET_BOUNDS]: ({ id, rect }) => tabManager.setBounds(id, rect),
      [METHODS.TAB_SET_ACTIVE]: ({ id }) => tabManager.setActive(id),
      // Hides the tab views so a chrome sheet can be seen; see tabManager.setOverlay.
      [METHODS.CHROME_SET_OVERLAY]: ({ open }) => tabManager.setOverlay(open),
      [METHODS.TAB_GO_BACK]: ({ id }) => tabManager.goBack(id),
      [METHODS.TAB_GO_FORWARD]: ({ id }) => tabManager.goForward(id),
      [METHODS.TAB_RELOAD]: ({ id }) => tabManager.reload(id),
      [METHODS.TAB_STOP]: ({ id }) => tabManager.stop(id),
      [METHODS.TAB_LIST]: () => tabManager.list()
    },
    send: (envelope) => win.webContents.send('nexus:host:in', envelope)
  })

  boot('router-ready')
  ipcMain.on('nexus:host:out', (_event, msg) => router.handle(msg))

  // AFTER first paint, not before. resume() starts with safeStorage, which is
  // SYNCHRONOUS keychain access on this thread — and on a build whose code signature
  // the keychain item does not yet trust, macOS parks that call behind a modal
  // password prompt. Fired at router-ready, that prompt sat in front of a white
  // window that could not paint, which is exactly the "signed builds hang" this shell
  // was misdiagnosed with (docs/SPEC-desktop-wallet.md). The chrome paints, shows the
  // gate, and learns the outcome through wallet.state — same flow as mobile, where
  // key derivation takes tens of seconds.
  win.webContents.once('did-finish-load', () => {
    void walletHost.resume()
  })

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

  /**
   * Evaluate a script file inside the chrome after it loads, and log the result.
   *
   * The desktop shell has no simulator to poke at, so without this the only way to
   * check that a bridge method reaches the real UI is to have a human click. The file
   * is read from disk at load time and is expected to evaluate to a promise or value;
   * whatever it resolves to is JSON-logged.
   *
   * Dev harness only — nothing reads NEXUS_EVAL in a packaged app, and it stays out of
   * the shipped scripts.
   */
  if (process.env.NEXUS_EVAL) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const { readFile } = await import('node:fs/promises')
          const src = await readFile(process.env.NEXUS_EVAL, 'utf8')
          const out = await win.webContents.executeJavaScript(src, true)
          console.log(`[eval] ${JSON.stringify(out)}`)
        } catch (err) {
          console.log(`[eval] failed: ${err.message}`)
        }
      }, 2000)
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

  win.webContents.on('did-finish-load', () => boot(`did-finish-load ${win.webContents.getURL()}`))
  win.webContents.on('did-fail-load', (_e, code, desc, url) => boot(`did-fail-load ${code} ${desc} ${url}`))
  win.webContents.on('preload-error', (_e, file, err) => boot(`preload-error ${file} ${err && err.message}`))
  win.webContents.on('render-process-gone', (_e, d) => boot(`chrome-renderer-gone ${d && d.reason}`))
  boot(`chrome source: url=${CHROME_URL} bundled=${BUNDLED_CHROME} exists=${existsSync(BUNDLED_CHROME)}`)

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

// A throw inside createWindow used to be an unhandled rejection: the process stayed
// alive with no window and no message, which in a packaged app is indistinguishable
// from a hang. Report it and exit non-zero instead.
process.on('uncaughtException', (err) => {
  boot('uncaught: ' + (err && (err.stack || err.message)))
  console.error('[fatal] uncaught:', err && (err.stack || err.message))
})

boot('awaiting-ready')
/**
 * Root-anchored chrome assets, rescued.
 *
 * The bundled export rewrites the STATIC references to be relative (tools/
 * bundle-ui.mjs), but Next's runtime also BUILDS URLs at run time — webpack's lazy-
 * chunk loader concatenates its configured public path, the literal "/_next/". Under
 * file:// that resolves against the filesystem root, and the first lazily-loaded
 * chunk dies with ChunkLoadError ("file:///_next/static/chunks/…"). The exact same
 * list of root-anchored prefixes bundle-ui rewrites in strings is therefore mapped
 * here at the protocol layer, where it catches the constructed URLs too.
 */
const UI_ROOT_PREFIXES = /^\/(?:_next|images|icons|avatars|tokens|media|members|ordinals|collectibles|ecosystems)\//

function serveChromeAssets() {
  const uiDir = path.dirname(BUNDLED_CHROME)
  protocol.handle('file', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    const target = UI_ROOT_PREFIXES.test(pathname)
      ? pathToFileURL(path.join(uiDir, pathname)).toString()
      : request.url
    // bypassCustomProtocolHandlers, or this handler recurses into itself.
    return net.fetch(target, { bypassCustomProtocolHandlers: true })
  })
}

app.whenReady().then(() => {
  boot('app-ready')
  serveChromeAssets()
  try {
    createWindow()
  } catch (err) {
    boot('createWindow threw: ' + (err && (err.stack || err.message)))
    console.error('[fatal] createWindow:', err && (err.stack || err.message))
    app.exit(1)
  }
})

// Spec calls out darwin as the exception: mac apps conventionally stay resident
// with no windows open (dock icon remains), every other desktop platform quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
