import React, { forwardRef } from 'react'
import { Platform } from 'react-native'
import WebView from 'react-native-webview'
import { buildChromeBridgeScript } from '@nexus/bridge'
import { CHROME_URL } from './config'

export interface ChromeHostProps {
  onMessage: (data: string) => void
}

/**
 * The chrome: one full-screen WebView loading the real Next.js DOM UI. Sits at
 * zIndex 0 (App.tsx positions the wrapping View); tab WebViews always paint
 * above it since native layers sit above a WebView's content regardless of
 * z-index (ARCHITECTURE.md, "known limitations").
 *
 * The ref is forwarded so App.tsx can injectJavaScript host-router
 * responses/events into this WebView — RN WebView's postMessage bridge is
 * one-way (page -> native), so delivery back to the page has to be an
 * injected call, not a return value.
 */
const ChromeHost = forwardRef<WebView, ChromeHostProps>(function ChromeHost({ onMessage }, ref) {
  // Built from @nexus/bridge's source STRING, never a stringified function — Hermes
  // discards function source and would hand the page a `[bytecode]` stub. `npm run check`
  // guards this; it is not something to re-verify by hand.
  // Everything this shell answers. The Electron shell declares a shorter list, and
  // the chrome renders to whichever it is handed rather than assuming.
  const bridgeScript = buildChromeBridgeScript({
    shell: 'expo',
    platform: Platform.OS,
    capabilities: ['tabs', 'wallet', 'pay', 'tx', 'scan', 'share', 'nearby', 'overlay', 'settings']
  })

  return (
    <WebView
      ref={ref}
      source={{ uri: CHROME_URL }}
      injectedJavaScriptBeforeContentLoaded={bridgeScript}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      // Native feel. The UI also declares maximumScale/userScalable in its viewport, but a
      // chrome that is ever served from somewhere else must not be able to opt back in:
      // pinch-zooming the app frame is the single clearest tell that it is a web page.
      scalesPageToFit={false}
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      bounces={false}
      overScrollMode="never"
      // The chrome is the app frame, not a document: it should not rubber-band or show
      // scrollbars. Individual panes inside it scroll on their own.
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  )
})

export default ChromeHost
