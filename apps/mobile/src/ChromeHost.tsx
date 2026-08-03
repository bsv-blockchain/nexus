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
  const bridgeScript = buildChromeBridgeScript({ shell: 'expo', platform: Platform.OS })

  return (
    <WebView
      ref={ref}
      source={{ uri: CHROME_URL }}
      injectedJavaScriptBeforeContentLoaded={bridgeScript}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      setBuiltInZoomControls={false}
      overScrollMode="never"
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  )
})

export default ChromeHost
