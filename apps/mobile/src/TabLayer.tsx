import React, { useRef } from 'react'
import { StyleSheet } from 'react-native'
import WebView from 'react-native-webview'
import { buildSubstrateScript } from '@nexus/substrate'
import type { SubstrateCtx, TabState } from './useTabHost'

export interface TabLayerProps {
  tabs: TabState[]
  registerRef: (id: string, ref: WebView | null) => void
  onTabMessage: (id: string, patch: Partial<Omit<TabState, 'id'>>) => void
  emit: (name: string, payload: unknown) => void
  substrateHost: { handle: (raw: string, ctx: SubstrateCtx) => void | Promise<void> }
}

/**
 * One absolutely-positioned WebView per tab, ALL of them mounted at once.
 * Hidden tabs stay mounted at opacity 0 with pointerEvents 'none' rather than
 * being unmounted on switch — this is the warm-pool behaviour this team
 * already shipped in BSV Browser (instant tab switch, no reload, no blank
 * flash), reused here rather than re-litigated.
 */
export default function TabLayer({ tabs, registerRef, onTabMessage, emit, substrateHost }: TabLayerProps) {
  // A *second* ref map, distinct from useTabHost's internal one (that one only
  // serves chrome-initiated commands via `registerRef`). This one lets a
  // tab's own onMessage handler hand its own WebView instance to the
  // substrate host's `send`, which has to inject the response into that exact
  // tab and has no other way to reach it.
  const refs = useRef<Record<string, WebView | null>>({})

  return (
    <>
      {tabs.map((tab) => (
        <WebView
          key={tab.id}
          ref={(instance) => {
            refs.current[tab.id] = instance
            registerRef(tab.id, instance)
          }}
          source={{ uri: tab.url }}
          style={[
            styles.tab,
            {
              left: tab.rect.x,
              top: tab.rect.y,
              width: tab.rect.width,
              height: tab.rect.height,
              opacity: tab.visible ? 1 : 0,
              pointerEvents: tab.visible ? 'auto' : 'none'
            }
          ]}
          injectedJavaScriptBeforeContentLoaded={buildSubstrateScript()}
          onMessage={(event) => {
            substrateHost.handle(event.nativeEvent.data, { id: tab.id, ref: refs.current[tab.id], emit })
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
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  tab: {
    position: 'absolute',
    zIndex: 1
  }
})
