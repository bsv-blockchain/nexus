import React, { useMemo, useRef } from 'react'
import { Dimensions, Platform, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import type WebView from 'react-native-webview'
import { createHostRouter } from '@nexus/bridge'
import { createSubstrateHost } from '@nexus/substrate'
import ChromeHost from './src/ChromeHost'
import TabLayer from './src/TabLayer'
import { useTabHost } from './src/useTabHost'

/**
 * Full-screen shell. ChromeHost (the real DOM UI) sits at zIndex 0; TabLayer's
 * native tab WebViews sit at zIndex 1 above it — the mobile half of
 * ARCHITECTURE.md's "native tab layers sit above the chrome" limitation, true
 * by construction since a native view always paints over a WebView's content.
 */
export default function App() {
  const chromeRef = useRef<WebView>(null)

  // Mirrors Electron's app.getVersion(): one value read from the app's own
  // manifest, reused for both host.info and the substrate getVersion handler.
  const version = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0-spike'

  if (__DEV__) {
    const w = Dimensions.get('window')
    console.log(`[screen] window=${w.width}×${w.height} dp scale=${w.scale}`)
  }
  const tabHost = useTabHost({ shell: 'expo', platform: Platform.OS, version })

  const router = useMemo(
    () =>
      createHostRouter({
        methods: tabHost.methods,
        send: (envelope) => {
          chromeRef.current?.injectJavaScript('window.__nexusHostDeliver(' + JSON.stringify(envelope) + ');true;')
        }
      }),
    [tabHost.methods]
  )

  // Same handler set as @nexus/desktop's tabManager.mjs — `handlers` comes
  // from useTabHost so both shells run byte-identical substrate business
  // logic, just wired to a different transport (injectJavaScript vs. IPC).
  const substrateHost = useMemo(
    () =>
      createSubstrateHost({
        handlers: tabHost.handlers,
        send: (envelope, ctx) => {
          ctx?.ref?.injectJavaScript('window.__nexusDeliver(' + JSON.stringify(envelope) + ');true;')
        }
      }),
    [tabHost.handlers]
  )

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <View style={[styles.layer, { zIndex: 0 }]}>
        <ChromeHost
          ref={chromeRef}
          onMessage={(data) => {
            if (__DEV__ && data.includes('__probe')) console.log('[probe] from chrome: ' + data)
            router.handle(data)
          }}
        />
      </View>
      {/* pointerEvents box-none: this layer's own bounds cover the full screen,
          but only the individual tab WebViews inside it (each opting in via its
          own pointerEvents) should ever intercept a touch — otherwise gaps
          around/below tabs (e.g. the chrome's own address bar) would be dead
          to touch even though no tab is actually there. */}
      <View style={[styles.layer, { zIndex: 1 }]} pointerEvents="box-none">
        <TabLayer
          tabs={tabHost.tabs}
          registerRef={tabHost.registerRef}
          onTabMessage={tabHost.onTabMessage}
          emit={router.emit}
          substrateHost={substrateHost}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject }
})
