/**
 * Shims for the two things the ported wallet expects from a React Native UI that Nexus
 * does not have: a native toast, and expo-router screen navigation.
 *
 * In BSV Browser the wallet and the UI are the same React tree, so it could call
 * showToast() and router.push() directly. In Nexus the UI is a DOM document in a WebView,
 * so both become events the shell emits over @nexus/bridge and the chrome reacts to.
 *
 * Deliberately a sink rather than an import of the router: this module is imported deep in
 * the wallet, and reaching back up for the bridge from there would tie the wallet to the
 * shell. App.tsx installs the sink at startup; before that, calls degrade to a log rather
 * than throwing — losing a toast must never take down a wallet operation.
 */
export type ToastKind = 'info' | 'success' | 'error'

export interface ShellUiSink {
  toast: (message: string, kind: ToastKind) => void
  navigate: (path: string, options?: { reset?: boolean }) => void
}

let sink: ShellUiSink | null = null

export function setShellUiSink(next: ShellUiSink | null): void {
  sink = next
}

/**
 * Signature matches BSV Browser's components/ui/Toast.tsx exactly —
 * `showToast(msg)` and `showToast(msg, { type: 'error' })` — so the ported call sites need
 * no edits. Changing proven code to suit a shim would be the wrong way round.
 */
export function showToast(message: string, opts?: { type?: ToastKind }): void {
  const kind = opts?.type ?? 'info'
  if (!sink) {
    console.warn(`[shell-ui] toast before sink installed: ${kind}: ${message}`)
    return
  }
  try {
    sink.toast(message, kind)
  } catch (err) {
    console.warn('[shell-ui] toast sink threw', err)
  }
}

/**
 * Replaces expo-router. `reset: true` is the dismissAll()+push('/') pattern the wallet uses
 * on logout: tear the stack down and return to the root, so no authenticated screen is
 * reachable with a back gesture.
 */
export function navigate(path: string, options?: { reset?: boolean }): void {
  if (!sink) {
    console.warn(`[shell-ui] navigate before sink installed: ${path}`)
    return
  }
  try {
    sink.navigate(path, options)
  } catch (err) {
    console.warn('[shell-ui] navigate sink threw', err)
  }
}
