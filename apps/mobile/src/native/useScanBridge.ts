import { createElement, useMemo } from 'react'

import { classifyScan, type PayTarget } from '@nexus/wallet-core/src/utils/pay/rails'

import QRScanner from './QRScanner'
import { useNativeModal } from './NativeModalHost'

/**
 * The camera, as the DOM chrome sees it.
 *
 * A document in a WebView cannot open a camera the shell's tab layer would not
 * paint over, so `nexusHost.scan.qr()` becomes a native screen: this method opens
 * QRScanner through NativeModalHost, awaits it, and returns what the user pointed
 * the phone at. One bridge call in, one scan or one cancellation out.
 *
 * The scanner itself knows nothing about payments — see QRScanner's own note. All
 * this file adds is the question the caller actually asked: "is that string one of
 * these kinds of thing?", answered by classifyScan, which is the single place in
 * the codebase where a scanned string becomes a rail.
 */

/** The kinds classifyScan can name. Not a separate vocabulary — derived from its output. */
export type ScanKind = PayTarget['kind']

export type ScanResult = { text: string; target: PayTarget | null } | { cancelled: true }

const SCAN_KINDS: readonly ScanKind[] = ['address', 'handle', 'nearby'] as const

function isScanKind(value: unknown): value is ScanKind {
  return typeof value === 'string' && (SCAN_KINDS as readonly string[]).includes(value)
}

/**
 * The caller's accept list, or null for "anything".
 *
 * An `accept` array that survives filtering as empty is refused rather than
 * honoured. Honouring it means a scanner that can never resolve: the camera runs,
 * every frame is silently rejected, and the user's only exit is cancelling a screen
 * that looked like it was working. A caller asking for a kind this shell cannot
 * classify — a Shamir slice, say — should find that out at the call, not by
 * watching a dead viewfinder.
 */
function normalizeAccept(raw: unknown): ScanKind[] | null {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw)) throw new Error('scan.qr: accept must be an array of scan kinds')
  const kinds = raw.filter(isScanKind)
  if (kinds.length === 0) {
    throw new Error(`scan.qr: no recognised scan kind in accept (known kinds: ${SCAN_KINDS.join(', ')})`)
  }
  return kinds
}

export function useScanBridge(): Record<string, (params: any) => any> {
  const { present } = useNativeModal()

  return useMemo<Record<string, (params: any) => any>>(
    () => ({
      /**
       * Scan one code. Resolves `{ text, target }` on the first acceptable read,
       * or `{ cancelled: true }` if the user backs out.
       *
       * `target` is classifyScan's output, so a caller wanting an address does not
       * re-parse the string — and cannot reach a different verdict than the rail
       * code will when it comes to spend against it.
       */
      'scan.qr': async (params: { accept?: unknown; hint?: unknown; multi?: unknown } | null): Promise<ScanResult> => {
        const accept = normalizeAccept(params?.accept)
        const hint = typeof params?.hint === 'string' && params.hint ? params.hint : undefined

        return present<ScanResult>((resolve) =>
          createElement(QRScanner, {
            hintText: hint,
            // Re-arm after every read whenever a read can be rejected. In its
            // single-scan mode QRScanner stops the camera permanently on the first
            // barcode it sees, so one wrong code — a URL on the same poster, a
            // handle when the caller wanted an address — would brick the screen.
            // An unaccepted frame is not an error; it is a frame the user has not
            // shown us yet.
            multiScan: accept !== null || Boolean(params?.multi),
            onScan: (text: string) => {
              const target = classifyScan(text)
              // Ignore, do not reject: resolving with a refusal would close the
              // scanner and make the chrome re-open it to try again.
              if (accept && !(target && accept.includes(target.kind))) return
              resolve({ text, target })
            },
            // The modal must settle on dismissal too. present() hands out one
            // resolver and nothing else calls it, so a close that resolves nothing
            // leaves the chrome's request hanging until its ten-minute timeout.
            onClose: () => resolve({ cancelled: true })
          })
        )
      }
    }),
    [present]
  )
}
