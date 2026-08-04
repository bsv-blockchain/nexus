import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

/**
 * The one place the shell puts a native screen in front of the chrome.
 *
 * Three things the DOM chrome cannot do — read a camera, drive the local radios,
 * open a share sheet — have to happen in React Native. Rather than each of them
 * inventing its own presentation, they all go through here: the chrome calls a
 * bridge method, the method opens a modal and awaits it, and the modal's result
 * becomes the method's return value.
 *
 *   chrome                        shell
 *   ──────                        ─────
 *   nexusHost.scan.qr(opts)  ──►  scan.qr method
 *                                 → present(<QRScanner …/>)   (awaits)
 *                                 ← resolve({ text })
 *                            ◄──  { text, target }
 *
 * ONE AT A TIME, deliberately. A second modal while one is open would leave the
 * first one's promise dangling forever, and the caller has no way to notice. The
 * second call is refused instead, which is a bug the caller can see.
 *
 * While anything is presented the tab layer must stand down — a native tab WebView
 * paints above everything in this app, including this. `onPresentedChange` is how
 * the shell tells the tab layer, using the same suppression the chrome's own
 * overlays use rather than a second mechanism that could disagree with it.
 */

export interface NativeModalApi {
  /**
   * Show a native screen and wait for it to finish.
   *
   * `render` receives the resolver. Call it exactly once — with the result, or
   * with the cancellation shape the caller expects. Failing to call it hangs the
   * bridge request until its timeout, which is why every caller in this app
   * resolves from its own onClose as well as its success path.
   */
  present<T>(render: (resolve: (value: T) => void) => React.ReactNode): Promise<T>
  /** True while a modal is up. Read by the shell to suppress the tab layer. */
  isPresenting: boolean
}

const NativeModalContext = createContext<NativeModalApi>({
  present: async () => {
    throw new Error('no native modal host is mounted')
  },
  isPresenting: false
})

export function useNativeModal(): NativeModalApi {
  return useContext(NativeModalContext)
}

export default function NativeModalHost({
  children,
  onPresentedChange
}: {
  children: React.ReactNode
  /** Called whenever a modal opens or closes, so the shell can hide the tab layer. */
  onPresentedChange?: (presented: boolean) => void
}) {
  const [content, setContent] = useState<React.ReactNode | null>(null)

  // The live resolver, held in a ref rather than state: resolving must not wait
  // for a render, and a stale copy would resolve the wrong request.
  const pendingRef = useRef<{ settle: (value: any) => void; fail: (err: Error) => void } | null>(null)
  const presentingRef = useRef(false)

  const notify = useCallback(
    (presented: boolean) => {
      presentingRef.current = presented
      onPresentedChange?.(presented)
    },
    [onPresentedChange]
  )

  const present = useCallback(
    <T,>(render: (resolve: (value: T) => void) => React.ReactNode): Promise<T> => {
      if (presentingRef.current) {
        return Promise.reject(new Error('a native screen is already open'))
      }
      return new Promise<T>((resolve, reject) => {
        // Settle-once: a modal that resolves from both its success path and its
        // dismiss handler is normal, not a bug, so the second call is ignored
        // rather than throwing somewhere the caller cannot see.
        let settled = false
        const settle = (value: T) => {
          if (settled) return
          settled = true
          pendingRef.current = null
          setContent(null)
          notify(false)
          resolve(value)
        }
        let node: React.ReactNode
        try {
          // Rendered BEFORE anything is latched. A render() that throws would
          // otherwise leave `presenting` true with nothing on screen to close it,
          // and every later present() would be refused for a modal that does not
          // exist — the host would be bricked for the life of the process.
          node = render(settle)
        } catch (err) {
          reject(err)
          return
        }
        pendingRef.current = { settle: settle as (value: any) => void, fail: reject }
        notify(true)
        setContent(node)
      })
    },
    [notify]
  )

  // If the host itself goes away mid-present — a provider remount, an error
  // boundary, a key change upstream — the awaiting bridge request would hang
  // until its own timeout with no screen left to settle it. Reject instead, so
  // the caller learns immediately and can say why.
  useEffect(
    () => () => {
      const pending = pendingRef.current
      pendingRef.current = null
      presentingRef.current = false
      pending?.fail(new Error('the native screen was torn down before it finished'))
    },
    []
  )

  const api = useMemo<NativeModalApi>(
    () => ({ present, isPresenting: content !== null }),
    [present, content]
  )

  return (
    <NativeModalContext.Provider value={api}>
      {children}
      {content !== null && (
        // A plain absolutely-positioned layer, not RN's <Modal>. Modal presents in
        // its own window, which on iOS sits above everything the shell controls —
        // including the tab layer we are trying to coordinate with. Staying inside
        // the shell's own view tree keeps one stacking order.
        <View style={styles.layer} pointerEvents="auto">
          {content}
        </View>
      )}
    </NativeModalContext.Provider>
  )
}

const styles = StyleSheet.create({
  // zIndex 2: above TabLayer (1), which is above the chrome (0).
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: '#000' }
})
