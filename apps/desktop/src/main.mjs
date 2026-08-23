import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync, appendFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bridgePkg from '@nexus/bridge'
import { createTabManager } from './tabManager.mjs'
import { createWalletHost } from './wallet/host.mjs'
import { createUpdater } from './updater.mjs'

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

/**
 * The app icon in DEVELOPMENT only.
 *
 * `build/icon.icns` is a buildResource: electron-builder stamps it into the packaged
 * .app, and nothing reads it when the shell is started with `electron .` — so a dev run
 * carried the stock Electron logo in the Dock and made a correct icon look like a
 * broken one. Packaged builds skip this: their icon is already in the bundle, and
 * build/ is not shipped, so the path would not resolve anyway.
 */
const DEV_ICON = app.isPackaged ? null : path.join(__dirname, '..', 'build', 'icon.png')

let win = null
let tabManager = null
let router = null
let walletHost = null

/**
 * The auto-updater, constructed once for the process.
 *
 * Outside createWindow because it outlives any window and is not owned by one:
 * closing the last window on macOS does not quit the app, and an update that
 * finished downloading while no window was open still has to be there when one
 * opens again. Its events go out on the same router the wallet's state does, so
 * the chrome learns about them the same way.
 */
const updater = createUpdater({
  onEvent: (state) => router?.emit('update.state', state)
})

/** The height of our own bar, shared with the renderer's CSS. */
const TITLEBAR_HEIGHT = 40

/**
 * How tall macOS's own three buttons are, which is not something it will tell
 * us. Only used to centre them in a bar of our height — `trafficLightPosition`
 * takes the top-left of their box, so without this they sit high.
 */
const TRAFFIC_LIGHT_SIZE = 12

/**
 * Three platforms, two modes.
 *
 * macOS and Windows keep the OS's own buttons and we draw everything else
 * around them. On Windows that is not cosmetic: Snap Layouts, the flyout under
 * the maximize button, only exists while the OS owns that button, and a
 * hand-rolled maximize loses it silently.
 *
 * Linux is frameless and we draw the buttons. The overlay API exists there in
 * this Electron, but Linux window managers disagree about where controls belong
 * and whether they honour a hint at all — GNOME on the right, others on the
 * left, tiling WMs ignoring the question. Owning them is the predictable
 * answer, and predictable beats native when native has no single answer.
 */
function windowChrome() {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: {
        x: 16,
        y: (TITLEBAR_HEIGHT - TRAFFIC_LIGHT_SIZE) / 2
      }
    }
  }
  if (process.platform === 'win32') {
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        // Transparent, so the strip takes the renderer's colour and nothing has
        // to be kept in step with the theme except the glyphs.
        color: '#00000000',
        symbolColor: '#e5e5e5',
        height: TITLEBAR_HEIGHT
      }
    }
  }
  return { frame: false }
}

/**
 * Minimise, maximise and close, for Linux where we draw the buttons.
 *
 * Registered once at module scope rather than per window: `ipcMain.handle`
 * throws on a duplicate channel, and macOS rebuilds the window on `activate`.
 */
