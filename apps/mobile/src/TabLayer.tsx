import React, { memo, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import WebView from 'react-native-webview'
import { buildSubstrateScript } from '@nexus/substrate'
import { buildCWIProviderScript } from '@nexus/substrate/src/browser/cwiProvider'
import { originatorForUrl, type CwiInvocation } from '@nexus/substrate/src/browser/cwiHost'
import type { SubstrateCtx, TabState } from './useTabHost'

export interface TabLayerProps {
  tabs: TabState[]
  registerRef: (id: string, ref: WebView | null) => void
  onTabMessage: (id: string, patch: Partial<Omit<TabState, 'id'>>) => void
  emit: (name: string, payload: unknown) => void
  substrateHost: { handle: (raw: string, ctx: SubstrateCtx) => void | Promise<void> }
  /** BRC-100 dispatcher; returns true when the message was a `window.CWI` call. */
  handleCwi: (msg: CwiInvocation, ctx: { origin: string; inject: (js: string) => void }) => Promise<boolean>
  /** Chrome is covering itself — stand down so its sheet is not painted through. */
  suppressed?: boolean
}

/**
 * One absolutely-positioned WebView per tab, ALL of them mounted at once.
 * Hidden tabs stay mounted at opacity 0 with pointerEvents 'none' rather than
 * being unmounted on switch — this is the warm-pool behaviour this team
 * already shipped in BSV Browser (instant tab switch, no reload, no blank
 * flash), reused here rather than re-litigated.
 */
function TabLayer({
  tabs,
  registerRef,
  onTabMessage,
  emit,
  substrateHost,
  handleCwi,
  suppressed = false
}: TabLayerProps) {
  // A *second* ref map, distinct from useTabHost's internal one (that one only
  // serves chrome-initiated commands via `registerRef`). This one lets a
  // tab's own onMessage handler hand its own WebView instance to the
  // substrate host's `send`, which has to inject the response into that exact
  // tab and has no other way to reach it.
  const refs = useRef<Record<string, WebView | null>>({})

  // Both providers, built once: `window.nexus` (our own shell protocol) and
  // `window.CWI` (BRC-100, what every existing BSV dApp and @bsv/sdk WalletClient
  // actually looks for). A page gets both; they do not overlap.
  const injectedProviders = useMemo(() => buildSubstrateScript() + '\n' + buildCWIProviderScript(), [])

  return (
    <>
      {tabs.map((tab) => (
        // The WebView is NOT absolutely positioned itself: under the New Architecture a
        // natively-backed view positioned that way reported the correct frame via
        // onLayout (106,176 286×530) while painting somewhere else entirely. Wrapping it
        // in a plain View that owns the absolute rect, with the WebView simply filling
        // that wrapper, keeps layout and paint in agreement.
        <View
          key={tab.id}
          style={[
            styles.tab,
            {
              left: tab.rect.x,
              top: tab.rect.y,
              width: tab.rect.width,
              height: tab.rect.height,
              // Opacity, not unmounting: the tab keeps running and comes back
              // instantly when the overlay closes. Same warm-pool rule as a
              // background tab, just driven by the chrome instead of the user.
              opacity: tab.visible && !suppressed ? 1 : 0
            }
          ]}
          pointerEvents={tab.visible && !suppressed ? 'auto' : 'none'}
        >
        <WebView
          ref={(instance) => {
            refs.current[tab.id] = instance
            registerRef(tab.id, instance)
          }}
          source={{ uri: tab.url }}
          style={styles.fill}
          onLayout={(e) => {
            // Gate G3: what RN ACTUALLY placed, versus what the chrome asked for.
            // This separates "the style never took" from "it took and something else
            // is painting over it".
            const l = e.nativeEvent.layout
            if (__DEV__) {
              console.log(
                `[layout] ${tab.id} rn=${Math.round(l.x)},${Math.round(l.y)} ${Math.round(l.width)}×${Math.round(
                  l.height
                )} requested=${tab.rect.x},${tab.rect.y} ${tab.rect.width}×${tab.rect.height} visible=${tab.visible}`
              )
            }
          }}
          injectedJavaScriptBeforeContentLoaded={injectedProviders}
          onMessage={(event) => {
            const raw = event.nativeEvent.data
            // Background tabs stay mounted and their pages keep running. Only the
            // visible tab may drive the wallet — otherwise a backgrounded page could
            // raise a spending prompt the user has no context for. Its call simply
            // waits until the user comes back to it. (BSV Browser's rule, kept.)
            if (tab.visible) {
              let msg: CwiInvocation | null = null
              try {
                msg = JSON.parse(raw)
              } catch {
                msg = null // not JSON; a page may postMessage anything
              }
              if (msg && msg.type === 'CWI') {
                const ref = refs.current[tab.id]
                void handleCwi(msg, {
                  origin: originatorForUrl(tab.url),
                  inject: (js) => ref?.injectJavaScript(js)
                })
                return
              }
            }
            substrateHost.handle(raw, { id: tab.id, ref: refs.current[tab.id], emit })
          }}
          onNavigationStateChange={(navState) => {
            onTabMessage(tab.id, {
              url: navState.url,
              title: navState.title,
              canGoBack: navState.canGoBack,
              canGoForward: navState.canGoForward
            })
            emit('tab.nav', {
              id: tab.id,
              url: navState.url,
              canGoBack: navState.canGoBack,
              canGoForward: navState.canGoForward
            })
            // react-native-webview bundles title into navState (Electron fires
            // it as the separate page-title-updated event instead), but the
            // wire protocol still wants a distinct tab.title push either way.
            emit('tab.title', { id: tab.id, title: navState.title })
          }}
          onLoadStart={() => {
            onTabMessage(tab.id, { loading: true })
            emit('tab.loading', { id: tab.id, loading: true, progress: 0 })
          }}
          onLoadEnd={() => {
            onTabMessage(tab.id, { loading: false })
            emit('tab.loading', { id: tab.id, loading: false, progress: 1 })
          }}
          onContentProcessDidTerminate={() => emit('tab.crash', { id: tab.id, reason: 'content-process-terminated' })}
          onRenderProcessGone={(event) =>
            emit('tab.crash', {
              id: tab.id,
              reason: event.nativeEvent?.didCrash ? 'render-process-crashed' : 'render-process-gone'
            })
          }
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
        />
        </View>
      ))}
    </>
  )
}

/**
 * Memoized: the shell now re-renders whenever the wallet's lifecycle ticks, and
 * without this every one of those would reconcile the whole tab layer — the same
 * render-storm shape BSV Browser had to chase out of its browser tree.
 */
export default memo(TabLayer)

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tab: {
    position: 'absolute',
    zIndex: 1
  }
})
