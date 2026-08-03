import { useCallback, useMemo, useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import type WebView from 'react-native-webview'
import { METHODS } from '@nexus/bridge'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface TabState {
  id: string
  url: string
  rect: Rect
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  visible: boolean
}

/**
 * Context threaded through `substrateHost.handle(raw, ctx)` -> each handler ->
 * `send(envelope, ctx)`. `ref` and `emit` are supplied per-call by TabLayer
 * (App.tsx builds `substrateHost`, but only TabLayer actually holds each tab's
 * WebView instance and receives the chrome router's `emit`), so this hook
 * never has to hold a reference to the host router that is built from its own
 * `methods` output — that would be a construction-order cycle.
 */
export interface SubstrateCtx {
  id: string
  ref: WebView | null
  emit: (name: string, payload: unknown) => void
}

export interface UseTabHostConfig {
  shell: string
  platform: string
  /** Same string answers both host.info's `version` and the getVersion handler, mirroring @nexus/desktop's single `app.getVersion()`. */
  version: string
  /**
   * Size of the chrome WebView in dp — the window MINUS safe-area insets, not the window.
   * Normalized rects are fractions of the chrome's viewport, so scaling them by the full
   * window would overshoot by exactly the insets.
   */
  chromeSize?: { width: number; height: number }
}

export type HostMethods = Record<string, (params: any) => any>
export type SubstrateHandlers = Record<string, (params: any, ctx: SubstrateCtx) => any>

export interface UseTabHostResult {
  tabs: TabState[]
  activeId: string | null
  methods: HostMethods
  registerRef: (id: string, ref: WebView | null) => void
  onTabMessage: (id: string, patch: Partial<Omit<TabState, 'id'>>) => void
  handlers: SubstrateHandlers
}

// Spec: "a fixed 33-byte hex string with an obvious spike- marker". Real hex
// can't spell a word, so this trades strict hex-only characters for an
// unmissable, grep-able flag. Byte-identical to @nexus/desktop's tabManager.mjs
// so both shells answer getPublicKey with the same spike value.
const SPIKE_PUBLIC_KEY = '02' + 'spike-' + '0'.repeat(66 - 2 - 'spike-'.length)

/**
 * Wrap a substrate handler so every handled call also emits `tab.message` to
 * the chrome, success or throw — mirrors @nexus/desktop's tabManager.mjs
 * `withMessage`, so the harness log (T1) shows substrate traffic on both shells.
 */
function withMessage(method: string, fn: (params: unknown, ctx: SubstrateCtx) => unknown | Promise<unknown>) {
  return async (params: unknown, ctx: SubstrateCtx) => {
    try {
      const result = await fn(params, ctx)
      ctx?.emit?.('tab.message', { id: ctx.id, method, params, result })
      return result
    } catch (err) {
      ctx?.emit?.('tab.message', { id: ctx.id, method, params, result: null })
      throw err
    }
  }
}

/**
 * Owns tab state and the two tables the shell hands off: `methods` to
 * @nexus/bridge's createHostRouter, `handlers` to @nexus/substrate's
 * createSubstrateHost. Chrome-initiated imperative commands (goBack, reload,
 * …) reach a tab through `registerRef` — refs TabLayer registers as it mounts
 * each WebView — never through React state, since state updates are async and
 * these have to fire on the actual native view right now.
 */
export function useTabHost(config: UseTabHostConfig): UseTabHostResult {
  const [tabs, setTabs] = useState<TabState[]>([])
  // Derived, not a second piece of state: a tab's `visible` flag is the single
  // source of truth, so activeId can never drift out of sync with it.
  const activeId = useMemo(() => tabs.find((t) => t.visible)?.id ?? null, [tabs])

  // Always-fresh snapshot for methods that read state (tabs.list, host.info)
  // without forcing `methods` to be rebuilt on every tab change.
  const tabsRef = useRef<TabState[]>(tabs)
  tabsRef.current = tabs

  const configRef = useRef(config)
  configRef.current = config

  const refs = useRef<Record<string, WebView | null>>({})
  const counter = useRef(0)

  const registerRef = useCallback((id: string, ref: WebView | null) => {
    if (ref) refs.current[id] = ref
    else delete refs.current[id]
  }, [])

  const onTabMessage = useCallback((id: string, patch: Partial<Omit<TabState, 'id'>>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  // Stable identity: every mutation below goes through updater-form setState
  // and every read goes through tabsRef/configRef, so `methods` never needs to
  // change shape after the first render — createHostRouter (built in App.tsx)
  // is handed this object exactly once.
  const methods = useMemo<HostMethods>(
    () => ({
      [METHODS.HOST_INFO]: () => ({
        shell: configRef.current.shell,
        platform: configRef.current.platform,
        version: configRef.current.version,
        tabCount: tabsRef.current.length
      }),
      [METHODS.TAB_CREATE]: ({ url, options }: { url: string; options?: Record<string, unknown> }) => {
        void options // spike doesn't act on tab-create options; accepted for wire-compatibility
        const id = 't' + ++counter.current
        setTabs((prev) => [
          ...prev,
          {
            id,
            url,
            rect: { x: 0, y: 0, width: 0, height: 0 },
            title: '',
            loading: true,
            canGoBack: false,
            canGoForward: false,
            // Starts hidden, mirroring @nexus/desktop's tabManager.create(): a
            // new tab never auto-activates, so it can't flash over whatever is
            // currently on screen. The chrome must call tabs.setActive.
            visible: false
          }
        ])
        return { id }
      },
      [METHODS.TAB_DESTROY]: ({ id }: { id: string }) => {
        delete refs.current[id]
        setTabs((prev) => prev.filter((t) => t.id !== id))
        return null
      },
      [METHODS.TAB_NAVIGATE]: ({ id, url }: { id: string; url: string }) => {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, url, loading: true } : t)))
        return null
      },
      [METHODS.TAB_SET_BOUNDS]: ({
        id,
        rect,
        viewport,
        norm
      }: {
        id: string
        rect: Rect
        viewport?: { width: number; height: number; zoom?: number; dpr?: number; vvWidth?: number }
        norm?: Rect
      }) => {
        // Normalized fractions × this screen's dp. A WebView scales the page whenever
        // the chrome's layout does not fit the frame, so the chrome's CSS px are not
        // dp and no constant factor recovers them. Fractions survive that; px are only
        // the fallback for a shell/chrome pair predating `norm`.
        const win = configRef.current.chromeSize ?? Dimensions.get('window')
        const rounded: Rect = norm
          ? {
              x: Math.round(norm.x * win.width),
              y: Math.round(norm.y * win.height),
              width: Math.round(norm.width * win.width),
              height: Math.round(norm.height * win.height)
            }
          : {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
        if (__DEV__) {
          console.log(
            `[bounds] ${id} css=${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(
              rect.height
            )} vp=${viewport?.width}×${viewport?.height} zoom=${viewport?.zoom} dpr=${viewport?.dpr} vvW=${viewport?.vvWidth} → dp=${rounded.x},${rounded.y} ${rounded.width}×${
              rounded.height
            } (screen ${win.width}×${win.height})`
          )
        }
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, rect: rounded } : t)))
        return null
      },
      [METHODS.TAB_SET_ACTIVE]: ({ id }: { id: string }) => {
        setTabs((prev) => prev.map((t) => ({ ...t, visible: t.id === id })))
        return null
      },
      [METHODS.TAB_GO_BACK]: ({ id }: { id: string }) => {
        refs.current[id]?.goBack()
        return null
      },
      [METHODS.TAB_GO_FORWARD]: ({ id }: { id: string }) => {
        refs.current[id]?.goForward()
        return null
      },
      [METHODS.TAB_RELOAD]: ({ id }: { id: string }) => {
        refs.current[id]?.reload()
        return null
      },
      [METHODS.TAB_STOP]: ({ id }: { id: string }) => {
        refs.current[id]?.stopLoading()
        return null
      },
      [METHODS.TAB_LIST]: () =>
        tabsRef.current.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          loading: t.loading,
          canGoBack: t.canGoBack,
          canGoForward: t.canGoForward
        }))
    }),
    []
  )

  // Same handler set as @nexus/desktop's tabManager.mjs (ping / getVersion /
  // getPublicKey fixed responses, createAction throws). tab.message
  // notification goes through `ctx.emit`, supplied per-call by TabLayer, so
  // this hook never needs the host router itself.
  const handlers = useMemo<SubstrateHandlers>(
    () => ({
      ping: withMessage('ping', () => ({ pong: true, at: Date.now() })),
      getVersion: withMessage('getVersion', () => configRef.current.version),
      getPublicKey: withMessage('getPublicKey', () => SPIKE_PUBLIC_KEY),
      createAction: withMessage('createAction', () => {
        throw new Error('not implemented in spike')
      })
    }),
    []
  )

  return { tabs, activeId, methods, registerRef, onTabMessage, handlers }
}