ipcMain.handle('nexus:window', (event, action) => {
  const target = BrowserWindow.fromWebContents(event.sender)
  // Can be null if the window died between the click and the message arriving.
  if (!target || target.isDestroyed()) return { ok: false, error: 'no-window' }
  try {
    if (action === 'minimize') target.minimize()
    else if (action === 'toggle-maximize') {
      target.isMaximized() ? target.unmaximize() : target.maximize()
    } else if (action === 'close') target.close()
    else return { ok: false, error: `unknown action: ${action}` }
    return { ok: true, maximized: target.isMaximized() }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

function createWindow() {
  boot('createWindow')
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    // Below this the overlay arithmetic stops making sense: the workspace strip
    // has nowhere to go and the window controls start overlapping it.
    minWidth: 720,
    // Painted before the renderer mounts, so the window does not flash white on
    // the way in. Matches the dark theme's canvas.
    backgroundColor: '#0f0d15',
    // Ignored on macOS — see DEV_ICON, the Dock is set instead — and undefined in a
    // packaged app, which is the same as not passing it.
    icon: DEV_ICON ?? undefined,
    ...windowChrome(),
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
  // A second createWindow — macOS 'activate' after every window was closed — builds a
  // second host. Stop the outgoing one first or its Monitor and connectivity poll
  // keep running beside the replacement's, against the same database.
  walletHost?.shutdown()
  walletHost = createWalletHost({
    userDataDir: app.getPath('userData'),
    onStateChange: (state) => router?.emit('wallet.state', state),
    // A spend above the auto-approve limit needs a person, and the person is in
    // the chrome. Null is pushed too — that is how the sheet closes when the
    // queue drains.
    onPermissionRequest: (request) => router?.emit('permission.request', request),
    // For backup.shares: the print dialogue is parented to this window so the OS
    // sheet appears attached to the app rather than as an ownerless window. A getter
    // rather than `win`, because the host outlives any single createWindow.
    getParentWindow: () => win
  })

  router = createHostRouter({
    methods: {
      [METHODS.UPDATE_STATE]: () => updater.get(),
      [METHODS.UPDATE_CHECK]: () => updater.check(),
      [METHODS.UPDATE_INSTALL]: () => {
        updater.install()
        return { ok: true }
      },
      [METHODS.HOST_INFO]: () => ({
        shell: 'electron',
        platform: process.platform,
        version: app.getVersion(),
        tabCount: tabManager.count()
      }),
      ...walletHost.methods,
      // pay.* and tx.* — the desktop port of the mobile pay bridge; see
      // src/wallet/payHost.mjs for the one rail it deliberately leaves out (nearby)
      // and why preload-chrome.cjs still withholds 'nearby' and 'scan'.
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

  /*
   * The traffic lights come and go with fullscreen on macOS.
   *
   * The renderer reserves space for them on the left. Enter fullscreen and they
   * are gone, so without this the bar keeps an 80px hole where they used to be.
   */
  const sendFullscreen = (value) => {
    if (win && !win.isDestroyed()) win.webContents.send('nexus:fullscreen', value)
  }
  win.on('enter-full-screen', () => sendFullscreen(true))
  win.on('leave-full-screen', () => sendFullscreen(false))

  /* Same for maximised: the user can maximise by dragging to a screen edge, and
     the renderer's own button state would never hear about it. */
  const sendMaximized = () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('nexus:maximized', win.isMaximized())
    }
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)

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
  // Dock icon for a dev run. Guarded on the platform AND on app.dock existing, because
  // the Dock API is macOS-only and a cosmetic touch must not be able to stop boot.
  if (DEV_ICON && process.platform === 'darwin' && existsSync(DEV_ICON)) {
    try {
      app.dock?.setIcon(DEV_ICON)
    } catch (err) {
      boot('dock icon skipped: ' + (err && err.message))
    }
  }
  serveChromeAssets()
  try {
    createWindow()
  } catch (err) {
    boot('createWindow threw: ' + (err && (err.stack || err.message)))
    console.error('[fatal] createWindow:', err && (err.stack || err.message))
    app.exit(1)
  }
  // After the window, and never before it: the first check is deferred ten
  // seconds anyway, and a failure here must not be able to cost somebody the app.
  updater.start()
})

// Spec calls out darwin as the exception: mac apps conventionally stay resident
// with no windows open (dock icon remains), every other desktop platform quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/**
 * The wallet runs timers now — a Monitor task loop and a connectivity poll (see
 * src/wallet/host.mjs). Nothing else stops them, and quitting with a fresh task pass
 * about to start is how a partially-written wallet database is earned. Synchronous
 * on purpose: 'before-quit' does not await, so anything asynchronous here would be a
 * promise the exiting process never returns to.
 */
app.on('before-quit', () => {
  updater.stop()
  walletHost?.shutdown()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
