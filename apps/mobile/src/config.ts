import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { bundleDirectory } from 'expo-file-system/legacy'

/**
 * Where the chrome (the Nexus DOM UI) is loaded from.
 *
 * Default is the copy bundled inside the app by plugins/withBundledUi.js, so the app has
 * no network dependency and the UI ships in lockstep with the binary that was tested.
 *
 * Overrides, in order:
 *   EXPO_PUBLIC_CHROME_URL   inlined at bundle time — point at the local harness, a branch
 *                            preview, or a colleague's machine without editing app.json
 *   extra.chromeUrl          a URL in app.json; the literal "bundled" selects the built-in
 */
function resolveChromeUrl(): string {
  const override = process.env.EXPO_PUBLIC_CHROME_URL
  if (override) return override

  const configured = Constants.expoConfig?.extra?.chromeUrl as string | undefined
  if (configured && configured !== 'bundled') return configured

  // Android bundles assets under a fixed virtual path; iOS exposes the real bundle dir.
  if (Platform.OS === 'android') return 'file:///android_asset/ui/index.html'
  if (bundleDirectory) {
    // bundleDirectory has been observed returning a bare path with no scheme. A WebView
    // given a bare path may resolve it, or may silently treat it as a relative URL — so
    // normalise rather than depend on which.
    const base = bundleDirectory.startsWith('file://') ? bundleDirectory : `file://${bundleDirectory}`
    return `${base.endsWith('/') ? base : base + '/'}ui/index.html`
  }

  // Bare workflow / unexpected platform: fail visibly rather than showing a blank WebView.
  console.warn('config: no bundleDirectory available; falling back to the local harness')
  return 'http://localhost:8099'
}

export const CHROME_URL: string = resolveChromeUrl()

if (__DEV__) {
  // Which chrome a build is actually running is the first question asked whenever the app
  // looks wrong, and it is invisible from the UI itself.
  console.log(`[chrome-url] ${CHROME_URL}`)
}
