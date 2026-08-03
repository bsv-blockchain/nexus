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
/**
 * Probe for the two ways document-start injection can silently fail on RN:
 *   1. Hermes returns `function () { [bytecode] }` from Function.prototype.toString(),
 *      which would make the stringified client garbage.
 *   2. `injectedJavaScriptBeforeContentLoaded` never fires at all.
 * The first is checked here in RN; the second announces itself from inside the page.
 */
const PROBE_BEFORE = `window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({__probe:'before-content',hasHost:typeof window.nexusHost}));`

const ChromeHost = forwardRef<WebView, ChromeHostProps>(function ChromeHost({ onMessage }, ref) {
  const bridgeScript = buildChromeBridgeScript({ shell: 'expo', platform: Platform.OS })
  if (__DEV__) {
    console.log(
      `[probe] chrome script len=${bridgeScript.length} bytecode=${/\[bytecode\]|native code/.test(bridgeScript)} head=${bridgeScript
        .slice(0, 100)
        .replace(/\n/g, ' ')}`
    )
  }

  return (
    <WebView
      ref={ref}
      source={{ uri: CHROME_URL }}
      injectedJavaScriptBeforeContentLoaded={PROBE_BEFORE + bridgeScript}
      injectedJavaScript={`window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({__probe:'after-content',hasHost:typeof window.nexusHost}));true;`}
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
