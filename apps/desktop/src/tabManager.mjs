import { app, WebContentsView, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import substratePkg from '@nexus/substrate'

// Same reasoning as main.mjs: destructure off the default (CJS) import instead of
// named ESM imports, since @nexus/substrate's index.js builds its exports object
// via a `...protocol` spread that static named-export detection may not trace.
const { createSubstrateHost } = substratePkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PRELOAD_TAB = path.join(__dirname, 'preload-tab.cjs')

// Spec: "a fixed 33-byte hex string with an obvious spike- marker". Real hex can't
// spell a word, so this trades strict hex-only characters for an unmissable,
// grep-able flag — nobody should ever mistake this for real key material.
// 33 bytes worth of characters (66), '02' compressed-key-shaped prefix + marker + padding.
const SPIKE_PUBLIC_KEY = '02' + 'spike-' + '0'.repeat(66 - 2 - 'spike-'.length)

/**
 * @param {{win: import('electron').BrowserWindow, emit: (name: string, payload: any) => void}} config
 */
function createTabManager({ win, emit }) {
  const tabs = new Map()
  // Reverse lookup so the single shared `nexus:tab:out` listener can tell which
  // tab a substrate message came from (ipcMain has no per-sender routing built in).
  const webContentsIdToTabId = new Map()
  let activeId = null
  let seq = 0

  /** Wrap a spike handler so every handled call also emits `tab.message`, success or throw. */
  function withMessage(method, fn) {
    return async (params, ctx) => {
      try {
        const result = await fn(params, ctx)
        emit('tab.message', { id: ctx.id, method, params, result })
        return result
      } catch (err) {
        emit('tab.message', { id: ctx.id, method, params, result: null })
        throw err
      }
    }
  }

  const substrateHost = createSubstrateHost({
    handlers: {
      ping: withMessage('ping', () => ({ pong: true, at: Date.now() })),
      getVersion: withMessage('getVersion', () => app.getVersion()),
      getPublicKey: withMessage('getPublicKey', () => SPIKE_PUBLIC_KEY),
      createAction: withMessage('createAction', () => {
        throw new Error('not implemented in spike')
      })
    },
    send: (envelope, ctx) => {
      const tab = tabs.get(ctx.id)
      if (tab && !tab.view.webContents.isDestroyed()) tab.view.webContents.send('nexus:tab:in', envelope)
    }
  })

  ipcMain.on('nexus:tab:out', (event, msg) => {
    const id = webContentsIdToTabId.get(event.sender.id)
    if (!id) return
    substrateHost.handle(msg, { id })
  })

  function wireEvents(id, wc) {
    function pushNav() {
      const tab = tabs.get(id)
      if (!tab) return
      tab.canGoBack = wc.navigationHistory.canGoBack()
      tab.canGoForward = wc.navigationHistory.canGoForward()
      emit('tab.nav', { id, url: tab.url, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward })
    }

    wc.on('did-navigate', (_e, url) => {
      const tab = tabs.get(id)
      if (!tab) return
      tab.url = url
      pushNav()
    })

    wc.on('did-navigate-in-page', (_e, url) => {
      const tab = tabs.get(id)
      if (!tab) return
      tab.url = url
      pushNav()
    })

    wc.on('page-title-updated', (_e, title) => {
      const tab = tabs.get(id)
      if (!tab) return
      tab.title = title
      emit('tab.title', { id, title })
    })

    wc.on('did-start-loading', () => {
      const tab = tabs.get(id)
      if (!tab) return
      tab.loading = true
      emit('tab.loading', { id, loading: true, progress: 0 })
    })

    wc.on('did-stop-loading', () => {
      const tab = tabs.get(id)
      if (!tab) return
      tab.loading = false
      emit('tab.loading', { id, loading: false, progress: 1 })
    })

    wc.on('render-process-gone', (_e, details) => {
      emit('tab.crash', { id, reason: (details && details.reason) || 'unknown' })
    })

    // Gate G4 evidence: tools/proof.html captures window.__proof in its first inline
    // script. Reading it from the main process is the only way to harvest that value
    // per platform without a human photographing the screen.
    if (process.env.NEXUS_DEBUG) {
      wc.on('did-finish-load', async () => {
        try {
          const raw = await wc.executeJavaScript('JSON.stringify(window.__proof || null)')
          if (raw && raw !== 'null') console.log(`[proof] ${id} ${raw}`)
        } catch (err) {
          console.log(`[proof] ${id} read failed: ${err.message}`)
        }
        // Gate G5: exercise the full page → shell → page round trip from inside each
        // tab. Running it per tab is also the cross-tab isolation check — a response
        // that leaked between tabs would show up as a mismatched id or a timeout.
        try {
          const t0 = Date.now()
          const pong = await wc.executeJavaScript(
            'window.nexus ? window.nexus.ping().then(function (v) { return JSON.stringify(v) }) : "NO-PROVIDER"'
          )
          console.log(`[ping] ${id} ${Date.now() - t0}ms ${pong}`)
        } catch (err) {
          console.log(`[ping] ${id} failed: ${err.message}`)
        }
      })
    }
  }

  function create(url, _options) {
    const id = 't' + ++seq
    const view = new WebContentsView({
      webPreferences: {
        preload: PRELOAD_TAB,
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false
      }
    })
    win.contentView.addChildView(view)
    const wc = view.webContents

    webContentsIdToTabId.set(wc.id, id)

    const tab = {
      view,
      rect: null,
      url: url || 'about:blank',
      title: '',
      loading: false,
      canGoBack: false,
      canGoForward: false
    }
    tabs.set(id, tab)
    wireEvents(id, wc)

    // Deny the native popup window entirely; a "new tab" in this product is always
    // one of our own tracked WebContentsViews, never a second OS-level window.
    // The new tab's own wireEvents (above, once created) fires the resulting
    // tab.nav once its navigation completes — no separate manual emit needed.
    wc.setWindowOpenHandler(({ url: targetUrl }) => {
      create(targetUrl, {})
      return { action: 'deny' }
    })

    // Start hidden; the chrome must explicitly setActive (mirrors the harness flow
    // of create() then, separately, click-to-activate) so a freshly created tab
    // never flashes on top of whatever is currently active.
    view.setVisible(false)

    wc.loadURL(tab.url)

    return { id }
  }

  function destroy(id) {
    const tab = tabs.get(id)
    if (!tab) return
    win.contentView.removeChildView(tab.view)
    webContentsIdToTabId.delete(tab.view.webContents.id)
    tabs.delete(id)
    if (activeId === id) activeId = null
    // Close the WebContents explicitly rather than waiting for GC: a leaked renderer
    // process per closed tab would poison any memory measurement we take under N tabs.
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
    // No explicit WebContentsView dispose API exists as of this Electron version;
    // removing it from the content view tree and dropping our own reference is the
    // documented cleanup path — the underlying WebContents is GC'd once unreferenced.
  }

  function navigate(id, url) {
    const tab = tabs.get(id)
    if (!tab) return
    tab.view.webContents.loadURL(url)
  }

  function setBounds(id, rect) {
    const tab = tabs.get(id)
    if (!tab) return
    // CSS px arrive as floats off getBoundingClientRect(); WebContentsView bounds
    // must be integers or Electron silently truncates in a way that can drift the
    // edge by a device pixel across repeated resizes.
    const bounds = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
    tab.rect = bounds
    tab.view.setBounds(bounds)

    // Gate G2 evidence: what the chrome measured vs what the native layer actually
    // holds. Any drift here is the exact failure mode that rules out a framework.
    if (process.env.NEXUS_DEBUG) {
      const actual = tab.view.getBounds()
      const drift =
        Math.abs(actual.x - bounds.x) +
        Math.abs(actual.y - bounds.y) +
        Math.abs(actual.width - bounds.width) +
        Math.abs(actual.height - bounds.height)
      console.log(
        `[bounds] ${id} req=${bounds.x},${bounds.y} ${bounds.width}×${bounds.height} ` +
          `actual=${actual.x},${actual.y} ${actual.width}×${actual.height} drift=${drift}px`
      )
    }
  }

  /**
   * True while the chrome has a sheet, gate or menu open.
   *
   * A WebContentsView is a native sibling of the chrome's renderer and always paints
   * ABOVE it — no z-index in the DOM can reach over one. So a chrome overlay is
   * invisible until every tab view is hidden, which is what this flag forces. Mobile
   * has the identical problem and the identical answer (apps/mobile/src/useTabHost.ts).
   *
   * The chrome refcounts before it calls, because a gate and a sheet can both be open;
   * here it is one boolean, deliberately, so the shell holds no state that could
   * disagree with the chrome's.
   */
  let overlayOpen = false

  /** The one place that decides whether a given tab may be on screen. */
  function applyVisibility() {
    for (const [tabId, tab] of tabs) {
      const visible = !overlayOpen && tabId === activeId
      tab.view.setVisible(visible)
      // Re-apply the last known rect whenever a tab becomes visible: a tab hidden
      // during a resize may hold a stale bounds from before it was hidden, since only
      // the visible tab is guaranteed to have received every setBounds push while
      // backgrounded.
      if (visible && tab.rect) tab.view.setBounds(tab.rect)
    }
  }

  function setActive(id) {
    if (!tabs.has(id)) return
    activeId = id
    applyVisibility()
  }

  function setOverlay(open) {
    overlayOpen = Boolean(open)
    applyVisibility()
  }

  function goBack(id) {
    const tab = tabs.get(id)
    if (!tab) return
    tab.view.webContents.navigationHistory.goBack()
  }

  function goForward(id) {
    const tab = tabs.get(id)
    if (!tab) return
    tab.view.webContents.navigationHistory.goForward()
  }

  function reload(id) {
    const tab = tabs.get(id)
    if (!tab) return
    tab.view.webContents.reload()
  }

  function stop(id) {
    const tab = tabs.get(id)
    if (!tab) return
    tab.view.webContents.stop()
  }

  /**
   * Close every tab, because the page that opened them is gone.
   *
   * A tab is owned by the chrome that asked for it: the pane calls `create` on
   * mount and `destroy` on unmount, and that contract holds for every route
   * change inside the single-page app. It does not hold across a document load.
   * A reload, a crash recovery or the shell pointing the window somewhere else
   * tears the renderer down without running any cleanup, and every view it had
   * asked for survives it — still parented to the window, still painting above
   * the chrome, and now unreachable, because the ids that addressed them died
   * with the page that held them.
   *
   * The result is a page from a previous load sitting over whatever is on
   * screen, on every screen, with nothing left that can hide it: `applyVisibility`
   * keeps showing whichever orphan was last active, and no overlay or route
   * change touches it because the chrome does not know it exists.
   *
   * So the shell reaps them itself, at the one moment it can be sure they are
   * all stale. See the caller in main.mjs.
   */
  function destroyAll() {
    for (const id of Array.from(tabs.keys())) destroy(id)
  }

  function list() {
    return Array.from(tabs, ([id, tab]) => ({
      id,
      url: tab.url,
      title: tab.title,
      loading: tab.loading,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward
    }))
  }

  function count() {
    return tabs.size
  }

  return { create, destroy, destroyAll, navigate, setBounds, setActive, setOverlay, goBack, goForward, reload, stop, list, count }
}

export { createTabManager }
