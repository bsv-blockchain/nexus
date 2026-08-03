import React, { useMemo, useRef } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
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
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  )
}

function Shell() {
  const chromeRef = useRef<WebView>(null)
  // A hosted chrome is a website: it cannot know it is running full-bleed under a notch,
  // and we cannot patch someone else's deployment. So the shell insets it. Our own UI can
  // later opt back into edge-to-edge by handling env(safe-area-inset-*) itself.
  const insets = useSafeAreaInsets()

  // Mirrors Electron's app.getVersion(): one value read from the app's own
  // manifest, reused for both host.info and the substrate getVersion handler.
  const version = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0-spike'
  const win = useWindowDimensions()
  const tabHost = useTabHost({
    shell: 'expo',
    platform: Platform.OS,
    version,
    chromeSize: {
      width: win.width - insets.left - insets.right,
      height: win.height - insets.top - insets.bottom
    }
  })

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
      <StatusBar style="light" />
      <View
        style={[
          styles.layer,
          { zIndex: 0, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }
        ]}
      >
        <ChromeHost ref={chromeRef} onMessage={(data) => router.handle(data)} />
      </View>
      {/* pointerEvents box-none: this layer's own bounds cover the full screen,
          but only the individual tab WebViews inside it (each opting in via its
          own pointerEvents) should ever intercept a touch — otherwise gaps
          around/below tabs (e.g. the chrome's own address bar) would be dead
          to touch even though no tab is actually there. */}
      {/* Inset identically to the chrome. Tab rects arrive in the chrome document's
          coordinate space, so if the chrome starts below the notch and the tab layer
          does not, every tab lands high by exactly inset.top. */}
      <View
        style={[
          styles.layer,
          { zIndex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }
        ]}
        pointerEvents="box-none"
        onLayout={(e) => {
          // If this layer is not at 0,0 covering the screen, every tab inherits the
          // offset and no amount of correct rect maths will land them right.
          const l = e.nativeEvent.layout
          if (__DEV__) {
            console.log(
              `[layout] tab-layer ${Math.round(l.x)},${Math.round(l.y)} ${Math.round(l.width)}×${Math.round(l.height)}`
            )
          }
        }}
      >
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
  // The inset strips around the chrome are ours to paint. Left default they render
  // white, which flashes against a dark UI on every launch and rotation.
  root: { flex: 1, backgroundColor: '#1A0E31' },
  layer: { ...StyleSheet.absoluteFillObject }
})
